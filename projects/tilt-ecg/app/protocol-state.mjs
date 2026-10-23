export const PRIMARY_PHASES = [
  "baseline_supine",
  "begin_tilt",
  "target_angle_reached",
  "begin_return",
  "begin_return_early",
  "supine_recovery",
];

const ALLOWED_TRANSITIONS = {
  baseline_supine: ["begin_tilt"],
  begin_tilt: ["target_angle_reached", "begin_return_early"],
  target_angle_reached: ["begin_return"],
  begin_return: ["supine_recovery"],
  begin_return_early: ["supine_recovery"],
  supine_recovery: [],
};

export class ProtocolPhaseTracker {
  constructor() {
    this.reset();
  }

  reset() {
    this.history = ["baseline_supine"];
  }

  get state() {
    const current = this.history.at(-1);
    return {
      current,
      completed: this.history.slice(0, -1),
      allowedNext: [...ALLOWED_TRANSITIONS[current]],
    };
  }

  assertNext(label) {
    if (!PRIMARY_PHASES.includes(label)) return;
    const allowed = ALLOWED_TRANSITIONS[this.history.at(-1)];
    if (!allowed.includes(label)) {
      const readable = allowed.length
        ? allowed.map((value) => value.replaceAll("_", " ")).join(" or ")
        : "test completion";
      throw new Error(`The next protocol phase must be ${readable}.`);
    }
  }

  advance(label) {
    this.assertNext(label);
    if (PRIMARY_PHASES.includes(label)) this.history.push(label);
  }

  rebuild(events) {
    const undone = new Set(
      events
        .filter((event) => event.type === "annotation_undo")
        .map((event) => event.data.targetEventId),
    );
    const activeLabels = events
      .filter((event) => (
        event.type === "phase"
        && PRIMARY_PHASES.includes(event.label)
        && !undone.has(event.id)
      ))
      .map((event) => event.label);
    this.reset();
    for (const label of activeLabels) {
      if (label === "baseline_supine") continue;
      this.advance(label);
    }
  }
}
