import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export const RECORDING_SCHEMA_VERSION = "tilt-ecg-recording-v2";
export const SUMMARY_SCHEMA_VERSION = "tilt-ecg-five-second-summary-v2";

function compactUtcDate(date) {
  return date.toISOString().slice(0, 10);
}

function compactRecordingTime(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function atomicJson(filePath, value) {
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, filePath);
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
  if (!path.isAbsolute(dataRoot)) {
    throw new Error("Governed data root must be an absolute path.");
  }
  const rawRoot = path.join(dataRoot, "raw", "tilt-ecg");
  const partialDatabases = await findPartialDatabases(rawRoot);
  const recovered = [];
  for (const partialPath of partialDatabases) {
    const recordingDirectory = path.dirname(partialPath);
    const recordingId = path.basename(recordingDirectory);
    const date = path.basename(path.dirname(recordingDirectory));
    const recoveredPath = path.join(recordingDirectory, "signals.recovered.sqlite");
    const recoveredAt = new Date().toISOString();
    const database = new DatabaseSync(partialPath);
    let sampleCounts;
    try {
      database.exec("PRAGMA wal_checkpoint(TRUNCATE)");
      const insert = database.prepare(`
        INSERT INTO recording_metadata (key, value_json) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
      `);
      insert.run("recoveredAt", JSON.stringify(recoveredAt));
      insert.run("recoveryStatus", JSON.stringify("interrupted_incomplete"));
      sampleCounts = {
        ecg: database.prepare("SELECT COUNT(*) AS count FROM ecg_samples").get().count,
        imu: database.prepare("SELECT COUNT(*) AS count FROM imu_samples").get().count,
        events: database.prepare("SELECT COUNT(*) AS count FROM events").get().count,
      };
      database.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    } finally {
      database.close();
    }
    await rename(partialPath, recoveredPath);
    const signalsSha256 = await sha256(recoveredPath);
    const manifestDirectory = path.join(dataRoot, "manifests", "tilt-ecg", date);
    await mkdir(manifestDirectory, { recursive: true });
    const manifestPath = path.join(
      manifestDirectory,
      `${recordingId}.recovered.json`,
    );
    await atomicJson(manifestPath, {
      schemaVersion: RECORDING_SCHEMA_VERSION,
      projectId: "hms-lab-tilt-ecg",
      recordingId,
      recoveredAt,
      finalized: false,
      recoveryStatus: "interrupted_incomplete",
      summaryAvailable: false,
      sampleCounts,
      files: {
        signals: {
          path: path.relative(manifestDirectory, recoveredPath),
          sha256: signalsSha256,
          bytes: (await readFile(recoveredPath)).byteLength,
        },
      },
      warning:
        "Recovered after an interrupted process. Review continuity and event completeness before analysis.",
    });
    recovered.push({
      recordingId,
      databasePath: recoveredPath,
      manifestPath,
      signalsSha256,
      sampleCounts,
    });
  }
  return recovered;
}

