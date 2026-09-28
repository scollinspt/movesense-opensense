# Workplan

## Objective

Build an open, reproducible pipeline that acquires Movesense IMU measurements and produces synchronized, convention-documented orientation data suitable for OpenSense/OpenSim. Interoperability milestones do not establish scientific or clinical validity.

## Milestone 1: Hardware inventory and bench acquisition

Establish what the available sensors and acquisition path actually provide before designing downstream processing.

### Work

1. Inventory each available Movesense sensor, including model, hardware identifier, firmware version, battery, attachment accessories, and Flash capability.
2. Record the receiving computer or mobile device, operating system, Bluetooth adapter, and acquisition software versions.
3. Select and document the initial acquisition route, with the official GATT SensorData Protocol Python client as the leading candidate.
4. Capture a short, non-human, single-sensor bench recording containing accelerometer, gyroscope, and magnetometer measurements.
5. Document the exact source schema, units, sample-rate configuration, sensor-native timing or counters, packet sequence information, and host receipt timing available from that route.
6. Add a synthetic or explicitly redistributable fixture representing the verified schema.
7. Implement one command that inspects a recording and reports sample counts, timing continuity, and missing or malformed records.

### Exit criteria

- Hardware and firmware inventory is complete for the sensors intended for the pilot.
- Acquisition software and configuration are recorded reproducibly.
- A non-human bench recording is retained in governed storage with a checksum and provenance manifest.
- The raw data contract distinguishes sensor-native timing from host receipt timing.
- The public test suite can inspect a redistributable fixture without governed-storage access.
- Unknown fields, timing limitations, and open acquisition questions are recorded explicitly.

## Milestone 2: Multi-sensor timing

Capture a mechanically shared event with two sensors, estimate clock offset and drift from sensor-native timing, quantify packet loss and jitter, and define a synchronized-stream contract. Simultaneous BLE subscription is not evidence of synchronized sensing.

## Milestone 3: Calibration and orientation estimation

Select a maintained, license-compatible sensor-fusion implementation; document initialization, magnetic-field handling, quaternion conventions, and coordinate frames; then validate static poses and prescribed rotations.

## Milestone 4: Minimal OpenSense integration

Map two or three logical sensors to model IMU frames, export normalized quaternions in OpenSense-compatible `.sto` format, run `IMUPlacer` and `IMUInverseKinematicsTool`, and retain orientation errors and reproducibility records.

## Milestone 5: External and task-specific validation

Compare bounded outputs against an appropriate synchronized reference. Scientific or clinically relevant claims require separate task-specific protocols, uncertainty analysis, and acceptance criteria.

## Cross-cutting requirements

- Keep identifiable, restricted, or human-subject data out of Git and SimTK.
- Preserve raw measurements and transformation provenance.
- Use released OpenSim Python APIs unless an engine modification is justified.
- Use synthetic or explicitly redistributable public fixtures.
- Record decisions, assumptions, software versions, checksums, and validation evidence.
- Keep user-facing workflows reproducible and progressively reduce manual file editing.
