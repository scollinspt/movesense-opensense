import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import {
  buildFiveSecondSummary,
  recoverInterruptedRecordings,
  TiltRecordingSession,
} from "../recording.mjs";

test("projects asynchronous estimates and exact events into fixed windows", () => {
  const rows = buildFiveSecondSummary({
    durationSeconds: 11,
    hrEstimates: [
      { relativeSeconds: 4.5, bpm: 60, quality: "good" },
      { relativeSeconds: 6, bpm: 65, quality: "good" },
      { relativeSeconds: 8, bpm: 70, quality: "good" },
    ],
    tiltEstimates: [
      { relativeSeconds: 1, tiltDegrees: 0, offAxisRollDegrees: 0, quality: "good" },
      { relativeSeconds: 4, tiltDegrees: 10, offAxisRollDegrees: 2, quality: "good" },
      { relativeSeconds: 6, tiltDegrees: 20, offAxisRollDegrees: 3, quality: "good" },
    ],
    events: [
      {
        id: "phase-1",
        type: "phase",
        label: "begin_tilt",
        relativeSeconds: 5.2,
        data: {},
      },
      {
        id: "symptom-1",
        type: "symptom",
        label: "presyncope",
        relativeSeconds: 7,
        data: {},
      },
    ],
    baselineBloodPressure: { systolic: 120, diastolic: 80 },
    baselineEtco2: 40,
  });

  assert.equal(rows.length, 3);
  assert.equal(rows[0].hr_bpm, 60);
  assert.equal(rows[1].hr_bpm, 70);
  assert.equal(rows[1].hr_estimate_count, 2);
  assert.equal(rows[1].phase, "begin_tilt");
  assert.equal(rows[1].tilt_mean_deg, 20);
  assert.match(rows[1].annotations_json, /presyncope/);
});

test("finalizes SQLite, summary, and checksum manifest", async (context) => {
  const root = await context.mock.method(os, "tmpdir")();
  const dataRoot = path.join(root, `tilt-ecg-test-${Date.now()}`);
  const recording = await TiltRecordingSession.create({
    dataRoot,
    sensor: {
      mode: "synthetic",
      name: "test",
      address: "synthetic",
      ecgRateHz: 250,
      imuRateHz: 50,
    },
    zero: {
      acceptedAtTimeMs: 3000,
      accelerationVector: [0, 0, 9.80665],
    },
    baselineBloodPressure: { systolic: 120, diastolic: 80 },
    baselineEtco2: 40,
    softwareVersion: "test",
  });
  recording.appendEcg({
    sensorTimestampMs: 3010,
    rawValue: 1.2,
    packetSequence: 1,
    sampleIndex: 0,
  });
  recording.appendImu({
    sensorTimestampMs: 3020,
    accelerationX: 0,
    accelerationY: 0,
    accelerationZ: 9.80665,
    angularVelocityX: 0,
    angularVelocityY: 0,
    angularVelocityZ: 0,
    packetSequence: 2,
    sampleIndex: 0,
  });
  recording.recordEvent({
    type: "symptom",
    label: "presyncope",
    semantics: "onset",
  });

  const result = await recording.stop();
  const manifest = JSON.parse(await readFile(result.manifestPath, "utf8"));
  const summary = await readFile(result.summaryPath, "utf8");
  const database = new DatabaseSync(result.databasePath, { readOnly: true });
  const ecgCount = database.prepare("SELECT COUNT(*) AS count FROM ecg_samples").get();
  const eventCount = database.prepare("SELECT COUNT(*) AS count FROM events").get();
  database.close();

  assert.equal(ecgCount.count, 1);
  assert.equal(eventCount.count, 1);
  assert.equal(manifest.finalized, true);
  assert.equal(manifest.files.signals.sha256, result.databaseSha256);
  assert.equal((await stat(result.databasePath)).isFile(), true);
  assert.match(summary, /hr_source_time_s/);
  assert.match(summary, /presyncope/);
});

test("explicitly recovers an interrupted partial database", async (context) => {
  const root = await context.mock.method(os, "tmpdir")();
  const dataRoot = path.join(root, `tilt-ecg-recovery-test-${Date.now()}`);
  const recording = await TiltRecordingSession.create({
    dataRoot,
    sensor: { mode: "synthetic", ecgRateHz: 250, imuRateHz: 50 },
    zero: { acceptedAtTimeMs: 3000, accelerationVector: [0, 0, 9.80665] },
    baselineBloodPressure: { systolic: 120, diastolic: 80 },
    baselineEtco2: 40,
    softwareVersion: "test",
  });
  recording.appendEcg({
    sensorTimestampMs: 3010,
    rawValue: 1,
    packetSequence: 1,
    sampleIndex: 0,
  });
  recording.database.exec("COMMIT; PRAGMA wal_checkpoint(TRUNCATE)");
  recording.database.close();

  const recovered = await recoverInterruptedRecordings(dataRoot);
  assert.equal(recovered.length, 1);
  assert.equal(recovered[0].recordingId, recording.recordingId);
  assert.equal(recovered[0].sampleCounts.ecg, 1);
  assert.equal((await stat(recovered[0].databasePath)).isFile(), true);
  const manifest = JSON.parse(await readFile(recovered[0].manifestPath, "utf8"));
  assert.equal(manifest.finalized, false);
  assert.equal(manifest.recoveryStatus, "interrupted_incomplete");
  assert.equal(manifest.summaryAvailable, false);
});
