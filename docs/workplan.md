# Workplan

## Objective

Build an open, reproducible pipeline that acquires Movesense IMU measurements and produces synchronized, convention-documented orientation data suitable for OpenSense/OpenSim. Interoperability milestones do not establish scientific or clinical validity.

## Milestone 1: Inventory and single-sensor feasibility

Establish what the available sensors and acquisition path actually provide before designing downstream processing.

### Work

1. Inventory each available Movesense sensor, including model, hardware identifier, firmware version, battery, attachment accessories, and Flash capability.
2. Record the receiving computer or mobile device, operating system, Bluetooth adapter, and acquisition software versions.
3. Select and document the initial acquisition route, with the official GATT SensorData Protocol Python client as the leading candidate.
4. Capture a short, non-human, single-sensor bench recording containing accelerometer, gyroscope, and magnetometer measurements.
5. Document the exact source schema, units, sample-rate configuration, sensor-native timing or counters, packet sequence information, and host receipt timing available from that route.
6. Add a synthetic or explicitly redistributable fixture representing the verified schema.
7. Implement one command that inspects a recording and reports sample counts, timing continuity, and missing or malformed records.
8. Obtain and record the institutional governance determination required before any human activity.
9. If permitted, complete one simple one-sensor human feasibility session to assess attachment, tolerability, workflow, recording continuity, and data quality without making validity or clinical claims.

### Exit criteria

- Hardware and firmware inventory is complete for the sensors intended for the pilot.
- Acquisition software and configuration are recorded reproducibly.
- A non-human bench recording is retained in governed storage with a checksum and provenance manifest.
- The raw data contract distinguishes sensor-native timing from host receipt timing.
- The public test suite can inspect a redistributable fixture without governed-storage access.
- Unknown fields, timing limitations, and open acquisition questions are recorded explicitly.
- The governance status of human feasibility work is explicit.
- If a human session is permitted and justified, its workflow and data-quality findings are recorded separately from measurement-validity claims.

## Milestone 2: Multi-sensor timing and scaling

1. Capture a mechanically shared event with two sensors in a non-human setup.
2. Estimate clock offset and drift from sensor-native timing; quantify packet loss, jitter, start and stop behavior, and residual alignment error.
3. Repeat non-human load tests with 3, 5, and 10 sensors at the intended stream and sample rate.
4. Make sensor count a versioned configuration option rather than a code change.
5. After a documented governance determination, and only if permitted, complete simple human feasibility sessions first with two sensors and then with 3, 5, and 10 sensors.
6. Advance only after the corresponding non-human stage and preceding human stage meet predefined stop/go criteria.

Simultaneous BLE subscription is not evidence of synchronized sensing. Configuration support is not evidence that a sensor count performs acceptably.

## Milestone 3: Calibration and orientation estimation

Select a maintained, license-compatible sensor-fusion implementation; document initialization, magnetic-field handling, quaternion conventions, and coordinate frames; then validate static poses and prescribed rotations. Repeat the non-human-before-human progression for one sensor, two sensors, and justified higher sensor counts rather than generalizing from a single configuration.

## Milestone 4: Minimal OpenSense integration

Round-trip synthetic trajectories first, then map two or three logical sensors to model IMU frames in a non-human acceptance run. Export normalized quaternions in OpenSense-compatible `.sto` format, run `IMUPlacer` and `IMUInverseKinematicsTool`, and retain orientation errors and reproducibility records. A bounded human OpenSense feasibility session may follow only after governance review and successful non-human acceptance.

## Milestone 5: External and task-specific validation

Compare bounded outputs against an appropriate synchronized reference, beginning with non-human prescribed motion before any governed human comparison. Scientific or clinically relevant claims require separate task-specific protocols, uncertainty analysis, and acceptance criteria.

## Governing escalation rule

Every new sensor count, task, placement, or processing claim is demonstrated non-human before a corresponding human feasibility stage is considered. The planned sensor-count progression is one sensor, two sensors, and then 3, 5, and 10 sensors. Human activity requires a documented institutional governance determination and applicable consent, privacy, supervision, and data plans. Human feasibility evaluates workflow and bounded method behavior; it does not establish validity, reliability, clinical utility, or an operational service.

## Cross-cutting requirements

- Keep identifiable, restricted, or human-subject data out of Git and SimTK.
- Preserve raw measurements and transformation provenance.
- Use released OpenSim Python APIs unless an engine modification is justified.
- Use synthetic or explicitly redistributable public fixtures.
- Record decisions, assumptions, software versions, checksums, and validation evidence.
- Keep user-facing workflows reproducible and progressively reduce manual file editing.
- Record stop/go criteria and the evidence supporting every increase in sensor count or task complexity.
