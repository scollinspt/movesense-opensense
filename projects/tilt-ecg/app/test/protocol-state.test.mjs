import assert from "node:assert/strict";
import test from "node:test";

import { ProtocolPhaseTracker } from "../protocol-state.mjs";

test("enforces one-way protocol phase progression", () => {
  const tracker = new ProtocolPhaseTracker();
  assert.deepEqual(tracker.state, {
    current: "baseline_supine",
    completed: [],
    next: "begin_tilt",
  });

  tracker.advance("begin_tilt");
  assert.equal(tracker.state.current, "begin_tilt");
  assert.equal(tracker.state.next, "target_angle_reached");
  assert.throws(
    () => tracker.advance("begin_tilt"),
    /next protocol phase must be target angle reached/,
  );
  assert.throws(
    () => tracker.advance("begin_return"),
    /next protocol phase must be target angle reached/,
  );
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
  assert.equal(tracker.state.next, "begin_tilt");
});
