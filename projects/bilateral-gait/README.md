# Bilateral Gait IMU Measurement and Recovery Tracking

## Status

The first localhost acquisition application is operational for simulator-based
workflow review and initial two-sensor hardware integration. Required hardware
timing and throughput validation remains pending. An initial bilateral processing studio now verifies finalized recordings,
compares both distal-shank streams, and displays acquisition-event anchors.
Metric-grade clock alignment, reviewed gait-event detection, and derived gait
metrics remain under development.

## Purpose

Develop a two-Movesense system that:

1. Acquires synchronized bilateral distal-shank IMU data over Bluetooth on a
   computer.
2. Makes sensor application and left/right assignment simple and explicit.
3. Bounds governed acquisition with application-controlled start and stop.
4. Records structured gait context and timestamped operator triggers.
5. Derives reviewable gait characteristics that can be followed over time
   alongside the physical therapy examination and movement system
   interpretation.

The first acquisition protocol is flat overground gait and includes both
straight walking and turning. Obstacles, treadmill walking, and other task
modifiers remain later protocol questions rather than being mixed into the
initial data collection.

This is an engineering and clinical-development project. It is not a fall
alarm, diagnostic system, medical device, or substitute for clinical
observation, guarding, or approved documentation.

## Project boundary

Project-specific documentation, configurations, schemas, applications, and
tests belong under `projects/bilateral-gait/`. Reusable Movesense transport,
multi-sensor timing, and governed-recording infrastructure should be extracted
only when the second implementation demonstrates a stable shared contract.

Human recordings and derived artifacts must remain in governed storage:

```text
MOVESENSE_DATA_ROOT/
|-- raw/bilateral-gait/YYYY-MM-DD/<recording-id>/
|-- manifests/bilateral-gait/YYYY-MM-DD/<recording-id>.json
`-- derived/bilateral-gait/YYYY-MM-DD/<recording-id>/
```

Do not commit patient recordings, identifiers, linkage keys, clinical notes,
or derived clinical artifacts to this public repository.

## Applications

- **Acquisition application:** operational localhost browser application for two-sensor
  discovery, left/right assignment, live preview, setup confirmation,
  calibration, bounded recording, structured triggers, SQLite finalization,
  checksums, and recovery. See the
  [acquisition application](acquisition-app/README.md).
- **Processing application:** the repository-owned Bilateral Gait Processing
  Studio provides read-only discovery, checksum and SQLite verification,
  bilateral stream-quality summaries, signal comparison, and acquisition-event
  review. Side-aware calibration, metric-grade inter-sensor alignment, reviewed
  gait-event detection, provenance-linked metrics, and later de-identified
  reporting remain planned stages.

On macOS, double-click:

```text
launch-bilateral-gait.command
```

to open acquisition at `http://127.0.0.1:4176/`.

## Initial sensor configuration

- One Movesense IMU on each distal medial shank.
- Each sensor immediately proximal to, but not on, the medial malleolus.
- Bilaterally symmetrical placement confirmed visually and by palpation.
- Strap perpendicular to the long axis of the shank.
- Movesense wordmark parallel to the long axis of the shank.
- `M` end directed proximally toward the knee on both limbs.
- Hardware identity explicitly assigned to `left_distal_shank` or
  `right_distal_shank`; side is never inferred from signal shape alone.

See the
[placement and calibration protocol](docs/placement-and-calibration-protocol.md).

## Initial acquisition scope

The first version is limited to:

- Flat overground walking.
- Straight gait.
- Left and right turns.
- Application-controlled start and stop.
- Structured assistive-device and assistance context.
- Timestamped path-segment and operator-observation triggers.

Flat treadmill walking is reserved in the context model but is not part of the
initial protocol. Obstacles will be modeled later as explicit task modifiers,
not silently combined with ordinary flat-overground walking.

## Documentation

- [Project charter](docs/project-charter.md)
- [Acquisition requirements](docs/acquisition-requirements.md)
- [Placement and calibration protocol](docs/placement-and-calibration-protocol.md)
- [Sensor readiness protocol](docs/sensor-readiness-protocol.md)
- [Gait context and event model](docs/gait-context-and-events.md)
- [Synchronization and timing plan](docs/synchronization-and-timing-plan.md)
- [Processing and metric plan](docs/processing-and-metric-plan.md)
- [Validation plan](docs/validation-plan.md)
- [Clinical-development boundaries](docs/clinical-development-boundaries.md)
- [Development continuity](docs/development-continuity.md)
- [Configurations](configs/README.md)
- [Schemas](schemas/README.md)
