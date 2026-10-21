# Tilt ECG Project Charter

## Status

Incubating in the current repository under the working slug `tilt-ecg`.

## Goal

Create a reproducible Movesense system that synchronizes ECG with chest
orientation and, later, ambulatory posture and activity.

The system is an engineering and research data-acquisition tool. It is not a
diagnostic ECG monitor, a medical device, or a replacement for the clinical
equipment and safety procedures used during tilt-table testing.

## Why this project belongs here initially

The project shares material infrastructure with the existing Movesense work:

- Bluetooth/GSP connection management.
- Sensor and firmware inventory.
- Timestamp and packet-continuity diagnostics.
- Immutable raw recording and checksummed manifests.
- Private canvas state and governed data boundaries.
- Firmware update and Flash-capability investigation.

Keeping the project in this repository during incubation avoids duplicating
those foundations. A top-level project boundary prevents ECG and Flash
requirements from being coupled to OpenSense.

## Phase 1: Live tilt-table acquisition

The operational interface will be a locally hosted full-screen browser
application rather than a VS Code canvas. See the
[live tilt-table requirements](live-tilt-table-requirements.md).

### Intended configuration

- One Movesense sensor on the chest.
- Suunto chest strap with biopotential electrodes.
- Simultaneous live ECG and inertial streaming to a computer.
- Current development rates of 512 Hz ECG and nominal 26 Hz IMU9.
- Live waveform, signal-quality, orientation, timing, and recording status.

### Primary outputs

- One SQLite raw-signal container with native-rate ECG, native-rate inertial
  samples, exact events, and recording metadata.
- One derived CSV with fixed five-second rows containing the latest completed
  five-R-wave HR estimate, tilt summaries, quality state, and annotations.
- A checksum and provenance manifest for both artifacts.
- Chest tilt relative to gravity.
- Sensor-native timestamps and separate host receipt timestamps.
- Recording events and protocol phases.
- Immutable manifest, checksums, hardware identity, firmware version, resource
  routes, requested rates, and effective rates.

Heart rate updates every five accepted consecutive R waves using the four
R-R intervals bounded by those waves. The five-beat estimator and fixed
five-second summary windows are independent; summary rows retain the source
time and age of any carried-forward HR estimate.

### Required protocol events

At minimum:

- Recording start and stop.
- Supine reference.
- Tilt transition start and end.
- Commanded table angle or stage.
- Return-to-supine transition.
- Signal interruption, strap adjustment, or sensor reconnection.

Symptoms, blood pressure, heart rate from clinical equipment, or other
observations require separately defined fields, time provenance, and
governance. They must not be inferred from operator notes without an explicit
data contract.

### Orientation scope

The first orientation outcome is chest tilt relative to gravity. It does not
require OpenSense. During static or quasi-static tilt stages, accelerometer
gravity provides the principal reference. Gyroscope data support transitions
and motion-quality checks.

Chest-sensor orientation is not automatically identical to tilt-table angle.
Placement, torso motion, breathing, strap motion, and calibration must be
measured or reported as limitations. A table-mounted reference sensor may be
added during validation if table angle must be distinguished from chest angle.

### Phase 1 advancement criteria

- Confirm the exact ECG and IMU resources supported by the sensor firmware.
- Confirm simultaneous subscription behavior and sustainable rates.
- Preserve synchronized sensor-native timing for ECG, IMU, and events.
- Quantify packet loss, gaps, effective rates, reconnect behavior, and host
  receipt batching.
- Verify electrode contact and ECG signal quality using non-diagnostic
  engineering criteria.
- Verify tilt-angle sign, reference pose, repeatability, and return-to-reference
  error on a bench or table fixture.
- Demonstrate immutable recording, checksum verification, and governed storage.
- Establish the applicable governance and operational approval before use in a
  clinical tilt-table context or with anyone other than the researcher.

## Phase 2: Ambulatory Flash logging

### Intended configuration

- A Movesense model that is verified to include usable on-sensor Flash.
- Chest strap with biopotential electrodes.
- On-sensor ECG and inertial logging without continuous live streaming.
- Later retrieval to governed storage for posture and activity derivation.

The sensor used in prior development is a candidate, not a confirmed Flash
device. Model, hardware revision, firmware, storage APIs, and available capacity
must be inventoried before the Phase 2 design is fixed.

### Questions that must be measured

- Which firmware and DataLogger/Logbook resources are present?
- Can ECG and the required inertial route be logged concurrently?
- What sample rates, channels, encodings, metadata, and timestamps are stored?
- How are clocks initialized and how stable are they over the target duration?
- What happens when storage fills, power is interrupted, or a log is not
  cleanly stopped?
- Can an interrupted log be listed, downloaded, checksummed, and recovered?
- Does storage use wrapping, rejection, truncation, or another full-capacity
  behavior?
- How much usable duration is available at each candidate ECG and IMU rate?
- What are the battery and electrode-contact limits before storage becomes the
  limiting factor?

Duration must be calculated from measured encoded bytes per sample, metadata
overhead, usable Flash capacity, and actual logging behavior. It must not be
estimated only from nominal sample rates.

### Phase 2 advancement criteria

- Complete a hardware and firmware capability inventory.
- Validate start, stop, list, download, delete, and recovery on a bench.
- Verify checksums and sample counts after retrieval.
- Measure clock behavior and synchronization with known events.
- Perform increasing-duration tests before any long ambulatory recording.
- Define posture and activity outputs separately from the raw logging contract.
- Establish governance, consent, privacy, retention, and operational procedures
  appropriate to ambulatory ECG before recording anyone other than the
  researcher.

## Data architecture

The recording manifest must distinguish:

- Project and protocol IDs.
- Live-streamed versus on-sensor origin.
- Sensor model, serial identifier, hardware revision, and firmware.
- Electrode/strap configuration and placement.
- ECG route, requested rate, units, and conversion provenance.
- Inertial routes, requested rates, axes, units, and frame conventions.
- Sensor-native time, host time, and any retrieval-time metadata.
- Event markers and their time source.
- Gaps, malformed samples, reconnects, and retrieval errors.
- Raw file paths and SHA-256 checksums.
- Transformations used to produce tilt, posture, activity, or ECG-derived
  artifacts.

Raw ECG and IMU remain immutable. Filtering, resampling, beat detection,
quality indices, tilt, posture, and activity are derived artifacts with separate
provenance.

## Safety and governance

- Use the chest strap and sensor only in their intended battery-powered
  configuration.
- Do not connect participant-worn electrodes to improvised mains-powered or
  non-isolated hardware.
- Do not use the system for clinical decisions, diagnosis, alarm generation, or
  replacement of approved tilt-table monitoring.
- Treat ECG and ambulatory activity as sensitive physiological data.
- Keep identifiers, consent, clinical records, and linkage keys outside the
  public repository and separated according to institutional policy.
- A clinical setting, patient population, or anyone other than the
  researcher/developer requires an appropriate governance determination before
  collection.

## Repository extraction criteria

Move this project to a separate repository when one or more of the following
becomes true:

- It acquires an independent release or deployment lifecycle.
- It develops a mobile application or custom sensor firmware with separate
  build and distribution requirements.
- Its collaborators or access controls differ from the OpenSense project.
- Its dependencies and CI materially interfere with the existing project.
- Its issue tracking and roadmap can no longer be managed clearly as a
  top-level project.
- Clinical or contractual governance requires a distinct code boundary.

If extraction occurs, retain reusable Movesense transport and recording
contracts in an explicitly shared package rather than copying them.
