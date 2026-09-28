# Movesense–OpenSense Project Handoff

_Last updated: 2026-09-28_

## Purpose

This document transfers the planning context for a new system that uses Movesense wearable sensors to collect human movement data and prepare it for integration with OpenSense/OpenSim.

It is intended to bootstrap work in a new VS Code workspace without requiring access to the original planning conversation. Treat the proposed architecture as a starting point to test and refine, not as proof that the system is scientifically or clinically validated.

## Project Goal

Develop an open, reproducible pipeline that:

1. acquires motion data from multiple Movesense sensors;
2. preserves sensor identity and sensor-native timestamps;
3. synchronizes streams onto a common time base;
4. calibrates the accelerometer, gyroscope, and magnetometer signals;
5. estimates sensor orientation through documented sensor fusion;
6. maps sensor and world coordinate systems into OpenSim conventions;
7. exports synchronized quaternion orientations in OpenSense-compatible `.sto` format;
8. calibrates IMU frames against an OpenSim model using `IMUPlacer`;
9. performs orientation-based inverse kinematics using `IMUInverseKinematicsTool`; and
10. records validation evidence, limitations, provenance, and reproducible processing steps.

The pipeline can be summarized as:

```text
Movesense sensors
  -> timestamped raw IMU streams
  -> clock alignment and resampling
  -> sensor calibration
  -> orientation estimation / sensor fusion
  -> coordinate-frame conversion
  -> <body>_imu quaternion .sto
  -> OpenSense IMUPlacer calibration
  -> OpenSense IMU inverse kinematics
  -> reviewed kinematic outputs and validation records
```

## Repository and Storage Decisions

### Public implementation repository

Create a public repository named `movesense-opensense`.

It should contain:

- acquisition and parsing code;
- synchronization algorithms;
- calibration and sensor-fusion code;
- coordinate-system transformations;
- OpenSense `.sto` export code;
- OpenSim/OpenSense runner scripts and configuration templates;
- tests and synthetic fixtures;
- documentation and example workflows;
- environment and dependency definitions;
- compact, permission-cleared validation artifacts; and
- provenance records for external software, models, and sample data.

It must not contain:

- identifiable participant information;
- consent records;
- sensor-to-participant identity keys;
- protected health information;
- unrestricted raw human-subject recordings;
- confidential partner information;
- restricted third-party models or datasets; or
- secrets, credentials, or institution-specific access tokens.

### Governed data storage

The authoritative research data store should be outside Git in institution-managed, encrypted storage with appropriate access control, retention, backup, and audit practices.

A gitignored `data/` directory in the public repository may serve as a local mount point, symlink target, or working location, but it is not the authoritative store.

Configure its location through an environment variable, for example:

```text
MOVESENSE_DATA_ROOT=/path/to/governed-storage
```

Recommended governed-storage layout:

```text
governed-storage/
  raw/                  # immutable source recordings
  staged/               # parsed but minimally transformed data
  derived/              # synchronized, calibrated, fused, and analyzed data
  manifests/            # checksums, provenance, software versions, processing records
  participant-keys/     # separately restricted identity linkage
  governance/           # approvals, retention rules, access records, protocol documents
```

The participant identity linkage should be more tightly restricted than coded movement data and should not be stored alongside ordinary analysis files when institutional systems allow separation.

### Optional private operations repository

A separate private Git repository may hold non-public operational material such as draft protocols, internal data dictionaries, IRB working documents, equipment inventories, and laboratory procedures.

It should not be used as the authoritative store for raw recordings, participant identifiers, consent records, or identity-linkage files. Git history makes deletion, access revocation, and large-data management difficult.

## Recommended VS Code Workspace

Use a multi-root workspace centered on the new implementation repository.

### Include initially

1. `movesense-opensense`
   - Primary software and validation repository.
   - Owns the complete Movesense-to-OpenSense adapter pipeline.

2. `movement-models-`
   - Owns computational model provenance, platform mappings, scenarios, experiments, and bounded findings.
   - Use it when the pipeline begins producing model-specific mappings or research experiments.

