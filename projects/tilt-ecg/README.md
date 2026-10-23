# Tilt ECG Project

`tilt-ecg` is the working project slug. The final project name remains open.

## Purpose

Develop a Movesense-based system that records synchronized ECG and chest
orientation for:

1. Live-streamed tilt-table testing.
2. On-sensor Flash logging during ambulatory activity.

This project reuses Movesense acquisition, firmware-inventory, recording,
checksum, and governance infrastructure from this repository. It does not
require OpenSense or OpenSim integration.

See:

- The [local application](app/README.md) for launch, synthetic validation,
  governed output, and tests.
- The [processing and report application](processing-app/README.md) for
  immutable review, table-angle calibration, native R–R analysis, and
  de-identified report export.
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
