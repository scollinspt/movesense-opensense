# Worklog

Maintain this as a chronological record of completed work, evidence, decisions, and blockers. Planned work belongs in the workplan; this log records what actually happened.

## 2026-10-19

### Decisions

- Shifted the primary R&D objective from distal upper-extremity
  pronation/supination to ambulatory monitoring of proximal, axial, and
  lower-extremity movement dynamics, coordination, motor control, and fatigue.
- Distinguished controlling forearm posture from logging
  pronation/supination as an outcome. Future elbow and shoulder protocols may
  define and control forearm posture without organizing the processing
  pipeline around a forearm-rotation coordinate.
- Retained a proximal-forearm sensor as necessary when elbow motion must be
  calculated relative to the humerus. Its role is an elbow segment sensor, not
  a wrist-centered outcome sensor.
- Adopted an observability-driven sensor plan: thorax-humerus for shoulder,
  humerus-forearm for elbow, pelvis-thorax for trunk, thorax-head for aggregate
  cervical motion, pelvis-thigh for hip, thigh-shank for knee, and shank-foot
  only when ankle or foot behavior is a defined outcome.
- Prioritized three R&D tracks: proximal upper extremity, trunk and head, and
  pelvis/lower extremity. Integrated ambulatory and fatigue protocols will
  follow only after the component segment pairs pass synchronization,
  repeatability, residual, cross-talk, and attachment checks.
- Preserved the wrist and pronation/supination work as a reproducible decision
  experiment and regression path rather than deleting or retroactively
  redefining it.

### Rationale

- The two-DOF wrist trial required substantial heading, frame-mapping,
  coordinate-limit, and cross-talk work but did not produce an acceptable
  solution: 61.2 degrees maximum orientation residual, 26.4 degrees RMS
  residual, and approximately 31 percent occupancy near the
  `pro_sup_l` upper limit.
- No currently anticipated major use scenario for this program hinges on
  pronation/supination. Its expected scientific value is low relative to the
  proximal, axial, and lower-extremity signals likely to matter for ambulatory
  coordination and fatigue.
- The experiment nevertheless achieved its R&D purpose by identifying a
  low-return technical direction before multi-sensor acquisition and larger
  protocols were organized around it.

## 2026-10-18

### Completed

- Retained the later anatomical-neutral isolated forearm
  pronation/supination recording and removed the earlier rejected trial from
  governed storage.
- Verified the retained recording's SHA-256 checksum, 2,488-row sample count,
  sensor timestamp continuity, and absence of malformed rows or gaps over 30
  milliseconds.
- Added the Movesense Processing Studio canvas for governed-recording
  integrity, timing, interactive raw-signal visualization, shared
  drag-to-select intervals, axis controls, calibration diagnostics, and
  movement interval annotation. The canvas reads recording data in place and
  persists only private selection state.
- Confirmed that the retained trial's sensor X axis carries 99.43 percent of
  bias-corrected gyroscope energy during the annotated movement interval.
- Added a constrained one-axis gyroscope integration and assigned the empirical
  mapping from sensor-positive X to pronation-positive rotation based on the
  confirmed first intentional movement.
- Verified that OpenSim 4.6's bundled Arm26 model has only shoulder-elevation
  and elbow-flexion coordinates and cannot represent pronation/supination.
- Added a project-owned fixed-humerus, one-DOF right-forearm model with a
  `pro_sup_r` coordinate and `forearm_r_imu` frame.
- Generated 2,206 neutral-referenced quaternion samples, exported an
  OpenSense-compatible `.sto`, and ran IMU inverse kinematics across 43.934
  seconds.
- Verified that the OpenSense `pro_sup_r` output reproduces the source
  constrained angle with 0.000794 degrees maximum absolute error and 0.000029
  degrees RMS error.
- Extended the Processing Studio to run or re-run the pipeline using private
  host-specific OpenSim runtime paths and to expose checksum-verified
  orientation, model, inverse-kinematics, and processing-manifest artifacts.
- Added visible asymmetric geometry to the one-DOF model: a fixed upper-arm
  segment, rotating forearm segment, and offset dorsal marker. This makes
  longitudinal pronation/supination visible in the OpenSim GUI without changing
  the validated coordinate solution.