3. `movement-systems` — optional during active development
   - Owns the public HMS Lab research agenda, methods, conservative capability records, approved results, educational translations, and public website.
   - Include it when publishing reviewed methods or conclusions, not as the operational data-processing repository.

### Do not include initially

- `opensim-core`
- `scone-core`

Use a released OpenSim installation and its Python API first. Add an upstream source repository only when a defined research need requires an engine modification. Project-specific adapters, transformations, and experiments should remain in `movesense-opensense` or `movement-models-` whenever possible.

### Conditional upstream checkout

Movesense’s software repositories are hosted on Bitbucket. Add `movesense-device-lib` as a pinned, preferably read-only upstream checkout only if the project must modify sensor firmware, inspect generated protocol details, or extend the official GATT client.

Do not vendor the complete upstream repository into `movesense-opensense`.

## Proposed Public Repository Structure

```text
movesense-opensense/
  README.md
  LICENSE
  CITATION.cff
  CHANGELOG.md
  pyproject.toml
  .gitignore
  .env.example

  src/
    movesense_opensense/
      acquisition/       # BLE/GSP streaming and offline log import
      synchronization/   # clock alignment, drift estimation, resampling
      calibration/       # accelerometer, gyroscope, magnetometer calibration
      fusion/            # raw IMU signals to normalized orientations
      coordinates/       # Movesense/sensor/world/OpenSim frame transformations
      opensense/         # STO writing, IMUPlacer, and IMU IK interfaces
      validation/        # signal, orientation, timing, and kinematic checks
      provenance/        # processing manifests and environment capture

  configs/
    sensors/             # serial ID or device ID to logical sensor labels
    placements/          # sensor label to OpenSim body/frame mapping
    protocols/           # sampling, recording, and calibration protocols
    opensense/           # IMUPlacer and inverse-kinematics setup templates

  models/
    README.md             # model provenance and storage rules
    records/              # checksums, licenses, citations, transformations

  scripts/
    acquire.py
    inspect_recording.py
    synchronize.py
    estimate_orientations.py
    export_opensense.py
    run_opensense.py
    validate_trial.py

  tests/
    fixtures/             # synthetic or explicitly redistributable data only
    unit/
    integration/
    acceptance/

  docs/
    architecture.md
    data-contract.md
    synchronization.md
    calibration.md
    sensor-fusion.md
    coordinate-conventions.md
    opensense-integration.md
    validation-plan.md
    governance-boundaries.md

  examples/
    static-calibration/
    prescribed-rotation/
    minimal-opensense/

  data/                   # entirely gitignored except an explanatory README
```

The exact Python package and command-line layout should follow the smallest working implementation rather than being created all at once.

## Existing Project Context

The `movement-systems` repository describes the Human Movement Systems Laboratory measurement stack as including:

- OpenCap/video for whole-body or segment movement;
- approximately 8–9 available Movesense IMUs for local segment motion;
- BIOPAC EMG and ECG-related physiological channels;
- Clarius ultrasound where scientifically appropriate;
- OpenSim plus custom computational analysis for system-level interpretation; and
- a future objective of placing heterogeneous measurements on a common temporal framework.

Relevant repository principles already established in `movement-systems` include:

- verify exact sensor models, firmware, APIs, sample behavior, export formats, and constraints rather than inferring capabilities from product categories;
- distinguish current capability from planned capability;
- keep identifiable or restricted data in governed private storage;
- publish capability claims only after readiness, uncertainty, and interpretive limits have been established;
- use `movement-models-` for specialized model mappings, computational experiments, and reproducible technical artifacts; and
- use installed OpenSim functionality unless an engine modification is scientifically justified.

## Movesense Technical Context

Official Movesense resources indicate:

- Movesense devices provide a 9-axis IMU: accelerometer, gyroscope, and magnetometer.
- Sensors expose open APIs and support custom device firmware.
- Bluetooth Low Energy is the normal connection path.
- The Movesense Device API is REST-like.
- The GATT SensorData Protocol (GSP) is included in default firmware version 2.3.0 or later and Movesense MD firmware version 1.0 or later.
- The official GSP Python example uses Python 3 and Bleak and can stream physiological and motion data to desktop systems.
- The Python client includes examples for parsing IMU9 and ECG binary streams to CSV.
- Movesense advertises IMU sampling rates from approximately 13 Hz through 1.6 kHz, with 52 Hz described as common for human movement analysis. The exact supported rates and behavior must be verified for each available sensor model and firmware revision.
- Multiple Movesense sensors can connect to one receiving device, but this does not by itself establish research-grade synchronization.
- Movesense Flash supports larger-capacity autonomous logging; exact available hardware must be inventoried before selecting live streaming versus offline logging.

