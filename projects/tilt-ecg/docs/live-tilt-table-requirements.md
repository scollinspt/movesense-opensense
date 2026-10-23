# Live Tilt-Table Application Requirements

## Decision

The operational interface will be a locally hosted browser application rather
than a VS Code canvas.

The application will:

- Bind only to `127.0.0.1`.
- Open in the system browser.
- Provide an operator-initiated full-screen control.
- Continue to function without an internet connection.
- Use the HMS Lab visual system.
- Store recordings only in the governed `tilt-ecg` namespace.

Browsers require a user gesture to enter full-screen mode, so the application
cannot force full-screen automatically. A later packaging decision may use a
PWA, Tauri, Electron, or another desktop shell if browser startup and
full-screen behavior become operational barriers.

## HMS Lab visual system

Use the design tokens from the `movement-systems` repository:

| Token | Value |
|---|---|
| Forest | `#135841` |
| Deep forest | `#0b392c` |
| Teal | `#2f6f5e` |
| Light green | `#a0b8b0` |
| Paper | `#f4f5f1` |
| Paper deep | `#e3e9e5` |
| Graphite | `#2e2e2e` |
| Muted text | `#59635f` |

The monitoring interface should be light, high-contrast, keyboard accessible,
and legible at full-screen distance. Critical connection, signal-quality, and
recording states require additional warning and error colors that remain
distinguishable without relying on color alone.

## Operator workflow

Before acquisition, identify the operational context outside the application
as teaching/development or clinical-development. Confirm that the applicable
governance, consent, privacy, retention, clinical-equipment, supervision, and
safety requirements are satisfied. The application must remain free of direct
identifiers in either context.

1. Apply the Suunto electrode strap and Movesense sensor.
2. Position the subject supine on the tilt table.
3. Scan for and connect the sensor.
4. Begin non-recorded live preview of ECG and inertial data.
5. Assess ECG signal quality and R-wave detection.
6. Assess stationarity from acceleration magnitude and gyroscope activity.
7. Present a candidate supine-zero state only after a stable window.
8. Require the operator to select **Accept supine zero**.
9. Enter baseline blood pressure and end-tidal carbon dioxide.
10. Confirm the commanded target table angle, defaulting to 70 degrees, using
    exact entry or 5-degree decrement/increment controls.
11. Select **Start test** to begin the governed recording.
12. Record phase transitions, symptoms, blood pressure, and etCO2 observations.
13. If the target is reached, log **Target angle reached** and continue through
    the normal return. If safety or symptoms require an earlier return, log
    **Begin return early** without delaying the table return for data entry.
14. Select **End test** to finalize, checkpoint, checksum, and manifest the
    recording.
15. Confirm finalization and checksum status before opening the processing
    application.
16. Review the finalized recording by its non-identifying recording ID,
    approve any calibration or interval-review decisions, and export the
    de-identified portrait report.
17. Keep any authorized connection between the recording ID, report, and person
    outside the acquisition and processing artifacts.

The application may detect readiness for zeroing but must not silently accept a
baseline. Chest orientation is not assumed to equal table angle.

## ECG and five-beat heart rate

### R-wave detection

Use a Pan-Tompkins-based detector adapted and validated for the selected
Movesense ECG sample rate. Preserve raw ECG independently of the detector.

The live display must show:

- Scrolling ECG.
- Accepted R-wave markers.
- ECG signal-quality state.
- Count of accepted R waves in the current five-wave group.
- Heart rate and the time since its source estimate.
- An unavailable or stale state when a reliable estimate is not present.

### Heart-rate calculation

Heart rate updates once for each group of five valid consecutive R waves.

For accepted R-wave times `t1` through `t5`:

```text
HR_bpm = 60 * 4 / (t5 - t1)
```

This is the reciprocal of the mean of the four R-R intervals bounded by the
five waves. The first update occurs at the fifth accepted R wave. Subsequent
updates occur every fifth accepted R wave.

An invalid detection or signal-quality failure breaks consecutiveness and
resets the in-progress group. The display may retain the preceding estimate
only with an explicit age/stale indication; it must not present an old value as
current.

The exact detector configuration, accepted-wave criteria, refractory period,
filter delays, resets, and rejected candidates must be versioned in processing
provenance.

## Tilt angle

The accepted supine gravity vector defines zero degrees. The primary live
output is signed head-up/head-down chest tilt relative to that reference.

- Accelerometer gravity supplies the static and quasi-static reference.
- Gyroscope data support transitions.
- Magnetometer heading is not required.
- Off-axis roll and dynamic-acceleration quality indicators must remain
  available.
- Tilt estimates must report invalid or low-quality states rather than silently
  falling back to zero.

Tilt angle is a protocol descriptor and geometric proxy, not a direct measure
of circulatory or hydrostatic load. Preserve the calibrated acceleration
vector, its magnitude, coordinate-frame provenance, and the derived angle so
future research can evaluate gravity-axis and anthropometric vertical-column
models without reconstructing them from rounded angle summaries. Any future
stature or segment-length measurements require an explicit governed data
contract and must not be added as free-text annotations.

Placement, breathing, torso motion, strap motion, and calibration can separate
chest angle from table angle. Validation should include a table-mounted
reference sensor or another independent table-angle reference.

The commanded target angle is acquisition metadata, not proof that the table
reached that angle. A later reviewed table-angle series may use a two-point
affine correction:

```text
corrected(t) = (raw(t) - baseline) × achieved / (plateau - baseline)
```

