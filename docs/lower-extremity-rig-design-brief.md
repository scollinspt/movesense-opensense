# Foot-Fixed Lower-Extremity Teaching Rig: Design and Sourcing Brief

## How to use this document

Provide this entire document to an AI system that can research currently available materials and generate or commission schematic images. Ask it to complete the requested deliverables without silently changing the project scope.

This is a design brief, not a finished construction drawing. The selected design must be checked against the actual bone models and available workshop tools before materials are purchased or cut.

## Role and requested outcome

Act as a mechanical design and educational-laboratory planning assistant. Develop a practical build package for a manually posed, foot-fixed lower-extremity teaching rig that can be built in a university woodshop by a person with ordinary woodworking skills.

The package must:

1. propose a buildable wooden mechanism;
2. source suitable materials and hardware from current suppliers;
3. provide dimensioned schematic images or image-generation prompts;
4. identify measurements that must be taken from the available anatomical bone models;
5. preserve the biomechanical and software requirements below; and
6. distinguish confirmed vendor specifications from estimates and design assumptions.

Do not redesign this as a robot, powered mechanism, precision rate table, or metal-machining project. Do not add motors, encoders, electronics, or a pelvis unless they are presented only as optional future upgrades.

## Project purpose

The apparatus will help students see the relationship between:

```text
physical foot, shank, and thigh movement
-> Movesense IMU acquisition
-> orientation processing and synchronization
-> OpenSense IMU inverse kinematics
-> movement of a matching OpenSim skeletal model
```

The primary objective is to establish and teach a reproducible Movesense-to-OpenSense interoperability workflow. The apparatus is not intended to validate the intrinsic accuracy of the Movesense IMU, reproduce complete human lower-extremity anatomy, or support clinical claims.

## Required mechanism

Build a vertical, sagittal-plane linkage with this physical and modeled structure:

```text
workbench or stable table
  -> rigid wooden base
      -> fixed foot segment
          -> friction-adjustable ankle hinge
              -> shank segment
                  -> friction-adjustable knee hinge
                      -> thigh segment with a safe handhold
```

### Required degrees of freedom

- The foot is rigidly fixed to the base.
- The ankle has one rotational degree of freedom representing plantarflexion and dorsiflexion.
- The knee has one rotational degree of freedom representing flexion and extension.
- The ankle and knee hinge axes are parallel.
- Both joints move in one common sagittal plane.
- Both joints can be tightened sufficiently to hold a static pose without an operator supporting the mechanism.
- The mechanism remains manually repositionable after the friction knobs are loosened.

This is an intentionally simplified two-joint chain. Do not add frontal-plane or transverse-plane motion to the first version.

## Anatomical bone models

Actual educational bone models of the foot, tibia/fibula, and femur will be incorporated to improve student understanding. Treat them as visual anatomical overlays, not as load-bearing links or precision joints.

Recommended arrangement:

- Build the mechanism from straight wooden foot, shank, and thigh links.
- Mount each bone or bone group to its corresponding wooden link with removable padded straps, clips, or custom cradles.
- Position the wooden linkage lateral to or behind the bones so the bones remain visible.
- Align the mechanical hinge axes approximately with the visible ankle and knee joint centers.
- Do not drill, permanently modify, or load the bone models unless explicit permission and replacement-cost review permit it.
- Do not rely on the bone model's original elastic cords, wire, or joint fittings to control motion.

The design must accommodate removal of the bones for maintenance, teaching, and storage.

## Initial dimensions and measurement placeholders

Do not invent final dimensions before measuring the available models. Produce a parametric design based on these required field measurements:

| Symbol | Required measurement | Value |
| --- | --- | --- |
| `L_foot` | Heel-to-toe length of the foot model | To be measured |
| `L_shank` | Intended ankle-axis to knee-axis distance | To be measured |
| `L_thigh` | Intended knee-axis to proximal thigh endpoint | To be measured |
| `W_bone_max` | Maximum lateral width of the mounted bones | To be measured |
| `D_bone_max` | Maximum anterior-posterior depth | To be measured |
| `T_link` | Proposed wooden-link thickness | To be designed |
| `O_bone` | Offset from linkage plane to bone centerline | To be designed |
| `H_total` | Maximum assembled height in extension | Derived |
| `A_base` | Required base footprint | Derived from stability check |

Provide formulas or clear rules for deriving cut lengths and hole locations from these measurements. Include at least 25 mm of adjustment in the bone-mount locations where practical.

## Preferred construction approach

Use common woodshop materials and hardware. The initial concept should evaluate:

- cabinet-grade plywood for the base;
- straight hardwood or high-quality plywood laminations for the moving links;
- through-bolts as hinge axles;
- large hand knobs or star knobs for friction adjustment;
- replaceable friction washers between moving wooden faces;
- flat washers and locking nuts that cannot loosen unintentionally;
- spacers or standoffs that keep the anatomical bones clear of the linkage;
- removable padded straps or cradles for the bones;
- non-slip feet and provision for clamping the base to a workbench; and
- rounded edges and guarded or recessed bolt ends.

At each friction joint, compare at least two buildable arrangements, such as:

1. a carriage bolt, flat washer, friction washer, moving link, fixed cheek plate, and female star knob; or
2. a threaded insert or captured nut with a male clamping knob.

Recommend one arrangement and explain how it limits wobble while retaining adjustable friction. Avoid a design in which tightening the knob substantially changes the hinge-axis location.

## Stability and support

The extended thigh makes the mechanism top-heavy. The design must include:

- a base footprint justified by the measured assembled height and segment masses;
- a method to clamp or screw the base to a workbench during use;
- a physical travel stop at each joint;
- sufficient joint friction to prevent an uncontrolled fall;
- a handhold on the thigh segment for repositioning;
- padding or a stop to prevent wood-to-wood impact; and
- an optional removable support strut for transport or unattended display.

This apparatus is for bone models and sensors only. It must not bear human body weight or be used as an exercise, mobilization, or rehabilitation device.

## Suggested motion ranges

Propose conservative mechanical stops near these teaching ranges, then adjust them for interference and stability:

- ankle: approximately `20 deg` dorsiflexion to `40 deg` plantarflexion relative to the mechanical neutral pose;
- knee: approximately `0 deg` extension to `120 deg` flexion.

The final drawings must define:

- the mechanical neutral pose;
- positive rotation direction for each joint;
- the zero-angle reference line on each segment;
- stop locations; and
- any difference between the teaching angle convention and the OpenSim coordinate convention.

Simple printed protractor scales and pointer marks are desirable for approximate pose checks. They are not precision ground truth.

## Movesense sensor mounting

Provide three rigid, repeatable mounting pads:

1. `foot_imu` on the fixed foot link;
2. `shank_imu` on the shank link; and
3. `thigh_imu` on the thigh link.

Each pad must:

- hold one Movesense sensor without movement relative to its wooden segment;
- allow battery replacement and sensor removal;
- return the sensor to the same orientation after replacement;
- display permanent local `+X`, `+Y`, and `+Z` axis marks;
- display the sensor's logical name; and
- avoid placing the sensor directly beside a steel bolt, washer, or knob when practical.

Prefer mounting the sensor to the rigid wooden segment rather than directly to a removable bone. The sensor and bone should both be visibly associated with the same segment.

Ask for at least two sensor-cradle options:

- a no-fabrication option using hook-and-loop straps and a keyed wooden recess; and
- a reusable fabricated option, such as a small 3D-printed or layered-plywood cradle.

## Magnetic-field limitation

Common hinges, bolts, washers, knobs, and educational skeleton hardware may contain ferromagnetic material and disturb the Movesense magnetometer. This does not prevent an initial interoperability demonstration, but it must be documented and tested.

The sourcing response must:

- identify which proposed parts are steel or magnetic;
- offer brass, aluminum, polymer, or verified low-magnetic alternatives where practical;
- avoid claiming that generic stainless steel is nonmagnetic;
- keep large steel components as far from sensor pads as the geometry allows; and
- propose a simple stationary before-and-after magnetometer screening procedure.

Do not recommend expensive nonmagnetic hardware unless its benefit is justified for this teaching objective.

## OpenSim and OpenSense mapping

The first custom OpenSim model should mirror the physical apparatus rather than a complete human model:

```text
ground
  -> foot: welded to ground
      -> shank: ankle pin joint
          -> thigh: knee pin joint
```

The corresponding IMU frames are:

```text
foot_imu   -> foot body
shank_imu  -> shank body
thigh_imu  -> thigh body
```

Mechanical neutral will provide the initial calibration pose. The physical labels, OpenSim body names, OpenSim coordinate names, and software configuration names must agree.

Suggested coordinate names:

- `ankle_flexion`;
- `knee_flexion`.

The generated diagrams must show the physical axis directions and a separate coordinate-frame mapping diagram suitable for later translation into the OpenSim model.

## Teaching workflow

The completed apparatus should support this sequence:

1. Identify the physical foot, shank, thigh, ankle axis, and knee axis.
2. Identify each Movesense sensor and its local axes.
3. Place the linkage in mechanical neutral and perform the documented calibration step.
4. Move one joint while holding the other fixed.
5. Observe the corresponding raw IMU and processed orientation signals.
6. Run the OpenSense workflow.
7. Compare the direction and approximate configuration of the physical apparatus with the OpenSim visualization.
8. Diagnose reversed axes, swapped sensors, incorrect calibration, synchronization errors, and implausible model motion.

