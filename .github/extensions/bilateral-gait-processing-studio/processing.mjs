import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const ROLES = ["left_distal_shank", "right_distal_shank"];

export class GaitProcessingError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "GaitProcessingError";
    this.code = code;
  }
}

function requireGovernedRoot(governedRoot) {
  if (typeof governedRoot !== "string" || !path.isAbsolute(governedRoot)) {
    throw new GaitProcessingError(
      "INVALID_GOVERNED_ROOT",
      "Governed storage must be an absolute path.",
    );
  }
  return path.resolve(governedRoot);
}

function requireRecordingId(recordingId) {
  if (typeof recordingId !== "string" || !/^\d{8}T\d{6}Z-[A-Za-z0-9_-]+$/.test(recordingId)) {
    throw new GaitProcessingError(
      "INVALID_RECORDING_ID",
      "The recording ID is not a supported bilateral-gait recording ID.",
    );
  }
  return recordingId;
}

function dateFolder(recordingId) {
  return `${recordingId.slice(0, 4)}-${recordingId.slice(4, 6)}-${recordingId.slice(6, 8)}`;
}

function isContained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function validateManifest(manifest, recordingId) {
  if (
    !manifest ||
    manifest.schemaVersion !== "bilateral-gait-manifest-v1" ||
    manifest.projectId !== "hms-lab-bilateral-gait" ||
    manifest.recordingId !== recordingId ||
    manifest.finalized !== true ||
    !Array.isArray(manifest.sensors) ||
    !ROLES.every((role) => manifest.sensors.some((sensor) => sensor?.role === role)) ||
    !manifest.sampleCounts ||
    !Array.isArray(manifest.artifacts)
  ) {
    throw new GaitProcessingError(
      "INVALID_MANIFEST",
      "The selected file is not a finalized bilateral-gait manifest.",
    );
  }
  const signals = manifest.artifacts.find(
    (artifact) =>
      artifact?.kind === "signals_sqlite" &&
      typeof artifact.relativePath === "string" &&
      /^[a-f0-9]{64}$/.test(artifact.sha256),
  );
  if (!signals) {
    throw new GaitProcessingError(
      "INVALID_MANIFEST",
      "The manifest does not identify a checksummed signals SQLite artifact.",
    );
  }
  return signals;
}

async function loadRecording(governedRoot, recordingId) {
  const root = requireGovernedRoot(governedRoot);
  const id = requireRecordingId(recordingId);
  const manifestPath = path.join(
    root,
    "manifests",
    "bilateral-gait",
    dateFolder(id),
    `${id}.json`,
  );
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new GaitProcessingError("RECORDING_NOT_FOUND", "The selected recording was not found.");
    }
    if (error instanceof SyntaxError) {
      throw new GaitProcessingError("INVALID_MANIFEST", "The recording manifest is not valid JSON.");
    }
    throw error;
  }
  const artifact = validateManifest(manifest, id);
  const databasePath = path.resolve(path.dirname(manifestPath), artifact.relativePath);
  if (!isContained(root, databasePath)) {
    throw new GaitProcessingError(
      "ARTIFACT_OUTSIDE_ROOT",
      "The signals artifact resolves outside governed storage.",
    );
  }
  return { root, manifestPath, manifest, artifact, databasePath };
}

