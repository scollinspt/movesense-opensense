# Initial Movesense Acquisition Plan

## Purpose

Use the official GATT SensorData Protocol (GSP) Python client with Bleak to verify one Movesense device and capture the first non-human bench recording. This is a planned procedure, not evidence that acquisition has succeeded or that the system is scientifically validated.

## Procedure

1. Test one sensor with its existing firmware; do not flash it yet.
2. Read `/Info` and `/Info/App` to inventory firmware, hardware, and the installed application.
3. Confirm GSP availability. Movesense default firmware `>=2.3.0` includes GSP.
4. Subscribe to `/Meas/IMU9/52` for a short bench recording containing synchronized accelerometer, gyroscope, and magnetometer samples.
5. Preserve sensor timestamps separately from host receipt timestamps. Bluetooth packet arrival time must not be treated as sensor sample time.
6. Store the immutable raw recording and its provenance manifest in governed storage outside Git.

If GSP is unavailable, then decide between updating default firmware or loading the GATT SensorData sample firmware. Do not change firmware until the installed version and application have been recorded.

## Recording Evidence

The recording manifest should include:

- logical device identifier and hardware identifier;
- firmware and application versions;
- acquisition client and Bleak versions;
- receiving computer, operating system, and Bluetooth adapter;
- requested resource path and sample rate;
- sensor timestamp or counter semantics;
- host receipt timestamp semantics;
- units and array structure for each signal;
- recording start and stop times;
- packet, sequence, gap, and parse diagnostics available from the client; and
- file checksum and storage location.

## Storage

Place the raw recording under the configured `MOVESENSE_DATA_ROOT/raw/` hierarchy and its checksum and provenance record under `MOVESENSE_DATA_ROOT/manifests/`. Only synthetic or explicitly redistributable fixtures belong in the public repository.