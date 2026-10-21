# Tilt ECG configurations

Store versioned, non-sensitive configuration for live ECG/IMU streaming and
on-sensor Flash logging here.

Each configuration must identify:

- Project and protocol version.
- Sensor resource routes and requested rates.
- Live or on-sensor acquisition mode.
- Required event labels.
- Electrode/strap and sensor placement definition.
- Timing and continuity acceptance thresholds.
- Output schema version.

Do not store participant identifiers, recordings, credentials, private device
inventories, or host-specific paths here.

Current configurations:

- `live-v1.json` — historical 125 Hz ECG and 52 Hz IMU9 development baseline.
- `live-v2.json` — current 512 Hz ECG and 26 Hz IMU9 configuration for
  HRV-oriented tilt-table acquisition.
