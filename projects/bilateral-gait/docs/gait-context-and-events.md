# Gait Context and Event Model

## Principle

Surface, assistive device, assistance, orthosis, path geometry, and task
modifiers are separate dimensions. Combining them into one label would make
later comparisons ambiguous.

## Session context dimensions

### Environment and surface

Initial enabled value:

- `flat_overground`

Reserved for later protocols:

- `flat_treadmill`
- `ramp`
- `stairs`
- `uneven_overground`
- `other`

### Assistive device

Initial structured values:

- `none`
- `single_point_cane`
- `quad_cane`
- `hemi_walker`
- `front_wheeled_walker`
- `four_wheeled_walker`
- `platform_walker`
- `other`

If `other` is selected, a short non-identifying description is required.

### Physical assistance

- `independent`
- `supervision`
- `contact_guard`
- `minimal_assistance`
- `moderate_assistance`
- `maximum_assistance`
- `total_assistance`

These values describe the recorded bout context; the application does not
decide which level is appropriate.

### Orthosis

- `none`
- `left_afo`
- `right_afo`
- `bilateral_afo`
- `other`

### Path geometry

- `straight`
- `turn_left`
- `turn_right`
- `transition`
- `pause`

Straight and turning segments may occur in one gait bout and are timestamped
independently.

## Event semantics

Events use explicit semantics:

- `start`
- `end`
- `change`
- `point`

Examples:

| Event type | Label | Semantics |
|---|---|---|
| `calibration` | `initial_seated_reference` | `start` / `end` |
| `calibration` | `left_knee_extension_flexion` | `start` / `end` |
| `gait_bout` | `flat_overground` | `start` / `end` |
| `path_segment` | `straight` | `start` |
| `path_segment` | `turn_left` | `start` |
| `path_segment` | `straight` | `start` |
| `context_change` | `assistive_device` | `change` |
| `observation` | `unexpected_interruption` | `point` |

A new path-segment start closes the preceding open path segment during
processing, while acquired events remain immutable.

## Recording start and gait-bout start

Application recording and walking are not the same boundary:

- **Start recording** begins governed sensor and event acquisition.
- **Gait bout start** marks when the intended walking bout begins.
- **Gait bout end** marks when it ends.
- **Stop and finalize** ends acquisition.

This preserves setup motion before walking and recovery motion afterward
without treating either as gait.

## Context changes

If the assistive device, assistance level, or orthosis changes, record an exact
change event. The new context remains active until another change or recording
end.

Prefer a new gait bout after a major context change. Do not change devices
during active walking merely to simplify acquisition.

## Obstacles

Obstacles are future task modifiers, not surfaces and not path geometries.
A later protocol may define:

- Obstacle type and dimensions.
- Approach onset.
- Negotiation onset and end.
- Lead limb.
- Contact or avoidance outcome.

The first flat-overground protocol does not collect obstacle events. The event
contract is extensible so this can be added without changing the meaning of
existing recordings.

## Turning

Turns remain in the initial recording because their signal effect is an
explicit processing question. Processing must compare:

- Straight-only event detection.
- Turn-only signal characteristics.
- Transition windows around turns.
- Whether turns require exclusion, separate metrics, or a dedicated detector.

An operator trigger supplies a review anchor, not assumed ground truth for the
exact biomechanical turn onset.
