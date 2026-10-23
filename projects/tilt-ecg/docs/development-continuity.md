# Tilt ECG development continuity

## Current validated state

The Tilt ECG application is a standalone localhost application. It is not
hosted by VS Code, Copilot Canvas, or the VS Code shared browser.

- Server URL: `http://127.0.0.1:4174/`
- Bind address: `127.0.0.1`
- Application entry point: `projects/tilt-ecg/app/server.mjs`
- Validated acquisition implementation commit: `639e284`
- macOS launcher commit: `24aba75`
- Current live configuration: `projects/tilt-ecg/configs/live-v2.json`
- ECG rate: 512 Hz
- IMU9 rate: nominal 26 Hz
- Raw recording schema: `tilt-ecg-recording-v2`
- Summary schema: `tilt-ecg-five-second-summary-v2`

The current acquisition workflow requires a commanded target table angle
before recording. It defaults to 70 degrees and supports exact entry or
5-degree adjustments. After **Begin tilt**, the protocol branches to either
**Target angle reached** or **Begin return early**. An achieved angle and
early-return reason may be captured, but neither is required before returning
the table. The commanded target and protocol outcome are preserved in SQLite,
the five-second summary, and the manifest for later immutable review.

A separate processing/report application is available at:

- Default URL: `http://127.0.0.1:4175/`
- Entry point: `projects/tilt-ecg/processing-app/server.mjs`
- macOS launcher: `projects/tilt-ecg/launch-tilt-ecg-processing.command`
- Review schema: `tilt-ecg-review-v2`
- Current processing/report commit: `9ca0395`

It discovers finalized governed recordings, verifies source checksums, derives
R waves and consecutive R–R intervals from native 512 Hz timestamps, supports
reviewed table-angle calibration, and fits corrected angle to raw R–R interval
during the ascending tilt phase. Approved reviews are written as new governed
derived JSON artifacts; acquisition files remain unchanged.

The clinical report expansion also provides beat-to-beat HR-angle regression,
configurable orthostatic HR assessment, BP and etCO2 changes, symptom
correlation, segment-specific time-domain HRV, Poincare plots, and
duration/quality/stationarity-gated frequency-domain HRV. Default spectral
minimums are 90 seconds for HF and 300 seconds for LF or LF/HF.

Firefox and the VS Code shared browser are equivalent clients of one
server-owned state. Opening two browser tabs does not create two BLE
connections. Actions in either client affect the same connection and
recording. Closing a tab or closing VS Code does not finalize a recording or
disconnect the sensor.

## Start and verify

From the repository root:

```bash
node projects/tilt-ecg/app/server.mjs --port 4174
```

Verify the server without opening VS Code:

```bash
curl --fail http://127.0.0.1:4174/api/state
```

Open or bookmark:

```text
http://127.0.0.1:4174/
```

The connection badge must report `ECG 512 Hz · IMU 26 Hz` after hardware
connection. If no ECG or IMU samples arrive within ten seconds, the bridge
reports an explicit error instead of presenting a false connected state.

## Browser-independent validation

A hardware trial initiated and operated entirely from Firefox while VS Code
remained uninvolved in the workflow completed successfully:

- 70.91 seconds.
- 36,304 ECG samples.
- Effective ECG rate 512.002 Hz.
- 1,778 IMU samples.
- Effective inertial rate 25.089 Hz.
- No missing ECG or IMU packet sequences.
- No non-monotonic sensor timestamps.
- Maximum ECG timestamp gap 3 milliseconds.
- Maximum IMU timestamp gap 43 milliseconds.
- ECG and tilt quality good in every five-second window.
- Heart rate available in every five-second window.
- SQLite integrity check passed.
- Raw and derived checksums verified.
- Ordered phases, symptom onset/resolution, BP, and etCO2 events persisted.
- Normal finalization and BLE disconnect.

This validated the localhost browser workflow independently of the VS Code
presentation.

A second hardware trial was then completed with VS Code fully closed. The
original detached server remained active throughout:

