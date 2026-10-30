import { EventEmitter } from "node:events";

import { GaitRecordingSession } from "./recording.mjs";
import {
  MovesenseImuSource,
  SyntheticImuSource,
  scanMovesense,
} from "./sources.mjs";

const ROLES = ["left_distal_shank", "right_distal_shank"];
const CALIBRATION_LABELS = new Set([
  "initial_seated_reference",
  "left_knee_extension_flexion",
  "right_knee_extension_flexion",
  "pre_walking_supported_standing",
  "post_walking_supported_standing",
  "post_gait_seated_reference",
]);
const POST_SESSION_LABELS = new Set([
  "post_walking_supported_standing",
  "post_gait_seated_reference",
]);
const KNEE_MOVEMENT_MODES = new Set([
  "active",
  "active_assisted",
  "passive",
]);
const PATH_LABELS = new Set([
  "straight",
  "turn_left",
  "turn_right",
  "transition",
  "pause",
]);
const ASSISTIVE_DEVICES = new Set([
  "none",
  "single_point_cane",
  "quad_cane",
  "hemi_walker",
  "front_wheeled_walker",
  "four_wheeled_walker",
  "platform_walker",
  "other",
]);
const ASSISTANCE_LEVELS = new Set([
  "independent",
  "supervision",
  "contact_guard",
  "minimal_assistance",
  "moderate_assistance",
  "maximum_assistance",
  "total_assistance",
]);
const ORTHOSES = new Set([
  "none",
  "left_afo",
  "right_afo",
  "bilateral_afo",
  "other",
]);

function emptyRoleState() {
  return {
    connectionState: "idle",
    sensor: null,
    sampleCount: 0,
    latest: null,
    errorMessage: null,
  };
}

function validateContext(input) {
  const context = {
    environment: "flat_overground",
    assistiveDevice: input.assistiveDevice,
    assistanceLevel: input.assistanceLevel,
    orthosis: input.orthosis,
    otherDescription: typeof input.otherDescription === "string"
      ? input.otherDescription.trim()
      : "",
  };
  if (!ASSISTIVE_DEVICES.has(context.assistiveDevice)) {
    throw new Error("Select a supported assistive-device value.");
  }
  if (!ASSISTANCE_LEVELS.has(context.assistanceLevel)) {
    throw new Error("Select a supported assistance level.");
  }
  if (!ORTHOSES.has(context.orthosis)) {
    throw new Error("Select a supported orthosis value.");
  }
  if (
    [
      context.assistiveDevice,
      context.orthosis,
    ].includes("other")
    && !context.otherDescription
  ) {
    throw new Error("Describe the selected other device or orthosis.");
  }
  if (context.otherDescription.length > 120) {
    throw new Error("The other-context description is too long.");
  }
  return context;
}

