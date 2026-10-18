# Upper-limb next sessions v1

## Purpose

Extend the current one-sensor feasibility result into repeatable recordings and
then into a two-sensor upper-limb pipeline. These are researcher
self-experiments for engineering development. They do not establish anatomical,
scientific, or clinical validity and are not a protocol for enrolling other
participants.

## Shared recording rules

For every recording:

1. Record the sensor identifiers, firmware versions, placement, side, strap
   orientation, requested sample rate, and movement protocol in the manifest.
2. Begin with at least five seconds in the protocol-defined anatomical neutral
   position without intentional movement.
3. Perform five controlled repetitions unless the session definition states
   otherwise.
4. Return to neutral and remain still for at least three seconds before stopping.
5. Do not reuse a failed recording ID. Record the reason for repeating a trial.
6. Review checksum, malformed rows, sensor-time gaps, effective sample rate,
   dominant-axis fraction, starting pose, and movement annotation before
   interpreting motion.
7. Treat dominant-axis fraction as a diagnostic rather than a validity score.
   Compare it across repeats and investigate changes in mounting or movement
   control.

## Session 1: one-sensor repeatability

Use the same sensor, left-wrist placement, strap orientation, and acquisition
settings as the retained feasibility recordings.

### 1A: isolated forearm rotation

- Elbow extended at the side.
- Wrist neutral.
- Begin in full comfortable supination.
- Perform five supination-to-pronation-to-supination cycles at a controlled,
  comfortable speed.
- Record three trials, removing and replacing the sensor before the third trial
  to expose placement sensitivity.

### 1B: isolated elbow flexion and extension

- Shoulder and trunk controlled.
- Begin with the elbow extended and forearm held in the protocol-defined
  rotation.
- Perform five flexion-to-extension cycles at a controlled, comfortable speed.
- Record three trials, removing and replacing the sensor before the third trial.

### Review before advancing

- All six recordings pass integrity checks.
- The static interval and five cycles are identifiable in every recording.
- OpenSense runs across the complete movement interval.
- Repetition range, endpoint return, dominant-axis fraction, and mounting notes
  are compared across trials.
- Unexpected cross-axis motion is documented rather than silently filtered.

## Session 2: two-sensor bench timing

Attach both sensors rigidly to the same non-human board or fixture.

1. Record at least five seconds stationary.
2. Produce five sharp, mechanically shared rotations or taps visible to both
   sensors.
3. Record at least 60 seconds including stationary periods at the beginning and
   end.
4. Repeat three times, changing which sensor connects first on alternating
   trials.

Do not proceed to joint-angle interpretation until the acquisition system can
record both sensors concurrently and report sensor-time offset, drift, packet
loss, and residual alignment around the shared events.

## Session 3: two-sensor isolated upper-limb motion

Place one sensor on the lateral upper arm and one on the dorsal distal forearm
or wrist. Record exact landmarks, side, logo direction, and strap orientation.

1. Capture a shared static anatomical-neutral interval.
2. Record three isolated elbow flexion/extension trials using the Session 1B
   movement.
3. Record three isolated forearm rotation trials with the elbow held at the
   protocol-defined position.
4. Process segment orientations separately before calculating relative
   humerus-to-forearm motion.

Advancement requires synchronized recordings, reproducible neutral mapping, and
an explicit sensor-to-model frame transform for both placements.

## Session 4: two-sensor combined motion

Only after Sessions 2 and 3 pass:

1. Begin in anatomical neutral.
2. Flex the elbow to a comfortable mid-range position.
3. Perform one pronation/supination cycle.
4. Return to supination, extend the elbow, and return to neutral.
5. Repeat the sequence five times in each of three recordings.

This session tests time-varying reference frames and model observability. Do not
apply the current one-axis estimator to the combined trial as if it represented
independent elbow and forearm coordinates.

## Deferred sessions

- Shoulder motion remains deferred until upper-arm and forearm segment
  orientation and relative elbow motion are reproducible.
- Three-, five-, and ten-sensor load testing remains deferred until the
  two-sensor acquisition and synchronization path is measured.
- Any session involving someone other than the researcher/developer requires a
  separate study protocol, governance determination, consent process, and data
  plan.
