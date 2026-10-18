import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export class ProcessingError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ProcessingError";
    this.code = code;
  }
}

const SIGNALS = [
  ["acceleration", "m/s²", ["acceleration_x_m_s2", "acceleration_y_m_s2", "acceleration_z_m_s2"]],
  ["angularVelocity", "deg/s", ["angular_velocity_x_deg_s", "angular_velocity_y_deg_s", "angular_velocity_z_deg_s"]],
  ["magneticField", "µT", ["magnetic_field_x_uT", "magnetic_field_y_uT", "magnetic_field_z_uT"]],
];

function containedPath(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function parseCsvLine(line) {
  const fields = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      fields.push(value);
      value = "";
    } else {
      value += character;
    }
  }
  if (quoted) {
    throw new ProcessingError("INVALID_CSV", "The recording contains an unterminated quoted field.");
  }
  fields.push(value);
  return fields;
}

function manifestPath(governedRoot, recordingId) {
  const date = recordingId.slice(0, 8);
  if (!/^\d{8}$/.test(date)) {
    throw new ProcessingError("INVALID_RECORDING_ID", "Recording ID must begin with YYYYMMDD.");
  }
  const dateFolder = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  return path.join(governedRoot, "manifests", dateFolder, `${recordingId}.json`);
}

function validateManifest(manifest, governedRoot, recordingId) {
  if (
    !manifest ||
    manifest.format !== "movesense-opensense-raw-recording" ||
    manifest.version !== 1 ||
    manifest.recordingId !== recordingId ||
    !manifest.acquisition ||
    !manifest.protocol ||
    !manifest.dataFile ||
    typeof manifest.dataFile.path !== "string" ||
    typeof manifest.dataFile.sha256 !== "string"
  ) {
    throw new ProcessingError("INVALID_MANIFEST", "The selected recording manifest is invalid.");
  }
  if (!containedPath(governedRoot, manifest.dataFile.path)) {
    throw new ProcessingError(
      "DATA_OUTSIDE_GOVERNED_ROOT",
      "The recording data path is outside the configured governed-storage root.",
    );
  }
}

function downsample(rows, limit = 800) {
  if (rows.length <= limit) {
    return rows;
  }
  const sampled = [];
  for (let index = 0; index < limit; index += 1) {
    sampled.push(rows[Math.round((index * (rows.length - 1)) / (limit - 1))]);
  }
  return sampled;
}

function dataLines(text, artifactName) {
  const lines = text.split(/\r?\n/);
  const headerEnd = lines.findIndex((line) => line.trim().toLowerCase() === "endheader");
  if (headerEnd < 0 || headerEnd + 2 >= lines.length) {
    throw new ProcessingError(
      "INVALID_OPENSENSE_ARTIFACT",
      `${artifactName} does not contain a valid OpenSim header and data table.`,
    );
  }
  return lines.slice(headerEnd + 1).filter((line) => line.trim());
}

function unwrapDegrees(angle, previous) {
  let unwrapped = angle;
  while (unwrapped - previous > 180) unwrapped -= 360;
  while (unwrapped - previous < -180) unwrapped += 360;
  return unwrapped;
}

