# Workplan

## Objective

Build an open, reproducible pipeline that acquires Movesense IMU measurements and produces synchronized, convention-documented orientation data suitable for OpenSense/OpenSim. Interoperability milestones do not establish scientific or clinical validity.

## Current state and next execution order

Completed engineering milestones:

1. Live macOS BLE/GSP acquisition of governed IMU9 recordings.
2. Checksum, schema, timing-continuity, calibration, and movement-interval
   inspection in the Processing Studio.
3. Constrained one-sensor forearm pronation/supination and elbow
   flexion/extension estimators.
4. Side-aware quaternion STO generation, project-owned one-DOF OpenSim models,
   OpenSense inverse kinematics, and numerical round-trip validation.
5. Synchronized in-canvas visualization of the source OpenSense orientation and
   OpenSim IK motion.

Next execution order:

1. Diagnose the failed two-coordinate validation using phase-trimmed residuals,
   forearm-coordinate limits, attachment placement, and proximal-motion review.
2. Decide whether the existing trial can support a corrected model
   configuration or whether to repeat it with a dedicated magnetic calibration
   and more explicit static holds between phases.
3. Add a 3-D-capable viewer only after the two-coordinate result meets its
   orientation-residual and cross-talk criteria.
4. Reuse the validated full-orientation pipeline for a distal-humerus, three-DOF,
   fixed-trunk and fixed-scapula shoulder model and 3-D visualization.
5. Complete the staged isolated and combined one-sensor shoulder session.
6. Extend acquisition to two concurrent sensors and complete the rigid-fixture
   timing session.
7. Add explicit inter-sensor synchronization diagnostics and acceptance output.
8. Complete isolated and combined two-sensor elbow and forearm sessions using
   relative segment orientation.
9. Defer unconstrained shoulder-girdle interpretation and larger sensor counts
   until the two-sensor path is measured and reproducible.

## Milestone 1: Inventory and single-sensor feasibility

**Status: engineering feasibility achieved; repeatability work remains.**

Establish what the available sensors and acquisition path actually provide before designing downstream processing.

### Work

1. Inventory each available Movesense sensor, including model, hardware identifier, firmware version, battery, attachment accessories, and Flash capability.
2. Record the receiving computer or mobile device, operating system, Bluetooth adapter, and acquisition software versions.
3. Select and document the initial acquisition route, with the official GATT SensorData Protocol Python client as the leading candidate.
4. Capture a short, non-human, single-sensor bench recording containing accelerometer, gyroscope, and magnetometer measurements.
5. Document the exact source schema, units, sample-rate configuration, sensor-native timing or counters, packet sequence information, and host receipt timing available from that route.
6. Add a synthetic or explicitly redistributable fixture representing the verified schema.
7. Implement one command that inspects a recording and reports sample counts, timing continuity, and missing or malformed records.
8. Use a simple non-human fixture to hold the sensor stationary and place it in repeatable approximate orientations. A specialized encoded fixture is not required for this milestone.
9. Obtain and record the institutional governance determination required before any human activity.
10. If permitted, complete one simple one-sensor human feasibility session to assess attachment, tolerability, workflow, recording continuity, and data quality without making validity or clinical claims.

### Constrained single-wrist movement progression

Use the versioned `single-wrist-feasibility-v1` mounting and protocol before
adding multi-joint or shoulder motion. Require explicit confirmation of the
anatomical starting position and control of the trunk and non-target joints
before every recording.

1. Capture a static anatomical-position reference.
2. Capture isolated forearm supination/pronation as one DOF while the trunk,
   shoulder, elbow, and wrist remain in their defined positions.
3. Capture isolated elbow flexion/extension as one sagittal-plane DOF while the
   trunk and shoulder remain fixed and forearm rotation is held constant.
4. Combine elbow flexion/extension with forearm rotation as two DOFs only after
   the isolated stages pass. Treat forearm rotation as occurring in a reference
   frame that changes with elbow position.
5. Defer shoulder movement until the constrained elbow-plus-forearm problem is
   understood. Then progress from isolated shoulder motion (three DOFs), to
   shoulder plus elbow, and finally shoulder plus elbow plus forearm.

This progression controls degrees of freedom for development; it does not make
all joint coordinates observable from one distal sensor. The combined
shoulder-elbow-forearm chain will require additional segment sensors and/or
validated model constraints.

### Exit criteria

- Hardware and firmware inventory is complete for the sensors intended for the pilot.
- Acquisition software and configuration are recorded reproducibly.
- A non-human bench recording is retained in governed storage with a checksum and provenance manifest.
- The raw data contract distinguishes sensor-native timing from host receipt timing.
- The public test suite can inspect a redistributable fixture without governed-storage access.
- Unknown fields, timing limitations, and open acquisition questions are recorded explicitly.
- The bench fixture can hold repeatable approximate poses, but no orientation-estimation validity claim is made in this milestone.
- The governance status of human feasibility work is explicit.
- If a human session is permitted and justified, its workflow and data-quality findings are recorded separately from measurement-validity claims.
- Isolated forearm and isolated elbow recordings are completed before any
  combined two-DOF recording.
