# Passive Three-Axis Gimbal Build Guide

> **Status:** Optional future validation fixture. This design was superseded as the preferred teaching apparatus by the simpler [foot-fixed lower-extremity rig](lower-extremity-rig-design-brief.md). It is not a requirement for HMS-PROJ-001 or for the first OpenSense interoperability demonstration.

## Purpose

Build a manually operated fixture that places one Movesense sensor in repeatable static orientations and prescribed three-axis rotations while independently measuring each mechanical axis. The fixture supports acquisition development in HMS-PROJ-001 and later orientation evaluation in HMS-PROJ-003.

The fixture does not make its encoder values validated ground truth merely by existing. Encoder accuracy, axis alignment, frame rigidity, backlash, repeatability, timing, and magnetic effects must be characterized before using it to support measurement claims.

## Recommended configuration

Use three nested frames with intersecting axes:

```text
fixed base
  -> yaw frame: rotation about the vertical axis
      -> pitch frame: rotation about the lateral axis
          -> roll platform: rotation about the longitudinal axis
              -> rigid Movesense mount near the common axis center
```

Recommended initial limits are approximately:

- yaw: `-180 deg` to `+180 deg`;
- pitch: `-75 deg` to `+75 deg`; and
- roll: `-180 deg` to `+180 deg`.

Limiting pitch avoids mechanical interference and the Euler-angle singularity near `+/-90 deg`. Exact limits should be established from the completed geometry.

## Design priorities

1. Make all three rotation axes intersect as closely as practical at the center of the sensor mount.
2. Make the sensor mount rigid, removable, and keyed so the sensor returns to the same orientation.
3. Measure every axis directly rather than inferring one angle from another mechanism.
4. Keep magnets, motors, ferromagnetic hardware, and high-current wiring away from the sensor.
5. Provide visible mechanical-zero marks and a repeatable way to return each axis to zero.
6. Limit the yaw range initially so encoder wires can use service loops instead of slip rings.
7. Design the frames so bearings, shafts, encoders, and sensor mounting surfaces can be inspected and adjusted.

## Suggested bill of materials

Quantities and dimensions depend on the final CAD design. Verify every component specification and current price before ordering.

### Mechanical structure

| Item | Suggested characteristics | Quantity |
| --- | --- | ---: |
| Stable base | Aluminum tooling plate, extrusion frame, or rigid benchtop plate | 1 |
| Nested frames | Machined or water-jet aluminum; acetal can be used for prototypes | 3 |
| Shafts or shoulder bolts | Straight, low-play, sized to selected bearings | 6 supports or 3 through-shafts |
| Bearings | Paired radial bearings or low-backlash flanged bearings | 6 or more |
| Shaft collars and spacers | Nonmagnetic where practical | As needed |
| Sensor platform | Flat, rigid, keyed, with documented reference axes | 1 |
| Movesense cradle | Close-fitting polymer mount with a positive retention feature | 1 |
| Hard stops | Adjustable and padded | 3 pairs |
| Zero/index references | Engraved marks, pointer scales, or removable alignment pins | 3 |
| Static-position locks | Nonmarring clamp knobs or indexing plungers | 3 |
| Feet or bench clamps | Prevent base movement during operation | 3 or 4 |
| Fasteners | Aluminum, brass, or verified low-magnetic stainless where suitable | As needed |

Do not assume that every stainless-steel fastener is nonmagnetic. Check candidate hardware with a magnet and perform a recorded magnetometer baseline test after assembly.

### Encoders

The preferred choice is a shaft-mounted optical encoder on each axis. Two practical approaches are:

| Approach | Advantages | Limitations |
| --- | --- | --- |
| Absolute optical encoder | Reports angle immediately after power-up; simpler recovery after interruption | Usually more expensive; interface support must be confirmed |
| Incremental optical quadrature encoder with index | Widely available; inexpensive; high count density | Requires homing after power-up and cannot recover position after missed counts without re-homing |

Suggested selection criteria:

- optical sensing rather than magnetic sensing;
- at least 12 effective bits per revolution, or comparable quadrature count density;
- a documented accuracy specification, not resolution alone;
- index or absolute-position support;
- low shaft loading and minimal coupling eccentricity;
- an interface compatible with one shared controller; and
- sufficient maximum count rate for the planned manual angular velocity.

A 12-bit encoder has a nominal count spacing of approximately `0.088 deg`, but count spacing is not the same as angular accuracy. Installation eccentricity, nonlinearity, shaft play, and frame deformation may dominate the error.

### Electronics

| Item | Purpose | Quantity |
| --- | --- | ---: |
| Real-time microcontroller | Samples all encoders and assigns one controller timestamp | 1 |
| USB data connection | Sends encoder records to the acquisition Mac | 1 |
| Shielded encoder cables | Reduces electrical noise and provides strain relief | 3 |
| Cable anchors and service loops | Prevents cable forces from rotating or loading frames | As needed |
| Optional local storage | Preserves encoder data if USB recording fails | 1 |

A Teensy 4.1 is one suitable controller candidate because it provides dedicated quadrature-decoder hardware, interval timers, USB serial, and sufficient input capacity. It is a candidate, not a mandatory dependency.

The controller record should include at least:

```text
sequence_number, controller_time_us, yaw_count, pitch_count, roll_count,
yaw_index, pitch_index, roll_index, status_flags
```

The host should add its own monotonic receipt timestamp without replacing the controller timestamp.

## Tools likely needed

- CAD software for frame geometry and tolerance checks;
- calipers, machinist square, and straightedge;
- drill press or access to machining, water-jet, or laser-cutting services;
- taps, reamers, and bearing installation tools appropriate to the design;
- dial indicator for shaft runout and frame deflection checks;
- digital level or inclinometer for assembly checks;
- multimeter, soldering tools, and cable-crimping tools; and
- small permanent magnet for screening nominally nonmagnetic hardware.

