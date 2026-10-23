# Tilt ECG Project

Public HMS Lab name: **Tilt ECG Measurement and Physiology Review**.

Public project page:
[movementsystems.org/hms-lab/projects/tilt-ecg-measurement-review](https://movementsystems.org/hms-lab/projects/tilt-ecg-measurement-review/)

## Purpose

Develop a Movesense-based system that:

1. Records synchronized ECG and chest orientation during live tilt-table
   testing.
2. Preserves governed, checksum-verified acquisition artifacts.
3. Supports de-identified physiology review and immutable report provenance.
4. May later support on-sensor Flash logging during ambulatory activity.

This project reuses Movesense acquisition, firmware-inventory, recording,
checksum, and governance infrastructure from this repository. It does not
require OpenSense or OpenSim integration.

See:

- The [local application](app/README.md) for launch, synthetic validation,
  governed output, and tests.
- The [processing and report application](processing-app/README.md) for
  immutable review, table-angle calibration, native R–R and beat-to-beat HR
  analysis, BP, end-tidal CO2, symptoms, HRV, Poincare analysis, and
  de-identified portrait report export.
- The [project charter](docs/project-charter.md) for scope, architecture,
  phases, governance, and repository-extraction criteria.
- The [live tilt-table requirements](docs/live-tilt-table-requirements.md) for
  the confirmed local-web interface, five-beat HR estimator, SQLite recording,
  five-second summary, and operator workflow.

## Project boundary

Project-specific software, schemas, protocols, tests, and documentation belong
under `projects/tilt-ecg/`. Reusable Movesense transport or recording
infrastructure may be extracted into a shared repository module when there is a
demonstrated second use; ECG-specific behavior must not be added to the
OpenSense processing package.

Public repository content may include:

- Application and firmware-integration code.
- Versioned configuration and schemas.
- Synthetic or explicitly redistributable ECG and IMU fixtures.
- Tests and non-sensitive validation reports.

Raw or derived human ECG, posture, activity, symptoms, identifiers, and
clinical records must remain outside this public repository.

## Current development status

The acquisition and processing/report applications are operational localhost
software and have completed automated, synthetic, hardware, governed-artifact,
approval, and browser-print validation. Representative teaching/development
and clinical-development workflows are being used to refine the complete path
from acquisition through report export.

This status does not establish scientific validity, diagnostic validity,
normative reference values, or readiness for clinical distribution. Approved
clinical equipment, supervision, stopping criteria, safety procedures, and
clinical documentation remain authoritative.

## Quick start

On macOS, double-click:

```text
launch-tilt-ecg.command
```

for acquisition, or:

```text
launch-tilt-ecg-processing.command
```

for review and reporting. The applications use `127.0.0.1` and do not require
VS Code after launch. Keep the launcher Terminal window open while using the
corresponding application.

## Governed storage namespace

The project will use the existing governed-storage boundary with a distinct
namespace:

```text
MOVESENSE_DATA_ROOT/
├── raw/tilt-ecg/YYYY-MM-DD/<recording-id>/
├── manifests/tilt-ecg/YYYY-MM-DD/<recording-id>.json
└── derived/tilt-ecg/YYYY-MM-DD/<recording-id>/
```

Existing OpenSense recording paths remain unchanged. The tilt-ECG application
must never write human recordings into this public project directory.

## Initial directory responsibilities

- `docs/` — project charter, architecture, decisions, and validation evidence.
- `configs/` — versioned live-streaming and Flash-logging configurations.
- `schemas/` — recording and artifact data contracts.
- `app/` — localhost Node application, deterministic simulator, live signal
  processing, SQLite recorder, browser UI, and automated tests.
- `processing-app/` — read-only governed-recording discovery, checksum
  verification, calibration, physiology analysis, review provenance, report
  preview, and automated tests.