- Recording ID `20261021T093613Z-fde5440e`.
- 120.56 seconds.
- 61,728 ECG samples at an effective 512.002 Hz.
- 3,024 IMU samples at an effective 25.091 Hz.
- No missing ECG or IMU packet sequences.
- No non-monotonic sensor timestamps.
- Maximum ECG timestamp gap 3 milliseconds.
- Maximum IMU timestamp gap 43 milliseconds.
- ECG and tilt quality good in every five-second window.
- Heart rate available in all 25 five-second rows.
- A substantial mock tilt range from approximately -8.0 to 49.4 degrees.
- Complete ordered phase progression.
- Dizziness, presyncope, and pallor onset/resolution pairs.
- SQLite integrity and both checksums verified.
- Normal finalization, BLE disconnect, and return to idle.

This confirms that VS Code is not required for server operation, acquisition,
finalization, or governed output.

## Governed output

Finalized recordings remain outside the public repository:

```text
MOVESENSE_DATA_ROOT/
├── raw/tilt-ecg/YYYY-MM-DD/<recording-id>/signals.sqlite
├── derived/tilt-ecg/YYYY-MM-DD/<recording-id>/five_second_summary.csv
└── manifests/tilt-ecg/YYYY-MM-DD/<recording-id>.json
```

Normal finalization checkpoints the SQLite WAL, closes and renames the primary
database, generates the five-second summary, computes SHA-256 checksums, and
writes the manifest. After a browser-only trial, identify the newest recording
by sorting the manifest paths rather than relying on browser state.

Approved processing reviews add:

```text
MOVESENSE_DATA_ROOT/
└── derived/tilt-ecg/YYYY-MM-DD/<recording-id>/reviews/<review-id>.json
```

The report is previewed in the processing browser and exported through
**Print / Save PDF** after review approval. The print layout is portrait-first
and redraws its charts at print dimensions.

## Processing validation with the October 22 table trial

The processing application was validated against recording
`20261022T162753Z-77ddb2da` without modifying the governed source artifacts:

- Raw and five-second-summary checksums verified.
- 94,678 native ECG samples and 4,640 IMU samples loaded.
- 247 R waves and 246 consecutive R–R intervals detected.
- Suggested baseline window: 49.0–74.0 seconds.
- Suggested upright plateau: 125.7–143.4 seconds.
- Reviewer-confirmation default achieved angle: 70 degrees.
- Raw baseline angle: approximately -2.83 degrees.
- Raw plateau angle: approximately 74.01 degrees.
- Calibration scale factor: approximately 0.911.
- Ascending phase: 79.0–125.7 seconds.
- 62 native R–R intervals included in the default ascending fit.
- Initial engineering fit:
  `R–R interval (ms) = -3.124 × corrected angle (°) + 834.280`.
- Coefficient of determination: approximately 0.894.
- Beat-to-beat HR-angle fit:
  `Heart rate (bpm) = 0.361 × corrected angle (°) + 71.400`.
- Baseline median beat-to-beat HR: approximately 75.5 bpm.
- Peak upright HR: approximately 115.2 bpm.
- Maximum HR change from baseline: approximately 39.6 bpm.
- Upright duration: approximately 17.7 seconds; the configured 600-second
  orthostatic HR assessment was therefore not possible.
- Supine HRV window: approximately 69.0 seconds; HF was ineligible under the
  90-second default and LF was ineligible under the 300-second default.
- Upright and recovery frequency-domain HRV were also ineligible because of
  insufficient duration.

These are development-validation results, not a clinical interpretation. The
real governed recording was not marked reviewed or approved. Approval,
immutable review output, report preview, and print-mode behavior were tested
against a temporary copy that was deleted afterward.

## October 23 representative workflow tests

Two tests are scheduled to provide the next development evidence:

1. A teaching/development test.
2. A pro bono clinical test that may also identify workflow and reporting
   improvements.

For each test:

- Use approved clinical equipment, supervision, safety procedures, stopping
  rules, and documentation independently of this development system.
- Do not enter a name, MRN, date of birth, or other direct identifier in the
  acquisition or processing applications.
- Preserve the recording ID and any authorized person linkage only in the
  appropriate external clinical or governed system.
- Complete the acquisition phase markers and observations in real time without
  delaying care, table return, or safety actions.
