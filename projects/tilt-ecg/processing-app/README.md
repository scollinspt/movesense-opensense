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
11. Review the Panther PT stage table, performed protocol, sustained HR
    response, consensus-criteria table, literature-grounded end-tidal CO2
    response, limitations, and frozen evidence references.
12. Add an optional de-identified reviewer conclusion to the detailed HMS
    report when needed.
13. Complete the DPT student, licensed reviewer, supervising clinician,
    credentials, approval date, and electronic-attestation fields.
14. Approve the review to write immutable `tilt-ecg-review-v3` provenance.
15. Export either the Panther PT clinical-adjunct report or the detailed HMS
    physiology report. Both use portrait-oriented paper by default.

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
- Recovery HR at 30, 60, 120, and 300 seconds plus time to return within
  10 bpm of baseline.
- Classic, initial, and delayed orthostatic-hypotension criteria as observed,
  not observed, or not assessable.

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

One approved analysis produces two report views:

- **PSU DPT Panther PT Pro Bono Clinic Passive Head-Up Tilt Physiological
  Response Report** — a de-identified clinical adjunct led by a stage-by-stage
  table containing phase duration, median and sustained HR, every logged BP
  and etCO2 value, and every symptom event. It also includes the performed
  protocol, sustained orthostatic HR, classic and delayed OH criteria, a
  literature-grounded end-tidal CO2 response classification, limitations,
  licensed approval, and frozen evidence references.
- **Detailed HMS report** — the existing physiology and technical report with
  HR-angle and R–R regression, HRV, Poincare plots, and technical provenance.

The clinic report method is
`panther-pt-passive-hut-report-v0.2.0`; its initial frozen evidence set is
`tilt-ecg-evidence-2026-10-24-v1`. Criteria are physiological observations, not automatic diagnoses. Initial
orthostatic hypotension is omitted because the current workflow does not
record the continuous beat-to-beat BP required for that assessment.
The end-tidal CO2 response uses the Stewart et al. literature threshold below
30 mmHg as a descriptive classification and distinguishes baseline
hypocapnic-range values from a new postural transition. Approval attests that
the report will be used alongside other physical therapy examination findings
in developing a movement system interpretation.

The browser print dialog is intentionally used for PDF export so the operator
can preview the exact report and choose an approved destination. The application
does not silently write a PDF or infer a patient identity.

Patient identifiers remain outside the acquisition and processing artifacts.
Authorized student and clinician identities are stored only with immutable
report approval provenance.

## Tests

```bash
cd projects/tilt-ecg/processing-app
npm test
```
