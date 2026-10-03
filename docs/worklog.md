# Worklog

Maintain this as a chronological record of completed work, evidence, decisions, and blockers. Planned work belongs in the workplan; this log records what actually happened.

## 2026-10-03

### Decisions

- Revised the development sequence so each new sensor count, task, placement, or processing claim is tested non-human before corresponding human feasibility is considered.
- Defined the sensor-count progression as one sensor, two sensors, and then staged 3-, 5-, and 10-sensor configurations.
- Separated human feasibility from measurement validity: any human activity requires a documented institutional governance determination and applicable consent, privacy, supervision, and data plans.
- Split the public HMS Lab sequence into acquisition, multi-sensor scaling, orientation validation, OpenSense interoperability, and OpenCap comparison projects.

### Current next step

- Complete HMS-PROJ-001 inventory work and the first non-human one-sensor bench recording. Do not begin human feasibility until the bench criteria and governance gate are satisfied.

## 2026-10-02

### Completed

- Confirmed that the SimTK project is associated with the OpenSim community.
- Completed the first part of the hardware inventory by recording the hardware identifiers and Bluetooth addresses for ten Movesense devices in a governed inventory outside Git.
- Documented the planned single-sensor bench acquisition using the official GATT SensorData Protocol Python client with Bleak.

### Remaining Milestone 1 work

- Read and record firmware, hardware, and application information from each device.
- Record batteries, attachment accessories, Flash capability, receiver details, and acquisition software versions.
- Test one sensor with its existing firmware and capture the first non-human bench recording.

See [acquisition-plan.md](acquisition-plan.md) for the planned first acquisition.

## 2026-10-01

### Completed

- Confirmed that SimTK approved and published `Movesense-OpenSense Integration` at `https://simtk.org/projects/movesense2os`.
- Requested association with the SimTK OpenSim community through the project administration page.
- Selected Apache-2.0 for project-authored software and documentation, aligned with OpenSim's license and with an explicit patent grant for reusable technical tooling.

## 2026-09-28

### Completed

- Established the initial public repository structure and Python package namespace.
- Established the governed-storage directory structure and Git exclusions.
- Documented the public/governed data boundary.
- Confirmed that the local Git repositories and their GitHub remotes have no commits or branches.
- Reviewed the SimTK project-registration form, OpenSense project scope, available project categories, and SimTK communities.
- Chose a standalone SimTK project aligned with OpenSense in the OpenSim community.
- Defined hardware inventory and non-human bench acquisition as the first milestone.
- Submitted the public `Movesense-OpenSense Integration` project (`movesense2os`) for SimTK administrator review. SimTK indicated that a decision and further instructions should arrive within 72 hours.

### Decisions

- Use the project title `Movesense-OpenSense Integration` and short identifier `movesense2os` for SimTK.
- Keep the SimTK project public and describe interoperability goals without scientific or clinical validity claims.
- Position the work as a Movesense acquisition and integration pathway for OpenSense, not as a replacement for OpenSense.
- Keep authoritative recordings and restricted research material in institution-managed governed storage.

### Open work

- Inventory available Movesense hardware and firmware.
- Confirm the initial acquisition route and capture the first non-human bench recording.