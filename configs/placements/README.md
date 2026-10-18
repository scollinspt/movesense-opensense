# Placement configurations

Map logical sensor labels to OpenSim body and IMU frame names.

## Initial single-wrist feasibility profile

Protocol ID: `single-wrist-feasibility-v1`

- Place the sensor at the dorsal distal forearm in the usual watch position.
- Orient the front face and Movesense logo away from the skin.
- Align the wordmark's long axis approximately with the forearm's
  proximal-distal axis.
- On the right wrist, direct the `M` end distally toward the hand and the final
  `E` end proximally toward the elbow.
- On the left wrist, direct the final `E` end distally toward the hand and the
  `M` end proximally toward the elbow.
- Keep the same side, strap location, tightness, and orientation for the static,
  forearm-rotation, and elbow flexion/extension recordings.

This convention defines reproducible physical mounting. It does not yet define
the mapping between sensor X/Y/Z axes and anatomical axes. Establish that
mapping with verified sensor-axis documentation and known static poses or
prescribed rotations before interpreting orientation or exporting to OpenSense.

The wrist-mounted sensor records distal-forearm motion. Under a constrained
one-DOF protocol with the trunk and non-target joints held in defined positions,
it can support development of forearm axial-rotation or elbow
flexion/extension logic. Those constraints do not make a single sensor a direct
joint-angle reference, and violations cannot be detected independently from the
wrist sensor alone.
