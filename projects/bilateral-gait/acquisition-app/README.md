# Bilateral Gait Acquisition Application

Localhost browser application for two-sensor distal-shank IMU acquisition.

## Current capabilities

- Deterministic two-sensor simulator.
- Scan and explicit left/right Movesense assignment.
- Two role-tagged live IMU9 streams through one Python process, one shared BLE
  discovery, and two `BleakClient` instances in one asyncio event loop.
- Live left and right sagittal angular-velocity traces.
- Placement and side-verification confirmation.
- Structured assistive-device, assistance, and orthosis context.
- Application-bounded recording start and stop.
- Calibration, gait-bout, straight, turn, transition, pause, context-change,
  and observation events.
- Native timestamps, separate host timestamps, SQLite transactions, final
  checkpoint, integrity check, SHA-256, and manifest.
- Explicit interrupted-recording recovery command.

Hardware acquisition has not yet completed the required two-sensor throughput
and timing validation. The simulator is for interface and recording-workflow
development only.

Concurrent connection and live 52 Hz streaming were verified with two
GSP-ready physical sensors on 2026-10-30. This bounded connection check does
not establish sustained throughput, packet continuity, clock offset, drift, or
reconnect performance.

Both hardware sensors must expose the Movesense GATT SensorData Protocol. A
sensor running the legacy Whiteboard/MDS application cannot provide the
required `/Meas/IMU9/{rate}` subscription and must be updated or loaded with a
compatible GATT SensorData application before use.

## Launch from the repository

```console
node projects/bilateral-gait/acquisition-app/server.mjs --port 4176
```

The server binds only to `127.0.0.1` and opens:

```text
http://127.0.0.1:4176/
```

Use the project launcher from Finder for operation outside VS Code:

```text
projects/bilateral-gait/launch-bilateral-gait.command
```

Keep the launcher Terminal window open during acquisition.

## Governed output

```text
MOVESENSE_DATA_ROOT/
|-- raw/bilateral-gait/YYYY-MM-DD/<recording-id>/signals.sqlite
`-- manifests/bilateral-gait/YYYY-MM-DD/<recording-id>.json
```

The app does not request or store direct patient identifiers.

## Recovery

If the process ends during recording, keep the `.partial` artifact and run:

```console
node projects/bilateral-gait/acquisition-app/recover.mjs \
  --data-root /absolute/path/to/governed-storage
```

Recovered artifacts are marked incomplete and require review.

## Tests

```console
npm --prefix projects/bilateral-gait/acquisition-app test
```
