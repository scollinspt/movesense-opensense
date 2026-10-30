import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  analyzeBilateralRecording,
  deriveMarkerSegments,
  listBilateralRecordings,
  loadBilateralSignalWindow,
} from "./processing.mjs";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "bilateral-gait-processing-"));
  const recordingId = "20261030T155636Z-test";
  const date = "2026-10-30";
  const rawDirectory = path.join(root, "raw", "bilateral-gait", date, recordingId);
  const manifestDirectory = path.join(root, "manifests", "bilateral-gait", date);
  await mkdir(rawDirectory, { recursive: true });
  await mkdir(manifestDirectory, { recursive: true });
  const databasePath = path.join(rawDirectory, "signals.sqlite");
  const database = new DatabaseSync(databasePath);
  database.exec(`
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
  const insert = database.prepare("INSERT INTO imu_samples VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
  for (const [role, offset] of [["left_distal_shank", 0], ["right_distal_shank", 5]]) {
    for (let index = 0; index < 8; index += 1) {
      insert.run(
        role,
        index % 4,
        1000 + offset + index * 20,
        String(1_000_000_000 + offset * 1_000_000 + Math.floor(index / 4) * 80_000_000),
        "2",
        index,
        index + 1,
        index + 2,
        index + 3,
        index + 4,
        index + 5,
        6,
        7,
        8,
        Math.floor(index / 4),
      );
    }
  }
  const insertEvent = database.prepare("INSERT INTO events VALUES (?,?,?,?,?,?,?,?,?,?)");
  [
    ["gait-start", 1, "gait_bout", "flat_overground", "start", 0],
    ["straight", 2, "path_segment", "straight", "start", 0.02],
    ["transition", 3, "path_segment", "transition", "start", 0.08],
    ["gait-end", 4, "gait_bout", "flat_overground", "end", 0.14],
  ].forEach(([id, sequence, type, label, semantics, seconds]) =>
    insertEvent.run(
      id,
      sequence,
      type,
      label,
      semantics,
      String(1_000_000_000 + seconds * 1e9),
      "2026-10-30T15:56:36.475Z",
      seconds,
      JSON.stringify({
        left_distal_shank: null,
        right_distal_shank: null,
      }),
      "{}",
    )
  );
  database.close();
  const bytes = await import("node:fs/promises").then(({ readFile }) => readFile(databasePath));
  const manifest = {
    schemaVersion: "bilateral-gait-manifest-v1",
    projectId: "hms-lab-bilateral-gait",
    recordingId,
    startedAt: "2026-10-30T15:56:36.475Z",
    stoppedAt: "2026-10-30T15:56:37.475Z",
    finalized: true,
    protocol: { configId: "bilateral-gait-flat-overground-v1", environment: "flat_overground" },
    sensors: [
      { role: "left_distal_shank", requestedRateHz: 50, sideVerificationAccepted: true },
      { role: "right_distal_shank", requestedRateHz: 50, sideVerificationAccepted: true },
    ],
    sampleCounts: { left_distal_shank: 8, right_distal_shank: 8 },
    eventCount: 4,
    initialContext: { environment: "flat_overground" },
    calibrationPlan: { leftKneeMovementMode: "active", rightKneeMovementMode: "active" },
    artifacts: [{
      kind: "signals_sqlite",
      relativePath: `../../../raw/bilateral-gait/${date}/${recordingId}/signals.sqlite`,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      bytes: bytes.length,
    }],
  };
  await writeFile(
    path.join(manifestDirectory, `${recordingId}.json`),
    JSON.stringify(manifest),
  );
  return { root, recordingId };
}

test("lists and analyzes finalized bilateral gait recordings", async () => {
  const { root, recordingId } = await fixture();
  const recordings = await listBilateralRecordings(root);
  const report = await analyzeBilateralRecording(root, recordingId);

  assert.equal(recordings.length, 1);
  assert.equal(recordings[0].recordingId, recordingId);
  assert.equal(report.integrity.checksumMatches, true);
  assert.equal(report.integrity.sqliteIntegrity, "ok");
  assert.equal(report.timing.roleQuality.length, 2);
  assert.equal(report.timing.sampleCountDifference, 0);
  assert.equal(report.events.length, 4);
  assert.equal(report.segments.length, 3);
  assert.deepEqual(
    report.segments.map((segment) => [segment.type, segment.label]),
    [
      ["gait_bout", "flat_overground"],
      ["path_segment", "straight"],
      ["path_segment", "transition"],
    ],
  );
  assert.equal(report.signals.left_distal_shank.length, 8);
  assert.equal(report.signals.right_distal_shank.length, 8);

  const window = await loadBilateralSignalWindow(root, recordingId, 0.02, 0.1);
  assert.equal(window.startSeconds, 0.02);
  assert.equal(window.endSeconds, 0.1);
  assert.equal(window.segments.length, 3);
  assert.equal(window.signals.left_distal_shank.length > 0, true);
});

test("derives explicit intervals and path segments from marker semantics", () => {
  const segments = deriveMarkerSegments([
    { sequence: 1, type: "calibration", label: "standing", semantics: "start", relativeSeconds: 1 },
    { sequence: 2, type: "calibration", label: "standing", semantics: "end", relativeSeconds: 3 },
    { sequence: 3, type: "gait_bout", label: "flat", semantics: "start", relativeSeconds: 5 },
    { sequence: 4, type: "path_segment", label: "straight", semantics: "start", relativeSeconds: 6 },
    { sequence: 5, type: "path_segment", label: "turn_left", semantics: "start", relativeSeconds: 8 },
    { sequence: 6, type: "gait_bout", label: "flat", semantics: "end", relativeSeconds: 10 },
  ]);
  assert.deepEqual(
    segments.map((segment) => [segment.type, segment.label, segment.startSeconds, segment.endSeconds]),
    [
      ["calibration", "standing", 1, 3],
      ["gait_bout", "flat", 5, 10],
      ["path_segment", "straight", 6, 8],
      ["path_segment", "turn_left", 8, 10],
    ],
  );
});
