# Placement and Calibration Protocol

## Placement objective

Apply two sensors quickly while preserving a consistent, side-aware
sensor-to-shank relationship.

## Bilateral placement

For each limb:

1. Palpate the medial malleolus.
2. Place the mount immediately proximal to, but not on, the malleolar
   prominence.
3. Match the contralateral placement visually and by palpation.
4. Position the strap perpendicular to the long axis of the shank.
5. Align the Movesense wordmark with the long axis of the shank.
6. Direct the `M` end proximally toward the knee.
7. Confirm that the mount is stable and does not contact footwear, an orthosis,
   or the assistive device.

A centimeter measurement above the malleolus is not required. Bilateral
symmetry and the documented landmark relationship are required.

## Why `M` is proximal on both sides

The anatomical relationship is more important than making the printed logo
look upright from both viewing directions. `M` proximal on both sides preserves
the same proximal-distal shell mapping and avoids an unnecessary 180-degree
longitudinal difference.

Because both sensors are medial, their surface-normal directions are mirrored.
Processing must still apply a side-aware transform.

## Side assignment

Bind each hardware ID to one role:

- `left_distal_shank`
- `right_distal_shank`

Role verification requires movement, not only a strap label or operator
selection.

## Initial seated static reference

Use supported sitting:

- Feet supported on the floor or a consistent firm surface.
- Legs uncrossed.
- Shanks as close to vertical as clinically appropriate.
- Patient still after settling.
- Record 10 to 20 seconds.

The application records whether both feet are supported and whether the
standard position was achieved. It must allow a structured deviation rather
than forcing anatomical symmetry that the patient cannot safely assume.

This reference supports gravity direction, gyroscope bias, initial orientation,
and data-quality checks. It does not assert identical anatomical alignment.

## Knee extension/flexion verification and calibration

Ask for two controlled active knee extension-and-flexion repetitions on one leg
at a time. The first discernible excursion starts from the supported seated
position and proceeds into knee extension; return/flexion follows. Use
active-assisted or passive movement when active movement does not provide a
clear, clinically appropriate excursion, and record the mode for each limb:

1. Keep the right leg still; extend and flex the left knee through a clinically
   appropriate range.
2. Confirm activity on the assigned left stream.
3. Keep the left leg still; extend and flex the right knee.
4. Confirm activity on the assigned right stream.

The clinician determines range, speed, assistance, support, and suitability.
Do not force end range. Movement mode describes calibration conditions and is
not itself a motor-performance outcome.

This stage can establish:

- Left/right role verification.
- Dominant functional sagittal rotation axis.
- Extension and return sign.
- Gross mount stability.
- Comparable sensor response.

The transform defines positive sagittal rotation as flexion. Processing uses
the first extension excursion to resolve the otherwise sign-ambiguous
functional axis separately for each limb.

It is named **side verification and functional sagittal-axis calibration**.
It can support the initial shank-based processing method but does not preclude
a later gait-specific calibration bout.

## Optional supported-standing references

If safe and relevant, collect paired pre- and post-walking supported-standing
references under comparable assistive-device and assistance conditions.

Standing references describe actual stance as well as sensor behavior. They
must not be interpreted automatically as drift.

## Post-gait seated static reference

After all gait bouts, reproduce the initial supported-seated position and
record another 10 to 20 seconds when clinically appropriate. Compare it with
the initial seated reference for:

- Orientation return error.
- Gyroscope-bias change.
- Possible strap or mount movement.
- Gross drift.

The post-gait seated reference is strongly recommended but not mandatory.
A standing pose cannot be directly compared with an initial seated pose for
return error. If this reference is omitted, post-session return error and
attachment stability are not assessable.

## Frame chain

Processing must preserve:

```text
raw Movesense frame
-> verified device shell frame
-> M-proximal medial-shank frame
-> side-aware anatomical shank frame
-> functionally calibrated sagittal shank axis
```

Raw axes must not be labeled anatomical without this provenance.

The initial seated gravity direction is a proximal-axis estimate only under the
protocol assumption that the shank is near vertical. Any structured deviation
from that pose limits anatomical frame accuracy and must remain attached to the
derived transform.