- Generalized sign mapping and the constrained exporter by movement protocol.
  Elbow trials now offer flexion/extension, map the wrist sensor's dominant
  gyroscope axis into a model-Z elbow hinge, and produce a side-aware
  `elbow_flex_l` or `elbow_flex_r` OpenSim coordinate.
- Generated and validated the left-wrist elbow trial across 1,762 samples and
  35.083 seconds. OpenSense reproduced the source constrained elbow angle with
  0.000770 degrees maximum absolute error and 0.000037 degrees RMS error.
- Corrected elbow model provenance to the left side, including
  `forearm_l_imu`, `elbow_flex_l`, and `left_elbow_1dof.osim`, and removed the
  superseded right-side model.
- Added a synchronized Processing Studio motion viewer that animates the
  Movesense-derived OpenSense quaternion beside the OpenSim inverse-kinematics
  coordinate, with scrubbing, playback speed, and per-frame angular error.
- Added `upper-limb-next-sessions-v1`, defining one-sensor repeatability,
  two-sensor rigid-fixture timing, isolated two-sensor upper-limb motion, and
  combined-motion sessions with explicit advancement checks.
- Added the Movesense Studio Hub canvas and documented the stable Copilot Chat
  launch phrases for the Acquisition, Processing, and Firmware Update studios.
- Updated the development plan to preserve the validated one-DOF path as a
  regression baseline while prioritizing concurrent two-sensor acquisition,
  synchronization measurement, segment orientation, and relative joint motion.
- Inserted a one-sensor, two-DOF wrist milestone before two-sensor acquisition.
  The fixed-humerus protocol stages isolated elbow flexion, isolated forearm
  rotation, and then combined motion. Processing must move to calibrated 3-D
  orientation, a two-coordinate OpenSim model, and a 3-D-capable viewer rather
  than extending the dominant-axis estimator.
- Inserted a distal-humerus, one-sensor three-DOF shoulder milestone after the
  wrist two-DOF stage and before two-sensor acquisition. The protocol stages
  shoulder flexion/extension, abduction/adduction, internal/external humeral
  rotation, and then combined motion using a fixed-trunk and fixed-scapula
  model. The fixed scapula remains an explicit modeling assumption because
  trunk control alone does not measure or eliminate scapulothoracic motion.
- Added live phase markers to the Acquisition Studio and retained each marker's
  sequence, nearest sensor timestamp, sample index, host monotonic timestamp,
  and wall-clock timestamp in the recording manifest.
- Captured one continuous left-wrist elbow-plus-forearm session
  (`20261019T090234Z-adb7b99e`) with nine ordered protocol markers, 11,224 valid
  samples over 223.611 seconds, a matching SHA-256 checksum, no malformed rows,
  and no sensor-time gaps over 30 milliseconds.
- Added full IMU9 orientation processing with x-io Fusion AHRS, calibrated
  gyroscope bias, explicit magnetometer exclusion, quaternion normalization,
  and endpoint-neutral drift closure.
- Added a Rajagopal OpenSense two-coordinate path that maps NWU world axes to
  OpenSim ground, calibrates `radius_l_imu`, locks the full model, and unlocks
  only `elbow_flex_l` and `pro_sup_l`.
- Ran all 11,157 samples from the saved calibration start through final neutral
  using the corrected combined interval of 150.000 to 210.939 seconds.
- Verified quaternion norm to within 3.4e-16, final-neutral closure within
  0.782 degrees, and unintended-coordinate motion below 0.00001 degrees.
- Rejected the result as validated kinematics because the OpenSense orientation
  residual reached 61.2 degrees with 26.4 degrees RMS, while `pro_sup_l`
  remained within 0.1 degrees of its 90-degree upper limit for approximately
  31 percent of processed samples.
- Added an interactive Processing Studio simulation generated from downsampled
  Rajagopal body and calibrated `radius_l_imu` frame positions. The viewer
  supports playback, scrubbing, drag-to-rotate inspection, IMU-axis display,
  and green/amber/red forearm coloring by orientation residual.

### Technical findings