The design should make labels and moving segments visible to a small student group standing around a workbench.

## Requested sourcing deliverables

Research current United States suppliers and produce a sourcing table with:

- component description;
- proposed material and dimensions;
- required quantity;
- manufacturer and part number where applicable;
- supplier;
- direct product URL;
- current listed unit price and date checked;
- estimated extended price;
- magnetic-material concern;
- acceptable substitute; and
- reason for selection.

Provide three sourcing tiers:

1. **Workshop minimum:** common lumber, plywood, and hardware-store components.
2. **Recommended durable build:** better knobs, bushings, friction material, and removable mounts.
3. **Optional refinements:** protractor scales, 3D-printed cradles, low-magnetic hardware, and transport supports.

Separate consumables from reusable parts. Do not present unverified prices, availability, accuracy, or material composition as fact. Flag products that require vendor confirmation.

## Requested schematic deliverables

Create clear, workshop-oriented images rather than photorealistic concept art. Use a white or light neutral background, dimension lines, readable labels, consistent colors, and no decorative elements.

Provide these views:

1. **Overall side elevation:** foot fixed to base, shank, thigh, both hinge axes, neutral pose, principal dimensions, motion arcs, and joint limits.
2. **Front elevation:** linkage plane, bone offset, base width, hinge-axis alignment, sensor pads, and anti-wobble cheek plates or bushings.
3. **Top view:** foot orientation, base footprint, bench-clamp locations, linkage offset, and bone-model position.
4. **Exploded ankle joint:** bolt or axle, knob, washers, friction washers, wooden members, bushing or spacer, locking feature, and stop.
5. **Exploded knee joint:** same level of detail, including the thigh handhold and travel stop.
6. **Bone attachment detail:** removable padded mounting method that avoids drilling the anatomical model.
7. **Movesense cradle detail:** retention, keyed orientation, battery access, segment labels, and local sensor axes.
8. **Coordinate mapping diagram:** physical segment frames, sensor frames, ankle and knee positive directions, and corresponding OpenSim body and coordinate names.
9. **Exploded assembly overview:** numbered parts matched to the bill of materials.

For every image, provide:

- a descriptive title;
- drawing scale or a clear `not to scale` label;
- all critical dimensions or parameter symbols;
- a legend;
- a short caption explaining the construction decision; and
- an image-generation prompt if the AI cannot directly produce a technically reliable drawing.

Do not depict a pelvis, motor, encoder, person standing on the apparatus, or unsupported free-standing use.

## Requested cut list and assembly plan

After the field measurements are supplied, produce:

- a dimensioned cut list;
- a drilling template for both hinge axes;
- a hardware schedule keyed to the exploded drawings;
- an ordered assembly procedure;
- required tools;
- estimated workshop time;
- finishing recommendations that preserve visible reference marks;
- an inspection checklist; and
- an adjustment procedure for joint friction and lateral play.

Identify operations that require more than ordinary woodshop capability. Prefer designs that can be made with a table saw or circular saw, drill press, router, and common hand tools.

## Acceptance checks

Define practical checks for the completed teaching rig:

- the base does not move when clamped;
- the foot remains fixed relative to the base;
- each joint moves independently through its permitted range;
- tightened friction knobs hold the selected pose for at least five minutes;
- loosened joints can be repositioned smoothly by one person;
- lateral wobble is visually small and does not allow the bones to contact the frame;
- mechanical stops prevent damaging overtravel;
- sensor cradles do not shift during repeated motion;
- neutral marks can be reproduced after disassembly and reassembly;
- all pinch points and projecting threads are guarded or clearly marked; and
- the apparatus can be carried or stored without uncontrolled joint motion.

Do not assign a numerical angular-accuracy claim unless a measurement method and evidence support it.

## Safety and review requirements

Before construction, flag:

- pinch and shear points at both hinges;
- tip-over risk;
- finger access near friction washers and stops;
- sharp corners and exposed threaded rod;
- unexpected joint release when a knob is loosened;
- bone-model cracking or detachment;
- sensor ejection; and
- workshop operations requiring guards, dust control, or supervision.

Require a dry-fit and manual stability review before finishing or attaching the bone models and sensors.

## Response format

Return the design package in this order:

1. assumptions and unresolved measurements;
2. recommended mechanism with rationale;
3. parameterized dimensions;
4. sourced bill of materials in three tiers;
5. cut list;
6. schematic set;
7. assembly procedure;
8. sensor mounting and coordinate mapping;
9. safety review;
10. acceptance checklist;
11. estimated cost and build time; and
12. open decisions requiring user approval.

Ask for the actual bone-model measurements before issuing final cut dimensions. It is acceptable to provide a clearly labeled provisional design first, but do not disguise assumed dimensions as measured values.