function csvValue(value) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function buildFiveSecondSummary({
  recordingId = "unknown",
  startedHostMonotonicNs = 0n,
  commandedTargetAngleDegrees = null,
  durationSeconds,
  hrEstimates,
  tiltEstimates,
  events,
  baselineBloodPressure,
  baselineEtco2,
}) {
  const rows = [];
  let latestHr = null;
  let latestPhase = "baseline_supine";
  let latestBloodPressure = baselineBloodPressure ?? null;
  let previousBloodPressure = baselineBloodPressure ?? null;
  let latestEtco2 = baselineEtco2 ?? null;
  let previousEtco2 = baselineEtco2 ?? null;
  const undone = new Set(
    events
      .filter((event) => event.type === "annotation_undo")
      .map((event) => event.data.targetEventId),
  );
  const activeEvents = events.filter(
    (event) => event.type !== "annotation_undo" && !undone.has(event.id),
  );
  const windowCount = Math.max(1, Math.ceil(durationSeconds / 5));
  for (let index = 0; index < windowCount; index += 1) {
    const start = index * 5;
    const end = Math.min((index + 1) * 5, durationSeconds);
    const windowStartMonotonicNs =
      BigInt(startedHostMonotonicNs) + BigInt(Math.round(start * 1e9));
    const windowEndMonotonicNs =
      BigInt(startedHostMonotonicNs) + BigInt(Math.round(end * 1e9));
    const windowHr = hrEstimates.filter(
      (estimate) => estimate.relativeSeconds >= start && estimate.relativeSeconds < end,
    );
    if (windowHr.length) latestHr = windowHr.at(-1);
    const windowTilt = tiltEstimates.filter(
      (estimate) => estimate.relativeSeconds >= start && estimate.relativeSeconds < end,
    );
    const windowEvents = activeEvents.filter(
      (event) => event.relativeSeconds >= start && event.relativeSeconds < end,
    );
    let windowBloodPressure = null;
    let windowBloodPressurePrevious = null;
    let windowEtco2 = null;
    let windowEtco2Previous = null;
    for (const event of windowEvents) {
      if (event.type === "phase") latestPhase = event.label;
      if (event.type === "blood_pressure") {
        previousBloodPressure = latestBloodPressure;
        latestBloodPressure = {
          systolic: event.data.systolic,
          diastolic: event.data.diastolic,
        };
        windowBloodPressure = latestBloodPressure;
        windowBloodPressurePrevious = previousBloodPressure;
      }
      if (event.type === "etco2") {
        previousEtco2 = latestEtco2;
        latestEtco2 = event.data.value;
        windowEtco2 = latestEtco2;
        windowEtco2Previous = previousEtco2;
      }
    }
    const tiltValues = windowTilt
      .map((value) => value.tiltDegrees)
      .filter(Number.isFinite);
    const rollValues = windowTilt
      .map((value) => value.offAxisRollDegrees)
      .filter(Number.isFinite);
    rows.push({
      recording_id: recordingId,
      window_index: index,
      commanded_target_angle_deg: commandedTargetAngleDegrees,
      window_start_s: start,
      window_end_s: end,
      window_start_host_monotonic_ns: windowStartMonotonicNs.toString(),
      window_end_host_monotonic_ns: windowEndMonotonicNs.toString(),
      hr_bpm: latestHr?.bpm ?? null,
      hr_source_time_s: latestHr?.relativeSeconds ?? null,
      hr_age_s: latestHr ? Math.max(0, end - latestHr.relativeSeconds) : null,
      hr_estimate_count: windowHr.length,
      ecg_quality: latestHr?.quality ?? "unavailable",
      tilt_mean_deg: tiltValues.length ? mean(tiltValues) : null,
      tilt_final_deg: tiltValues.length ? tiltValues.at(-1) : null,
      tilt_min_deg: tiltValues.length ? Math.min(...tiltValues) : null,
      tilt_max_deg: tiltValues.length ? Math.max(...tiltValues) : null,
      roll_mean_deg: rollValues.length ? mean(rollValues) : null,
      roll_max_abs_deg: rollValues.length
        ? Math.max(...rollValues.map(Math.abs))
        : null,
      tilt_quality: windowTilt.length
        ? (windowTilt.some((value) => value.quality !== "good") ? "dynamic" : "good")
        : "unavailable",
      phase: latestPhase,
      annotation_count: windowEvents.length,
      annotations_json: JSON.stringify(
        windowEvents
          .filter((event) => !["phase", "blood_pressure", "etco2"].includes(event.type))
          .map(({ id, type, label, relativeSeconds, data }) => ({
            id,
            type,
            label,
            relativeSeconds,
            data,
          })),
      ),
      systolic_mm_hg: windowBloodPressure?.systolic ?? null,
      diastolic_mm_hg: windowBloodPressure?.diastolic ?? null,
      systolic_from_baseline_mm_hg:
        windowBloodPressure && baselineBloodPressure
          ? windowBloodPressure.systolic - baselineBloodPressure.systolic
          : null,
      diastolic_from_baseline_mm_hg:
        windowBloodPressure && baselineBloodPressure
          ? windowBloodPressure.diastolic - baselineBloodPressure.diastolic
          : null,
      systolic_from_previous_mm_hg:
        windowBloodPressure && windowBloodPressurePrevious
          ? windowBloodPressure.systolic - windowBloodPressurePrevious.systolic
          : null,
      diastolic_from_previous_mm_hg:
        windowBloodPressure && windowBloodPressurePrevious
          ? windowBloodPressure.diastolic - windowBloodPressurePrevious.diastolic
          : null,
      etco2_mm_hg: windowEtco2,
      etco2_from_baseline_mm_hg:
        Number.isFinite(windowEtco2) && Number.isFinite(baselineEtco2)
          ? windowEtco2 - baselineEtco2
          : null,
      etco2_from_previous_mm_hg:
        Number.isFinite(windowEtco2) && Number.isFinite(windowEtco2Previous)
          ? windowEtco2 - windowEtco2Previous
          : null,
    });
  }
  return rows;
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function serializeSummary(rows) {
  const columns = Object.keys(rows[0]);
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvValue(row[column])).join(",")),
  ].join("\n") + "\n";
}