- The retained recording spans 49.552 seconds of sensor time at an effective
  rate of approximately 50.190 Hz, despite requesting `/Meas/IMU9/52`.
- Repeated host receipt timestamps occur in four-sample BLE packet batches and
  must not be treated as repeated sensor timestamps.
- The recorded magnetic-field magnitude averaged approximately 538 microtesla
  during calibration, outside the expected 20 to 100 microtesla Earth-field
  range, so it was not used for heading.
- Six-axis fusion accumulated 28.3 degrees of initial-to-final neutral
  orientation difference before endpoint closure. The final-neutral protocol
  constraint reduced the reported closure error to 0.782 degrees, but does not
  independently validate the intervening orientation trajectory.
- The full-orientation and frame-mapping pipeline is now implemented, but this
  recording does not meet the initial 15-degree maximum orientation-residual
  threshold. Coordinate saturation and phase cross-talk require investigation
  before scientific interpretation or a three-dimensional viewer is warranted.

### Decisions

- Standardized the supplied-strap wrist mounting as dorsal with the logo face
  outward and the wordmark axis approximately proximal-distal. The `M` end is
  distal on the right wrist; the final `E` end is distal on the left wrist.
- Required explicit confirmation of anatomical starting position and control of
  the trunk, shoulder, and non-target joints before recording.
- Defined a staged movement progression: static reference, isolated forearm
  rotation, isolated elbow flexion/extension, combined elbow plus forearm,
  isolated shoulder, shoulder plus elbow, and finally shoulder plus elbow plus
  forearm.
- Kept the interpretation boundary explicit: constraints permit bounded
  one-DOF and two-DOF development, but one wrist sensor cannot uniquely identify
  the full shoulder-elbow-forearm joint state.

## 2026-10-06

### Decisions

- Replaced the passive three-axis gimbal as the preferred teaching apparatus with a workshop-buildable, foot-fixed lower-extremity mechanism.
- Defined the apparatus as a sagittal-plane wooden linkage with a fixed foot, friction-adjustable ankle and knee hinges, and foot, shank, and thigh sensor platforms.
- Chose to attach educational foot, leg, and thigh bones to the wooden segments as visible anatomical overlays. The wooden linkage controls the motion; the bone-model joints do not serve as precision bearings.
- Reframed the apparatus around end-to-end interoperability and instruction: Movesense acquisition, orientation processing, OpenSense inverse kinematics, and visualization in a matching OpenSim model.
- Retained the passive-gimbal design only as optional future orientation-validation work. It is not required for HMS-PROJ-001 or for the first interoperability demonstration.

### Scope

- The first model will be a planar chain: `ground -> foot -> shank -> thigh`.
- The foot will be fixed to the base, while the ankle and knee will use parallel hinge axes and friction knobs so static poses can be held.
- The physical and OpenSim models will be deliberately simplified and matched to each other. They are not intended to reproduce full lower-extremity anatomy, validate Movesense hardware, or support clinical claims.
- Approximate mechanical angle references may be used to detect mapping, sign, calibration, and plausibility errors without being represented as metrological ground truth.

See [lower-extremity-rig-design-brief.md](lower-extremity-rig-design-brief.md) for the sourcing and schematic-generation brief.

## 2026-10-04

### Decisions

- Initially selected a passive, manually operated three-axis gimbal with independent optical encoders as the leading controlled-motion fixture for HMS-PROJ-001 preparation. This was superseded on 2026-10-06 by the simpler lower-extremity teaching apparatus.
- Reserved a bicycle crank for use as a possible later drive mechanism rather than treating it as a multidimensional reference fixture.
- Identified an encoded spatial linkage as the preferred later fixture for multisensor, multibody, translational-acceleration, and relative-orientation work.
- Chose a command-line acquisition workflow on macOS as the first software target. A future student GUI should call the same acquisition and processing services rather than implement a separate data path.
- Kept the project boundaries explicit: HMS-PROJ-001 establishes one-sensor raw acquisition and integrity; orientation estimation belongs to HMS-PROJ-003; OpenSense and custom OpenSim model interoperability belong to HMS-PROJ-004.
- Allowed synthetic orientation and custom-model tests to de-risk later architecture without treating them as evidence that the corresponding sensor-processing milestones have been completed.

