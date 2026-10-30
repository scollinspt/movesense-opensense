# Bilateral gait schemas

This directory contains public, versioned contracts for acquisition metadata
and events. Human recordings remain in governed storage.

## Current schemas

- `bilateral-gait-manifest-v1.schema.json` - finalized recording identity,
  source artifacts, sensor-role assignments, placement, context, timing, and
  integrity.
- `bilateral-gait-event-v1.schema.json` - calibration, gait-bout, path,
  context-change, and observation events projected to both sensor streams.

## Planned schemas

- Native-rate SQLite recording contract.
- Inter-sensor synchronization review.
- Candidate and reviewed gait events.
- Derived gait metrics.
- Review and report provenance.

Schemas must preserve sensor-native time, host monotonic receipt time, host
wall-clock time, and event time as distinct values. Missing or invalid timing
must not be replaced with zero.

