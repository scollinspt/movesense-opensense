# Bilateral Gait Project Charter

## Status

Incubating in this repository under the slug `bilateral-gait`.

## Goal

Create a reproducible two-Movesense workflow for bilateral distal-shank IMU
acquisition and reviewable gait measurements that may be followed over time
alongside other physical therapy examination findings.

The immediate goal is reliable acquisition. Specific clinical gait outcomes
remain provisional until the treating students and clinicians define the
aspects of gait they need to follow.

## Initial use case

A person after cerebrovascular accident is progressing from preparatory
mobility activities to walking meaningful distances with different assistive
devices. The project will prototype a low-burden method for collecting
bilateral shank movement during gait and determining which measurements are
reliable and useful enough to support longitudinal physical therapy
interpretation.

This use case motivates development but does not authorize research use,
establish validity, or define a diagnostic claim.

## Why this project belongs here

The project shares established infrastructure with the existing Movesense
work:

- Bluetooth GATT SensorData Protocol acquisition.
- Sensor and firmware inventory.
- Native sensor and host timestamp preservation.
- Immutable governed recordings and checksummed manifests.
- Localhost browser applications.
- Separate acquisition and processing responsibilities.
- Calibration, review, and derived-artifact provenance.

It also supplies the next concrete use of concurrent two-sensor acquisition,
which is already an engineering priority in the repository workplan.

## Initial configuration

- Two Movesense IMU9 sensors.
- Bilateral distal medial shank placement.
- `M` end proximal on both limbs.
- Computer-based Bluetooth acquisition.
- Flat overground walking.
- Straight and turning path segments.
- Structured assistive-device and assistance context.

## Design principles

1. Sensor placement must be quick, repeatable, and confirmable.
2. Hardware identity and anatomical side must be bound explicitly.
3. The application controls recording start, stop, finalization, and recovery.
4. Raw sensor and event timing remain immutable.
5. Context is recorded as structured dimensions rather than ambiguous notes.
6. Processing never silently converts missing or poor-quality data into a
   valid-looking metric.
7. Two shank sensors are not treated as whole-body or joint-angle measurement.
8. Sensors are added only when a defined outcome requires another segment.
9. Clinical-development data do not become research data without separate
   authorization.

## Scope

### Included in the first acquisition system

- Concurrent connection to exactly two assigned sensors.
- Independent connection and stream status.
- Left/right movement verification.
- Seated static references.
- Active knee extension/flexion functional calibration, with active-assisted
  or passive movement permitted when needed and recorded by limb.
- Flat-overground gait bouts.
- Straight and turning segment triggers.
- Assistive-device, orthosis, and assistance context.
- Immutable data, events, manifest, checksums, and finalization state.

### Deferred

- Flat treadmill acquisition.
- Obstacles and uneven surfaces.
- Stairs and ramps.
- Real-time gait classification.
- Automated clinical recommendations.
- Step-length estimation from unconstrained inertial integration.
- Ankle, knee, hip, pelvis, trunk, or center-of-mass kinematics.
- Patient-facing or iOS applications.
- Research comparisons or normative claims.

## Planned architecture

### Acquisition application

A localhost browser application binds only to `127.0.0.1`, functions without
internet access, and provides setup, preview, calibration, recording, event,
finalization, and recovery workflows.

### Processing application

A separate read-only localhost application verifies source integrity and
multi-sensor timing before applying side-aware calibration or gait-event
methods. Corrections and approvals are new derived artifacts; source data are
never edited.

## Repository and data boundary

Public software, schemas, protocols, synthetic fixtures, and permission-cleared
validation materials belong in this repository. Human recordings and derived
artifacts belong in approved governed storage under the `bilateral-gait`
namespace.

Any authorized connection between a recording and a patient remains outside
the acquisition and processing artifacts.

## Advancement criteria

Application implementation may begin after the documentation and initial
schemas are reviewed. Clinical-development collection requires:

- Applicable institutional and clinic authorization.
- Two-sensor bench acquisition and recovery validation.
- Measured inter-sensor offset and drift behavior.
- Repeatable side assignment and placement workflow.
- Clear guarding and operator responsibilities.
- Verified governed-storage finalization.

Processing metrics require separate validation criteria documented in the
processing and validation plans.

## Repository extraction criteria

The project can remain here while it shares active infrastructure with the
Movesense/OpenSense work. A separate repository may be appropriate when it has
independent release, deployment, governance, support, or contributor needs.