export class GaitSessionManager extends EventEmitter {
  constructor() {
    super();
    this.sources = new Map();
    this.roles = Object.fromEntries(ROLES.map((role) => [role, emptyRoleState()]));
    this.latestSamples = new Map();
    this.sampleBatch = [];
    this.clients = new Set();
    this.setup = null;
    this.context = null;
    this.recording = null;
    this.lastFinalization = null;
    this.activeCalibration = null;
    this.gaitBoutActive = false;
    this.completedGaitBoutCount = 0;
    this.currentPath = null;
    this.flushTimer = setInterval(() => this.#flush(), 100);
  }

  get state() {
    return {
      roles: this.roles,
      setup: this.setup,
      context: this.context,
      ready:
        ROLES.every((role) => this.roles[role].connectionState === "connected")
        && Boolean(this.setup),
      recording: this.recording
        ? {
            recordingId: this.recording.recordingId,
            startedAt: this.recording.startedAt.toISOString(),
            elapsedSeconds: this.recording.elapsedSeconds,
            sampleCounts: this.recording.sampleCounts,
            eventCount: this.recording.eventCount,
          }
        : null,
      activeCalibration: this.activeCalibration,
      gaitBoutActive: this.gaitBoutActive,
      completedGaitBoutCount: this.completedGaitBoutCount,
      currentPath: this.currentPath,
      lastFinalization: this.lastFinalization,
    };
  }

  addClient(response) {
    this.clients.add(response);
    this.#send(response, "state", this.state);
    return () => this.clients.delete(response);
  }

  #send(response, event, value) {
    response.write(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`);
  }

  #broadcast(event, value) {
    for (const client of this.clients) this.#send(client, event, value);
  }

  #flush() {
    if (this.sampleBatch.length) {
      this.#broadcast("samples", this.sampleBatch);
      this.sampleBatch = [];
    }
    if (this.sources.size) this.#broadcast("state", this.state);
  }

  async scan() {
    return scanMovesense();
  }

  async connectSynthetic() {
    await this.disconnect();
    this.#attach(
      "left_distal_shank",
      new SyntheticImuSource({
        role: "left_distal_shank",
        phaseOffset: 0,
      }),
    );
    this.#attach(
      "right_distal_shank",
      new SyntheticImuSource({
        role: "right_distal_shank",
        phaseOffset: Math.PI,
      }),
    );
    return this.state;
  }

  async connectHardware({ leftAddress, rightAddress, imuRateHz = 52 }) {
    if (
      typeof leftAddress !== "string"
      || typeof rightAddress !== "string"
      || !leftAddress.trim()
      || !rightAddress.trim()
    ) {
      throw new Error("Select both left and right Movesense sensors.");
    }
    if (leftAddress.trim() === rightAddress.trim()) {
      throw new Error("Left and right roles require different sensors.");
    }
    const rate = Number(imuRateHz);
    if (![13, 26, 52, 104, 208].includes(rate)) {
      throw new Error("Select a supported IMU9 rate.");
    }
    await this.disconnect();
    this.#attach(
      "left_distal_shank",
      new MovesenseImuSource({
        role: "left_distal_shank",
        address: leftAddress.trim(),
        rateHz: rate,
      }),
    );
    this.#attach(
      "right_distal_shank",
      new MovesenseImuSource({
        role: "right_distal_shank",
        address: rightAddress.trim(),
        rateHz: rate,
      }),
    );
    return this.state;
  }

  #attach(role, source) {
    this.sources.set(role, source);
    this.roles[role] = {
      ...emptyRoleState(),
      connectionState: "connecting",
    };
    source.on("sample", (sample) => this.#handleSample(role, sample));
    source.on("status", (status) => {
      this.roles[role].connectionState = status.state;
      if (status.sensor) this.roles[role].sensor = status.sensor;
      this.#broadcast("state", this.state);
    });
    source.on("error", (error) => {
      this.roles[role].errorMessage = error.message;
      this.roles[role].connectionState = "error";
      this.#broadcast("state", this.state);
    });
    this.roles[role].sensor = source.start();
  }

  #handleSample(role, sample) {
    this.latestSamples.set(role, sample);
    const magnitude = Math.hypot(
      sample.accelerationX,
      sample.accelerationY,
      sample.accelerationZ,
    );
    const angularVelocity = Math.hypot(
      sample.angularVelocityX,
      sample.angularVelocityY,
      sample.angularVelocityZ,
    );
    this.roles[role].sampleCount += 1;
    this.roles[role].latest = {
      sensorTimestampMs: sample.sensorTimestampMs,
      accelerationMagnitude: magnitude,
      sagittalAngularVelocity: sample.angularVelocityX,
      angularVelocityMagnitude: angularVelocity,
    };
    if (this.recording) this.recording.appendSample(role, sample);
    this.sampleBatch.push({
      role,
      timeMs: sample.sensorTimestampMs,
      accelerationMagnitude: magnitude,
      sagittalAngularVelocity: sample.angularVelocityX,
    });
  }

  configureSetup(input) {
    if (!ROLES.every((role) => this.roles[role].connectionState === "connected")) {
      throw new Error("Connect both sensor roles before confirming setup.");
    }
    const required = [
      "symmetricalPlacement",
      "proximalMalleoli",
      "wordmarksParallel",
      "mEndsProximal",
      "mountsStable",
      "leftMovementVerified",
      "rightMovementVerified",
    ];
    if (!required.every((key) => input[key] === true)) {
      throw new Error("Complete every placement and side-verification confirmation.");
    }
    if (
      !KNEE_MOVEMENT_MODES.has(input.leftKneeMovementMode)
      || !KNEE_MOVEMENT_MODES.has(input.rightKneeMovementMode)
    ) {
      throw new Error("Select the movement mode used for each knee calibration.");
    }
    this.setup = {
      ...Object.fromEntries(required.map((key) => [key, true])),
      leftKneeMovementMode: input.leftKneeMovementMode,
      rightKneeMovementMode: input.rightKneeMovementMode,
    };
    this.context = validateContext(input);
    this.#broadcast("state", this.state);
    return this.state;
  }

  async startRecording({ dataRoot }) {
    if (!this.state.ready) {
      throw new Error("Connect both sensors and confirm setup before recording.");
    }
    if (this.recording) throw new Error("A recording is already active.");
    const sensors = ROLES.map((role) => ({
      role,
      hardwareId: this.roles[role].sensor.hardwareId
        ?? this.roles[role].sensor.address,
      resource: `/Meas/IMU9/${this.roles[role].sensor.imuRateHz}`,
      requestedRateHz: this.roles[role].sensor.imuRateHz,
      sideVerificationAccepted: true,
    }));
    this.recording = await GaitRecordingSession.create({
      dataRoot,
      sensors,
      placement: {
        bilaterallySymmetrical: true,
        immediatelyProximalToMedialMalleoli: true,
        wordmarksParallel: true,
        mEndsProximal: true,
        mountsStable: true,
      },
      calibrationPlan: {
        preferredMovementMode: "active",
        assistanceWhenNeeded: true,
        leftKneeMovementMode: this.setup.leftKneeMovementMode,
        rightKneeMovementMode: this.setup.rightKneeMovementMode,
      },
      initialContext: this.context,
      softwareVersion: "bilateral-gait-acquisition-v0.1.0",
    });
    this.lastFinalization = null;
    this.activeCalibration = null;
    this.gaitBoutActive = false;
    this.completedGaitBoutCount = 0;
    this.currentPath = null;
    this.#recordEvent("recording", "recording_start", "start", {});
    this.#broadcast("state", this.state);
    return this.state.recording;
  }

  #projection(eventHostMonotonicNs) {
    return Object.fromEntries(ROLES.map((role) => {
      const sample = this.latestSamples.get(role);
      if (!sample) return [role, null];
      const sampleHostMonotonicNs = BigInt(
        sample.hostMonotonicNs ?? eventHostMonotonicNs,
      );
      return [role, {
        sensorTimestamp: sample.sensorTimestampMs,
        sampleIndex: sample.sampleIndex ?? this.roles[role].sampleCount - 1,
        absoluteTimeDifferenceSeconds:
          Number(
            eventHostMonotonicNs >= sampleHostMonotonicNs
              ? eventHostMonotonicNs - sampleHostMonotonicNs
              : sampleHostMonotonicNs - eventHostMonotonicNs,
          ) / 1e9,
      }];
    }));
  }

  #recordEvent(type, label, semantics, data) {
    if (!this.recording) throw new Error("Start recording before adding events.");
    const hostMonotonicNs = process.hrtime.bigint();
    const event = this.recording.recordEvent({
      type,
      label,
      semantics,
      data,
      streamProjection: this.#projection(hostMonotonicNs),
      hostMonotonicNs,
    });
    this.#broadcast("annotation", event);
    return event;
  }

  recordEvent(input) {
    if (!input || typeof input !== "object") {
      throw new Error("Event input is required.");
    }
    if (input.type === "calibration") {
      if (!CALIBRATION_LABELS.has(input.label)) {
        throw new Error("Unknown calibration stage.");
      }
      if (!["start", "end"].includes(input.semantics)) {
        throw new Error("Calibration semantics must be start or end.");
      }
      if (
        POST_SESSION_LABELS.has(input.label)
        && (
          this.completedGaitBoutCount === 0
          || this.gaitBoutActive
        )
      ) {
        throw new Error(
          "Complete a gait bout before starting a post-session quality check.",
        );
      }
      if (input.semantics === "start") {
        if (this.activeCalibration) {
          throw new Error("End the active calibration stage first.");
        }
        this.activeCalibration = input.label;
      } else if (this.activeCalibration !== input.label) {
        throw new Error("The selected calibration stage is not active.");
      } else {
        this.activeCalibration = null;
      }
      const movementMode =
        input.label === "left_knee_extension_flexion"
          ? this.setup.leftKneeMovementMode
          : input.label === "right_knee_extension_flexion"
            ? this.setup.rightKneeMovementMode
            : null;
      return this.#recordEvent(
        "calibration",
        input.label,
        input.semantics,
        movementMode ? { movementMode } : {},
      );
    }
    if (input.type === "gait_bout") {
      if (!["start", "end"].includes(input.semantics)) {
        throw new Error("Gait-bout semantics must be start or end.");
      }
      if (input.semantics === "start" && this.gaitBoutActive) {
        throw new Error("A gait bout is already active.");
      }
      if (input.semantics === "end" && !this.gaitBoutActive) {
        throw new Error("No gait bout is active.");
      }
      this.gaitBoutActive = input.semantics === "start";
      if (!this.gaitBoutActive) {
        this.completedGaitBoutCount += 1;
        this.currentPath = null;
      }
      return this.#recordEvent(
        "gait_bout",
        "flat_overground",
        input.semantics,
        { ...this.context },
      );
    }
    if (input.type === "path_segment") {
      if (!this.gaitBoutActive) throw new Error("Start a gait bout first.");
      if (!PATH_LABELS.has(input.label)) throw new Error("Unknown path segment.");
      this.currentPath = input.label;
      return this.#recordEvent("path_segment", input.label, "start", {});
    }
    if (input.type === "context_change") {
      this.context = validateContext(input);
      return this.#recordEvent(
        "context_change",
        input.label ?? "gait_context",
        "change",
        { ...this.context },
      );
    }
    if (input.type === "observation") {
      const label = typeof input.label === "string" ? input.label.trim() : "";
      if (!label || label.length > 100) {
        throw new Error("Observation label must contain 1 to 100 characters.");
      }
      const note = typeof input.note === "string" ? input.note.trim() : "";
      if (note.length > 200) throw new Error("Observation note is too long.");
      return this.#recordEvent(
        "observation",
        label,
        "point",
        { note },
      );
    }
    throw new Error("Unknown event type.");
  }

  async stopRecording() {
    if (!this.recording) throw new Error("No recording is active.");
    if (this.activeCalibration) {
      throw new Error("End the active calibration stage before finalizing.");
    }
    if (this.gaitBoutActive) {
      throw new Error("End the active gait bout before finalizing.");
    }
    this.#recordEvent("recording", "recording_stop", "end", {});
    const recording = this.recording;
    this.recording = null;
    this.lastFinalization = await recording.finalize();
    this.#broadcast("state", this.state);
    return this.lastFinalization;
  }

  async disconnect() {
    if (this.recording) {
      throw new Error("Stop and finalize the active recording before disconnecting.");
    }
    const sources = [...this.sources.values()];
    this.sources.clear();
    await Promise.all(sources.map((source) => source.stop()));
    this.roles = Object.fromEntries(ROLES.map((role) => [role, emptyRoleState()]));
    this.latestSamples.clear();
    this.setup = null;
    this.context = null;
    this.activeCalibration = null;
    this.gaitBoutActive = false;
    this.completedGaitBoutCount = 0;
    this.currentPath = null;
    this.#broadcast("state", this.state);
    return this.state;
  }

  async close() {
    clearInterval(this.flushTimer);
    if (this.recording) {
      const recording = this.recording;
      this.recording = null;
      recording.database.exec("COMMIT; PRAGMA wal_checkpoint(TRUNCATE)");
      recording.database.close();
    }
    const sources = [...this.sources.values()];
    this.sources.clear();
    await Promise.all(sources.map((source) => source.stop()));
    for (const client of this.clients) client.end();
    this.clients.clear();
  }
}
