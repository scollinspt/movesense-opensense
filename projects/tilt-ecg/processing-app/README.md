# HMS Lab Tilt ECG processing and report application

This separate localhost application reviews finalized Tilt ECG recordings,
derives table-angle calibration and native-timestamp R–R intervals, and prepares
a de-identified printable report. It never modifies the acquisition SQLite,
CSV, or manifest.

The application is a research review interface. It is not a diagnostic
interpretation, clinical alarm, or substitute for approved tilt-table
procedures.

## Start

On macOS, double-click:

```text
projects/tilt-ecg/launch-tilt-ecg-processing.command
```

Or start it from the repository root:

```bash
node projects/tilt-ecg/processing-app/server.mjs
```

The server binds only to `127.0.0.1:4175` and opens the system browser. Override
the port or governed root when needed:

```bash
node projects/tilt-ecg/processing-app/server.mjs \
  --port 4181 \
  --data-root /absolute/path/to/governed-storage
```

## Review workflow

1. Select a finalized Tilt ECG recording.
2. Verify the raw and five-second-summary checksums.
3. Review or correct the suggested baseline, plateau, and ascending-tilt
   intervals.
4. Confirm the achieved table angle. Older recordings without acquisition
   target metadata require explicit confirmation.
5. Inspect the corrected-angle and native R–R timeline.
6. Inspect the ascending-tilt scatter plot and ordinary least-squares line.
7. Click a scatter point to exclude or restore that R–R interval.
8. Approve the review to write immutable review provenance.
9. Select **Print / Save PDF** and choose the browser's PDF destination.

The regression pairs every accepted consecutive R–R interval with the
linearly interpolated corrected table angle at the interval midpoint. It does
not use five-second heart-rate aggregates. The default regression scope is the
recorded ascending tilt interval.

## Calibration

The corrected angle is:

```text
corrected(t) =
  (raw(t) - baseline_raw) × achieved_table_angle
  / (plateau_raw - baseline_raw)
```

Raw chest-relative tilt remains unchanged. Review artifacts preserve the
windows, achieved angle, scale factor, accepted/excluded interval counts,
regression equation, source checksums, and software provenance.

Approved reviews are written beneath:

```text
MOVESENSE_DATA_ROOT/
└── derived/tilt-ecg/YYYY-MM-DD/<recording-id>/reviews/<review-id>.json
```

No name, MRN, date of birth, or other direct identifier is requested or stored.

## Report boundary

The report contains the recording ID, acquisition integrity, protocol timing,
calibration, native R–R quality, synchronized timeline, ascending-tilt scatter
plot, regression equation, coefficient of determination, sample count, and
method limitations.

The browser print dialog is intentionally used for PDF export so the operator
can preview the exact report and choose an approved destination. The application
does not silently write a PDF or infer a patient identity.

## Tests

```bash
cd projects/tilt-ecg/processing-app
npm test
```
