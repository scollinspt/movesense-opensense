import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export const RECORDING_SCHEMA_VERSION = "bilateral-gait-recording-v1";
export const MANIFEST_SCHEMA_VERSION = "bilateral-gait-manifest-v1";

function recordingId(date) {
  const timestamp = date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `${timestamp}-${randomUUID().slice(0, 8)}`;
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function atomicJson(filePath, value) {
  const temporary = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, filePath);
}

function requireAbsoluteDataRoot(dataRoot) {
  if (typeof dataRoot !== "string" || !path.isAbsolute(dataRoot)) {
    throw new Error("Governed data root must be an absolute path.");
  }
}

async function findPartialDatabases(directory) {
  const results = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return results;
    throw error;
  }
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...await findPartialDatabases(entryPath));
    } else if (entry.isFile() && entry.name === "signals.sqlite.partial") {
      results.push(entryPath);
    }
  }
  return results;
}

export async function recoverInterruptedRecordings(dataRoot) {
  requireAbsoluteDataRoot(dataRoot);
  const partials = await findPartialDatabases(
    path.join(dataRoot, "raw", "bilateral-gait"),
  );
  const recovered = [];
  for (const partialPath of partials) {
    const directory = path.dirname(partialPath);
    const id = path.basename(directory);
    const date = path.basename(path.dirname(directory));
    const recoveredPath = path.join(directory, "signals.recovered.sqlite");
    const database = new DatabaseSync(partialPath);
    let sampleCounts;
    let eventCount;
    try {
      database.exec("PRAGMA wal_checkpoint(TRUNCATE)");
      sampleCounts = Object.fromEntries(
        ["left_distal_shank", "right_distal_shank"].map((role) => [
          role,
          database.prepare(
            "SELECT COUNT(*) AS count FROM imu_samples WHERE role = ?",
          ).get(role).count,
        ]),
      );
      eventCount = database.prepare(
        "SELECT COUNT(*) AS count FROM events",
      ).get().count;
    } finally {
      database.close();
    }
    await rename(partialPath, recoveredPath);
    const checksum = await sha256(recoveredPath);
    const manifestDirectory = path.join(
      dataRoot,
      "manifests",
      "bilateral-gait",
      date,
    );
    await mkdir(manifestDirectory, { recursive: true });
    const manifestPath = path.join(
      manifestDirectory,
      `${id}.recovered.json`,
    );
    await atomicJson(manifestPath, {
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      projectId: "hms-lab-bilateral-gait",
      recordingId: id,
      recoveredAt: new Date().toISOString(),
      finalized: false,
      recoveryStatus: "interrupted_incomplete",
      sampleCounts,
      eventCount,
      artifacts: [{
        kind: "signals_sqlite",
        relativePath: path.relative(manifestDirectory, recoveredPath),
        sha256: checksum,
        bytes: (await stat(recoveredPath)).size,
      }],
      warning:
        "Recovered after interruption. Review continuity, context, and event completeness before processing.",
    });
    recovered.push({
      recordingId: id,
      databasePath: recoveredPath,
      manifestPath,
      checksum,
      sampleCounts,
      eventCount,
    });
  }
  return recovered;
}

export class GaitRecordingSession {
  static async create({
    dataRoot,
    sensors,
    placement,
    calibrationPlan,
    initialContext,
    softwareVersion,
  }) {
    requireAbsoluteDataRoot(dataRoot);
    const startedAt = new Date();
    const id = recordingId(startedAt);
    const date = startedAt.toISOString().slice(0, 10);
    const directory = path.join(dataRoot, "raw", "bilateral-gait", date, id);
    await mkdir(directory, { recursive: true });
    const partialPath = path.join(directory, "signals.sqlite.partial");
    return new GaitRecordingSession({
      dataRoot,
      directory,
      partialPath,
      recordingId: id,
      startedAt,
      sensors,
      placement,
      calibrationPlan,
      initialContext,
      softwareVersion,
    });
  }

