# Tilt ECG schemas

This directory will contain versioned public schemas for:

- Live ECG and IMU recordings.
- On-sensor log inventory and retrieval.
- Recording manifests.
- Protocol events.
- Derived ECG-quality, tilt, posture, and activity artifacts.

Schemas must preserve the distinction among sensor-native sample time, host
receipt time, event time, and log retrieval time. Public fixtures must be
synthetic or explicitly redistributable.