export function parseOpenSenseVisualization(orientationsText, motionText, estimator) {
  const orientationLines = dataLines(orientationsText, "Quaternion STO");
  const motionLines = dataLines(motionText, "IK motion");
  const orientationColumns = orientationLines.shift().trim().split(/\s+/);
  const motionColumns = motionLines.shift().trim().split(/\s+/);
  const frameIndex = orientationColumns.indexOf(
    `forearm_${estimator.side === "left" ? "l" : "r"}_imu`,
  );
  const coordinateIndex = motionColumns.indexOf(estimator.coordinateName);
  const componentIndex = { x: 1, y: 2, z: 3 }[estimator.modelQuaternionAxis];
  if (frameIndex < 1 || coordinateIndex < 1 || componentIndex === undefined) {
    throw new ProcessingError(
      "INVALID_OPENSENSE_ARTIFACT",
      "OpenSense artifact columns do not match the processing manifest.",
    );
  }

  const sourceRows = orientationLines.map((line) => {
    const fields = line.trim().split(/\s+/);
    const quaternion = fields[frameIndex].split(",").map(Number);
    if (quaternion.length !== 4 || !quaternion.every(Number.isFinite)) {
      throw new ProcessingError(
        "INVALID_OPENSENSE_ARTIFACT",
        "Quaternion STO contains an invalid quaternion.",
      );
    }
    return {
      timeSeconds: Number(fields[0]),
      wrappedAngleDegrees: (2 * Math.atan2(quaternion[componentIndex], quaternion[0]) * 180) / Math.PI,
    };
  });
  const motionRows = motionLines.map((line) => {
    const fields = line.trim().split(/\s+/).map(Number);
    return {
      timeSeconds: fields[0],
      angleDegrees: fields[coordinateIndex],
    };
  });
  if (
    sourceRows.length !== motionRows.length ||
    sourceRows.length < 2 ||
    sourceRows.some((row) => !Number.isFinite(row.timeSeconds)) ||
    motionRows.some((row) => !Number.isFinite(row.timeSeconds) || !Number.isFinite(row.angleDegrees))
  ) {
    throw new ProcessingError(
      "INVALID_OPENSENSE_ARTIFACT",
      "OpenSense orientation and IK motion samples are invalid or unsynchronized.",
    );
  }

  let previousAngle = sourceRows[0].wrappedAngleDegrees;
  const frames = sourceRows.map((source, index) => {
    const sourceAngleDegrees =
      index === 0 ? source.wrappedAngleDegrees : unwrapDegrees(source.wrappedAngleDegrees, previousAngle);
    previousAngle = sourceAngleDegrees;
    const motion = motionRows[index];
    if (Math.abs(source.timeSeconds - motion.timeSeconds) > 0.000_001) {
      throw new ProcessingError(
        "INVALID_OPENSENSE_ARTIFACT",
        "OpenSense orientation and IK motion timestamps are not synchronized.",
      );
    }
    return {
      timeSeconds: source.timeSeconds,
      sourceAngleDegrees,
      ikAngleDegrees: motion.angleDegrees,
      errorDegrees: motion.angleDegrees - sourceAngleDegrees,
    };
  });
  return {
    motionType: estimator.motionType,
    side: estimator.side,
    coordinateName: estimator.coordinateName,
    durationSeconds: frames.at(-1).timeSeconds,
    frames: downsample(frames, 700),
  };
}

function rangeFor(rows, key) {
  return [0, 1, 2].map((axis) => ({
    min: Math.min(...rows.map((row) => row[key][axis])),
    max: Math.max(...rows.map((row) => row[key][axis])),
  }));
}

function vectorMagnitude(values) {
  return Math.hypot(...values);
}

