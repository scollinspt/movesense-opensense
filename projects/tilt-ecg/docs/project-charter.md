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

## Phase 1 processing, analysis, and report application

A separate localhost browser application now processes finalized tilt-table
recordings and exports a report for the student or clinician who brought the
participant. Its initial design was grounded in a representative recording
from the actual tilt table so that phase segmentation, angle behavior, ECG
quality, event projections, and report content reflect the real workflow.

The processing application must:

- Read finalized, checksum-verified Tilt ECG artifacts without modifying raw
  data.
- Never request, store, infer, embed, or export a participant name, medical
  record number, date of birth, address, or other direct identifier.
- Use only a non-identifying recording ID in application state and reports.
- Keep any manual connection between a report and a person outside this
  repository and outside the acquisition or processing artifacts.
- Produce an export suitable for manual review and, when appropriate, manual
  upload into the applicable record system.
- Preserve algorithm, configuration, source-checksum, review, correction, and
  export provenance.
- Remain a development/research analysis tool unless and until its governance,
  validation, intended use, and operational status are formally changed.

One actual tilt-table trial is sufficient to begin designing the application,
not to validate its clinical interpretation or reporting conclusions.

## Post-refinement directions

After the full acquisition, processing, analysis, review, and report workflow
has been refined with representative teaching and clinical-development tests,
the project may advance along two separate tracks.

### Availability to other users

Before distribution beyond the development environment, determine:

- Intended users, intended use, and the claims that may be made.
- Supported computers, browsers, Bluetooth adapters, sensors, firmware, and
  operating-system versions.
- Installation, update, rollback, backup, recovery, and support procedures.
- Whether configuration, data-root selection, and launch can be made safe
  without repository or Terminal knowledge.
- Validation fixtures and acceptance checks that do not expose human data.
- Training, documentation, incident reporting, and version compatibility.
- Applicable institutional, privacy, regulatory, licensing, and clinical
  governance requirements.

Availability does not imply clinical validation or authorization. The public
software and any governed operational deployment must retain distinct
boundaries.

### Active versus passive orthostatic stress research

A future prospective study may compare an active orthostatic stress protocol
with passive head-up tilt in people without signs, symptoms, or a diagnosis of
dysautonomia. The scientific purpose would be to characterize how physiologic
responses differ between active and passive orthostatic loading under
standardized conditions, not to derive a diagnostic claim from development
recordings.

Tilt angle is a conventional protocol descriptor, not the circulatory load
itself. During stationary or quasi-static periods, the chest accelerometer
estimates the direction and magnitude of gravity in the sensor frame. The
hydrostatic pressure difference relevant to the circulation depends on gravity
and the vertical distance between vascular locations. In a simplified aligned
model, that vertical column varies with an anatomical length and the sine of
the tilt angle. Standing height may be a useful initial proxy, but
heart-to-foot, heart-to-head, leg, and trunk distances are more directly tied
to the relevant vascular columns.

The project should therefore test whether physiology is better explained by:

- Corrected tilt angle alone.
- The measured gravity component along the table or body axis.
- A stature-adjusted gravity-load proxy.
- Direct anatomical vertical-column estimates.
- A hydrostatic-load estimate such as `rho * g * delta-h`, with assumptions,
  units, and uncertainty retained.

This is a hypothesis to evaluate, not a claim that one chest sensor directly
measures vascular pressure. Active standing also introduces muscle-pump
activity, joint configuration, postural stabilization, and other mechanisms
that must be separated from gravitational loading when compared with passive
head-up tilt.

Before beginning that work:

- Define the active protocol and passive head-up tilt protocol precisely,
  including posture, timing, target angle, transition rate, duration, stopping
  rules, and recovery.
- Define which anthropometric distances are required and whether standing
  height is adequate or only a preliminary proxy. Treat those measurements as
  governed participant data and assess their re-identification implications.
- Prespecify the gravitational and hydrostatic-load variables, coordinate
  axes, equations, units, assumptions, and uncertainty.
- Prespecify primary and secondary outcomes, candidate covariates, signal
  quality rules, exclusions, and statistical comparisons.
- Determine whether ECG, beat-to-beat HR, BP, end-tidal CO2, symptoms, and HRV
  can be acquired comparably in both protocols.
- Establish ethics/governance review, consent, recruitment, data retention,
  adverse-event, and privacy procedures.
- Develop a sample-size rationale and an analysis plan before enrollment.
- Keep clinical-development recordings out of the research dataset unless
  their use is specifically authorized.

## HMS website communication

The public HMS website is owned through the separate `movement-systems`
repository. Website updates should therefore be prepared there after review,
not generated from governed recordings or approved reports in this
repository.

The publication sequence should be:

1. **Development project page:** describe the de-identified Movesense ECG and
   chest-angle workflow, acquisition-to-report architecture, current
   development status, and boundaries. State that it is not a diagnostic
   monitor or replacement for approved clinical systems.
2. **Methods and teaching update:** after additional workflow validation, show
   only diagrams, synthetic data, or explicitly permission-cleared teaching
   examples. Link to the public implementation repository when installation
   and documentation are ready.
3. **Research direction:** describe the active-versus-passive orthostatic
   comparison as a proposed research question until governance approval and a
   protocol exist.
4. **Results:** publish findings only after formal analysis and scientific
   review; do not turn engineering or clinical-development observations into
   efficacy, normative, or diagnostic claims.

Do not publish patient traces, reports, recording identifiers, clinical event
details, or screenshots derived from governed clinical data. Every public
statement must distinguish current capability, validation status, proposed
work, and completed research.

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