Important: the material reviewed describes raw acceleration, angular velocity, and magnetic-field data. Do not assume that the selected acquisition route supplies synchronized, OpenSense-ready orientation quaternions. Orientation estimation, synchronization, and their validation are core project responsibilities unless a verified vendor or third-party algorithm is deliberately adopted.

## OpenSense Input Contract

OpenSense computes model segment motion from IMU orientations. The reviewed documentation and OpenSim implementation establish the following requirements:

- OpenSense expects sensor-frame orientations represented as quaternions in an OpenSim `.sto` file.
- Orientation data must already have undergone sensor fusion and synchronization.
- Labels should map sensors to model IMU frames, conventionally using names such as `pelvis_imu`, `femur_r_imu`, and similar `<body>_imu` labels.
- `IMUPlacer` registers IMU frames against an OpenSim model using a known calibration pose.
- The first orientation row is normally treated as the calibration pose unless the workflow deliberately prepares another calibration file.
- `sensor_to_opensim_rotations` provides fixed XYZ space rotations from the IMU world frame to the OpenSim world frame.
- A base IMU and heading axis can be specified for heading correction.
- `IMUInverseKinematicsTool` minimizes orientation errors between measured IMU orientations and model IMU frames.
- Orientation-only inverse kinematics does not recover global translation; translational coordinates are locked by the implementation.
- OpenSense can write resulting model coordinates to `.mot` and orientation errors to `.sto` when configured.

A released OpenSim installation exposes the required Python interfaces, including:

- `TimeSeriesTableQuaternion`;
- `STOFileAdapterQuaternion`;
- `IMUPlacer`; and
- `IMUInverseKinematicsTool`.

This means a source checkout of `opensim-core` is not required for the initial adapter.

## Core Data Contracts to Define

Before substantial implementation, define and version these contracts.

### Raw sample record

Each sample should retain at least:

- recording identifier;
- sensor hardware identifier;
- logical sensor label;
- firmware version;
- sensor-native timestamp or counter;
- host receipt timestamp, retained separately;
- sequence number when available;
- sampling configuration;
- accelerometer values and units;
- gyroscope values and units;
- magnetometer values and units;
- packet-loss or integrity indicators; and
- acquisition software version.

Do not treat BLE packet-arrival time as equivalent to sensor sample time.

### Synchronized stream

Record:

- source clock for each sensor;
- estimated offset and drift;
- synchronization method;
- interpolation or resampling method;
- target time grid and rate;
- gaps and dropped samples;
- uncertainty or residual synchronization error; and
- transformation provenance.

### Orientation stream

Record:

- fusion algorithm and version;
- parameter values;
- quaternion component order;
- active versus passive rotation convention;
- direction of mapping, such as sensor-to-world or world-to-sensor;
- coordinate handedness and axis definitions;
- magnetic-field handling;
- normalization checks;
- initialization procedure;
- invalid or reset states; and
- known drift behavior.

### OpenSense export

Record:

- OpenSim/OpenSense version;
- source orientation manifest;
- exact sensor labels;
- sensor-to-body mapping;
- sampling times;
- quaternion convention conversion;
- sensor-to-OpenSim world rotation;
- calibration frame or interval;
- base IMU and heading axis;
- input model provenance and checksum; and
- output file checksums.

## Highest-Risk Technical Areas

### 1. Multi-sensor synchronization

This is the first major risk. BLE delivery is asynchronous and can introduce variable latency. The system must identify and use sensor-native timing where possible, estimate inter-sensor clock offset and drift, and quantify residual alignment error.

Synchronization must be validated experimentally rather than inferred from simultaneous subscription commands.

### 2. Orientation estimation

