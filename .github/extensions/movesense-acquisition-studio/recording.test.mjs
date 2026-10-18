import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { RecordingSession } from "./recording.mjs";

test("writes immutable raw data and a checksummed manifest", async (context) => {
  const root = await context.mock.method(os, "tmpdir")();
  const sessionRoot = path.join(root, `movesense-recording-test-${Date.now()}`);
  const recording = await RecordingSession.create({
    dataRoot: sessionRoot,
    sensorAddress: "sensor-address",
    sensorName: "Movesense test",
    sampleRateHz: 52,
    movement: "bench_rotation",
    placement: "right_wrist",
    orientation: "supplied_strap_side_specific_v1",
    orientationNotes: "Test mounting",
    anatomicalStartConfirmed: true,
    proximalControlConfirmed: true,
  });
  recording.append({
    sensor_timestamp_ms: 100,
    host_monotonic_ns: 200,
    host_time_ns: 300,
    acceleration_x: 1,
    acceleration_y: 2,
    acceleration_z: 3,
    angular_velocity_x: 4,
    angular_velocity_y: 5,
    angular_velocity_z: 6,
    magnetic_field_x: 7,
    magnetic_field_y: 8,
    magnetic_field_z: 9,
  });

  const result = await recording.stop();
  const manifest = JSON.parse(await readFile(result.manifestPath, "utf8"));
  const csv = await readFile(result.dataPath, "utf8");

  assert.equal(manifest.acquisition.sampleCount, 1);
  assert.equal(manifest.protocol.movement, "bench_rotation");
  assert.equal(manifest.protocol.protocolId, "single-wrist-feasibility-v1");
  assert.match(manifest.protocol.orientationDefinition, /M end distal/);
  assert.equal(manifest.protocol.anatomicalStartConfirmed, true);
  assert.equal(manifest.dataFile.sha256, result.sha256);
  assert.match(csv, /sensor_timestamp_ms/);
  assert.match(csv, /Movesense test,100,200,300/);
});
