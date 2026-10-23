# HMS Lab Tilt ECG processing and report application

This separate localhost application reviews finalized Tilt ECG recordings,
derives table-angle calibration, beat-to-beat HR, native-timestamp R–R
intervals, clinical physiology summaries, and HRV, and prepares a
de-identified clinician-reviewable report. It never modifies the acquisition
SQLite, CSV, or manifest.

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
6. Inspect the ascending-tilt R–R and beat-to-beat HR scatter plots and
   ordinary least-squares lines.
7. Review HR response, BP, etCO2, symptoms, and their timing.
8. Set the supine, upright, and recovery HRV windows.
9. Review time-domain HRV, Poincare results, and frequency-domain eligibility.
10. Click an R–R scatter point to exclude or restore that interval.
11. Add an optional de-identified clinical reviewer conclusion.
12. Approve the review to write immutable review provenance.
13. Select **Print / Save PDF** and choose the browser's PDF destination.
    The report is formatted for portrait-oriented paper by default.

The regression pairs every accepted consecutive R–R interval with the
linearly interpolated corrected table angle at the interval midpoint. It does
not use five-second heart-rate aggregates. The default regression scope is the
recorded ascending tilt interval.

The clinical analysis also reports:

- Baseline median and range of beat-to-beat HR.
- Peak upright HR and maximum change from baseline.
- Maximum sustained HR change when the upright interval is long enough.
- A configurable orthostatic HR threshold and assessment duration.
- Corrected-angle versus beat-to-beat HR slope.
- BP changes and configured orthostatic hypotension criteria.
- etCO2 values and changes from baseline.
- Symptom onset/resolution with corrected angle and HR context.

Meeting a configured HR threshold is reported as a physiologic pattern, not as
a diagnosis. The HR-angle slope remains descriptive until a protocol-specific
reference range is established.

## HRV and frequency-domain eligibility

HRV is calculated separately for reviewer-defined stable supine, upright, and
recovery segments. Time-domain and Poincare outputs include:

- Mean and median NN.
- Mean HR.
- SDNN.
- RMSSD.
- pNN50.
- SD1, SD2, and SD1/SD2.

Default frequency-domain requirements are:

```text
Minimum HF segment:             90 seconds
Minimum LF and LF/HF segment:  300 seconds
Minimum accepted NN:            95 percent
Maximum excluded NN:             5 percent
Stationary corrected angle:     required
Maximum robust angle range:      5 degrees
```

The reviewer can exclude frequency-domain HRV entirely. A nonstandard
eligibility override requires a rationale and is preserved in review
provenance. Eligible spectra use a 4 Hz interpolated NN tachogram, mean
detrending, and a Hann-window Welch periodogram. LF/HF is presented
descriptively and is not labeled as a direct measure of sympathovagal balance.

## Calibration

The corrected angle is:

```text
corrected(t) =
  (raw(t) - baseline_raw) × achieved_table_angle
  / (plateau_raw - baseline_raw)
```

Raw chest-relative tilt remains unchanged. Review artifacts preserve the windows, achieved angle, scale factor,
accepted/excluded interval counts, R–R and HR regression equations, clinical
physiology results, HRV metrics and eligibility, source checksums, reviewer
conclusion, and software provenance.

Approved reviews are written beneath:

```text
MOVESENSE_DATA_ROOT/
└── derived/tilt-ecg/YYYY-MM-DD/<recording-id>/reviews/<review-id>.json
```

No name, MRN, date of birth, or other direct identifier is requested or stored.

## Report boundary

The report prioritizes the clinical physiology summary, heart-rate response,
HR-angle association, BP, etCO2, symptoms, HRV, and Poincare analysis.
Acquisition integrity, calibration, native R–R quality, source checksums, and
processing provenance appear in the technical appendix.

The browser print dialog is intentionally used for PDF export so the operator
can preview the exact report and choose an approved destination. The application
does not silently write a PDF or infer a patient identity.

## Tests

```bash
cd projects/tilt-ecg/processing-app
npm test
```