export class TiltRecordingSession {
  static async create({
    dataRoot,
    sensor,
    zero,
    baselineBloodPressure,
    baselineEtco2,
    commandedTargetAngleDegrees,
    softwareVersion,
  }) {
    if (!path.isAbsolute(dataRoot)) {
      throw new Error("Governed data root must be an absolute path.");
    }
    const startedAt = new Date();
    const recordingId = `${compactRecordingTime(startedAt)}-${randomUUID().slice(0, 8)}`;
    const date = compactUtcDate(startedAt);
    const rawDirectory = path.join(dataRoot, "raw", "tilt-ecg", date, recordingId);
    const derivedDirectory = path.join(
      dataRoot,
      "derived",
      "tilt-ecg",
      date,
      recordingId,
    );
    const manifestDirectory = path.join(dataRoot, "manifests", "tilt-ecg", date);
    await Promise.all([
      mkdir(rawDirectory, { recursive: true }),
      mkdir(derivedDirectory, { recursive: true }),
      mkdir(manifestDirectory, { recursive: true }),
    ]);
    return new TiltRecordingSession({
      recordingId,
      startedAt,
      rawDirectory,
      derivedDirectory,
      manifestDirectory,
      sensor,
      zero,
      baselineBloodPressure,
      baselineEtco2,
      commandedTargetAngleDegrees,
      softwareVersion,
    });
  }

  constructor(options) {
    Object.assign(this, options);
    this.partialDatabasePath = path.join(this.rawDirectory, "signals.sqlite.partial");
    this.databasePath = path.join(this.rawDirectory, "signals.sqlite");
    this.summaryPath = path.join(this.derivedDirectory, "five_second_summary.csv");
    this.manifestPath = path.join(
      this.manifestDirectory,
      `${this.recordingId}.json`,
    );
    this.database = new DatabaseSync(this.partialDatabasePath);
    this.hrEstimates = [];
    this.tiltEstimates = [];
    this.events = [];
    this.ecgCount = 0;
    this.imuCount = 0;
    this.transactionSampleCount = 0;
    this.lastEcgTimestampMs = null;
    this.lastImuTimestampMs = null;
    this.startedMonotonicMs = performance.now();
    this.startedHostMonotonicNs = process.hrtime.bigint();
    this.#initializeDatabase();
  }

  #initializeDatabase() {
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = FULL;
      CREATE TABLE recording_metadata (
        key TEXT PRIMARY KEY NOT NULL,
        value_json TEXT NOT NULL
      ) STRICT;
      CREATE TABLE ecg_samples (
        sequence INTEGER PRIMARY KEY,
        sensor_timestamp_ms REAL NOT NULL,
        host_monotonic_ns TEXT NOT NULL,
        host_time_ns TEXT NOT NULL,
        host_time_utc TEXT NOT NULL,
        raw_value REAL NOT NULL,
        packet_sequence INTEGER,
        packet_sample_index INTEGER
      ) STRICT;
      CREATE TABLE imu_samples (
        sequence INTEGER PRIMARY KEY,
        sensor_timestamp_ms REAL NOT NULL,
        host_monotonic_ns TEXT NOT NULL,
        host_time_ns TEXT NOT NULL,
        host_time_utc TEXT NOT NULL,
        acceleration_x REAL NOT NULL,
        acceleration_y REAL NOT NULL,
        acceleration_z REAL NOT NULL,
        angular_velocity_x REAL NOT NULL,
        angular_velocity_y REAL NOT NULL,
        angular_velocity_z REAL NOT NULL,
        magnetic_field_x REAL,
        magnetic_field_y REAL,
        magnetic_field_z REAL,
        packet_sequence INTEGER,
        packet_sample_index INTEGER
      ) STRICT;
      CREATE TABLE events (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        semantics TEXT NOT NULL,
        host_monotonic_ns TEXT NOT NULL,
        host_time_utc TEXT NOT NULL,
        relative_seconds REAL NOT NULL,
        nearest_ecg_timestamp_ms REAL,
        nearest_imu_timestamp_ms REAL,
        data_json TEXT NOT NULL
      ) STRICT;
    `);
    this.insertMetadata = this.database.prepare(
      "INSERT INTO recording_metadata (key, value_json) VALUES (?, ?)",
    );
    this.insertEcg = this.database.prepare(`
      INSERT INTO ecg_samples VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.insertImu = this.database.prepare(`
      INSERT INTO imu_samples VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.insertEvent = this.database.prepare(`
      INSERT INTO events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const metadata = {
      schemaVersion: RECORDING_SCHEMA_VERSION,
      projectId: "hms-lab-tilt-ecg",
      recordingId: this.recordingId,
      startedAt: this.startedAt.toISOString(),
      sensor: this.sensor,
      acceptedSupineZero: this.zero,
      baselineBloodPressure: this.baselineBloodPressure,
      baselineEtco2: this.baselineEtco2,
      commandedTargetAngleDegrees: this.commandedTargetAngleDegrees,
      softwareVersion: this.softwareVersion,
      algorithms: {
        ecgDetector: "pan-tompkins-streaming-v1",
        heartRate: "five-consecutive-r-waves-v1",
        heartRateFormula: "240000 / (t5_ms - t1_ms)",
        tilt: "low-pass-gravity-pitch-roll-v1",
      },
    };
    for (const [key, value] of Object.entries(metadata)) {
      this.insertMetadata.run(key, JSON.stringify(value));
    }
    this.database.exec("BEGIN IMMEDIATE");
  }

