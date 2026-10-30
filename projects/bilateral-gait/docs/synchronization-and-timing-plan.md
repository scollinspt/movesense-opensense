# Synchronization and Timing Plan

## Objective

Establish whether two independently streaming Movesense sensors support the
timing accuracy required for bilateral gait comparisons.

Bluetooth arrival time similarity is not evidence of sensor synchronization.

## Preserved time domains

For each sensor preserve:

- Sensor-native timestamp or counter.
- Host monotonic receipt time.
- Host wall-clock receipt time.
- Packet or batch boundaries.
- Sample index.

For each event preserve:

- Host monotonic event time.
- Host wall-clock event time.
- Nearest native timestamp and sample index from each stream.

Do not replace native times with host times or force samples onto a common grid
during acquisition.

## Questions to measure

- Are native clocks initialized independently?
- What is the initial inter-sensor offset?
- Does relative offset drift during a typical session?
- Are samples batched before notification?
- How do packet loss and reconnect affect alignment?
- Can a common movement event estimate residual alignment?
- What uncertainty remains after correction?

## Bench sequence

1. Stream both sensors while stationary.
2. Mount both sensors rigidly to the same object with documented alignment.
3. Apply multiple sharp, non-damaging rotations separated by still periods.
4. Repeat at the beginning and end of a session-length recording.
5. Compare gyroscope and acceleration features in native time.
6. Estimate offset and drift without using host arrival as ground truth.
7. Repeat after disconnect and reconnect.

## Processing artifact

Alignment must be stored as a derived artifact containing:

- Source recording and checksums.
- Algorithm version.
- Feature events used.
- Offset model.
- Drift model.
- Residual timing error.
- Excluded intervals.
- Reviewer decision.

Raw timestamps remain unchanged.

## Initial advancement criteria

Thresholds will be fixed after bench measurement rather than guessed. Before
bilateral temporal asymmetry is reported, validation must demonstrate:

- Continuous native timing for both streams or explicit gaps.
- Stable or correctable relative timing.
- Residual alignment uncertainty small relative to the gait timing outcome.
- Repeatability across recordings and reconnects.
- Failure signaling when alignment is not adequate.

If uncertainty is not small enough for a metric, that metric is not
assessable.