A calibrated angle reference or an external metrology service will eventually be needed if the encoder system is used for quantitative accuracy claims.

## Mechanical details to resolve in CAD

### Axis intersection

Place the three shaft centerlines through one nominal point. Place the center of the Movesense sensing package as close to that point as the sensor geometry allows. Record the measured offsets after assembly rather than relying only on nominal CAD dimensions.

### Bearing support

Support each moving frame on both sides when possible. A single cantilevered bearing is easier to build but is more susceptible to tilt, deflection, and backlash. Allow controlled bearing preload without binding the axis.

### Encoder coupling

Prefer direct shaft measurement. If a flexible coupling is necessary, use one designed for encoder service and keep angular windup small. Avoid belts or gears in the measurement path unless their backlash and ratio errors are characterized.

### Sensor mounting

Give the platform permanent `+X`, `+Y`, and `+Z` marks. The cradle should prevent translation and rotation while allowing battery replacement. Photograph and measure the installed orientation so the sensor-to-gimbal transform is reproducible.

### Detents and locks

Provide repeatable static positions at useful angles such as `0 deg`, `+/-45 deg`, and `+/-90 deg` where geometry permits. Detents are for repeatability; the encoder remains the angle observation. Axis locks should not shift the frame when tightened.

### Cable routing

Route encoder cables along the relevant rotation axis before forming a service loop. Check the full travel manually with power disconnected. Avoid a slip ring in the first version by limiting continuous yaw rotation.

## Timing and synchronization

The gimbal introduces three clocks that must remain distinct:

1. Movesense sensor-native time;
2. encoder-controller time; and
3. Mac host-monotonic receipt time for each transport.

All encoder axes should share one controller clock. For early bench work, align the encoder and Movesense streams using a clearly prescribed motion event and estimate residual offset. Do not claim synchronized sensing from similar host arrival times alone.

Hardware-assisted synchronization or a jointly observable trigger should be evaluated in HMS-PROJ-002 before using the fixture for stronger dynamic timing claims.

## Suggested build sequence

1. Finalize axis order, travel, sensor dimensions, bearing arrangement, and encoder interfaces in CAD.
2. Build one axis and evaluate play, runout, encoder readout, and locking behavior.
3. Build the complete nested frame without the Movesense sensor installed.
4. Verify free motion, hard-stop operation, cable clearance, and base stability.
5. Install encoders and implement one timestamped three-channel controller stream.
6. Characterize zero repeatability, backlash, static drift, and repeated-angle consistency.
7. Screen the assembled fixture for magnetic disturbance with the sensor stationary at several distances and orientations.
8. Install the keyed sensor cradle and document the physical coordinate transform.
9. Run static poses before attempting continuous rotations.
10. Add dynamic trajectories only after timing alignment and static behavior are understood.

## Initial bench protocol

Use a fixed protocol so rebuilds and adjustments can be compared:

1. Record a stationary baseline at mechanical zero.
2. Repeat the zero position after moving and returning each axis independently.
3. Hold known indexed positions long enough to measure stationary noise and drift.
4. Perform isolated yaw, pitch, and roll sweeps in both directions.
5. Repeat each sweep at slow, medium, and fast manual speeds.
6. Perform dwell-and-reversal motions to expose backlash and timing offset.
7. Perform combined sequential rotations in a documented order.
8. Repeat selected trajectories across sessions after powering down and re-homing.
9. Run magnetic-disturbance tests separately from ordinary orientation trials.

Mount the sensor near the axis intersection for the initial protocol. Deliberate off-center mounting can be added later to introduce known tangential and centripetal acceleration, but it changes the question being tested.

## Preliminary acceptance checks

Before treating the fixture as ready for Project 003 evaluation, document:

- measured zero-return repeatability for every axis;
- encoder count continuity with no unexplained jumps;
- backlash or hysteresis in both directions;
- short-term static angle stability;
- shaft runout and observable frame deflection;
- the measured offset between axis intersection and sensor center;
- the sensor-to-gimbal axis mapping and sign conventions;
- magnetic-field changes caused by the complete fixture;
- controller sample-rate stability and dropped-record behavior; and
- repeatability after power cycling and re-homing.

Numerical acceptance thresholds should be chosen after the first-axis prototype establishes achievable performance and the intended orientation-error question is specified.

## OpenSim and OpenSense preparation

Represent the fixture with a custom model containing three nested bodies:

```text
ground -> yaw_body -> pitch_body -> roll_body
```

Add an IMU offset frame to `roll_body` using the measured sensor-platform transform. Define the model's coordinate order, axis directions, ranges, and zero pose to match the physical fixture.

Encoder angles can generate synthetic reference orientations for early model tests. Actual Movesense data require a documented fusion method and synchronized quaternion series before OpenSense ingestion. Those are HMS-PROJ-003 and HMS-PROJ-004 activities, respectively, not HMS-PROJ-001 completion criteria.

## Procurement questions

Resolve these questions before ordering:

- What angular accuracy and repeatability are needed for the first scientific comparison?
- Are absolute optical encoders affordable, or is indexed incremental homing acceptable?
- What encoder interface can the selected controller sample simultaneously?
- Can local machine-shop or engineering-program resources fabricate the nested frames?
- What materials and fasteners remain acceptably nonmagnetic at the sensor location?
- Can bearings and shafts meet the play and runout targets without custom machining?
- Is a calibrated external angle reference available for fixture characterization?
- Can replacement encoders and bearings be sourced for student maintenance?

Do not procure motors for the first version. If later motorization is justified, treat motor fields, power wiring, vibration, control accuracy, safety guarding, and emergency stopping as a separate design review.