  #commitIfNeeded() {
    this.transactionSampleCount += 1;
    if (this.transactionSampleCount < 500) return;
    this.database.exec("COMMIT; BEGIN IMMEDIATE");
    this.transactionSampleCount = 0;
  }

  appendEcg(sample) {
    const hostMonotonicNs =
      sample.hostMonotonicNs ?? process.hrtime.bigint().toString();
    const hostTimeNs =
      sample.hostTimeNs ?? (BigInt(Date.now()) * 1_000_000n).toString();
    const hostTime = new Date(Number(BigInt(hostTimeNs) / 1_000_000n)).toISOString();
    this.insertEcg.run(
      this.ecgCount,
      sample.sensorTimestampMs,
      hostMonotonicNs,
      hostTimeNs,
      hostTime,
      sample.rawValue,
      sample.packetSequence ?? null,
      sample.sampleIndex ?? null,
    );
    this.ecgCount += 1;
    this.lastEcgTimestampMs = sample.sensorTimestampMs;
    this.#commitIfNeeded();
  }

  appendImu(sample) {
    const hostMonotonicNs =
      sample.hostMonotonicNs ?? process.hrtime.bigint().toString();
    const hostTimeNs =
      sample.hostTimeNs ?? (BigInt(Date.now()) * 1_000_000n).toString();
    const hostTime = new Date(Number(BigInt(hostTimeNs) / 1_000_000n)).toISOString();
    this.insertImu.run(
      this.imuCount,
      sample.sensorTimestampMs,
      hostMonotonicNs,
      hostTimeNs,
      hostTime,
      sample.accelerationX,
      sample.accelerationY,
      sample.accelerationZ,
      sample.angularVelocityX,
      sample.angularVelocityY,
      sample.angularVelocityZ,
      sample.magneticFieldX ?? null,
      sample.magneticFieldY ?? null,
      sample.magneticFieldZ ?? null,
      sample.packetSequence ?? null,
      sample.sampleIndex ?? null,
    );
    this.imuCount += 1;
    this.lastImuTimestampMs = sample.sensorTimestampMs;
    this.#commitIfNeeded();
  }

  addHrEstimate(estimate) {
    this.hrEstimates.push({
      ...estimate,
      relativeSeconds: (performance.now() - this.startedMonotonicMs) / 1000,
    });
  }

  addTiltEstimate(estimate) {
    this.tiltEstimates.push({
      ...estimate,
      relativeSeconds: (performance.now() - this.startedMonotonicMs) / 1000,
    });
  }

  recordEvent({ type, label, semantics = "point", data = {} }) {
    const event = {
      id: randomUUID(),
      type,
      label,
      semantics,
      hostMonotonicNs: process.hrtime.bigint().toString(),
      hostTimeUtc: new Date().toISOString(),
      relativeSeconds: (performance.now() - this.startedMonotonicMs) / 1000,
      nearestEcgTimestampMs: this.lastEcgTimestampMs,
      nearestImuTimestampMs: this.lastImuTimestampMs,
      data,
    };
    this.insertEvent.run(
      event.id,
      event.type,
      event.label,
      event.semantics,
      event.hostMonotonicNs,
      event.hostTimeUtc,
      event.relativeSeconds,
      event.nearestEcgTimestampMs,
      event.nearestImuTimestampMs,
      JSON.stringify(event.data),
    );
    this.events.push(event);
    return event;
  }

  async stop() {
    const durationSeconds = (performance.now() - this.startedMonotonicMs) / 1000;
    this.database.exec("COMMIT");
    const stoppedAt = new Date();
    this.insertMetadata.run("stoppedAt", JSON.stringify(stoppedAt.toISOString()));
    this.insertMetadata.run("durationSeconds", JSON.stringify(durationSeconds));
    this.insertMetadata.run(
      "sampleCounts",
      JSON.stringify({ ecg: this.ecgCount, imu: this.imuCount }),
    );
    const undone = new Set(
      this.events
        .filter((event) => event.type === "annotation_undo")
        .map((event) => event.data.targetEventId),
    );
    const activePhaseEvents = this.events.filter(
      (event) => event.type === "phase" && !undone.has(event.id),
    );
    const targetReached = activePhaseEvents.find(
      (event) => event.label === "target_angle_reached",
    );
    const earlyReturn = activePhaseEvents.find(
      (event) => event.label === "begin_return_early",
    );
    const protocolOutcome = {
      commandedTargetAngleDegrees: this.commandedTargetAngleDegrees,
      targetAngleReached: Boolean(targetReached),
      earlyReturn: Boolean(earlyReturn),
      achievedAngleDegrees: targetReached
        ? this.commandedTargetAngleDegrees
        : earlyReturn?.data.achievedAngleDegrees ?? null,
      achievedAngleSource: targetReached
        ? "commanded_target_confirmed_reached"
        : earlyReturn?.data.achievedAngleDegrees !== null
          && earlyReturn?.data.achievedAngleDegrees !== undefined
          ? "operator_observation_during_acquisition"
          : null,
      earlyReturnReason: earlyReturn?.data.reason ?? null,
    };
    this.insertMetadata.run(
      "protocolOutcome",
      JSON.stringify(protocolOutcome),
    );
    this.database.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    this.database.close();
    await rename(this.partialDatabasePath, this.databasePath);
    const summaryRows = buildFiveSecondSummary({
      recordingId: this.recordingId,
      startedHostMonotonicNs: this.startedHostMonotonicNs,
      commandedTargetAngleDegrees: this.commandedTargetAngleDegrees,
      durationSeconds,
      hrEstimates: this.hrEstimates,
      tiltEstimates: this.tiltEstimates,
      events: this.events,
      baselineBloodPressure: this.baselineBloodPressure,
      baselineEtco2: this.baselineEtco2,
    });
    await writeFile(this.summaryPath, serializeSummary(summaryRows), "utf8");
    const [databaseSha256, summarySha256] = await Promise.all([
      sha256(this.databasePath),
      sha256(this.summaryPath),
    ]);
    const manifest = {
      schemaVersion: RECORDING_SCHEMA_VERSION,
      summarySchemaVersion: SUMMARY_SCHEMA_VERSION,
      projectId: "hms-lab-tilt-ecg",
      recordingId: this.recordingId,
      startedAt: this.startedAt.toISOString(),
      stoppedAt: stoppedAt.toISOString(),
      generatedAt: new Date().toISOString(),
      durationSeconds,
      finalized: true,
      sensor: this.sensor,
      acceptedSupineZero: this.zero,
      protocol: {
        commandedTargetAngleDegrees: this.commandedTargetAngleDegrees,
        ...protocolOutcome,
      },
      sampleCounts: { ecg: this.ecgCount, imu: this.imuCount },
      eventCount: this.events.length,
      files: {
        signals: {
          path: path.relative(path.dirname(this.manifestPath), this.databasePath),
          sha256: databaseSha256,
          bytes: (await readFile(this.databasePath)).byteLength,
        },
        fiveSecondSummary: {
          path: path.relative(path.dirname(this.manifestPath), this.summaryPath),
          sha256: summarySha256,
          bytes: (await readFile(this.summaryPath)).byteLength,
        },
      },
      provenance: {
        softwareVersion: this.softwareVersion,
        rawSignalsSha256: databaseSha256,
        summaryAlgorithms: {
          heartRate: "latest completed five-wave estimate as of window end",
          tilt: "native-rate estimates summarized in fixed five-second windows",
          eventProjection: "exact SQLite events projected by event onset window",
        },
      },
    };
    await atomicJson(this.manifestPath, manifest);
    return {
      recordingId: this.recordingId,
      databasePath: this.databasePath,
      summaryPath: this.summaryPath,
      manifestPath: this.manifestPath,
      databaseSha256,
      summarySha256,
    };
  }
}