  constructor({
    dataRoot,
    directory,
    partialPath,
    recordingId,
    startedAt,
    sensors,
    placement,
    calibrationPlan,
    initialContext,
    softwareVersion,
  }) {
    this.dataRoot = dataRoot;
    this.directory = directory;
    this.partialPath = partialPath;
    this.recordingId = recordingId;
    this.startedAt = startedAt;
    this.startedMonotonicNs = process.hrtime.bigint();
    this.sensors = sensors;
    this.placement = placement;
    this.calibrationPlan = calibrationPlan;
    this.initialContext = initialContext;
    this.softwareVersion = softwareVersion;
    this.sampleCounts = {
      left_distal_shank: 0,
      right_distal_shank: 0,
    };
    this.eventCount = 0;
    this.closed = false;
    this.pendingWrites = 0;
    this.database = new DatabaseSync(partialPath);
    this.database.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA synchronous=FULL;
      CREATE TABLE recording_metadata (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL
      );
      CREATE TABLE imu_samples (
        role TEXT NOT NULL,
        sample_index INTEGER,
        sensor_timestamp_ms REAL NOT NULL,
        host_monotonic_ns TEXT NOT NULL,
        host_time_ns TEXT NOT NULL,
        acceleration_x REAL NOT NULL,
        acceleration_y REAL NOT NULL,
        acceleration_z REAL NOT NULL,
        angular_velocity_x REAL NOT NULL,
        angular_velocity_y REAL NOT NULL,
        angular_velocity_z REAL NOT NULL,
        magnetic_field_x REAL,
        magnetic_field_y REAL,
        magnetic_field_z REAL,
        packet_sequence INTEGER
      );
      CREATE INDEX imu_role_time
        ON imu_samples(role, sensor_timestamp_ms);
      CREATE TABLE events (
        event_id TEXT PRIMARY KEY,
        sequence INTEGER NOT NULL,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        semantics TEXT NOT NULL,
        host_monotonic_ns TEXT NOT NULL,
        host_wall_clock_time TEXT NOT NULL,
        relative_seconds REAL NOT NULL,
        stream_projection_json TEXT NOT NULL,
        data_json TEXT NOT NULL
      );
    `);
    this.insertSample = this.database.prepare(`
      INSERT INTO imu_samples VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);
    this.insertEvent = this.database.prepare(`
      INSERT INTO events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMetadata = this.database.prepare(
      "INSERT INTO recording_metadata VALUES (?, ?)",
    );
    insertMetadata.run("schemaVersion", JSON.stringify(RECORDING_SCHEMA_VERSION));
    insertMetadata.run("projectId", JSON.stringify("hms-lab-bilateral-gait"));
    insertMetadata.run("recordingId", JSON.stringify(recordingId));
    insertMetadata.run("startedAt", JSON.stringify(startedAt.toISOString()));
    insertMetadata.run("sensors", JSON.stringify(sensors));
    insertMetadata.run("placement", JSON.stringify(placement));
    insertMetadata.run("calibrationPlan", JSON.stringify(calibrationPlan));
    insertMetadata.run("initialContext", JSON.stringify(initialContext));
    insertMetadata.run("softwareVersion", JSON.stringify(softwareVersion));
    this.database.exec("BEGIN IMMEDIATE");
  }

  get elapsedSeconds() {
    return Number(process.hrtime.bigint() - this.startedMonotonicNs) / 1e9;
  }

  appendSample(role, sample) {
    if (this.closed) throw new Error("Recording is already closed.");
    if (!(role in this.sampleCounts)) throw new Error("Unknown sensor role.");
    const hostMonotonicNs =
      sample.hostMonotonicNs ?? process.hrtime.bigint().toString();
    const hostTimeNs =
      sample.hostTimeNs ?? (BigInt(Date.now()) * 1_000_000n).toString();
    this.insertSample.run(
      role,
      sample.sampleIndex ?? null,
      sample.sensorTimestampMs,
      String(hostMonotonicNs),
      String(hostTimeNs),
      sample.accelerationX,
      sample.accelerationY,
      sample.accelerationZ,
      sample.angularVelocityX,
      sample.angularVelocityY,
      sample.angularVelocityZ,
      Number.isFinite(sample.magneticFieldX) ? sample.magneticFieldX : null,
      Number.isFinite(sample.magneticFieldY) ? sample.magneticFieldY : null,
      Number.isFinite(sample.magneticFieldZ) ? sample.magneticFieldZ : null,
      sample.packetSequence ?? null,
    );
    this.sampleCounts[role] += 1;
    this.pendingWrites += 1;
    this.#commitIfNeeded();
  }

  recordEvent({
    type,
    label,
    semantics,
    data,
    streamProjection,
    hostMonotonicNs = process.hrtime.bigint(),
  }) {
    if (this.closed) throw new Error("Recording is already closed.");
    const event = {
      schemaVersion: "bilateral-gait-event-v1",
      eventId: randomUUID(),
      sequence: this.eventCount + 1,
      type,
      label,
      semantics,
      hostMonotonicSeconds: Number(hostMonotonicNs) / 1e9,
      hostWallClockTime: new Date().toISOString(),
      streamProjection,
      data,
    };
    this.insertEvent.run(
      event.eventId,
      event.sequence,
      type,
      label,
      semantics,
      hostMonotonicNs.toString(),
      event.hostWallClockTime,
      Number(hostMonotonicNs - this.startedMonotonicNs) / 1e9,
      JSON.stringify(streamProjection),
      JSON.stringify(data),
    );
    this.eventCount += 1;
    this.pendingWrites += 1;
    this.#commitIfNeeded();
    return event;
  }

  #commitIfNeeded() {
    if (this.pendingWrites < 250) return;
    this.database.exec("COMMIT; BEGIN IMMEDIATE");
    this.pendingWrites = 0;
  }

  async finalize() {
    if (this.closed) throw new Error("Recording is already closed.");
    this.closed = true;
    const stoppedAt = new Date();
    this.database.exec("COMMIT");
    const upsert = this.database.prepare(`
      INSERT INTO recording_metadata VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
    `);
    upsert.run("stoppedAt", JSON.stringify(stoppedAt.toISOString()));
    upsert.run("sampleCounts", JSON.stringify(this.sampleCounts));
    upsert.run("eventCount", JSON.stringify(this.eventCount));
    upsert.run("finalized", JSON.stringify(true));
    this.database.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    const integrity = this.database.prepare("PRAGMA integrity_check").get();
    this.database.close();
    if (integrity.integrity_check !== "ok") {
      throw new Error(`SQLite integrity check failed: ${integrity.integrity_check}`);
    }
    const finalizedPath = path.join(this.directory, "signals.sqlite");
    await rename(this.partialPath, finalizedPath);
    const checksum = await sha256(finalizedPath);
    const bytes = (await stat(finalizedPath)).size;
    const date = this.startedAt.toISOString().slice(0, 10);
    const manifestDirectory = path.join(
      this.dataRoot,
      "manifests",
      "bilateral-gait",
      date,
    );
    await mkdir(manifestDirectory, { recursive: true });
    const manifestPath = path.join(
      manifestDirectory,
      `${this.recordingId}.json`,
    );
    const manifest = {
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      projectId: "hms-lab-bilateral-gait",
      recordingId: this.recordingId,
      startedAt: this.startedAt.toISOString(),
      stoppedAt: stoppedAt.toISOString(),
      finalized: true,
      protocol: {
        configId: "bilateral-gait-flat-overground-v1",
        environment: "flat_overground",
      },
      sensors: this.sensors,
      placement: this.placement,
      calibrationPlan: this.calibrationPlan,
      initialContext: this.initialContext,
      sampleCounts: this.sampleCounts,
      eventCount: this.eventCount,
      artifacts: [{
        kind: "signals_sqlite",
        relativePath: path.relative(manifestDirectory, finalizedPath),
        sha256: checksum,
        bytes,
      }],
      software: { applicationVersion: this.softwareVersion },
    };
    await atomicJson(manifestPath, manifest);
    return {
      recordingId: this.recordingId,
      finalizedAt: stoppedAt.toISOString(),
      databasePath: finalizedPath,
      manifestPath,
      checksum,
      sampleCounts: this.sampleCounts,
      eventCount: this.eventCount,
    };
  }
}
