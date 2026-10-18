import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeRecording,
  listRecordings,
  parseOpenSenseVisualization,
} from "./processing.mjs";

test("analyzes a governed IMU9 recording", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "movesense-processing-"));
  const recordingId = "20261018T091350Z-test";
  const date = "2026-10-18";
  const rawDirectory = path.join(root, "raw", date, recordingId);
  const manifestDirectory = path.join(root, "manifests", date);
  await mkdir(rawDirectory, { recursive: true });
  await mkdir(manifestDirectory, { recursive: true });
  const columns = [
    "recording_id", "sensor_identifier", "sensor_timestamp_ms", "host_monotonic_ns", "host_time_ns",
    "acceleration_x_m_s2", "acceleration_y_m_s2", "acceleration_z_m_s2",
    "angular_velocity_x_deg_s", "angular_velocity_y_deg_s", "angular_velocity_z_deg_s",
    "magnetic_field_x_uT", "magnetic_field_y_uT", "magnetic_field_z_uT",
  ];
  const csv = [
    columns.join(","),
    `${recordingId},sensor,1000,1,2,1,2,3,4,5,6,7,8,9`,
    `${recordingId},sensor,1020,1,2,2,3,4,5,6,7,8,9,10`,
    `${recordingId},sensor,1040,3,4,3,4,5,25,7,8,9,10,11`,
  ].join("\n") + "\n";
  const dataPath = path.join(rawDirectory, "imu9.csv");
  await writeFile(dataPath, csv);
  const manifest = {
    format: "movesense-opensense-raw-recording",
    version: 1,
    recordingId,
    acquisition: { sampleCount: 3 },
    protocol: { movement: "isolated_forearm_rotation" },
    dataFile: {
      path: dataPath,
      sha256: createHash("sha256").update(csv).digest("hex"),
    },
  };
  await writeFile(
    path.join(manifestDirectory, `${recordingId}.json`),
    JSON.stringify(manifest),
  );

  const report = await analyzeRecording(root, recordingId, {
    startSeconds: 0,
    endSeconds: 0.02,
  }, [{
    label: "movement",
    startSeconds: 0.02,
    endSeconds: 0.04,
  }], {
    firstMovement: "pronation",
    positiveDirection: "pronation",
  });
  const recordings = await listRecordings(root);

  assert.equal(report.integrity.checksumMatches, true);
  assert.equal(report.integrity.parsedSamples, 3);
  assert.equal(report.timing.effectiveRateHz, 50);
  assert.equal(report.timing.repeatedHostMonotonicTimestamps, 1);
  assert.deepEqual(report.ranges.acceleration[0], { min: 1, max: 3 });
  assert.equal(report.calibration.sampleCount, 2);
  assert.equal(report.oneDof.dominantAxis, "x");
  assert.equal(report.oneDof.mappingAssigned, true);
  assert.equal(recordings.length, 1);
  assert.equal(recordings[0].recordingId, recordingId);
});

test("synchronizes OpenSense quaternions with OpenSim inverse kinematics", () => {
  const orientations = [
    "DataType=Quaternion",
    "endheader",
    "time\tforearm_l_imu",
    "0\t1,0,0,0",
    "0.02\t0.9238795325,0,0,0.3826834324",
  ].join("\n");
  const motion = [
    "inDegrees=yes",
    "endheader",
    "time\telbow_flex_l",
    "0\t0",
    "0.02\t45",
  ].join("\n");

  const result = parseOpenSenseVisualization(orientations, motion, {
    side: "left",
    coordinateName: "elbow_flex_l",
    modelQuaternionAxis: "z",
    motionType: "elbow_flexion",
  });

  assert.equal(result.frames.length, 2);
  assert.equal(result.frames[1].sourceAngleDegrees.toFixed(6), "45.000000");
  assert.equal(result.frames[1].ikAngleDegrees, 45);
  assert.equal(Math.abs(result.frames[1].errorDegrees) < 1e-8, true);
});