### Technical findings

- Confirmed that the local OpenSim 4.6 Python SDK loads under Python 3.11 and exposes `IMUPlacer`, `IMUInverseKinematicsTool`, and `TimeSeriesTableQuaternion`.
- Confirmed that OpenSense can use a custom OpenSim model and quaternion orientation files, provided orientations have already been fused and synchronized.
- Defined the initial custom-model concept as three nested rotational bodies representing the gimbal's yaw, pitch, and roll axes, with an IMU frame fixed to the sensor platform.

### Planned fixture

- Mount the Movesense sensor near the common center of the three rotational axes to isolate orientation behavior and reduce translational acceleration.
- Provide mechanical zero references, angle index marks, hard stops, repeatable static positions, and a documented sensor-to-fixture axis alignment.
- Prefer optical encoders over magnetic encoders near the Movesense magnetometer.
- Record all three encoder channels through one timestamping controller while preserving encoder-controller, host-monotonic, and Movesense sensor-native timing as distinct clocks.

See [passive-gimbal-build-guide.md](passive-gimbal-build-guide.md) for the preliminary build specification. Component specifications, prices, and availability must be verified before procurement.

## 2026-10-03

### Decisions

- Revised the development sequence so each new sensor count, task, placement, or processing claim is tested non-human before corresponding human feasibility is considered.
- Defined the sensor-count progression as one sensor, two sensors, and then staged 3-, 5-, and 10-sensor configurations.
- Separated human feasibility from measurement validity: any human activity requires a documented institutional governance determination and applicable consent, privacy, supervision, and data plans.
- Split the public HMS Lab sequence into acquisition, multi-sensor scaling, orientation validation, OpenSense interoperability, and OpenCap comparison projects.

### Current next step

- Complete HMS-PROJ-001 inventory work and the first non-human one-sensor bench recording. Do not begin human feasibility until the bench criteria and governance gate are satisfied.

## 2026-10-02

### Completed

- Confirmed that the SimTK project is associated with the OpenSim community.
- Completed the first part of the hardware inventory by recording the hardware identifiers and Bluetooth addresses for ten Movesense devices in a governed inventory outside Git.
- Documented the planned single-sensor bench acquisition using the official GATT SensorData Protocol Python client with Bleak.

### Remaining Milestone 1 work

- Read and record firmware, hardware, and application information from each device.
- Record batteries, attachment accessories, Flash capability, receiver details, and acquisition software versions.
- Test one sensor with its existing firmware and capture the first non-human bench recording.

See [acquisition-plan.md](acquisition-plan.md) for the planned first acquisition.

## 2026-10-01

### Completed

- Confirmed that SimTK approved and published `Movesense-OpenSense Integration` at `https://simtk.org/projects/movesense2os`.
- Requested association with the SimTK OpenSim community through the project administration page.
- Selected Apache-2.0 for project-authored software and documentation, aligned with OpenSim's license and with an explicit patent grant for reusable technical tooling.

## 2026-09-28

### Completed

- Established the initial public repository structure and Python package namespace.
- Established the governed-storage directory structure and Git exclusions.
- Documented the public/governed data boundary.
- Confirmed that the local Git repositories and their GitHub remotes have no commits or branches.
- Reviewed the SimTK project-registration form, OpenSense project scope, available project categories, and SimTK communities.
- Chose a standalone SimTK project aligned with OpenSense in the OpenSim community.
- Defined hardware inventory and non-human bench acquisition as the first milestone.
- Submitted the public `Movesense-OpenSense Integration` project (`movesense2os`) for SimTK administrator review. SimTK indicated that a decision and further instructions should arrive within 72 hours.

### Decisions

- Use the project title `Movesense-OpenSense Integration` and short identifier `movesense2os` for SimTK.
- Keep the SimTK project public and describe interoperability goals without scientific or clinical validity claims.
- Position the work as a Movesense acquisition and integration pathway for OpenSense, not as a replacement for OpenSense.
- Keep authoritative recordings and restricted research material in institution-managed governed storage.

### Open work

- Inventory available Movesense hardware and firmware.
- Confirm the initial acquisition route and capture the first non-human bench recording.