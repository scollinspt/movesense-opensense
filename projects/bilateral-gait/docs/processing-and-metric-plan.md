# Processing and Metric Plan

## Processing objective

Convert finalized two-shank recordings into reviewed, provenance-linked gait
events and descriptive measurements without overstating what two sensors can
measure.

## Processing order

1. Verify source finalization and checksums.
2. Verify role assignments and placement confirmations.
3. Inspect sample continuity and effective rates independently.
4. Estimate and review inter-sensor alignment.
5. Review seated references, knee extension/flexion calibration, and the
   movement mode recorded for each limb.
6. Apply device-to-shell and side-aware shank frame mappings.
7. Segment gait bouts and path geometry from acquired triggers.
8. Detect candidate gait events.
9. Review, correct, include, or exclude candidate events.
10. Calculate metrics only from eligible reviewed intervals.
11. Save derived artifacts without changing source acquisition.

## Initial candidate outputs

Subject to validation:

- Step count.
- Gait-bout duration.
- Cadence.
- Left and right stride time.
- Step-time alternation.
- Swing-time estimates.
- Stance-time estimates.
- Left-right temporal asymmetry.
- Stride-to-stride variability.
- Peak sagittal shank angular velocity.
- Timing and consistency of shank advancement.
- Pause, start, stop, and turn timing.
- Detection confidence and excluded-step counts.

## Straight and turning gait

Initial development must retain both so that processing can determine whether:

- Straight-gait detectors remain valid during turns.
- Turn transitions need exclusion windows.
- Turns can be identified from bilateral shank signals.
- Turn direction can be supported reliably.
- Turn-specific metrics are repeatable.

Acquired triggers are anchors for review, not exact biomechanical truth.

## Context stratification

Metrics must remain associated with:

- Assistive device.
- Assistance level.
- Orthosis.
- Surface/environment.
- Straight or turning path segment.
- Bout and session.

Comparisons across devices or assistance levels must not silently pool
incompatible contexts.

## External distance

Walking speed requires an independently measured distance and elapsed time.
The application must not infer reliable distance or step length from
unvalidated double integration.

If distance is later entered, preserve:

- Value and unit.
- Measurement method.
- Path boundaries.
- Operator entry time.
- Whether turns are included.

## Not supported by two distal-shank sensors alone

- Ankle-joint angle.
- Knee-joint angle.
- Hip-joint angle.
- Foot progression angle.
- Toe clearance.
- Center-of-mass motion.
- Whole-body balance.
- Diagnostic gait classification.

Foot, thigh, pelvis, or trunk sensors should be added only when a defined
outcome requires the corresponding segment relationship.

## Review model

Candidate events must expose:

- Detector version and parameters.
- Left/right source.
- Time and confidence.
- Signal features used.
- Path and gait-bout context.
- Reviewer acceptance, correction, or exclusion.
- Exclusion reason.

Metrics must link to the exact reviewed events used.

## Reporting direction

A later report may display results by gait bout and context, measurement
quality, repeated-session changes, methods, limitations, and reviewer
approval. It should state that results are considered alongside the physical
therapy examination and movement system interpretation.

The report must not create treatment recommendations automatically.
