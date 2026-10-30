# Bilateral Gait Development Continuity

## Current status

The project has a documentation, protocol, and initial schema foundation. The
first localhost acquisition application supports simulator review, two-sensor
hardware assignment, live preview, governed SQLite recording, structured
events, finalization, checksums, and explicit recovery. Hardware timing and
throughput validation remains pending. A bounded 2026-10-30 hardware check
confirmed concurrent 52 Hz streaming from two GSP-ready sensors after the BLE
bridge was consolidated into one Python process and asyncio event loop. The
processing application has not yet
been implemented. The HMS Lab Zotero collection for this project contains an
initial 16-paper evidence set with locally accessible PDFs for algorithm,
benchmark, validation, and interpretation work.

## Confirmed decisions

- Working name: Bilateral Gait IMU Measurement and Recovery Tracking.
- Repository slug: `bilateral-gait`.
- Two Movesense sensors over Bluetooth to a computer.
- One sensor on each distal medial shank.
- Placement immediately proximal to, but not on, the medial malleolus.
- Bilaterally symmetrical placement; no centimeter measurement required.
- Strap perpendicular and wordmark parallel to the shank long axis.
- `M` points proximally on both limbs.
- Hardware ID is explicitly assigned to left or right.
- Initial supported-seated static reference.
- One-leg-at-a-time active knee extension/flexion is preferred for side and
  functional-axis verification; active-assisted or passive movement is allowed
  when needed and recorded by limb.
- A strongly recommended post-gait supported-seated reference follows the gait
  bouts and supports return-error review; it is not a gait calibration stage.
- No separate walking-calibration stage is used; recorded gait bouts provide
  the walking data for later algorithm development.
- Application-bounded start, stop, finalization, and recovery.
- First protocol: flat overground, including straight and turning gait.
- Assistive device, physical assistance, orthosis, surface, and path geometry
  are separate context dimensions.
- Treadmill and obstacles are deferred.

## Current unresolved questions

- Which gait characteristics the students most need to follow.
- Exact acquisition IMU rate after two-sensor throughput testing.
- SQLite table and packet-provenance details.
- Measured inter-sensor clock behavior.
- Which reference system will validate each candidate gait event.
- Metric-specific acceptance thresholds.
- Whether a later report is useful before longitudinal repeatability is known.
- Which literature-derived detector should be implemented first after the
  initial recording establishes the source and timing contracts.

## Immediate next implementation sequence

1. Collect and finalize the first governed real two-sensor recording under the
   applicable authorized workflow.
2. Inspect sample continuity, effective rates, native-clock behavior,
   event-to-sample projections, and left/right role integrity.
3. Confirm that initial calibration, gait-bout, path, context-change, and
   post-session quality events support reproducible processing.
4. Compare the Lanotte, Romijnders, Voisard, Gaitmap, and foundational
   inertial-gait methods against the observed signal and timing contracts.
5. Define an independent event-timing reference and metric-specific acceptance
   criteria.
6. Build read-only processing only after the source, synchronization, and
   review contracts are stable.

## Boundary

Do not place patient data in this repository. Clinical-development use requires
the applicable authorization and safety workflow even if the software is
technically operational.
