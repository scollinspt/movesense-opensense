# Bilateral Gait Development Continuity

## Current status

The project has a documentation, protocol, and initial schema foundation. The
first localhost acquisition application supports simulator review, two-sensor
hardware assignment, live preview, governed SQLite recording, structured
events, finalization, checksums, and explicit recovery. Hardware timing and
throughput validation remains pending. The processing application has not yet
been implemented.

## Confirmed decisions

- Working name: Bilateral Gait IMU Measurement and Recovery Tracking.
- Repository slug: `bilateral-gait`.
- Two Movesense sensors over Bluetooth to a computer.
- One sensor on each distal medial shank.
- Placement immediately proximal to, but not on, the medial malleolus.
- Bilaterally symmetrical placement; no centimeter measurement required.
- Strap perpendicular and wordmark parallel to the shank long axis.
- `M` points proximally on both limbs.
- Hardware ID is explicitly assigned to left or right.
- Initial supported-seated static reference.
- One-leg-at-a-time active knee extension/flexion is preferred for side and
  functional-axis verification; active-assisted or passive movement is allowed
  when needed and recorded by limb.
- A strongly recommended post-gait supported-seated reference follows the gait
  bouts and supports return-error review; it is not a gait calibration stage.
- Application-bounded start, stop, finalization, and recovery.
- First protocol: flat overground, including straight and turning gait.
- Assistive device, physical assistance, orthosis, surface, and path geometry
  are separate context dimensions.
- Treadmill and obstacles are deferred.

## Current unresolved questions

- Which gait characteristics the students most need to follow.
- Exact acquisition IMU rate after two-sensor throughput testing.
- SQLite table and packet-provenance details.
- Measured inter-sensor clock behavior.
- Which reference system will validate each candidate gait event.
- Metric-specific acceptance thresholds.
- Whether a later report is useful before longitudinal repeatability is known.

## Immediate next implementation sequence

1. Review the documentation and initial contracts.
2. Review the acquisition interface using its deterministic two-sensor
   simulator.
3. Measure two-sensor BLE and native-clock behavior.
4. Validate hardware preview, role assignment, recording, finalization, and
   recovery.
5. Validate with a rigid fixture and non-patient development walking.
6. Begin the processing application only after source and timing contracts are
   stable.

## Boundary

Do not place patient data in this repository. Clinical-development use requires
the applicable authorization and safety workflow even if the software is
technically operational.
