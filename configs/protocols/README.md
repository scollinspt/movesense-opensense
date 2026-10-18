# Protocol configurations

Store versioned sampling, recording, and calibration protocol settings.

## Current protocol documents

- [`upper-limb-next-sessions-v1.md`](./upper-limb-next-sessions-v1.md) defines
  the next one-sensor repeatability, one-sensor wrist two-DOF, one-sensor
  humerus three-DOF, two-sensor bench timing, isolated two-sensor motion, and
  combined-motion sessions.

## Single-wrist constrained progression

Protocol ID: `single-wrist-feasibility-v1`

Every human recording begins from a confirmed anatomical position: upright
trunk and head, shoulders neutral, arms at the sides, elbows extended, forearms
supinated, and wrists neutral. The operator must also confirm that the trunk,
shoulder, and all non-target joints will remain in the protocol-defined
position.

Develop movement interpretation one stage at a time:

1. Record a static anatomical-position reference.
2. Record isolated forearm supination/pronation as one rotational DOF about the
   forearm's longitudinal axis while trunk, shoulder, elbow, and wrist remain
   controlled.
3. Record isolated elbow flexion/extension as one DOF in the sagittal plane
   while trunk and shoulder remain controlled and forearm rotation is fixed.
4. Combine elbow flexion/extension and forearm rotation as two DOFs only after
   both isolated stages pass. Interpret forearm rotation in the reference frame
   established by elbow position.
5. Introduce isolated shoulder motion as three rotational DOFs only after the
   elbow-plus-forearm stages are understood.
6. Add shoulder plus elbow, then shoulder plus elbow plus forearm.

The final shoulder-elbow-forearm chain has more joint DOFs than one wrist
orientation can uniquely identify. Later stages therefore require additional
segment sensors, model constraints, or both. OpenSense/OpenSim may support the
model-based interpretation, but they do not remove the need for observable
segment motion, calibration, and validated coordinate transformations.
