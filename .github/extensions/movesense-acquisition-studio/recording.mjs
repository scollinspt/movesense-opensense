import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const COLUMNS = [
  "recording_id",
  "sensor_identifier",
  "sensor_timestamp_ms",
  "host_monotonic_ns",
  "host_time_ns",
  "acceleration_x_m_s2",
  "acceleration_y_m_s2",
  "acceleration_z_m_s2",
  "angular_velocity_x_deg_s",
  "angular_velocity_y_deg_s",
  "angular_velocity_z_deg_s",
  "magnetic_field_x_uT",
  "magnetic_field_y_uT",
  "magnetic_field_z_uT",
];

function orientationDefinition(orientation, placement) {
  if (orientation === "supplied_strap_side_specific_v1") {
    if (placement === "right_wrist") {
      return "Dorsal wrist; logo face outward; wordmark axis proximal-distal; M end distal toward hand; final E end proximal toward elbow.";
    }
    if (placement === "left_wrist") {
      return "Dorsal wrist; logo face outward; wordmark axis proximal-distal; final E end distal toward hand; M end proximal toward elbow.";
    }
  }
  if (orientation === "custom_documented") {
    return "Custom mounting documented in orientation notes.";
  }
  return "Unrecognized orientation code or placement.";
}

function csvValue(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function recordingId(date = new Date()) {
  return `${date.toISOString().replaceAll(/[-:.]/g, "").slice(0, 15)}Z-${randomUUID().slice(0, 8)}`;
}

async function atomicJson(target, value) {
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  await rename(temporary, target);
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

export class RecordingSession {
  static async create({
    dataRoot,
    sensorAddress,
    sensorName,
    sampleRateHz,
    movement,
    placement,
    orientation,
    orientationNotes,
    anatomicalStartConfirmed,
    proximalControlConfirmed,
  }) {
    if (typeof dataRoot !== "string" || !path.isAbsolute(dataRoot)) {
      throw new Error("MOVESENSE_DATA_ROOT must be an absolute path.");
    }
    if (typeof sensorAddress !== "string" || sensorAddress.trim() === "") {
      throw new Error("A connected sensor identifier is required.");
    }
    const startedAt = new Date();
    const id = recordingId(startedAt);
    const dateDirectory = startedAt.toISOString().slice(0, 10);
    const rawDirectory = path.join(dataRoot, "raw", dateDirectory, id);
    const manifestDirectory = path.join(dataRoot, "manifests", dateDirectory);
    await mkdir(rawDirectory, { recursive: true, mode: 0o700 });
    await mkdir(manifestDirectory, { recursive: true, mode: 0o700 });
    const finalDataPath = path.join(rawDirectory, "imu9.csv");
    const partialDataPath = `${finalDataPath}.partial`;
    const manifestPath = path.join(manifestDirectory, `${id}.json`);
    const stream = createWriteStream(partialDataPath, {
      encoding: "utf8",
      flags: "wx",
      mode: 0o600,
    });
    stream.write(`${COLUMNS.join(",")}\n`);
    return new RecordingSession({
      id,
      startedAt,
      sensorAddress,
      sensorName,
      sampleRateHz,
      movement,
      placement,
      orientation,
      orientationNotes,
      anatomicalStartConfirmed,
      proximalControlConfirmed,
      finalDataPath,
      partialDataPath,
      manifestPath,
      stream,
    });
  }

  constructor(options) {
    Object.assign(this, options);
    this.sampleCount = 0;
    this.firstSensorTimestampMs = null;
    this.lastSensorTimestampMs = null;
    this.events = [];
    this.closed = false;
  }

  append(sample) {
    if (this.closed) throw new Error("Recording is already closed.");
    const row = [
      this.id,
      this.sensorName || this.sensorAddress,
      sample.sensor_timestamp_ms,
      sample.host_monotonic_ns,
      sample.host_time_ns,
      sample.acceleration_x,
      sample.acceleration_y,
      sample.acceleration_z,
      sample.angular_velocity_x,
      sample.angular_velocity_y,
      sample.angular_velocity_z,
      sample.magnetic_field_x,
      sample.magnetic_field_y,
      sample.magnetic_field_z,
    ];
    this.stream.write(`${row.map(csvValue).join(",")}\n`);
    this.sampleCount += 1;
    this.firstSensorTimestampMs ??= sample.sensor_timestamp_ms;
    this.lastSensorTimestampMs = sample.sensor_timestamp_ms;
  }

  markEvent(label) {
    if (this.closed) throw new Error("Recording is already closed.");
    if (typeof label !== "string" || !/^[a-z0-9_]{1,80}$/.test(label)) {
      throw new Error("A valid phase-marker label is required.");
    }
    if (this.sampleCount === 0 || this.lastSensorTimestampMs === null) {
      throw new Error("Wait for the first recorded sensor sample before marking a phase.");
    }
    const event = {
      sequence: this.events.length + 1,
      label,
      markedAt: new Date().toISOString(),
      hostMonotonicNs: process.hrtime.bigint().toString(),
      hostTimeNs: (BigInt(Date.now()) * 1_000_000n).toString(),
      nearestSensorTimestampMs: this.lastSensorTimestampMs,
      sampleIndex: this.sampleCount - 1,
    };
    this.events.push(event);
    return event;
  }

  async stop(status = "complete") {
    if (this.closed) return this.result;
    this.closed = true;
    await new Promise((resolve, reject) => {
      this.stream.once("error", reject);
      this.stream.end(resolve);
    });
    await rename(this.partialDataPath, this.finalDataPath);
    const checksum = await sha256(this.finalDataPath);
    const endedAt = new Date();
    const manifest = {
      format: "movesense-opensense-raw-recording",
      version: 1,
      recordingId: this.id,
      status,
      startedAt: this.startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      sensor: {
        identifier: this.sensorName || this.sensorAddress,
        bleAddress: this.sensorAddress,
      },
      acquisition: {
        resource: `/Meas/IMU9/${this.sampleRateHz}`,
        requestedSampleRateHz: this.sampleRateHz,
        sampleCount: this.sampleCount,
        firstSensorTimestampMs: this.firstSensorTimestampMs,
        lastSensorTimestampMs: this.lastSensorTimestampMs,
        sensorTimestampSemantics: "Movesense relative timestamp in milliseconds",
        hostMonotonicTimestampSemantics: "Host monotonic receipt time in nanoseconds",
        hostTimeSemantics: "Host Unix wall-clock receipt time in nanoseconds",
      },
      protocol: {
        protocolId: "single-wrist-feasibility-v1",
        movement: this.movement || "unspecified",
        placement: this.placement || "unspecified",
        orientation: this.orientation || "unspecified",
        orientationDefinition: orientationDefinition(this.orientation, this.placement),
        orientationNotes: this.orientationNotes || "",
        anatomicalStartConfirmed: this.anatomicalStartConfirmed === true,
        proximalControlConfirmed: this.proximalControlConfirmed === true,
      },
      events: this.events,
      signals: {
        acceleration: { unit: "m/s^2", axes: ["x", "y", "z"] },
        angularVelocity: { unit: "deg/s", axes: ["x", "y", "z"] },
        magneticField: { unit: "uT", axes: ["x", "y", "z"] },
      },
      dataFile: {
        path: this.finalDataPath,
        sha256: checksum,
        columns: COLUMNS,
      },
      software: {
        project: "movesense-opensense",
        version: "0.1.0",
        runtime: process.version,
        platform: `${process.platform}-${process.arch}`,
      },
    };
    await atomicJson(this.manifestPath, manifest);
    this.result = {
      recordingId: this.id,
      status,
      sampleCount: this.sampleCount,
      dataPath: this.finalDataPath,
      manifestPath: this.manifestPath,
      sha256: checksum,
    };
    return this.result;
  }
}
