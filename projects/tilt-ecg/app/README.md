# HMS Lab Tilt ECG application

This directory contains the localhost operational application for live
Movesense ECG and chest-orientation acquisition during tilt-table testing.

The application is a research acquisition interface. It is not a diagnostic
monitor, alarm, medical device, or substitute for approved ECG, blood-pressure,
end-tidal CO2, table-safety, stop-criteria, or emergency procedures.

## Requirements

- Node.js 22.13 or later, with the built-in `node:sqlite` module.
- Python 3.11 or later in the repository `.venv`.
- Repository Python dependencies installed for hardware scan and BLE access.
- A governed data root outside this public repository.

No web-package installation or internet connection is required.

## Start

### Double-click on macOS

In Finder, double-click:

```text
projects/tilt-ecg/launch-tilt-ecg.command
```

The launcher opens the existing server when one is already running. Otherwise,
it starts the server and opens the application in the default browser. Keep the
launcher Terminal window open during acquisition; closing it stops a server
that was started by the launcher.

For easier access, create a Finder alias for the launcher and move the alias to
the Desktop or Dock. Keep the original launcher in the repository so it
continues to resolve the application correctly.

### Start from Terminal

From the repository root:

```bash
node projects/tilt-ecg/app/server.mjs
```

The server binds only to `127.0.0.1:4173` and opens the system browser. Override
the port or governed root when needed:

```bash
node projects/tilt-ecg/app/server.mjs \
  --port 4180 \
  --data-root /absolute/path/to/governed-storage
```

Use `--no-open` when browser launch is not wanted. Port `0` selects an
ephemeral port.

## Synthetic validation

Select **Run simulator** to exercise the complete live path without a sensor.
The deterministic source provides:

- ECG at 250 Hz with a nominal 72 bpm rhythm.
- IMU at 50 Hz.
- Stable supine data, a transition to 70 degrees, a hold, and return to zero.

After approximately three stationary seconds, accept the supine zero. Enter
baseline observations and start recording. The simulator uses the same signal
processing, annotations, SQLite writer, five-second summary, checksums, and
manifest as hardware acquisition.

During recording, the interface displays the current protocol phase and
enables only the next valid progression step: baseline supine, begin tilt,
target angle reached, begin return, then supine recovery. Completed/current
steps remain visible but cannot be logged twice. **Undo last annotation**
restores the preceding phase when the latest eligible event was a phase.
Technical interruption and strap/sensor adjustment remain repeatable.

## Recording output

Each finalized test writes:

```text
MOVESENSE_DATA_ROOT/
├── raw/tilt-ecg/YYYY-MM-DD/<recording-id>/signals.sqlite
├── derived/tilt-ecg/YYYY-MM-DD/<recording-id>/five_second_summary.csv
└── manifests/tilt-ecg/YYYY-MM-DD/<recording-id>.json
```

The SQLite database preserves native-rate ECG and IMU samples in separate
tables plus exact operator events and metadata. The CSV is a derived
five-second projection. The manifest stores SHA-256 checksums for both files.

During a recording, SQLite WAL sidecars can exist beside
`signals.sqlite.partial`. Normal finalization checkpoints the WAL, closes the
database, renames the primary file to `signals.sqlite`, and only then computes
checksums.

If the process or computer stops during recording, preserve the partial
database and any WAL sidecars. Recover it explicitly with:

```bash
node projects/tilt-ecg/app/recover.mjs \
  --data-root /absolute/path/to/governed-storage
```

Recovery checkpoints the WAL into `signals.recovered.sqlite`, records the
interrupted/incomplete status in the database, and writes a checksummed
`.recovered.json` manifest. It does not generate a five-second summary or
present the incomplete recording as normally finalized.

## Tests

```bash
cd projects/tilt-ecg/app
npm test
```

The test suite covers the five-wave HR formula, synthetic Pan-Tompkins
detection, tilt zeroing, five-second projection, SQLite finalization, checksums,
and local HTTP startup.

## Current hardware boundary

Hardware scanning and concurrent ECG/IMU9 subscriptions use the repository's
Bleak GSP bridge. The implemented ECG contract is `/Meas/ECG/{rate}` with a
little-endian device-uptime timestamp followed by raw `int32` ADC samples.
ECG and IMU use distinct GSP references and independent continuation buffers.

The current live configuration requests ECG at 512 Hz and IMU9 at 26 Hz. This
provides approximately 1.95 ms ECG timing resolution for derived HRV while
retaining approximately 38 ms orientation sampling for slow table motion. The
application reports a connection error when no samples arrive within ten
seconds, but it does not yet query `/Meas/ECG/Info`. Confirm that the installed
sensor application advertises the requested ECG rate and validate simultaneous
throughput, timestamp continuity, signal units, and R-wave behavior on the
actual sensor before collecting participant data.