- Confirm normal finalization and manifest/checksum creation before processing.
- Open the processing application, verify source integrity, review achieved
  angle and phase windows, inspect ECG-derived intervals and clinical
  physiology, and record any justified exclusions or overrides.
- Add a de-identified reviewer conclusion only after review, approve the
  immutable review artifact, and export the portrait report.
- Record workflow friction, corrections, unexpected states, and desired report
  changes separately from the immutable source artifacts.

The teaching and clinical contexts must remain distinguishable. The clinical
test may guide engineering refinement, but its data must not be treated as
research data or included in a future comparative study without the applicable
authorization.

## Longer-term decision points

After representative tests show that the full acquisition-to-report workflow
is stable:

1. Evaluate how to package, install, document, validate, and support the system
   for other qualified users.
2. Evaluate a prospective research protocol comparing an active orthostatic
   stress protocol with passive head-up tilt in individuals without signs,
   symptoms, or a diagnosis of dysautonomia.

The second direction requires a prespecified protocol, outcomes, analysis
plan, sample-size rationale, ethics/governance determination, consent, and
clear separation from clinical-development recordings.

One candidate research hypothesis is that individualized gravitational or
hydrostatic loading explains physiologic responses better than corrected tilt
angle alone. The sensor preserves the gravity vector used to estimate angle;
future analysis could compare angle with gravity-axis components and
anthropometric vertical-column estimates. Standing height is a possible first
proxy, but direct heart-to-foot, heart-to-head, leg, and trunk distances may be
more physiologically relevant. The accelerometer does not directly measure
vascular pressure, and active standing adds muscle-pump and postural effects
that must be modeled separately.

Public project communication belongs in the `movement-systems` website
repository. Begin with a bounded development-project page using diagrams,
synthetic data, or explicitly permission-cleared teaching material. Do not
publish governed clinical traces, reports, recording IDs, or claims of
diagnostic or normative validity. Later website updates may describe the
comparative study as proposed, approved, active, or completed only when that
status is accurate.

## Interrupted recording recovery

If the server or computer stops during recording, preserve the partial
database and WAL sidecars. Recover explicitly:

```bash
node projects/tilt-ecg/app/recover.mjs \
  --data-root /absolute/path/to/governed-storage
```

Recovered data are marked interrupted/incomplete and are not presented as
normally finalized.

## macOS launcher

The executable launcher is:

```text
projects/tilt-ecg/launch-tilt-ecg.command
```

Double-clicking it in Finder opens an existing server or starts a new server on
port 4174 and opens the browser. If it starts the server, its Terminal window
must remain open during acquisition.

The launcher has been validated against an existing server. The next handoff
test is its cold-start path:

1. Confirm no server is listening on port 4174.
2. Close VS Code.
3. Double-click `launch-tilt-ecg.command`.
4. Confirm the Terminal window reports server startup.
5. Confirm the browser opens the Tilt ECG application.
6. No sensor trial is required.
7. Press Control-C in the launcher Terminal window when finished.

## Before acquisition with VS Code closed

1. Confirm `/api/state` reports `recording: null`.
2. Confirm `connectionState` is `idle`.
3. Confirm the localhost server is listening on port 4174.
4. Keep the Mac logged in and awake.
5. Do not restart or log out before the browser-only trial.

The detached server does not survive a computer restart or macOS logout. If it
is no longer running, restart it with the command above before opening the
bookmark.

## Remaining development items

- Query `/Meas/ECG/Info` at connection time and select among sensor-advertised
  rates rather than relying only on the configured 512 Hz request.
- Add an explicit `test_end` event in addition to manifest `stoppedAt`
  metadata.
- Refine the current HRV artifact with persisted accepted/rejected R-wave and
  NN-interval provenance plus an explicit artifact/ectopic correction workflow.
- Review the acquisition-to-report workflow against the October 23 teaching
  and clinical-development tests.
- Preserve the gravity-vector and coordinate provenance needed to evaluate
  angle-only versus individualized gravitational/hydrostatic-load models in a
  future governed study.
- Validate chest angle against an independent table-angle reference before
  interpreting it as table tilt.