- Starting-pose and proximal-control confirmations are retained in each
  recording manifest.

## Milestone 2: Multi-sensor timing and scaling

**Status: next major implementation milestone.**

1. Generalize the acquisition session from one connection to a versioned list of
   sensor connections without duplicating recording logic.
2. Capture mechanically shared events with two sensors on one rigid non-human
   fixture using Session 2 of `upper-limb-next-sessions-v1`.
3. Estimate clock offset and drift from sensor-native timing; quantify packet
   loss, jitter, start and stop behavior, and residual alignment error.
4. Add a synchronized two-sensor recording manifest and Processing Studio
   diagnostics before interpreting joint motion.
5. Complete isolated two-sensor elbow and forearm researcher self-experiments,
   followed by the defined combined-motion session.
6. Repeat non-human load tests with 3, 5, and 10 sensors only after the
   two-sensor path meets its timing and reliability criteria.
7. Make sensor count a versioned configuration option rather than a code
   change.

Simultaneous BLE subscription is not evidence of synchronized sensing. Configuration support is not evidence that a sensor count performs acceptably.

## Milestone 3: Calibration and orientation estimation

**Status: full-orientation prototype implemented; first two-DOF trial failed validation.**

The current gyroscope-only integrator is intentionally limited to isolated
one-axis trials. The next processing milestone is a one-sensor, two-DOF wrist
trial with a fixed humerus. Select a maintained, license-compatible
sensor-fusion implementation; document initialization, magnetic-field handling,
quaternion conventions, and sensor-to-model coordinate frames; then solve
elbow flexion and forearm rotation with a two-coordinate constrained model. The
staged protocol includes isolated phases before combined motion so coordinate
cross-talk can be inspected.

After that milestone, two-sensor segment processing must calculate relative
orientation rather than assigning a distal sensor angle directly to a joint
coordinate. Before two-sensor work, reuse the same full-orientation foundation
for a distal-humerus sensor and a three-coordinate shoulder model. Stage
flexion/extension, abduction/adduction, and internal/external rotation
separately before combined shoulder motion. Treat the fixed scapula as an
explicit model constraint, not an observed anatomical fact. An encoded gimbal
may be considered later if quantitative orientation validation requires it.

## Milestone 4: Minimal OpenSense integration

**Status: upper-limb one-DOF interoperability achieved; multi-segment work remains.**

The project now exports normalized neutral-referenced quaternions, builds
side-aware fixed-humerus forearm and elbow models, runs
`IMUInverseKinematicsTool`, retains orientation errors, and validates the
coordinate trajectory against the source constrained angle. The Processing
Studio visualizes the OpenSense orientation and OpenSim IK result together.

Next, add a two-coordinate fixed-humerus model and a 3-D-capable synchronized
viewer for the one-sensor elbow-plus-forearm trial. Preserve the existing
one-DOF path as a regression fixture rather than applying its dominant-axis
estimator to combined motion. Then add a three-coordinate, fixed-trunk and
fixed-scapula shoulder model driven by a distal-humerus sensor and verify it in
the same 3-D viewer. After both one-sensor multi-DOF stages, add synchronized
humerus and forearm IMU frames, a reproducible static calibration transform,
and relative segment orientation. The custom lower-extremity
teaching-apparatus path remains a later, separate multi-segment application.

## Milestone 5: External and task-specific validation

Compare bounded outputs against an appropriate synchronized reference, beginning with non-human prescribed motion before any governed human comparison. Scientific or clinically relevant claims require separate task-specific protocols, uncertainty analysis, and acceptance criteria.

## Governing escalation rule

Every new sensor count, task, placement, or processing claim is first exercised
on a non-human fixture where that is technically meaningful. Researcher
self-experimentation is stored in the private governed repository and used for
engineering development without making participant-study or clinical claims.
Any activity involving someone other than the researcher/developer requires a
separate study protocol, governance determination, consent process, privacy
plan, and approved data storage. The planned sensor-count progression is one
sensor, two sensors, and then 3, 5, and 10 sensors.

## Cross-cutting requirements

- Keep identifiable, restricted, or human-subject data out of Git and SimTK.
- Preserve raw measurements and transformation provenance.
- Use released OpenSim Python APIs unless an engine modification is justified.
- Use synthetic or explicitly redistributable public fixtures.
- Record decisions, assumptions, software versions, checksums, and validation evidence.
- Keep user-facing workflows reproducible and progressively reduce manual file editing.
- Record stop/go criteria and the evidence supporting every increase in sensor count or task complexity.
