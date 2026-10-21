export const PRIMARY_PHASES = [
  "baseline_supine",
  "begin_tilt",
  "target_angle_reached",
  "begin_return",
  "supine_recovery",
];

export class ProtocolPhaseTracker {
  constructor() {
    this.reset();
  }

  reset() {
    this.index = 0;
  }

  get state() {
    return {
      current: PRIMARY_PHASES[this.index],
      completed: PRIMARY_PHASES.slice(0, this.index),
      next: PRIMARY_PHASES[this.index + 1] ?? null,
    };
  }

  assertNext(label) {
    if (!PRIMARY_PHASES.includes(label)) return;
    const expected = PRIMARY_PHASES[this.index + 1] ?? null;
    if (label !== expected) {
      const readable = expected?.replaceAll("_", " ") ?? "test completion";
      throw new Error(`The next protocol phase must be ${readable}.`);
    }
  }

  advance(label) {
    this.assertNext(label);
    if (PRIMARY_PHASES.includes(label)) this.index += 1;
  }

  rebuild(events) {
    const undone = new Set(
      events
        .filter((event) => event.type === "annotation_undo")
        .map((event) => event.data.targetEventId),
    );
    const activeLabels = new Set(
      events
        .filter((event) => (
          event.type === "phase"
          && PRIMARY_PHASES.includes(event.label)
          && !undone.has(event.id)
        ))
        .map((event) => event.label),
    );
    this.index = 0;
    while (
      this.index + 1 < PRIMARY_PHASES.length
      && activeLabels.has(PRIMARY_PHASES[this.index + 1])
    ) {
      this.index += 1;
    }
  }
}
