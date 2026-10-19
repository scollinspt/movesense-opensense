# Ambulatory Movement R&D Strategy

## Decision

As of 2026-10-19, the project is shifting from distal upper-extremity
pronation/supination as a primary modeling target to proximal and axial
multi-segment movement.

The project goal is ambulatory monitoring of movement dynamics and the effects
of fatigue on coordination and motor control. The highest-value outcomes for
that goal are expected to arise from interactions among the head, trunk,
pelvis, shoulder, elbow, hip, knee, and, when justified, ankle. Forearm
pronation/supination is not expected to be a major outcome in the currently
anticipated applications.

This is a prioritization decision, not a claim that forearm rotation is
universally unimportant.

## Evidence and rationale

The one-sensor wrist work established acquisition, calibration, orientation
export, OpenSense inverse kinematics, and simulation capabilities. It also
exposed a poor return on additional R&D investment in pronation/supination for
this program:

- The one-sensor elbow-plus-forearm recording accumulated 28.3 degrees of
  neutral-to-neutral orientation difference before endpoint closure.
- The corrected OpenSense result retained a 61.2-degree maximum orientation
  residual and a 26.4-degree RMS residual.
- `pro_sup_l` remained within 0.1 degrees of its 90-degree model limit for
  approximately 31 percent of processed samples.
- Forearm rotation increased sensitivity to heading drift, magnetic-field
  distortion, sensor-to-model frame assumptions, coordinate limits, and
  cross-talk.
- Those costs do not align with the expected importance of forearm rotation in
  future ambulatory fatigue, coordination, and motor-control studies.

The experiment was therefore successful as a decision experiment: it
identified a technically expensive outcome with limited anticipated value and
prevented the broader program from remaining organized around it.

## Control variable versus outcome

Forearm rotation can remain important as a protocol condition without remaining
a primary measured outcome.

For elbow or shoulder experiments:

- Define the intended forearm posture, such as neutral or supinated.
- Use repeatable placement instructions and static reference holds.
- Ask the participant or researcher to maintain that posture when the task
  permits.
- Treat departures from the instructed posture as a possible protocol
  violation, nuisance motion, or source of uncertainty.
- Do not optimize the principal processing and validation pipeline around
  estimating pronation/supination unless a future scientific question
  specifically requires it.

A proximal forearm sensor may still be required to calculate elbow motion
relative to the humerus. In that role, it is an elbow segment sensor rather
than a distal upper-extremity outcome sensor.

## Minimum sensor sets by target

Each primary outcome should be based on relative orientation between the
segments that bound the modeled joint or region.

| Primary target | Minimum segment sensors | Interpretation boundary |
|---|---|---|
| Trunk relative to pelvis | Pelvis and thorax | Aggregate trunk/lumbar behavior, not individual vertebrae |
| Head relative to trunk | Thorax and head | Aggregate cervical/head behavior |
| Shoulder/humerus | Thorax and humerus | Shoulder-complex estimate; scapular motion remains modeled unless measured |
| Elbow flexion/extension | Humerus and proximal forearm | Forearm rotation is controlled or treated as nuisance motion |
| Hip | Pelvis and thigh | Hip orientation relative to the pelvis |
| Knee | Thigh and shank | Knee orientation relative to the thigh |
| Ankle | Shank and foot | Add only when ankle or foot behavior is an outcome |

Absolute segment orientation remains useful for visualization and quality
control, but ambulatory joint interpretation should preferentially use
synchronized relative segment orientation.

## R&D tracks

### Track A: Proximal upper extremity

Purpose: characterize elbow and shoulder coordination without making distal
forearm rotation a central outcome.

1. Use humerus and proximal-forearm sensors for isolated elbow
   flexion/extension.
2. Hold the shoulder in a defined position during the first protocol.
3. Define and control forearm posture; lock or de-emphasize the model
   pronation/supination coordinate.
4. Add a thorax sensor for shoulder motion relative to the trunk.
5. Stage shoulder flexion/extension, abduction/adduction, and humeral rotation
   separately before combined shoulder-elbow movement.
6. Treat a fixed or modeled scapula as an explicit limitation unless a future
   protocol adds a justified scapular measurement.

### Track B: Trunk and head

Purpose: quantify axial coordination and changes in head-trunk-pelvis control
under ambulatory tasks and fatigue.

1. Use pelvis, thorax, and head sensors.
2. Stage trunk flexion/extension, lateral bending, and axial rotation.
3. Stage head flexion/extension, lateral bending, and rotation relative to the
   thorax.
4. Progress to combined head-trunk movement.
5. Interpret the outputs as aggregate segment relationships rather than
   motion at individual spinal levels.

### Track C: Pelvis and lower extremity

Purpose: prioritize the segments most likely to carry high-value ambulatory
coordination, fatigue, and motor-control signals.

1. Use pelvis and thigh sensors for hip motion.
2. Add a shank sensor for knee motion.
3. Validate sagittal-plane hip and knee behavior before frontal- and
   transverse-plane outcomes.
4. Add a foot sensor only when ankle dorsiflexion/plantarflexion, foot
   progression, or another foot-specific outcome is required.
5. Progress from isolated movements to sit-to-stand, squat, step, and gait only
   after the relevant relative-orientation measurements pass their isolated
   acceptance criteria.

### Track D: Integrated ambulatory coordination

Purpose: study coordination and fatigue only after the component segment pairs
are synchronized, repeatable, and interpretable.

Candidate integrated configuration:

1. Pelvis.
2. Thorax.
3. Head.
4. Humerus.
5. Proximal forearm.
6. Thigh.
7. Shank.
8. Foot when ankle behavior is required.

With ten available sensors, the remaining sensors can support contralateral
comparison, a task-specific segment, redundant validation, or rigid-fixture
timing tests. They should not be added merely because they are available.

## Execution order

1. Complete concurrent two-sensor acquisition and rigid-fixture
   synchronization measurement.
2. Validate humerus-to-proximal-forearm relative orientation for elbow
   flexion/extension.
3. Add thorax-to-humerus shoulder processing, followed by combined
   shoulder-elbow motion.
4. Validate pelvis-thorax-head relative orientation.
5. Validate pelvis-thigh-shank relative orientation for hip and knee.
6. Add the foot only for a defined ankle or foot outcome.
7. Combine validated subsystems in an ambulatory task.
8. Add fatigue exposure only after the non-fatigued task has acceptable timing,
   attachment, repeatability, residual, and cross-talk performance.

## Advancement criteria

Each segment pair must pass before being incorporated into a larger chain:

- Sensor-native timing continuity and measured inter-sensor synchronization.
- Reproducible placement and static-reference procedures.
- Quaternion normalization and frame-convention checks.
- Neutral-return and drift diagnostics.
- Model orientation residuals within a protocol-defined threshold.
- No unexplained coordinate-limit saturation.
- Acceptable cross-talk during isolated movements.
- Repeatability across repeated trials and remounting.
- Explicit accounting for controlled, unmeasured, and modeled motion.

Fatigue-related interpretation additionally requires a stable non-fatigued
baseline and evidence that observed changes exceed measurement and attachment
variability.

## Disposition of distal upper-extremity work

The existing wrist recordings, one-DOF models, two-DOF processing artifacts,
and diagnostic simulation remain part of the reproducible engineering record.
They continue to serve as:

- Regression fixtures for acquisition and OpenSense interoperability.
- Evidence supporting this strategy transition.
- Examples of heading drift, coordinate saturation, and model residual
  diagnostics.
- Reusable infrastructure if a future project has a specific and justified
  pronation/supination outcome.

They are no longer the main path for the ambulatory movement R&D program.