OpenSense requires orientations, while the readily available Movesense interfaces expose raw IMU data. The selected sensor-fusion method must have explicit conventions, known initialization behavior, and evidence appropriate to the intended tasks.

Use a proven library or published implementation rather than inventing an undocumented fusion algorithm. Selection remains open pending hardware tests and license review.

### 3. Magnetic disturbance

Magnetometers can reduce heading drift but are vulnerable to indoor field distortion. The workflow should preserve raw magnetic data, expose whether magnetometer correction was enabled, detect implausible field magnitude or direction when practical, and compare magnetometer-aided and magnetometer-free performance for relevant tasks.

### 4. Coordinate conventions

Movesense sensor axes, attachment axes, fusion-world axes, quaternion conventions, OpenSim ground axes, and body-segment frames are distinct. Every transformation must be explicit, tested with known rotations, and documented.

### 5. Sensor placement and attachment

Placement errors, soft-tissue artifact, sensor movement relative to the segment, and inconsistent mounting can dominate algorithmic precision. Protocols must define sensor orientation, attachment method, body segment, laterality, and repeatability procedures.

### 6. Calibration

OpenSense assumes a known model pose and corresponding IMU orientation sample. Calibration-pose selection, heading correction, model default coordinate values, and sensor-to-segment offsets must be controlled and recorded.

## Validation Strategy

Validation should proceed in stages. Passing an earlier stage does not validate later scientific or clinical claims.

### Stage 1: File and numerical correctness

- Parse known GSP or exported recordings deterministically.
- Verify units and sample counts.
- Detect packet loss and non-monotonic timestamps.
- Verify normalized quaternions.
- Round-trip small orientation tables through OpenSim’s `TimeSeriesTableQuaternion` and `STOFileAdapterQuaternion`.

### Stage 2: Single-sensor static and prescribed rotations

- Confirm gravity direction in multiple static poses.
- Test rotations around each sensor axis.
- Verify quaternion sign continuity handling.
- Confirm known coordinate transformations.
- Measure stationary drift and magnetic sensitivity.

### Stage 3: Multi-sensor timing

- Apply a shared impulsive or mechanically coupled event to several sensors.
- Estimate offset, jitter, and drift over recordings of realistic duration.
- Repeat under expected BLE load and sensor count.
- Establish acceptance tolerances before full-body collection.

### Stage 4: Minimal OpenSense integration

- Begin with 2–3 sensors, not the full available set.
- Use a controlled calibration pose.
- Export a valid orientation `.sto`.
- Run `IMUPlacer` and inspect sensor frame registration.
- Run `IMUInverseKinematicsTool` on a bounded movement.
- Review orientation residuals and output plausibility.

### Stage 5: External comparison

Where practical, compare against synchronized OpenCap, video, a turntable or mechanical fixture, or another reference system. State which quantities and tasks were compared and avoid treating agreement in one task as universal validation.

### Stage 6: Task-specific research validation

Only after the prior stages should the system support claims about gait, rehabilitation tasks, fatigue, motor control, or clinical interpretation. Each task requires its own protocol, uncertainty analysis, and acceptance criteria.

## First Operational Milestone

Deliver one reproducible, end-to-end demonstration with 2–3 sensors.

Suggested acceptance criteria:

1. Exact sensor models and firmware versions are recorded.
2. Raw accelerometer, gyroscope, and magnetometer samples are retained with sensor-native timing.
3. Packet loss, timestamp continuity, and inter-sensor alignment are reported.
4. Orientation estimation produces normalized, convention-documented quaternions.
5. Sensor labels map deterministically to model IMU frames.
6. A calibration pose produces a calibrated OpenSim model without manual file editing.
7. OpenSense inverse kinematics completes from a single command.
8. Outputs are finite and reproducible from pinned inputs.
9. Orientation errors and processing diagnostics are retained.
10. Synthetic or permission-cleared fixtures allow the public test suite to run without governed data access.

This milestone demonstrates pipeline interoperability, not scientific or clinical validity.

## Immediate Next Steps

