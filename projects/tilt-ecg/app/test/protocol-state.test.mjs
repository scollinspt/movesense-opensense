import assert from "node:assert/strict";
import test from "node:test";

import { ProtocolPhaseTracker } from "../protocol-state.mjs";

test("enforces one-way protocol phase progression", () => {
  const tracker = new ProtocolPhaseTracker();
  assert.deepEqual(tracker.state, {
    current: "baseline_supine",
    completed: [],
    allowedNext: ["begin_tilt"],
  });

  tracker.advance("begin_tilt");
  assert.equal(tracker.state.current, "begin_tilt");
  assert.deepEqual(
    tracker.state.allowedNext,
    ["target_angle_reached", "begin_return_early"],
  );
  assert.throws(
    () => tracker.advance("begin_tilt"),
    /next protocol phase must be target angle reached or begin return early/,
  );
});

test("allows early return without reaching the target", () => {
  const tracker = new ProtocolPhaseTracker();
  tracker.advance("begin_tilt");
  tracker.advance("begin_return_early");

  assert.equal(tracker.state.current, "begin_return_early");
  assert.deepEqual(tracker.state.allowedNext, ["supine_recovery"]);
  assert.throws(
    () => tracker.advance("target_angle_reached"),
    /next protocol phase must be supine recovery/,
  );
  tracker.advance("supine_recovery");
  assert.deepEqual(tracker.state.allowedNext, []);
});

test("rebuilds progression after undoing the latest phase", () => {
  const tracker = new ProtocolPhaseTracker();
  const events = [
    { id: "baseline", type: "phase", label: "baseline_supine", data: {} },
    { id: "tilt", type: "phase", label: "begin_tilt", data: {} },
    {
      id: "undo",
      type: "annotation_undo",
      label: "undo",
      data: { targetEventId: "tilt" },
    },
  ];

  tracker.rebuild(events);

  assert.equal(tracker.state.current, "baseline_supine");
  assert.deepEqual(tracker.state.allowedNext, ["begin_tilt"]);
});