async function sha256(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

function downsample(rows, limit = 900) {
  if (rows.length <= limit) return rows;
  return Array.from({ length: limit }, (_, index) =>
    rows[Math.round((index * (rows.length - 1)) / (limit - 1))]
  );
}

function vector(row, prefix) {
  return [row[`${prefix}_x`], row[`${prefix}_y`], row[`${prefix}_z`]];
}

function magnitude(values) {
  return Math.hypot(...values);
}

function readSamples(
  database,
  manifest,
  { startSeconds = Number.NEGATIVE_INFINITY, endSeconds = Number.POSITIVE_INFINITY, limit = 900 } = {},
) {
  const originRow = database.prepare(
    "SELECT MIN(CAST(host_monotonic_ns AS INTEGER)) AS origin FROM imu_samples",
  ).get();
  const origin = BigInt(originRow.origin);
  const rates = Object.fromEntries(
    manifest.sensors.map((sensor) => [sensor.role, Number(sensor.requestedRateHz)]),
  );
  const rows = database.prepare(`
    SELECT
      role,
      sample_index,
      sensor_timestamp_ms,
      host_monotonic_ns,
      acceleration_x,
      acceleration_y,
      acceleration_z,
      angular_velocity_x,
      angular_velocity_y,
      angular_velocity_z,
      MAX(sample_index) OVER (
        PARTITION BY role, packet_sequence
      ) AS packet_max_index
    FROM imu_samples
    ORDER BY role, sensor_timestamp_ms, packet_sequence, sample_index
  `).all();
  const byRole = Object.fromEntries(ROLES.map((role) => [role, []]));
  for (const row of rows) {
    const rate = rates[row.role];
    const packetOffset =
      Number.isFinite(rate) && rate > 0 && row.sample_index !== null
        ? (row.packet_max_index - row.sample_index) / rate
        : 0;
    const acceleration = vector(row, "acceleration");
    const angularVelocity = vector(row, "angular_velocity");
    const timeSeconds =
      Number(BigInt(row.host_monotonic_ns) - origin) / 1e9 - packetOffset;
    if (timeSeconds < startSeconds || timeSeconds > endSeconds) continue;
    byRole[row.role].push({
      timeSeconds,
      sensorTimestampMs: row.sensor_timestamp_ms,
      acceleration,
      accelerationMagnitude: magnitude(acceleration),
      angularVelocity,
      angularVelocityMagnitude: magnitude(angularVelocity),
    });
  }
  return Object.fromEntries(
    ROLES.map((role) => [role, downsample(byRole[role], limit)]),
  );
}

function readRoleQuality(database, manifest) {
  const requestedRates = Object.fromEntries(
    manifest.sensors.map((sensor) => [sensor.role, Number(sensor.requestedRateHz)]),
  );
  const rows = database.prepare(`
    WITH ordered AS (
      SELECT
        role,
        sensor_timestamp_ms,
        packet_sequence,
        sample_index,
        magnetic_field_x,
        magnetic_field_y,
        magnetic_field_z,
        sensor_timestamp_ms - LAG(sensor_timestamp_ms)
          OVER (PARTITION BY role ORDER BY sensor_timestamp_ms, packet_sequence, sample_index) AS gap_ms
      FROM imu_samples
    )
    SELECT
      role,
      COUNT(*) AS samples,
      MIN(sensor_timestamp_ms) AS first_sensor_ms,
      MAX(sensor_timestamp_ms) AS last_sensor_ms,
      COUNT(DISTINCT packet_sequence) AS packets,
      MIN(packet_sequence) AS first_packet,
      MAX(packet_sequence) AS last_packet,
      SUM(gap_ms <= 0) AS nonpositive_gaps,
      MAX(gap_ms) AS maximum_gap_ms,
      SUM(
        magnetic_field_x IS NULL OR magnetic_field_y IS NULL OR magnetic_field_z IS NULL
      ) AS missing_magnetometer
    FROM ordered
    GROUP BY role
    ORDER BY role
  `).all();
  return rows.map((row) => {
    const spanSeconds = (row.last_sensor_ms - row.first_sensor_ms) / 1000;
    const requestedRateHz = requestedRates[row.role];
    const expectedPacketCount = row.last_packet - row.first_packet + 1;
    return {
      role: row.role,
      samples: row.samples,
      packets: row.packets,
      missingPackets: Math.max(0, expectedPacketCount - row.packets),
      sensorSpanSeconds: spanSeconds,
      effectiveRateHz: spanSeconds > 0 ? (row.samples - 1) / spanSeconds : null,
      requestedRateHz,
      nonpositiveGaps: row.nonpositive_gaps,
      maximumGapMs: row.maximum_gap_ms,
      gapsOverTwoPointFivePeriods: database.prepare(`
        WITH ordered AS (
          SELECT
            sensor_timestamp_ms - LAG(sensor_timestamp_ms)
              OVER (ORDER BY sensor_timestamp_ms, packet_sequence, sample_index) AS gap_ms
          FROM imu_samples
          WHERE role = ?
        )
        SELECT COUNT(*) AS count FROM ordered WHERE gap_ms > ?
      `).get(row.role, 2500 / requestedRateHz).count,
      missingMagnetometerSamples: row.missing_magnetometer,
    };
  });
}

function readEvents(database) {
  return database.prepare(`
    SELECT sequence, type, label, semantics, relative_seconds, stream_projection_json
    FROM events
    ORDER BY sequence
  `).all().map((event) => {
    let streamProjection;
    try {
      streamProjection = JSON.parse(event.stream_projection_json);
    } catch {
      throw new GaitProcessingError(
        "INVALID_EVENT_PROJECTION",
        `Event ${event.sequence} has invalid stream projection JSON.`,
      );
    }
    return {
      sequence: event.sequence,
      type: event.type,
      label: event.label,
      semantics: event.semantics,
      relativeSeconds: event.relative_seconds,
      streamProjection,
    };
  });
}

export function deriveMarkerSegments(events) {
  const intervals = [];
  const starts = new Map();
  for (const event of events) {
    if (event.type === "path_segment") continue;
    const key = `${event.type}:${event.label}`;
    if (event.semantics === "start") {
      starts.set(key, event);
    } else if (event.semantics === "end") {
      const start = starts.get(key);
      if (!start) continue;
      intervals.push({
        id: `${start.sequence}-${event.sequence}`,
        type: event.type,
        label: event.label,
        startSequence: start.sequence,
        endSequence: event.sequence,
        startSeconds: start.relativeSeconds,
        endSeconds: event.relativeSeconds,
        durationSeconds: event.relativeSeconds - start.relativeSeconds,
      });
      starts.delete(key);
    }
  }

  const gaitBouts = intervals.filter((interval) => interval.type === "gait_bout");
  const pathStarts = events.filter(
    (event) => event.type === "path_segment" && event.semantics === "start",
  );
  for (const bout of gaitBouts) {
    const startsInBout = pathStarts.filter(
      (event) =>
        event.relativeSeconds >= bout.startSeconds &&
        event.relativeSeconds <= bout.endSeconds,
    );
    startsInBout.forEach((event, index) => {
      const next = startsInBout[index + 1];
      const endSeconds = next?.relativeSeconds ?? bout.endSeconds;
      intervals.push({
        id: `${event.sequence}-${next?.sequence ?? bout.endSequence}`,
        type: "path_segment",
        label: event.label,
        startSequence: event.sequence,
        endSequence: next?.sequence ?? bout.endSequence,
        startSeconds: event.relativeSeconds,
        endSeconds,
        durationSeconds: endSeconds - event.relativeSeconds,
      });
    });
  }
  return intervals.sort(
    (left, right) =>
      left.startSeconds - right.startSeconds ||
      right.durationSeconds - left.durationSeconds,
  );
}

export async function listBilateralRecordings(governedRoot) {
  const root = requireGovernedRoot(governedRoot);
  const manifestsRoot = path.join(root, "manifests", "bilateral-gait");
  let dates;
  try {
    dates = await readdir(manifestsRoot, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const recordings = [];
  for (const date of dates.filter((entry) => entry.isDirectory())) {
    const directory = path.join(manifestsRoot, date.name);
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      try {
        const manifest = JSON.parse(await readFile(path.join(directory, entry.name), "utf8"));
        validateManifest(manifest, manifest.recordingId);
        recordings.push({
          recordingId: manifest.recordingId,
          startedAt: manifest.startedAt,
          stoppedAt: manifest.stoppedAt,
          sampleCounts: manifest.sampleCounts,
          eventCount: manifest.eventCount,
          context: manifest.initialContext,
        });
      } catch (error) {
        if (!(error instanceof GaitProcessingError) && !(error instanceof SyntaxError)) {
          throw error;
        }
      }
    }
  }
  return recordings.sort((left, right) => right.startedAt.localeCompare(left.startedAt));
}

export async function analyzeBilateralRecording(governedRoot, recordingId) {
  const recording = await loadRecording(governedRoot, recordingId);
  const [actualSha256, file] = await Promise.all([
    sha256(recording.databasePath),
    stat(recording.databasePath),
  ]);
  const database = new DatabaseSync(recording.databasePath, { readOnly: true });
  try {
    const integrity = database.prepare("PRAGMA integrity_check").get().integrity_check;
    const roleQuality = readRoleQuality(database, recording.manifest);
    const sampleCounts = Object.fromEntries(
      roleQuality.map((quality) => [quality.role, quality.samples]),
    );
    const countDifference = Math.abs(
      sampleCounts.left_distal_shank - sampleCounts.right_distal_shank,
    );
    const events = readEvents(database);
    return {
      recording: {
        recordingId: recording.manifest.recordingId,
        startedAt: recording.manifest.startedAt,
        stoppedAt: recording.manifest.stoppedAt,
        protocol: recording.manifest.protocol,
        context: recording.manifest.initialContext,
        calibrationPlan: recording.manifest.calibrationPlan,
        sensors: recording.manifest.sensors.map((sensor) => ({
          role: sensor.role,
          requestedRateHz: sensor.requestedRateHz,
          sideVerificationAccepted: sensor.sideVerificationAccepted,
        })),
      },
      integrity: {
        finalized: recording.manifest.finalized,
        sqliteIntegrity: integrity,
        checksumMatches: actualSha256 === recording.artifact.sha256,
        expectedSha256: recording.artifact.sha256,
        actualSha256,
        manifestBytes: recording.artifact.bytes,
        actualBytes: file.size,
      },
      timing: {
        roleQuality,
        sampleCountDifference: countDifference,
        alignmentStatus: "provisional_host_packet_time",
      },
      events,
      segments: deriveMarkerSegments(events),
      signals: readSamples(database, recording.manifest, { limit: 1200 }),
    };
  } finally {
    database.close();
  }
}

export async function loadBilateralSignalWindow(
  governedRoot,
  recordingId,
  startSeconds,
  endSeconds,
) {
  if (
    !Number.isFinite(startSeconds) ||
    !Number.isFinite(endSeconds) ||
    startSeconds < 0 ||
    endSeconds <= startSeconds ||
    endSeconds - startSeconds > 3600
  ) {
    throw new GaitProcessingError(
      "INVALID_TIME_WINDOW",
      "The zoom window must have a non-negative start and a greater end.",
    );
  }
  const recording = await loadRecording(governedRoot, recordingId);
  const database = new DatabaseSync(recording.databasePath, { readOnly: true });
  try {
    const events = readEvents(database);
    return {
      startSeconds,
      endSeconds,
      signals: readSamples(database, recording.manifest, {
        startSeconds,
        endSeconds,
        limit: 1800,
      }),
      events: events.filter(
        (event) =>
          event.relativeSeconds >= startSeconds &&
          event.relativeSeconds <= endSeconds,
      ),
      segments: deriveMarkerSegments(events).filter(
        (segment) =>
          segment.endSeconds >= startSeconds &&
          segment.startSeconds <= endSeconds,
      ),
    };
  } finally {
    database.close();
  }
}
