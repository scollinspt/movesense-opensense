# Bilateral Gait Acquisition Requirements

## Operational decision

The first application will be a locally hosted browser application rather than
a VS Code canvas. It will bind to `127.0.0.1`, function without internet
access, and write only to the governed `bilateral-gait` namespace.

The application bounds acquisition. A recording starts only after the operator
selects **Start recording** and ends only after **Stop and finalize** or an
explicit interrupted-recording recovery workflow.

## Acquisition state model

The interface must expose the current state:

1. `setup` - no acquisition is possible.
2. `preview` - both sensors stream without governed recording.
3. `ready` - role, placement, context, and calibration requirements pass.
4. `recording` - raw samples and exact events are persisted.
5. `finalizing` - streams stop, storage checkpoints, and checksums are made.
6. `finalized` - immutable artifacts and verification status are displayed.
7. `interrupted` - recovery is required and success must not be implied.

## Sensor discovery and assignment

The application must:

- Discover and connect exactly two Movesense sensors.
- Display hardware ID, advertised name, firmware, battery when available, and
  stream status independently.
- Bind one hardware ID to `left_distal_shank` and the other to
  `right_distal_shank`.
- Reject duplicate hardware IDs or duplicate side roles.
- Require one-leg-at-a-time movement verification before locking roles.
- Preserve role assignments in the recording manifest.
- Require reassignment and reverification after a sensor replacement.

Side must never be inferred solely from the gait signal.

## Placement confirmation

Before calibration, require confirmation that:

- Each sensor is immediately proximal to, but not on, the medial malleolus.
- Placement is bilaterally symmetrical relative to the malleoli.
- Each strap is perpendicular to the shank's long axis.
- Each wordmark is parallel to the shank's long axis.
- `M` points proximally on both limbs.
- Mounts are stable and do not interfere with footwear or orthoses.

No centimeter measurement above the malleolus is required in the initial
protocol.

## Calibration workflow

The application must guide and timestamp:

1. Initial supported-seated static reference.
2. Left knee extension and flexion, active when possible.
3. Right knee extension and flexion, active when possible.
4. Optional pre-walking supported standing.
5. One or more gait bouts.
6. Optional post-walking supported standing when paired with the pre-walking
   condition.
7. Strongly recommended post-gait supported-seated static reference.

Active-assisted or passive movement is permitted when needed. Record the mode
used for each limb. The clinician determines the appropriate range, assistance,
and whether standing is suitable.

Post-session references occur after the gait bouts and support measurement
quality review rather than gait calibration. They remain optional so clinical
needs can end the session without delaying positioning or care.

## Session context

Before recording, collect structured context:

- Environment/surface.
- Assistive device.
- Orthosis.
- Physical assistance level.
- Intended path content.
- Optional non-identifying operator note with a strict length limit.

Initial protocol configuration permits `flat_overground` only. Other values
remain in the extensible contract but are not selectable until a protocol
enables them.

## During-recording triggers

The operator must be able to record exact structured events without stopping
the streams:

- Gait bout start and end.
- Straight segment start.
- Left-turn start.
- Right-turn start.
- Turn end or return to straight gait.
- Pause or rest start and end.
- Assistive-device change.
- Assistance-level change.
- Orthosis change.
- Unexpected interruption.
- Clinically relevant observation without direct identifiers.

Events must retain host monotonic time, host wall-clock time, nearest sensor
timestamps for both sensors, and sample indices for both streams.

## Flat overground first

The first protocol includes straight and turning gait in the same governed
recording so processing can determine whether turns:

- Require exclusion from straight-gait metrics.
- Can be detected reliably.
- Need separate metrics.
- Distort gait-event detection around transition boundaries.

Turns are path segments, not separate recording categories.

## Obstacles and other tasks

Obstacles should later be represented as task modifiers with explicit onset,
offset, type, and protocol version. They must not be placed in the same
category as surface or assistive device.

The initial application must not offer an unvalidated generic **obstacle**
button. The schema reserves extensibility without collecting ambiguous data.

## Raw acquisition

Preserve each sensor's:

- Native timestamp or counter.
- Host monotonic receipt time.
- Host wall-clock receipt time.
- Accelerometer axes.
- Gyroscope axes.
- Magnetometer axes when requested.
- Packet or batch provenance.
- Decode and continuity status.

Do not align the two streams by assigning common host receipt times or by
resampling during acquisition.

## Storage and recovery

The preferred first implementation is one recoverable SQLite container with
separate native-rate sample tables for each assigned sensor, an events table,
and recording metadata. The manifest and checksum are separate finalized
artifacts.

Transactions must commit periodically. Finalization must checkpoint database
sidecars before checksum generation. Interrupted recordings require explicit
recovery and integrity reporting.

## Usability and safety

- Setup should use large, ordered controls and unambiguous side labels.
- Recording status and elapsed time must remain continuously visible.
- Critical states must not rely on color alone.
- Event controls must be usable without navigating away from live status.
- The computer operator must not be assumed to be the person responsible for
  guarding.
- The application must not provide fall alarms or safety clearance.
- Stop and finalization controls must remain available if one stream fails.
