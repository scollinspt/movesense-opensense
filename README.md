# Movesense OpenSense

An open development repository for governed Movesense measurement workflows:

1. IMU acquisition and synchronized orientation processing for
   OpenSense/OpenSim.
2. ECG and chest-angle acquisition, physiology review, and de-identified
   reporting during tilt-table testing.
3. Bilateral distal-shank IMU acquisition and gait-measurement development for
   physical therapy.

Working software and engineering validation do not establish scientific
validity, diagnostic validity, normative reference values, or readiness for
clinical distribution.

The Human Movement Systems Laboratory public project page describes the current
[Tilt ECG Measurement and Physiology Review](https://movementsystems.org/hms-lab/projects/tilt-ecg-measurement-review/)
work, its boundaries, and its future directions.

## Repository projects

- The root OpenSense work develops governed IMU acquisition, orientation
  processing, OpenSense integration, and ambulatory movement methods.
- [`projects/tilt-ecg/`](projects/tilt-ecg/) contains the operational
  acquisition and processing/report applications for synchronized ECG and
  chest orientation during tilt-table testing. Later work may investigate
  ambulatory on-sensor Flash logging. The project reuses Movesense
  infrastructure but has no OpenSense dependency.
- [`projects/bilateral-gait/`](projects/bilateral-gait/) is a
  documentation-first project for two-sensor bilateral shank acquisition,
  structured gait context, synchronization validation, and later reviewed gait
  metrics. Its acquisition and processing applications have not yet been
  built.

## Tilt ECG measurement and physiology review

The Tilt ECG project currently provides two separate localhost browser
applications:

- **Acquisition:** live 512 Hz ECG and nominal 26 Hz IMU, five-beat heart rate,
  accepted supine zero, target-angle and early-return workflow, symptoms, BP,
  end-tidal CO2, native-rate SQLite storage, five-second summaries, checksums,
  and manifests.
- **Processing and report:** source-integrity verification, reviewed
  table-angle calibration, native R–R intervals, beat-to-beat HR, angle-response
  regression, time-aligned observations, segment-specific HRV, Poincare
  analysis, configurable frequency-domain eligibility, immutable review
  provenance, and portrait PDF export.

Neither application requests a name, medical record number, date of birth, or
other direct identifier. Any authorized connection between a recording,
report, and person remains outside the application artifacts. Clinical
recordings and derived reports remain governed data even when direct
identifiers are absent.

### Launch on macOS

From Finder, double-click:

```text
projects/tilt-ecg/launch-tilt-ecg.command
```

The launcher starts acquisition at `http://127.0.0.1:4174/`. Keep its Terminal
window open throughout acquisition.

To review a finalized recording and prepare a report, double-click:

```text
projects/tilt-ecg/launch-tilt-ecg-processing.command
```

The processing application opens at `http://127.0.0.1:4175/`. It reads
finalized source artifacts without modifying them and writes approved review
provenance as a new derived artifact.

See the [Tilt ECG project documentation](projects/tilt-ecg/), the
[acquisition application](projects/tilt-ecg/app/), and the
[processing/report application](projects/tilt-ecg/processing-app/) for
requirements, operating workflow, validation evidence, tests, schemas, and
governance boundaries.

After further workflow refinement, two separate questions will be evaluated:

1. How the system could be packaged, installed, validated, documented, and
   supported for other qualified users.
2. Whether a prospective study should compare active orthostatic stress with
   passive head-up tilt in individuals without signs, symptoms, or a diagnosis
   of dysautonomia.

The proposed comparison requires its own protocol, outcomes, sample-size
rationale, ethics/governance review, consent, and analysis plan. Clinical
development recordings do not become research data without specific
authorization.

## Open the canvas studios

In Copilot Chat, enter:

> **Open Movesense Studio Hub**

The hub explains which studio to use and provides copyable launch phrases for
the Acquisition, Processing, and Firmware Update studios. Canvas pages cannot
directly control the VS Code host, so the copied phrase is pasted back into
Copilot Chat to open the selected studio.

The direct launch phrases are:

- **Open Movesense Acquisition Studio**
- **Open Movesense Processing Studio**
- **Open Movesense Firmware Update Studio**

See the current
[ambulatory movement R&D strategy](docs/ambulatory-movement-rd-strategy.md)
before planning the next collection session. The existing
[`upper-limb-next-sessions-v1`](configs/protocols/upper-limb-next-sessions-v1.md)
protocol remains a historical record of the distal upper-extremity development
stage rather than the active R&D priority.

## Data boundary

Recordings and generated artifacts must not be committed to this public
repository. Researcher self-recordings used for engineering development are
stored in the separate private governed-storage repository. Human-subject data,
participant identifiers, consent records, and other restricted material require
a separately approved storage and governance plan. Set `MOVESENSE_DATA_ROOT` to
the applicable governed-storage location.

See `docs/governance-boundaries.md` for the complete boundary.

## Live acquisition prototype

The Movesense Acquisition Studio project canvas can scan for a nearby Movesense
sensor, subscribe to `/Meas/IMU9/52` over the official GATT SensorData Protocol,
and plot acceleration, angular velocity, and magnetic-field samples in real time.

Create the development environment before opening the canvas:

```console
python3 -m venv .venv
.venv/bin/python -m pip install -e '.[dev]'
```

On macOS, enable Bluetooth and grant VS Code or Python access under **System
Settings > Privacy & Security > Bluetooth**. Wake the sensor, select **Scan** in
the canvas, choose the discovered device, and select **Connect**.

The dashboard provides start/stop recording controls when a sensor is connected.
Sensor-native timestamps and host receipt times remain separate in every decoded
sample. Recordings are written under the configured governed data root:

During a multi-phase recording, the operator can add named phase markers. Each
marker retains its sequence, nearest sensor timestamp, sample index, host
monotonic timestamp, and host wall-clock timestamp in the recording manifest.
Static pauses around markers allow boundaries to be checked and refined during
processing without modifying the raw CSV.

```text
MOVESENSE_DATA_ROOT/
├── raw/YYYY-MM-DD/<recording-id>/imu9.csv
└── manifests/YYYY-MM-DD/<recording-id>.json
```

The raw CSV preserves sensor-native timestamps, host monotonic receipt times,
host wall-clock receipt times, and IMU9 values. The manifest records the
requested resource and sample rate, movement protocol, placement, sensor
orientation, units, timestamp semantics, sample count, software environment,
and SHA-256 checksum. A raw recording is acquisition input; OpenSense requires
later synchronization, calibrated orientation estimation, coordinate
conversion, and quaternion `.sto` export.

## Governed recording inspection

The Movesense Processing Studio project canvas reads a selected recording
directly from its governed-storage repository. It verifies the raw CSV checksum
and sample count, reports sensor-time continuity and effective rate, displays
acceleration, angular-velocity, and magnetic-field traces, supports shared
drag-to-select intervals and axis visibility controls, calculates calibration
interval diagnostics, records private calibration and movement annotations, and
builds a bias-corrected constrained one-DOF forearm or elbow angle after the
user assigns the anatomical sign.

The studio stores only its selected recording ID, governed-storage root, and
calibration and annotation state in private Copilot extension data. It does not
copy raw recordings into this repository.

For a constrained forearm or elbow trial, the studio can run a bias-corrected
one-axis estimator, generate normalized neutral-referenced quaternions, build a
side-aware one-DOF OpenSim model, export an OpenSense quaternion `.sto`, run
IMU inverse kinematics, and checksum and validate the result. A synchronized
canvas viewer animates the source OpenSense quaternion beside the OpenSim IK
coordinate, with playback controls and per-frame angular error. Generated
artifacts remain under the governed root:

```text
derived/YYYY-MM-DD/<recording-id>/opensense-one-dof/
├── forearm_orientations.sto
├── right_forearm_1dof.osim
├── forearm_ik.mot
├── forearm_ik.mot_orientationErrors.sto
└── processing-manifest.json
```

This path requires an installed OpenSim 4.6 Python SDK and a compatible Python
3.11 interpreter. Their host-specific paths are saved only in private extension
state. The OpenSim source repository is not required. The bundled Arm26 model
is not used because its two coordinates are shoulder elevation and elbow
flexion; it does not model forearm pronation/supination.

For a marked left-wrist elbow-plus-forearm session, the studio can also run a
two-stage full-orientation pipeline. The project virtual environment performs
six-axis x-io Fusion AHRS processing and endpoint-neutral drift closure; the
configured OpenSim Python runtime maps NWU orientations to OpenSim ground,
calibrates `radius_l_imu` on the Rajagopal OpenSense model, locks every
coordinate except `elbow_flex_l` and `pro_sup_l`, and runs orientation IK.
Generated artifacts are stored separately under
`derived/YYYY-MM-DD/<recording-id>/opensense-two-dof/`. The processing manifest
reports magnetic-field exclusion, neutral closure, orientation residuals,
coordinate-limit occupancy, and phase-specific coordinate ranges. A completed
IK run is not reported as validated when these diagnostics exceed their
acceptance thresholds. The studio also provides an interactive diagnostic
simulation generated from the actual Rajagopal body and calibrated IMU-frame
states. Playback, scrubbing, and drag-to-rotate controls show elbow flexion,
forearm rotation, and a residual-coded forearm; the simulation is explicitly
diagnostic rather than an independent validation reference.

The constrained estimator does not replace general orientation fusion for
arbitrary three-dimensional motion or multi-segment trials.

## Firmware fleet preparation

The Movesense Firmware Update Studio project canvas maintains a private
ten-sensor inventory and update queue. It can:

- scan for and inventory nearby sensors;
- classify sensors as GSP-ready, legacy MDS, or unknown;
- download the commit-pinned official SS2 default-firmware package; and
- import a supplied Nordic DFU ZIP;
- validate safe ZIP paths, the DFU manifest, and referenced application and
  bootloader images; and
- verify the official package against the project's recorded SHA-256 checksum.

Disconnect a sensor from the Movesense mobile app before scanning from the
computer because a connected sensor may stop advertising. Firmware flashing is
intentionally locked until desktop bootloader entry and Nordic DFU transfer have
been validated on one test sensor. Inventory records and downloaded firmware are
stored in private Copilot extension data rather than Git.

The supported fleet workflow is deliberately sequential: inventory one sensor,
verify the package, release the desktop BLE connection, perform DFU through a
maintained Nordic/Movesense mobile transport, then reconnect from the studio and
confirm the sensor exposes GSP before moving to the next sensor. A structurally
valid user-supplied ZIP is not treated as trusted until its provenance and
checksum have been approved.

## License

Project-authored software and documentation are licensed under the
[Apache License 2.0](LICENSE). Third-party materials are not relicensed by this project;
software, models, and data remain subject to their own licenses and redistribution terms.