function mean(values) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function standardDeviation(values, average) {
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function summarizeCalibration(rows, firstSensorMs, calibration) {
  const selected = rows.filter((row) => {
    const seconds = (row.sensorTimestampMs - firstSensorMs) / 1000;
    return seconds >= calibration.startSeconds && seconds <= calibration.endSeconds;
  });
  if (selected.length === 0) {
    return {
      sampleCount: 0,
      durationSeconds: calibration.endSeconds - calibration.startSeconds,
    };
  }
  const accelerationMagnitudes = selected.map((row) => vectorMagnitude(row.acceleration));
  const angularVelocityMagnitudes = selected.map((row) => vectorMagnitude(row.angularVelocity));
  const magneticFieldMagnitudes = selected.map((row) => vectorMagnitude(row.magneticField));
  const accelerationMean = mean(accelerationMagnitudes);
  const angularVelocityMean = mean(angularVelocityMagnitudes);
  const magneticFieldMean = mean(magneticFieldMagnitudes);
  return {
    sampleCount: selected.length,
    durationSeconds: calibration.endSeconds - calibration.startSeconds,
    accelerationMagnitude: {
      mean: accelerationMean,
      standardDeviation: standardDeviation(accelerationMagnitudes, accelerationMean),
    },
    angularVelocityMagnitude: {
      mean: angularVelocityMean,
      standardDeviation: standardDeviation(angularVelocityMagnitudes, angularVelocityMean),
      maximum: Math.max(...angularVelocityMagnitudes),
    },
    magneticFieldMagnitude: {
      mean: magneticFieldMean,
      standardDeviation: standardDeviation(magneticFieldMagnitudes, magneticFieldMean),
    },
  };
}

function summarizeOneDof(rows, firstSensorMs, calibration, annotations, mapping) {
  const calibrationRows = rows.filter((row) => {
    const seconds = (row.sensorTimestampMs - firstSensorMs) / 1000;
    return seconds >= calibration.startSeconds && seconds <= calibration.endSeconds;
  });
  const movement = annotations[0] ?? {
    startSeconds: calibration.endSeconds,
    endSeconds: (rows.at(-1).sensorTimestampMs - firstSensorMs) / 1000,
  };
  const movementRows = rows.filter((row) => {
    const seconds = (row.sensorTimestampMs - firstSensorMs) / 1000;
    return seconds >= movement.startSeconds && seconds <= movement.endSeconds;
  });
  if (calibrationRows.length < 2 || movementRows.length < 2) {
    return null;
  }
  const biases = [0, 1, 2].map((axis) =>
    mean(calibrationRows.map((row) => row.angularVelocity[axis])),
  );
  const rms = [0, 1, 2].map((axis) =>
    Math.sqrt(mean(movementRows.map((row) => (row.angularVelocity[axis] - biases[axis]) ** 2))),
  );
  const energy = rms.map((value) => value ** 2);
  const dominantAxisIndex = energy.indexOf(Math.max(...energy));
  const dominantAxis = ["x", "y", "z"][dominantAxisIndex];
  const calibrationAxisValues = calibrationRows.map(
    (row) => row.angularVelocity[dominantAxisIndex],
  );
  const calibrationAxisMean = biases[dominantAxisIndex];
  const calibrationAxisSd = standardDeviation(calibrationAxisValues, calibrationAxisMean);
  const threshold = Math.max(10, calibrationAxisSd * 3);
  const firstExcursion = movementRows.find(
    (row) => Math.abs(row.angularVelocity[dominantAxisIndex] - calibrationAxisMean) >= threshold,
  );
  const initialSensorSign = firstExcursion
    ? Math.sign(firstExcursion.angularVelocity[dominantAxisIndex] - calibrationAxisMean)
    : 0;
  let multiplier = null;
  if (
    initialSensorSign !== 0 &&
    mapping &&
    ["pronation", "supination", "flexion", "extension"].includes(mapping.firstMovement)
  ) {
    const intendedSign = ["pronation", "flexion"].includes(mapping.firstMovement) ? 1 : -1;
    multiplier = intendedSign / initialSensorSign;
  }

  let angle = 0;
  const angleRows = [{
    timeSeconds: movement.startSeconds,
    sensorAngleDegrees: 0,
    anatomicalAngleDegrees: multiplier === null ? null : 0,
  }];
  for (let index = 1; index < movementRows.length; index += 1) {
    const previous = movementRows[index - 1];
    const current = movementRows[index];
    const deltaSeconds = (current.sensorTimestampMs - previous.sensorTimestampMs) / 1000;
    const previousRate = previous.angularVelocity[dominantAxisIndex] - calibrationAxisMean;
    const currentRate = current.angularVelocity[dominantAxisIndex] - calibrationAxisMean;
    angle += ((previousRate + currentRate) / 2) * deltaSeconds;
    angleRows.push({
      timeSeconds: (current.sensorTimestampMs - firstSensorMs) / 1000,
      sensorAngleDegrees: angle,
      anatomicalAngleDegrees: multiplier === null ? null : angle * multiplier,
    });
  }
  const sensorAngles = angleRows.map((row) => row.sensorAngleDegrees);
  const anatomicalAngles = angleRows
    .map((row) => row.anatomicalAngleDegrees)
    .filter((value) => value !== null);
  return {
    movement,
    dominantAxis,
    dominantAxisIndex,
    axisEnergyFraction: energy[dominantAxisIndex] / energy.reduce((total, value) => total + value, 0),
    gyroscopeBiasDegS: biases,
    movementRmsDegS: rms,
    initialSensorSign,
    initialSensorDirection: initialSensorSign > 0 ? "positive" : initialSensorSign < 0 ? "negative" : "undetected",
    anatomicalPositiveDirection: mapping?.positiveDirection ?? "unassigned",
    mappingAssigned: multiplier !== null,
    sensorAngle: {
      minimum: Math.min(...sensorAngles),
      maximum: Math.max(...sensorAngles),
      final: sensorAngles.at(-1),
    },
    anatomicalAngle: anatomicalAngles.length
      ? {
          minimum: Math.min(...anatomicalAngles),
          maximum: Math.max(...anatomicalAngles),
          final: anatomicalAngles.at(-1),
        }
      : null,
    plot: downsample(angleRows),
  };
}

export async function listRecordings(governedRoot) {
  if (typeof governedRoot !== "string" || !path.isAbsolute(governedRoot)) {
    throw new ProcessingError("NOT_CONFIGURED", "Configure an absolute governed-storage root first.");
  }
  const manifestsRoot = path.join(governedRoot, "manifests");
  try {
    const dates = await readdir(manifestsRoot, { withFileTypes: true });
    const recordings = [];
    for (const date of dates.filter((entry) => entry.isDirectory())) {
      const directory = path.join(manifestsRoot, date.name);
      const files = await readdir(directory, { withFileTypes: true });
      for (const file of files.filter((entry) => entry.isFile() && entry.name.endsWith(".json"))) {
        try {
          const manifest = JSON.parse(await readFile(path.join(directory, file.name), "utf8"));
          if (
            manifest.format === "movesense-opensense-raw-recording" &&
            manifest.version === 1 &&
            typeof manifest.recordingId === "string"
          ) {
            recordings.push({
              recordingId: manifest.recordingId,
              startedAt: manifest.startedAt,
              movement: manifest.protocol?.movement ?? "unknown",
              placement: manifest.protocol?.placement ?? "unknown",
              sampleCount: manifest.acquisition?.sampleCount ?? null,
            });
          }
        } catch (error) {
          if (error?.code === "EACCES") {
            throw error;
          }
        }
      }
    }
    return recordings.sort((left, right) => String(right.startedAt).localeCompare(String(left.startedAt)));
  } catch (error) {
    if (error instanceof ProcessingError) {
      throw error;
    }
    if (error?.code === "ENOENT") {
      throw new ProcessingError("MANIFESTS_NOT_FOUND", "The governed root has no manifests directory.");
    }
    throw new ProcessingError("RECORDING_LIST_FAILED", `Could not list recordings: ${error.message}`);
  }
}

export async function loadOpenSenseResult(governedRoot, recordingId) {
  if (typeof governedRoot !== "string" || !path.isAbsolute(governedRoot)) {
    throw new ProcessingError("NOT_CONFIGURED", "Configure an absolute governed-storage root first.");
  }
  const date = recordingId.slice(0, 8);
  if (!/^\d{8}$/.test(date)) {
    throw new ProcessingError("INVALID_RECORDING_ID", "Recording ID must begin with YYYYMMDD.");
  }
  const dateFolder = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  const resultPath = path.join(
    governedRoot,
    "derived",
    dateFolder,
    recordingId,
    "opensense-one-dof",
    "processing-manifest.json",
  );
  try {
    const manifest = JSON.parse(await readFile(resultPath, "utf8"));
    if (
      manifest.format !== "movesense-opensense-one-dof-processing" ||
      manifest.version !== 1 ||
      !manifest.outputs ||
      !manifest.validation
    ) {
      throw new ProcessingError(
        "INVALID_PROCESSING_RESULT",
        "The OpenSense processing manifest is invalid.",
      );
    }
    const artifactContents = {};
    for (const [name, artifact] of Object.entries(manifest.outputs)) {
      if (
        !artifact ||
        typeof artifact.path !== "string" ||
        typeof artifact.sha256 !== "string" ||
        !containedPath(governedRoot, artifact.path)
      ) {
        throw new ProcessingError(
          "INVALID_PROCESSING_RESULT",
          "An OpenSense artifact path is invalid or outside governed storage.",
        );
      }
      const bytes = await readFile(artifact.path);
      if (createHash("sha256").update(bytes).digest("hex") !== artifact.sha256) {
        throw new ProcessingError(
          "PROCESSING_CHECKSUM_MISMATCH",
          `OpenSense artifact checksum mismatch: ${path.basename(artifact.path)}`,
        );
      }
      artifactContents[name] = bytes;
    }
    const visualization = parseOpenSenseVisualization(
      artifactContents.orientationsSto.toString("utf8"),
      artifactContents.inverseKinematicsMotion.toString("utf8"),
      manifest.estimator,
    );
    return {
      manifestPath: resultPath,
      visualization,
      ...manifest,
    };
  } catch (error) {
    if (error instanceof ProcessingError) {
      throw error;
    }
    if (error?.code === "ENOENT") {
      return null;
    }
    if (error instanceof SyntaxError) {
      throw new ProcessingError(
        "INVALID_PROCESSING_RESULT",
        "The OpenSense processing manifest is not valid JSON.",
      );
    }
    throw new ProcessingError(
      "PROCESSING_RESULT_READ_FAILED",
      `Could not read OpenSense results: ${error.message}`,
    );
  }
}

export async function analyzeRecording(
  governedRoot,
  recordingId,
  calibration = null,
  annotations = [],
  oneDofMapping = null,
) {
  if (typeof governedRoot !== "string" || !path.isAbsolute(governedRoot)) {
    throw new ProcessingError("NOT_CONFIGURED", "Configure an absolute governed-storage root first.");
  }
  const selectedManifestPath = manifestPath(governedRoot, recordingId);
  let manifest;
  let csvBuffer;
  try {
    manifest = JSON.parse(await readFile(selectedManifestPath, "utf8"));
    validateManifest(manifest, governedRoot, recordingId);
    csvBuffer = await readFile(manifest.dataFile.path);
  } catch (error) {
    if (error instanceof ProcessingError) {
      throw error;
    }
    if (error?.code === "ENOENT") {
      throw new ProcessingError("RECORDING_NOT_FOUND", "The selected governed recording was not found.");
    }
    if (error instanceof SyntaxError) {
      throw new ProcessingError("INVALID_MANIFEST", "The selected manifest is not valid JSON.");
    }
    throw new ProcessingError("RECORDING_READ_FAILED", `Could not read the recording: ${error.message}`);
  }

  const text = csvBuffer.toString("utf8").trim();
  const lines = text.split(/\r?\n/);
  const headers = parseCsvLine(lines.shift() ?? "");
  const required = [
    "sensor_timestamp_ms",
    "host_monotonic_ns",
    "host_time_ns",
    ...SIGNALS.flatMap(([, , columns]) => columns),
  ];
  const indexes = Object.fromEntries(required.map((column) => [column, headers.indexOf(column)]));
  if (Object.values(indexes).some((index) => index < 0)) {
    throw new ProcessingError("INVALID_CSV", "The recording is missing required IMU or timing columns.");
  }

  const rows = [];
  let malformedRows = 0;
  for (const line of lines) {
    const fields = parseCsvLine(line);
    const numeric = Object.fromEntries(
      required.map((column) => [column, Number(fields[indexes[column]])]),
    );
    if (Object.values(numeric).some((value) => !Number.isFinite(value))) {
      malformedRows += 1;
      continue;
    }
    rows.push({
      sensorTimestampMs: numeric.sensor_timestamp_ms,
      hostMonotonicNs: numeric.host_monotonic_ns,
      hostTimeNs: numeric.host_time_ns,
      acceleration: SIGNALS[0][2].map((column) => numeric[column]),
      angularVelocity: SIGNALS[1][2].map((column) => numeric[column]),
      magneticField: SIGNALS[2][2].map((column) => numeric[column]),
    });
  }
  if (rows.length < 2) {
    throw new ProcessingError("INSUFFICIENT_DATA", "The recording has fewer than two valid samples.");
  }

  const firstSensorMs = rows[0].sensorTimestampMs;
  const steps = rows.slice(1).map((row, index) => row.sensorTimestampMs - rows[index].sensorTimestampMs);
  const sortedSteps = [...steps].sort((left, right) => left - right);
  const spanSeconds = (rows.at(-1).sensorTimestampMs - firstSensorMs) / 1000;
  const plotted = downsample(rows).map((row) => ({
    timeSeconds: (row.sensorTimestampMs - firstSensorMs) / 1000,
    acceleration: row.acceleration,
    angularVelocity: row.angularVelocity,
    magneticField: row.magneticField,
  }));

  return {
    manifestPath: selectedManifestPath,
    dataPath: manifest.dataFile.path,
    manifest,
    integrity: {
      checksumMatches:
        createHash("sha256").update(csvBuffer).digest("hex") === manifest.dataFile.sha256,
      manifestSamples: manifest.acquisition.sampleCount,
      parsedSamples: rows.length,
      malformedRows,
    },
    timing: {
      spanSeconds,
      effectiveRateHz: (rows.length - 1) / spanSeconds,
      minimumStepMs: sortedSteps[0],
      medianStepMs: sortedSteps[Math.floor(sortedSteps.length / 2)],
      maximumStepMs: sortedSteps.at(-1),
      nonpositiveSteps: steps.filter((step) => step <= 0).length,
      gapsOver30Ms: steps.filter((step) => step > 30).length,
      repeatedHostMonotonicTimestamps: rows
        .slice(1)
        .filter((row, index) => row.hostMonotonicNs === rows[index].hostMonotonicNs).length,
    },
    ranges: Object.fromEntries(SIGNALS.map(([key]) => [key, rangeFor(rows, key)])),
    calibration:
      calibration && Number.isFinite(calibration.startSeconds) && Number.isFinite(calibration.endSeconds)
        ? summarizeCalibration(rows, firstSensorMs, calibration)
        : null,
    oneDof:
      calibration && Number.isFinite(calibration.startSeconds) && Number.isFinite(calibration.endSeconds)
        ? summarizeOneDof(rows, firstSensorMs, calibration, annotations, oneDofMapping)
        : null,
    plot: {
      axes: ["x", "y", "z"],
      signals: Object.fromEntries(SIGNALS.map(([key, unit]) => [key, { unit }])),
      rows: plotted,
    },
  };
}
