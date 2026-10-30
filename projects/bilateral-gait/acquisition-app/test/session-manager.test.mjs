import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { GaitSessionManager } from "../session-manager.mjs";

const setup = {
  symmetricalPlacement: true,
  proximalMalleoli: true,
  wordmarksParallel: true,
  mEndsProximal: true,
  mountsStable: true,
  leftMovementVerified: true,
  rightMovementVerified: true,
  leftKneeMovementMode: "active",
  rightKneeMovementMode: "active_assisted",
  assistiveDevice: "front_wheeled_walker",
  assistanceLevel: "contact_guard",
  orthosis: "left_afo",
  otherDescription: "",
};

test("runs a bounded simulated flat-overground session", async (context) => {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "gait-manager-"));
  const manager = new GaitSessionManager();
  context.after(async () => {
    await manager.close();
    await rm(dataRoot, { recursive: true, force: true });
  });
  await manager.connectSynthetic();
  manager.configureSetup(setup);
  assert.equal(manager.state.ready, true);
  await manager.startRecording({ dataRoot });
  assert.throws(
    () => manager.recordEvent({
      type: "calibration",
      label: "post_gait_seated_reference",
      semantics: "start",
    }),
    /Complete a gait bout/,
  );
  manager.recordEvent({
    type: "calibration",
    label: "left_knee_extension_flexion",
    semantics: "start",
  });
  manager.recordEvent({
    type: "calibration",
    label: "left_knee_extension_flexion",
    semantics: "end",
  });
  manager.recordEvent({ type: "gait_bout", semantics: "start" });
  manager.recordEvent({ type: "path_segment", label: "straight" });
  manager.recordEvent({ type: "path_segment", label: "turn_left" });
  manager.recordEvent({ type: "gait_bout", semantics: "end" });
  manager.recordEvent({
    type: "calibration",
    label: "post_gait_seated_reference",
    semantics: "start",
  });
  manager.recordEvent({
    type: "calibration",
    label: "post_gait_seated_reference",
    semantics: "end",
  });
  const finalized = await manager.stopRecording();

  assert.equal(finalized.eventCount, 10);
  assert.equal(finalized.checksum.length, 64);
  assert.equal(manager.state.recording, null);
  assert.equal(manager.state.lastFinalization.recordingId, finalized.recordingId);
});

test("rejects duplicate hardware role assignments", async (context) => {
  const manager = new GaitSessionManager();
  context.after(() => manager.close());
  await assert.rejects(
    manager.connectHardware({
      leftAddress: "same",
      rightAddress: "same",
      imuRateHz: 52,
    }),
    /different sensors/,
  );
});
