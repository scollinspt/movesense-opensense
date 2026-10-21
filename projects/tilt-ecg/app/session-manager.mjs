import { EventEmitter } from "node:events";

import { TiltRecordingSession } from "./recording.mjs";
import { ProtocolPhaseTracker } from "./protocol-state.mjs";
import {
  FiveWaveHeartRate,
  PanTompkinsDetector,
  TiltEstimator,
} from "./signal-processing.mjs";
import {
  MovesenseBridgeSource,
  SyntheticSource,
  scanMovesense,
} from "./sources.mjs";

const PHASES = new Set([
  "baseline_supine",
  "begin_tilt",
  "target_angle_reached",
  "begin_return",
  "supine_recovery",
  "technical_interruption",
  "strap_sensor_adjustment",
]);

const SYMPTOMS = new Set([
  "presyncope",
  "dizziness",
  "vertigo",
  "palpitations",
  "pallor",
  "flushing",
  "cyanosis",
  "diaphoresis",
  "nausea",
  "visual_disturbance",
  "other",
]);

export class TiltSessionManager extends EventEmitter {
  constructor() {
    super();
    this.source = null;
    this.sensor = null;
    this.detector = null;
    this.heartRate = new FiveWaveHeartRate();
    this.tilt = new TiltEstimator();
    this.zero = null;
    this.recording = null;
    this.latestEcg = null;
    this.latestTilt = null;
    this.latestHeartRate = null;
    this.previousEcgQuality = "unavailable";
    this.phaseTracker = new ProtocolPhaseTracker();
    this.connectionState = "idle";
    this.errorMessage = null;
    this.ecgBatch = [];
    this.clients = new Set();
    this.flushTimer = setInterval(() => this.#flushLiveData(), 100);
  }

  get state() {
    return {
      connectionState: this.connectionState,
      sensor: this.sensor,
      zero: this.zero,
      zeroReady: this.latestTilt?.zeroReady ?? false,
      latestTilt: this.latestTilt,
      latestHeartRate: this.latestHeartRate,
      fiveWaveProgress: this.heartRate.progress,
      ecgQuality: this.latestEcg?.quality ?? "unavailable",
      protocolPhase: this.recording ? this.phaseTracker.state : null,
      recording: this.recording
        ? {
            recordingId: this.recording.recordingId,
            startedAt: this.recording.startedAt.toISOString(),
            ecgCount: this.recording.ecgCount,
            imuCount: this.recording.imuCount,
          }
        : null,
      errorMessage: this.errorMessage,
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

  #flushLiveData() {
    if (this.ecgBatch.length) {
      this.#broadcast("ecg", this.ecgBatch);
      this.ecgBatch = [];
    }
    if (this.source) this.#broadcast("state", this.state);
  }

  async scan() {
    return scanMovesense();
  }

  async connectSynthetic() {
    await this.disconnect();
    const source = new SyntheticSource();
    this.#attachSource(source, source.ecgRateHz);
    this.sensor = source.start();
    return this.state;
  }

  async connectHardware({ address, ecgRateHz = 512, imuRateHz = 26 }) {
    if (typeof address !== "string" || !address.trim()) {
      throw new Error("A Movesense address is required.");
    }
    await this.disconnect();
    const source = new MovesenseBridgeSource({
      address: address.trim(),
      ecgRateHz,
      imuRateHz,
    });
    this.#attachSource(source, ecgRateHz);
    this.sensor = source.start();
    return this.state;
  }

  #attachSource(source, ecgRateHz) {
    this.source = source;
    this.connectionState = "connecting";
    this.errorMessage = null;
    this.detector = new PanTompkinsDetector(ecgRateHz);
    this.heartRate = new FiveWaveHeartRate();
    this.tilt = new TiltEstimator();
    this.zero = null;
    this.previousEcgQuality = "unavailable";
    source.on("ecg", (sample) => this.#handleEcg(sample));
    source.on("imu", (sample) => this.#handleImu(sample));
    source.on("status", (status) => {
      this.connectionState = status.state;
      if (status.sensor) this.sensor = { ...this.sensor, ...status.sensor };
      this.#broadcast("state", this.state);
    });
    source.on("error", (error) => {
      this.errorMessage = error.message;
      this.connectionState = "error";
      this.#broadcast("state", this.state);
    });
  }

  #handleEcg(sample) {
    const result = this.detector.addSample(
      sample.sensorTimestampMs,
      sample.rawValue,
    );
    this.latestEcg = result;
    if (this.recording) this.recording.appendEcg(sample);
    let hrEstimate = null;
    if (result.quality === "poor" && this.previousEcgQuality !== "poor") {
      this.heartRate.reset();
    }
    if (result.rWave) {
      const completed = this.heartRate.addRWave(result.rWaveTimeMs);
      if (completed?.accepted) {
        hrEstimate = { ...completed, quality: result.quality };
        this.latestHeartRate = hrEstimate;
        if (this.recording) this.recording.addHrEstimate(hrEstimate);
      }
    }
    this.previousEcgQuality = result.quality;
    this.ecgBatch.push({
      timeMs: result.timeMs,
      value: result.rawValue,
      filteredValue: result.filteredValue,
      rWave: result.rWave,
      rWaveTimeMs: result.rWaveTimeMs,
      hrEstimate,
    });
  }

  #handleImu(sample) {
    const estimate = this.tilt.addSample({
      timeMs: sample.sensorTimestampMs,
      ...sample,
    });
    this.latestTilt = estimate;
    if (this.recording) {
      this.recording.appendImu(sample);
      this.recording.addTiltEstimate(estimate);
    }
  }

  acceptZero() {
    if (!this.latestTilt?.zeroReady) {
      throw new Error("The sensor is not yet stationary enough to accept supine zero.");
    }
    this.zero = this.tilt.acceptZero();
    this.#broadcast("state", this.state);
    return this.zero;
  }

  async startRecording({
    dataRoot,
    baselineSystolic,
    baselineDiastolic,
    baselineEtco2,
  }) {
    if (!this.source || this.connectionState !== "connected") {
      throw new Error("Connect a data source before starting the test.");
    }
    if (!this.zero) throw new Error("Accept the stable supine zero first.");
    if (this.recording) throw new Error("A test is already being recorded.");
    const numeric = [baselineSystolic, baselineDiastolic, baselineEtco2].map(Number);
    if (!numeric.every(Number.isFinite)) {
      throw new Error("Baseline systolic, diastolic, and etCO2 values are required.");
    }
    const [systolic, diastolic, etco2] = numeric;
    if (
      systolic < 40 || systolic > 260
      || diastolic < 20 || diastolic > 180
      || etco2 < 5 || etco2 > 100
    ) {
      throw new Error("One or more baseline observations are outside the allowed range.");
    }
    this.recording = await TiltRecordingSession.create({
      dataRoot,
      sensor: this.sensor,
      zero: this.zero,
      baselineBloodPressure: { systolic, diastolic },
      baselineEtco2: etco2,
      softwareVersion: "tilt-ecg-app-v0.1.0",
    });
    this.phaseTracker.reset();
    this.recording.recordEvent({
      type: "phase",
      label: "baseline_supine",
      data: {},
    });
    this.#broadcast("state", this.state);
    return this.state.recording;
  }

  recordEvent(input) {
    if (!this.recording) throw new Error("Start the test before adding annotations.");
    const type = input?.type;
    let event;
    if (type === "phase") {
      if (!PHASES.has(input.label)) throw new Error("Unknown test phase.");
      this.phaseTracker.assertNext(input.label);
      event = this.recording.recordEvent({
        type,
        label: input.label,
        semantics: "point",
      });
      this.phaseTracker.advance(input.label);
    } else if (type === "symptom") {
      if (!SYMPTOMS.has(input.label)) throw new Error("Unknown symptom.");
      if (!["onset", "resolution"].includes(input.semantics)) {
        throw new Error("Symptom semantics must be onset or resolution.");
      }
      event = this.recording.recordEvent({
        type,
        label: input.label,
        semantics: input.semantics,
      });
    } else if (type === "blood_pressure") {
      const systolic = Number(input.systolic);
      const diastolic = Number(input.diastolic);
      if (
        !Number.isFinite(systolic) || !Number.isFinite(diastolic)
        || systolic < 40 || systolic > 260
        || diastolic < 20 || diastolic > 180
      ) {
        throw new Error("Enter a valid systolic and diastolic blood pressure.");
      }
      event = this.recording.recordEvent({
        type,
        label: "blood_pressure_observation",
        data: { systolic, diastolic, unit: "mmHg" },
      });
    } else if (type === "etco2") {
      const value = Number(input.value);
      if (!Number.isFinite(value) || value < 5 || value > 100) {
        throw new Error("Enter a valid end-tidal CO2 observation.");
      }
      event = this.recording.recordEvent({
        type,
        label: "etco2_observation",
        data: { value, unit: "mmHg" },
      });
    } else if (type === "undo") {
      const target = [...this.recording.events]
        .reverse()
        .find((event) => (
          event.type !== "annotation_undo"
          && !(event.type === "phase" && event.label === "baseline_supine")
          && !this.recording.events.some(
            (candidate) => candidate.type === "annotation_undo"
              && candidate.data.targetEventId === event.id,
          )
        ));
      if (!target) throw new Error("There is no eligible annotation to undo.");
      event = this.recording.recordEvent({
        type: "annotation_undo",
        label: "undo",
        data: { targetEventId: target.id },
      });
      this.phaseTracker.rebuild(this.recording.events);
    } else {
      throw new Error("Unknown annotation type.");
    }
    this.#broadcast("state", this.state);
    return event;
  }

  async stopRecording() {
    if (!this.recording) throw new Error("No test is being recorded.");
    const recording = this.recording;
    this.recording = null;
    const result = await recording.stop();
    this.#broadcast("recording-complete", result);
    this.#broadcast("state", this.state);
    return result;
  }

  async disconnect() {
    if (this.recording) {
      throw new Error("End and finalize the active test before disconnecting.");
    }
    const source = this.source;
    this.source = null;
    if (source) await source.stop();
    this.connectionState = "idle";
    this.sensor = null;
    this.zero = null;
    this.latestEcg = null;
    this.latestTilt = null;
    this.latestHeartRate = null;
    this.previousEcgQuality = "unavailable";
    this.heartRate = new FiveWaveHeartRate();
    this.detector = null;
    this.phaseTracker.reset();
    this.ecgBatch = [];
    return this.state;
  }

  async close() {
    clearInterval(this.flushTimer);
    if (this.recording) await this.stopRecording();
    await this.disconnect();
    for (const client of this.clients) client.end();
    this.clients.clear();
  }
}
