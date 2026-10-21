# Workplan

## Objective

Build an open, reproducible pipeline that acquires Movesense IMU measurements and produces synchronized, convention-documented orientation data suitable for OpenSense/OpenSim. Interoperability milestones do not establish scientific or clinical validity.

The active application objective is ambulatory monitoring of movement
dynamics and the effects of fatigue on coordination and motor control. See the
[ambulatory movement R&D strategy](ambulatory-movement-rd-strategy.md) for the
current scientific and sensor-allocation priorities.

The repository also incubates a parallel
[tilt ECG project](../projects/tilt-ecg/README.md). Its first phase will
synchronize live ECG with chest tilt during tilt-table testing. Its second
phase will investigate ambulatory ECG and inertial logging to verified
Movesense Flash storage. This project reuses acquisition and governance
infrastructure but does not use OpenSense.

## Parallel tilt ECG execution order

1. Inventory the candidate sensor's model, hardware revision, firmware, ECG
   resources, and Flash/DataLogger capability.
2. Define versioned live ECG-plus-IMU schemas and synthetic fixtures.
3. Measure sustainable simultaneous live ECG and inertial streaming rates,
   timing, packet continuity, and reconnect behavior.
4. Implement a localhost full-screen browser application with live ECG,
   Pan-Tompkins R-wave detection, five-beat HR updates, explicit supine-zero
   confirmation, phase markers, and chest tilt relative to gravity.
5. Write native-rate ECG, IMU, exact events, and metadata to one recoverable
   SQLite container; derive a provenance-linked five-second summary CSV.
6. Validate chest angle against a bench or table reference and distinguish it
   from table angle.
7. Establish the required governance and operational approval before use in a
   clinical tilt-table context.
8. Bench-test Flash start, stop, inventory, capacity, retrieval, checksum, and
   interrupted-log recovery.
9. Calculate and measure achievable ambulatory duration before defining a
   long-duration protocol.
10. Develop posture, activity, and ECG-derived outputs as provenance-tracked
   artifacts rather than modifying raw logs.

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

1. Extend acquisition to two concurrent sensors and complete a rigid-fixture
   synchronization trial.
2. Add explicit inter-sensor timing, offset, drift, loss, and residual
   alignment diagnostics.
3. Validate humerus-to-proximal-forearm relative orientation for elbow
   flexion/extension while forearm rotation is controlled rather than treated
   as a primary outcome.
4. Add a thorax sensor for shoulder motion relative to the trunk, followed by
   combined shoulder-elbow movement.
5. Validate pelvis-thorax-head relative orientation for axial coordination.
6. Validate pelvis-thigh-shank relative orientation for hip and knee.
7. Add a foot sensor only for a defined ankle or foot outcome.
8. Combine validated segment pairs in an ambulatory task.
9. Add fatigue exposure only after the corresponding non-fatigued task has
   acceptable timing, attachment, repeatability, residual, and cross-talk
   performance.

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

### Historical constrained single-wrist movement progression

This progression was completed as an engineering and decision experiment. It
is retained for provenance and regression testing but is no longer the active
application sequence.

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
5. Complete a two-sensor humerus-to-proximal-forearm elbow experiment, with
   forearm posture defined as a controlled condition rather than
   pronation/supination as a primary outcome.
6. Repeat non-human load tests with 3, 5, and 10 sensors only after the
   two-sensor path meets its timing and reliability criteria.
7. Make sensor count a versioned configuration option rather than a code
   change.

Simultaneous BLE subscription is not evidence of synchronized sensing. Configuration support is not evidence that a sensor count performs acceptably.

## Milestone 3: Calibration and orientation estimation

**Status: full-orientation prototype implemented; focus shifted to synchronized relative segment orientation.**

The wrist two-DOF experiment implemented full-orientation fusion, frame
mapping, constrained OpenSense IK, residual reporting, and diagnostic
simulation. It did not pass its kinematic acceptance threshold and showed that
pronation/supination would demand disproportionate R&D effort for the current
ambulatory-monitoring objective.

The next processing milestone is synchronized relative orientation for the
segments bounding a high-value target. Begin with humerus and proximal forearm
for elbow flexion/extension, then add thorax-to-humerus shoulder processing.
The same pattern will be used for pelvis-thorax-head and
pelvis-thigh-shank-foot chains. Forearm rotation may be controlled or reported
as uncertainty without remaining a primary modeled outcome.

## Milestone 4: Minimal OpenSense integration

**Status: upper-limb one-DOF interoperability achieved; multi-segment work remains.**

The project now exports normalized neutral-referenced quaternions, builds
side-aware fixed-humerus forearm and elbow models, runs
`IMUInverseKinematicsTool`, retains orientation errors, and validates the
coordinate trajectory against the source constrained angle. The Processing
Studio visualizes the OpenSense orientation and OpenSim IK result together.

Preserve the one-DOF and wrist two-DOF paths as regression and decision
fixtures. The next OpenSense integration must support synchronized segment
pairs, reproducible static frame calibration, and relative orientation.
Prioritize thorax-humerus-forearm, pelvis-thorax-head, and
pelvis-thigh-shank chains. Add a foot frame only when ankle or foot behavior is
an explicit outcome. Select or configure models according to each target
rather than forcing every protocol into one model.

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
sensor, two sensors, and then the minimum segment set required by each target.
Three-, five-, and ten-sensor acquisition load tests remain useful engineering
checks but do not justify adding sensors to a scientific protocol.

## Cross-cutting requirements

- Keep identifiable, restricted, or human-subject data out of Git and SimTK.
- Preserve raw measurements and transformation provenance.
- Use released OpenSim Python APIs unless an engine modification is justified.
- Use synthetic or explicitly redistributable public fixtures.
- Record decisions, assumptions, software versions, checksums, and validation evidence.
- Keep user-facing workflows reproducible and progressively reduce manual file editing.
- Record stop/go criteria and the evidence supporting every increase in sensor count or task complexity.