The raw chest-relative angle must remain preserved. The correction must also
preserve its baseline window, plateau/reference window, achieved table angle,
scale factor, quality, and review provenance. If the achieved table angle is
unknown, the processing application must not fabricate a corrected table
angle.

## Raw recording

Each test produces one SQLite raw-signal container:

```text
signals.sqlite
```

Minimum tables:

### `ecg_samples`

- Sensor-native timestamp.
- Host monotonic receipt timestamp.
- Host wall-clock receipt timestamp.
- Raw ECG sample value.
- Packet or batch provenance when available.

### `imu_samples`

- Sensor-native timestamp.
- Host monotonic receipt timestamp.
- Host wall-clock receipt timestamp.
- Acceleration axes.
- Angular-velocity axes.
- Magnetic-field axes when acquired.
- Packet or batch provenance when available.

### `events`

- Stable event ID.
- Event type and label.
- Onset, resolution, phase, or point-observation semantics.
- Host monotonic and wall-clock timestamps.
- Nearest ECG and IMU sensor timestamps.
- Structured observation values and units.
- Operator-input provenance.

### `recording_metadata`

- Schema version.
- Recording and project IDs.
- Sensor identity, hardware, firmware, resources, and requested rates.
- Placement and strap configuration.
- Accepted supine-zero transform.
- Commanded target table angle.
- Protocol outcome, including whether the target was reached or the test
  returned early, the optional acquisition-entered achieved angle, and the
  optional early-return reason.
- Software and algorithm versions.

ECG and IMU remain in separate tables because their native rates and packet
semantics differ. They must not be resampled merely to place them in one file.

SQLite transactions must be committed periodically during acquisition. WAL and
shared-memory sidecar files may exist while recording; normal finalization must
checkpoint them into the primary database before checksum generation. Recovery
must explicitly handle an interrupted recording with remaining sidecars.

After finalization, `signals.sqlite` is immutable and receives a SHA-256
checksum in the recording manifest.

## Five-second summary

Each test also produces:

```text
five_second_summary.csv
```

Rows are fixed, non-overlapping five-second intervals measured from the test
recording start:

```text
[0,5), [5,10), [10,15), ...
```

The five-beat HR estimator and five-second summary operate on independent
clocks. A five-second row may contain zero, one, or multiple completed
five-beat estimates.

Minimum columns:

- Recording ID.
- Window index.
- Commanded target table angle.
- Window start and end in recording-relative seconds.
- Window start and end host monotonic timestamps.
- Latest valid five-beat HR available at the end of the window.
- Timestamp of that HR estimate.
- Age of the HR estimate at the end of the window.
- Number of new HR estimates completed in the window.
- ECG signal-quality status.
- Mean, final, minimum, and maximum tilt angle.
- Mean and maximum off-axis roll.
- Tilt-quality status.
- Recording phase.
- Annotation count.
- Structured annotations occurring in the window.
- Observed systolic and diastolic BP when logged in the window.
- BP changes from baseline and from the previous observation.
- Observed etCO2 when logged in the window.
- etCO2 changes from baseline and from the previous observation.

If no valid HR estimate exists, HR fields remain blank and the status explains
why. A carried-forward estimate must retain its source time and age.

Annotations in the CSV are a five-second projection for analysis convenience.
The `events` table remains authoritative for exact event times and structured
values.

The summary is a derived artifact. It must record the raw database checksum,
algorithm/configuration version, generation time, and its own checksum in the
manifest.

## Operator annotations

### Test phases

- Baseline supine.
- Begin tilt.
- Target angle reached.
- Begin return.
- Begin return early.
- Supine recovery.
- Test end.
- Technical interruption.
- Strap or sensor adjustment.

### Symptoms and observations

Use large onset/resolution controls for:

- Presyncope/lightheadedness.
- Dizziness.
- Vertigo.
- Palpitations.
- Pallor.
- Flushing.
- Cyanosis.
- Diaphoresis.
- Nausea.
- Visual disturbance.
- Other observation.

Dizziness and vertigo remain separate because they are not synonymous.

### Blood pressure

Record actual observed systolic and diastolic values. The interface may use
large `-5` and `+5 mmHg` controls for speed, with exact correction available.
Each observation stores the absolute values, changes from baseline, changes
from the previous observation, and exact event time.

### End-tidal carbon dioxide

Record the actual observed etCO2 value from the separate monitor. The interface
may use `-5` and `+5 mmHg` controls with exact correction. Store the absolute
value, changes from baseline and previous observation, and exact event time.

## Screen organization

### Status band

- Sensor and stream connection.
- Recording state and elapsed time.
- ECG quality and R-wave group progress.
- Tilt/supine state.
- Packet-continuity and storage status.

### Primary monitoring

- Large scrolling ECG.
- Large five-beat HR.
- Large signed tilt angle and direction.
- Smaller roll and quality indicators.

### One-touch events

- Test-phase controls.
- Symptom onset/resolution controls.
- Undo last eligible operator annotation.

### Observations

- BP baseline, current values, and deltas.
- etCO2 baseline, current value, and deltas.
- Immediate timestamp confirmation after logging.

Ending a test must require a deliberate confirmation or hold action to prevent
accidental termination.

## Operational boundary

This application is a research acquisition interface, not a diagnostic
monitor, clinical alarm, or replacement for approved tilt-table ECG, blood
pressure, etCO2, supervision, restraints, stop criteria, or emergency
procedures. Interface simplification must not be used to override an HMS Lab or
institutional requirement for additional personnel.
