# Tilt ECG development continuity

## Current validated state

The Tilt ECG application is a standalone localhost application. It is not
hosted by VS Code, Copilot Canvas, or the VS Code shared browser.

- Server URL: `http://127.0.0.1:4174/`
- Bind address: `127.0.0.1`
- Application entry point: `projects/tilt-ecg/app/server.mjs`
- Validated implementation commit: `639e284`
- Current live configuration: `projects/tilt-ecg/configs/live-v2.json`
- ECG rate: 512 Hz
- IMU9 rate: nominal 26 Hz
- Raw recording schema: `tilt-ecg-recording-v1`
- Summary schema: `tilt-ecg-five-second-summary-v1`

Firefox and the VS Code shared browser are equivalent clients of one
server-owned state. Opening two browser tabs does not create two BLE
connections. Actions in either client affect the same connection and
recording. Closing a tab or closing VS Code does not finalize a recording or
disconnect the sensor.

## Start and verify

From the repository root:

```bash
node projects/tilt-ecg/app/server.mjs --port 4174
```

Verify the server without opening VS Code:

```bash
curl --fail http://127.0.0.1:4174/api/state
```

Open or bookmark:

```text
http://127.0.0.1:4174/
```

The connection badge must report `ECG 512 Hz · IMU 26 Hz` after hardware
connection. If no ECG or IMU samples arrive within ten seconds, the bridge
reports an explicit error instead of presenting a false connected state.

## Browser-independent validation

A hardware trial initiated and operated entirely from Firefox while VS Code
remained uninvolved in the workflow completed successfully:

- 70.91 seconds.
- 36,304 ECG samples.
- Effective ECG rate 512.002 Hz.
- 1,778 IMU samples.
- Effective inertial rate 25.089 Hz.
- No missing ECG or IMU packet sequences.
- No non-monotonic sensor timestamps.
- Maximum ECG timestamp gap 3 milliseconds.
- Maximum IMU timestamp gap 43 milliseconds.
- ECG and tilt quality good in every five-second window.
- Heart rate available in every five-second window.
- SQLite integrity check passed.
- Raw and derived checksums verified.
- Ordered phases, symptom onset/resolution, BP, and etCO2 events persisted.
- Normal finalization and BLE disconnect.

This validates the localhost browser workflow independently of the VS Code
presentation. The next validation is to close VS Code completely, retain the
already-running detached server, complete a Firefox trial, reopen VS Code, and
audit the newest manifest.

## Governed output

Finalized recordings remain outside the public repository:

```text
MOVESENSE_DATA_ROOT/
├── raw/tilt-ecg/YYYY-MM-DD/<recording-id>/signals.sqlite
├── derived/tilt-ecg/YYYY-MM-DD/<recording-id>/five_second_summary.csv
└── manifests/tilt-ecg/YYYY-MM-DD/<recording-id>.json
```

Normal finalization checkpoints the SQLite WAL, closes and renames the primary
database, generates the five-second summary, computes SHA-256 checksums, and
writes the manifest. After a browser-only trial, identify the newest recording
by sorting the manifest paths rather than relying on browser state.

## Interrupted recording recovery

If the server or computer stops during recording, preserve the partial
database and WAL sidecars. Recover explicitly:

```bash
node projects/tilt-ecg/app/recover.mjs \
  --data-root /absolute/path/to/governed-storage
```

Recovered data are marked interrupted/incomplete and are not presented as
normally finalized.

## Before closing VS Code

1. Confirm `/api/state` reports `recording: null`.
2. Confirm `connectionState` is `idle`.
3. Confirm the localhost server is listening on port 4174.
4. Keep the Mac logged in and awake.
5. Do not restart or log out before the browser-only trial.

The detached server does not survive a computer restart or macOS logout. If it
is no longer running, restart it with the command above before opening the
bookmark.

## Remaining development items

- Query `/Meas/ECG/Info` at connection time and select among sensor-advertised
  rates rather than relying only on the configured 512 Hz request.
- Add an explicit `test_end` event in addition to manifest `stoppedAt`
  metadata.
- Create an HRV-derived artifact with accepted/rejected peaks, refined R-wave
  times, R-R intervals, reviewed NN intervals, quality flags, and artifact or
  ectopic-correction provenance.
- Validate chest angle against an independent table-angle reference before
  interpreting it as table tilt.
