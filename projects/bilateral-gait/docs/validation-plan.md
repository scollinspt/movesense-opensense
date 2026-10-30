# Validation Plan

## Principle

Working acquisition and plausible plots do not establish gait-event or clinical
validity. Advancement is staged so each layer is tested before patient-facing
interpretation.

## Stage 1: Schema and simulator

- Validate configuration and schemas.
- Generate two synthetic native-rate streams with known offset, drift, gaps,
  straight segments, and turns.
- Test recording finalization, checksums, interruption, and recovery.
- Test missing, duplicate, and conflicting side assignments.

## Stage 2: Two-sensor rigid fixture

- Mount both sensors on one rigid object.
- Measure offset, drift, notification batching, and residual alignment.
- Repeat after reconnect and for a session-length recording.
- Verify that inadequate alignment fails explicitly.

## Stage 3: Placement and functional calibration

With an authorized researcher or non-patient development participant:

- Test comfort and interference.
- Test bilateral placement repeatability.
- Test `M`-proximal confirmation.
- Test one-leg-at-a-time side verification.
- Test active knee extension/flexion functional axes and active-assisted or
  passive alternatives when needed.
- Test initial-to-post-gait seated return error when the optional post-session
  reference is collected.
- Remount and repeat.

## Stage 4: Controlled flat-overground gait

- Use a measured straight path.
- Record multiple bouts at comfortable pace.
- Mark straight, left-turn, and right-turn segments.
- Repeat with the same context.
- Determine how turns alter event signals and detector performance.

## Stage 5: Reference comparison

Select a reference appropriate to the metric:

- Synchronized video for event timing.
- Instrumented walkway when available.
- Manual counted steps for limited checks.
- Independently measured distance and timing for speed.

Reference limitations and synchronization must be documented.

## Stage 6: Context repeatability

After initial validation:

- Repeat across supported assistive-device contexts.
- Separate device conditions by gait bout.
- Quantify within-condition and remounting variability.
- Do not interpret between-device change until measurement variability is
  known.

## Stage 7: Governed clinical-development use

Clinical-development use requires applicable authorization, safe workflow,
trained operators, governed storage, and a validated limited output set.
Clinical observations may refine software but do not become research data
without separate authorization.

## Metric-specific advancement

Each metric requires:

- Defined source events and eligibility.
- Reference method.
- Error and repeatability estimates.
- Missing-data behavior.
- Turn and transition behavior.
- Assistive-device boundary.
- Known limitations.
- Versioned implementation.

Metrics that fail their threshold remain experimental or not assessable.
