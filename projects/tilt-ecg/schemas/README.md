# Tilt ECG schemas

This directory will contain versioned public schemas for:

- Live ECG and IMU recordings.
- On-sensor log inventory and retrieval.
- Recording manifests.
- Protocol events.
- Derived ECG-quality, tilt, posture, activity, and review artifacts.

Schemas must preserve the distinction among sensor-native sample time, host
receipt time, event time, and log retrieval time. Public fixtures must be
synthetic or explicitly redistributable.

## `tilt-ecg-review-v2`

The processing application writes approved review provenance as versioned JSON
under the governed derived recording directory. Each review records:

- Source SQLite and five-second-summary SHA-256 checksums.
- Reviewer-approved achieved table angle.
- Baseline, plateau, and ascending-tilt intervals.
- Two-point table-angle calibration and scale factor.
- Native-timestamp R-wave and R–R interval acceptance counts.
- Reviewer-excluded R–R interval IDs.
- Ascending-tilt ordinary least-squares equation, coefficient of determination,
  interval count, and corrected-angle range.
- Beat-to-beat HR response and corrected-angle regression.
- Configured orthostatic HR and BP assessment results.
- BP, etCO2, and symptom physiology correlations.
- Segment-specific time-domain HRV and Poincare metrics.
- HF/LF duration, NN-quality, stationarity, and override eligibility
  provenance.
- Eligible LF, HF, and LF/HF spectral results.
- Optional de-identified clinical reviewer conclusion.
- Processing algorithm and software provenance.

The review never contains direct identifiers and never changes the acquisition
SQLite, CSV, or manifest.
