import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import {
  GaitRecordingSession,
  recoverInterruptedRecordings,
} from "../recording.mjs";

function sample(index) {
  return {
    sensorTimestampMs: index * 20,
    hostMonotonicNs: String(1_000_000_000 + index * 20_000_000),
    hostTimeNs: String(2_000_000_000 + index * 20_000_000),
    accelerationX: 0,
    accelerationY: 1,
    accelerationZ: 9.8,
    angularVelocityX: index,
    angularVelocityY: 0,
    angularVelocityZ: 0,
    magneticFieldX: 10,
    magneticFieldY: 20,
    magneticFieldZ: 30,
    packetSequence: index,
    sampleIndex: index,
  };
}

test("finalizes two native-rate streams and exact events", async (context) => {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "gait-recording-"));
  context.after(() => rm(dataRoot, { recursive: true, force: true }));
  const session = await GaitRecordingSession.create({
    dataRoot,
    sensors: [
      {
        role: "left_distal_shank",
        hardwareId: "LEFT",
        resource: "/Meas/IMU9/52",
        requestedRateHz: 52,
        sideVerificationAccepted: true,
      },
      {
        role: "right_distal_shank",
        hardwareId: "RIGHT",
        resource: "/Meas/IMU9/52",
        requestedRateHz: 52,
        sideVerificationAccepted: true,
      },
    ],
    placement: { mEndsProximal: true },
    calibrationPlan: {
      preferredMovementMode: "active",
      assistanceWhenNeeded: true,
      leftKneeMovementMode: "active",
      rightKneeMovementMode: "active_assisted",
    },
    initialContext: {
      environment: "flat_overground",
      assistiveDevice: "hemi_walker",
      assistanceLevel: "contact_guard",
      orthosis: "left_afo",
    },
    softwareVersion: "test",
  });

  for (let index = 0; index < 4; index += 1) {
    session.appendSample("left_distal_shank", sample(index));
    session.appendSample("right_distal_shank", sample(index));
  }
  session.recordEvent({
    type: "path_segment",
    label: "straight",
    semantics: "start",
    data: {},
    streamProjection: {
      left_distal_shank: {
        sensorTimestamp: 60,
        sampleIndex: 3,
        absoluteTimeDifferenceSeconds: 0,
      },
      right_distal_shank: {
        sensorTimestamp: 60,
        sampleIndex: 3,
        absoluteTimeDifferenceSeconds: 0,
      },
    },
  });
  const result = await session.finalize();

  assert.deepEqual(result.sampleCounts, {
    left_distal_shank: 4,
    right_distal_shank: 4,
  });
  assert.equal(result.eventCount, 1);
  assert.equal(result.checksum.length, 64);
  const manifest = JSON.parse(await readFile(result.manifestPath, "utf8"));
  assert.equal(manifest.finalized, true);
  assert.equal(manifest.sensors[0].role, "left_distal_shank");
  assert.equal(
    manifest.calibrationPlan.rightKneeMovementMode,
    "active_assisted",
  );
  const database = new DatabaseSync(result.databasePath, { readOnly: true });
  try {
    assert.equal(
      database.prepare("SELECT COUNT(*) AS count FROM imu_samples").get().count,
      8,
    );
    assert.equal(
      database.prepare("SELECT label FROM events").get().label,
      "straight",
    );
  } finally {
    database.close();
  }
});

test("recovers an interrupted recording as incomplete", async (context) => {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "gait-recovery-"));
  context.after(() => rm(dataRoot, { recursive: true, force: true }));
  const session = await GaitRecordingSession.create({
    dataRoot,
    sensors: [],
    placement: {},
    calibrationPlan: {},
    initialContext: {},
    softwareVersion: "test",
  });
  session.appendSample("left_distal_shank", sample(0));
  session.appendSample("right_distal_shank", sample(0));
  session.database.exec("COMMIT; PRAGMA wal_checkpoint(TRUNCATE)");
  session.database.close();

  const recovered = await recoverInterruptedRecordings(dataRoot);
  assert.equal(recovered.length, 1);
  assert.deepEqual(recovered[0].sampleCounts, {
    left_distal_shank: 1,
    right_distal_shank: 1,
  });
  const manifest = JSON.parse(
    await readFile(recovered[0].manifestPath, "utf8"),
  );
  assert.equal(manifest.finalized, false);
  assert.equal(manifest.recoveryStatus, "interrupted_incomplete");
});