1. Inventory the available hardware:
   - exact Movesense models;
   - serial or device identifiers;
   - firmware versions;
   - battery and attachment accessories;
   - whether any devices are Movesense Flash;
   - receiving computers and mobile devices.

2. Select the initial acquisition path:
   - official GSP Python client for desktop live streaming is the leading starting point;
   - use Showcase exports for quick inspection only if their timing metadata satisfies the pilot need;
   - consider autonomous logging only after confirming exact hardware and synchronization implications.

3. Create the public `movesense-opensense` repository with:
   - a minimal Python package;
   - `.gitignore` protection for data and secrets;
   - `.env.example` with `MOVESENSE_DATA_ROOT`;
   - a governance-boundary document;
   - synthetic fixtures; and
   - one command that inspects an input recording.

4. Capture a short, non-human bench recording from one sensor and document its exact binary/CSV schema.

5. Capture a synchronized bench event from two sensors and determine what timing information is actually available.

6. Define quaternion and coordinate conventions before implementing `.sto` export.

7. Build the smallest OpenSense acceptance fixture using a known or synthetic orientation trajectory.

8. Add `movement-models-` only when a model mapping or formal experiment record is ready to be created.

## Open Decisions

The following choices require evidence and should not be silently assumed:

- exact Movesense sensor and firmware versions;
- live BLE streaming versus autonomous logging;
- achievable multi-sensor synchronization accuracy;
- target sampling rate for the first task;
- sensor-fusion library and configuration;
- magnetometer use in the intended collection environments;
- initial body segments and movement task;
- initial OpenSim model and its license;
- calibration pose and heading convention;
- acceptable orientation and timing errors;
- comparison/reference measurement system; and
- institutional location and policy for governed storage.

## Authoritative References Reviewed

### OpenSense and OpenSim

- OpenSense kinematics with IMU data:
  https://opensimconfluence.atlassian.net/wiki/spaces/OpenSim/pages/53084203/OpenSense+-+Kinematics+with+IMU+Data
- SimTK:
  https://simtk.org/
- OpenSim source repository used for implementation reference:
  https://github.com/scollinspt/opensim-core

Key OpenSim implementation surfaces reviewed include `IMUPlacer`, `IMUInverseKinematicsTool`, `TimeSeriesTableQuaternion`, `STOFileAdapterQuaternion`, and the bundled Python OpenSense examples.

### Movesense

- Movesense homepage:
  https://www.movesense.com/
- Developer resources:
  https://www.movesense.com/resources/
- Technical specifications:
  https://www.movesense.com/specifications/
- Documentation:
  https://www.movesense.com/docs/
- Movesense device library:
  https://bitbucket.org/movesense/movesense-device-lib
- GATT SensorData/Python example:
  https://bitbucket.org/movesense/movesense-device-lib/src/master/samples/gatt_sensordata_app/
- Data recording tools overview:
  https://www.movesense.com/news/2025/11/recording-data-with-movesense-sensors-five-free-tools-to-get-you-started/
- Human movement analysis overview:
  https://www.movesense.com/news/2023/02/5-steps-to-human-movement-analysis-with-movesense-sensors-and-machine-learning/

### Existing project repositories

- Movement Systems:
  https://github.com/scollinspt/movement-systems
- Movement Models:
  https://github.com/scollinspt/movement-models-

## Instructions for the Next Coding Agent

When beginning implementation:

1. Inspect the existing repositories and this handoff before changing architecture.
2. Keep `movesense-opensense` focused on acquisition-to-OpenSense interoperability.
3. Preserve raw measurements and transformation provenance.
4. Do not claim that simultaneous BLE collection means synchronized sensing.
5. Do not assume a quaternion convention or axis mapping; verify it experimentally.
6. Do not place human-subject or restricted data in Git, including private Git.
7. Prefer released OpenSim Python APIs over modifying `opensim-core`.
8. Prefer official Movesense protocols and maintained libraries over reverse engineering.
9. Use synthetic or explicitly redistributable fixtures for public tests.
10. Separate technical interoperability, measurement validity, scientific validity, and clinical utility.
11. Keep changes small and validate each pipeline boundary before expanding sensor count or task complexity.
12. Record open assumptions as explicit decisions or experiment questions.
