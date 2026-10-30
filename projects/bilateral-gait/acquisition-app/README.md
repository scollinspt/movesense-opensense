# Bilateral Gait Acquisition Application

Localhost browser application for two-sensor distal-shank IMU acquisition.

## Current capabilities

- Deterministic two-sensor simulator.
- Scan and explicit left/right Movesense assignment.
- Two independent live IMU9 streams through the existing Python BLE bridge.
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

