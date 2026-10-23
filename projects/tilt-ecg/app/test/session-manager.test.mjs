import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { TiltSessionManager } from "../session-manager.mjs";

function readyManager(context) {
  const manager = new TiltSessionManager();
  context.after(() => manager.close());
  manager.connectionState = "connected";
  manager.source = { async stop() {} };
  manager.sensor = {
    mode: "synthetic",
    name: "test",
    address: "synthetic",
    ecgRateHz: 250,
    imuRateHz: 50,
  };
  manager.zero = {
    acceptedAtTimeMs: 3000,
    accelerationVector: [0, 0, 9.80665],
  };
  return manager;
}

test("validates the commanded target angle before recording", async (context) => {
  const manager = readyManager(context);
  const dataRoot = path.join(os.tmpdir(), `tilt-angle-validation-${Date.now()}`);

  await assert.rejects(
    manager.startRecording({
      dataRoot,
      baselineSystolic: 120,
      baselineDiastolic: 80,
      baselineEtco2: 40,
      targetAngleDegrees: 95,
    }),
    /target table angle/,
  );
});

test("records early return without requiring an achieved angle", async (context) => {
  const manager = readyManager(context);
  const dataRoot = path.join(os.tmpdir(), `tilt-early-return-${Date.now()}`);

  await manager.startRecording({
    dataRoot,
    baselineSystolic: 120,
    baselineDiastolic: 80,
    baselineEtco2: 40,
    targetAngleDegrees: 70,
  });
  manager.recordEvent({ type: "phase", label: "begin_tilt" });
  const earlyReturn = manager.recordEvent({
    type: "phase",
    label: "begin_return_early",
    achievedAngleDegrees: null,
    reason: "symptoms",
  });

  assert.deepEqual(earlyReturn.data, {
    commandedTargetAngleDegrees: 70,
    achievedAngleDegrees: null,
    reason: "symptoms",
  });
  assert.deepEqual(manager.state.protocolPhase.allowedNext, ["supine_recovery"]);

  const result = await manager.stopRecording();
  const manifest = JSON.parse(await readFile(result.manifestPath, "utf8"));
  assert.equal(manifest.protocol.commandedTargetAngleDegrees, 70);
  assert.equal(manifest.protocol.earlyReturn, true);
  assert.equal(manifest.protocol.achievedAngleDegrees, null);
  assert.equal(manifest.protocol.earlyReturnReason, "symptoms");
});
