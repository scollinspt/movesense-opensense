const STANDARD_GRAVITY = 9.80665;

function magnitude(values) {
  return Math.hypot(...values);
}

function mean(values) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function standardDeviation(values) {
  if (!values.length) return Number.NaN;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

export class FiveWaveHeartRate {
  constructor({ minimumBpm = 25, maximumBpm = 240 } = {}) {
    this.minimumBpm = minimumBpm;
    this.maximumBpm = maximumBpm;
    this.waveTimesMs = [];
    this.lastEstimate = null;
  }

  reset() {
    this.waveTimesMs = [];
  }

  addRWave(timeMs) {
    if (!Number.isFinite(timeMs)) {
      throw new TypeError("R-wave time must be finite.");
    }
    if (this.waveTimesMs.length && timeMs <= this.waveTimesMs.at(-1)) {
      throw new RangeError("R-wave times must be strictly increasing.");
    }
    this.waveTimesMs.push(timeMs);
    if (this.waveTimesMs.length < 5) return null;
    const durationMs = this.waveTimesMs[4] - this.waveTimesMs[0];
    const bpm = 240_000 / durationMs;
    const estimate = {
      timeMs,
      bpm,
      durationMs,
      accepted: bpm >= this.minimumBpm && bpm <= this.maximumBpm,
      waveTimesMs: [...this.waveTimesMs],
    };
    this.waveTimesMs = [];
    if (estimate.accepted) this.lastEstimate = estimate;
    return estimate;
  }

  get progress() {
    return this.waveTimesMs.length;
  }
}

export class PanTompkinsDetector {
  constructor(sampleRateHz) {
    if (!Number.isFinite(sampleRateHz) || sampleRateHz < 50) {
      throw new RangeError("ECG sample rate must be at least 50 Hz.");
    }
    this.sampleRateHz = sampleRateHz;
    this.samplePeriodMs = 1000 / sampleRateHz;
    this.lowPassAlpha = this.#alpha(15);
    this.highPassAlpha = this.#highPassAlpha(5);
    this.integrationLength = Math.max(3, Math.round(0.15 * sampleRateHz));
    this.refractoryMs = 250;
    this.warmupSamples = Math.round(2 * sampleRateHz);
    this.reset();
  }

  #alpha(cutoffHz) {
    const dt = 1 / this.sampleRateHz;
    const rc = 1 / (2 * Math.PI * cutoffHz);
    return dt / (rc + dt);
  }

  #highPassAlpha(cutoffHz) {
    const dt = 1 / this.sampleRateHz;
    const rc = 1 / (2 * Math.PI * cutoffHz);
    return rc / (rc + dt);
  }

  reset() {
    this.sampleCount = 0;
    this.previousRaw = 0;
    this.highPass = 0;
    this.lowPass = 0;
    this.previousFiltered = 0;
    this.integrationValues = [];
    this.integrationSum = 0;
    this.previousIntegrated2 = 0;
    this.previousIntegrated1 = 0;
    this.previousTime1 = null;
    this.signalPeak = 0;
    this.noisePeak = 0;
    this.threshold = 0;
    this.lastRWaveMs = Number.NEGATIVE_INFINITY;
    this.lastAcceptedPeak = 0;
    this.recentAbsolute = [];
  }

  addSample(timeMs, rawValue) {
    if (!Number.isFinite(timeMs) || !Number.isFinite(rawValue)) {
      throw new TypeError("ECG sample time and value must be finite.");
    }
    this.sampleCount += 1;
    this.highPass = this.highPassAlpha
      * (this.highPass + rawValue - this.previousRaw);
    this.previousRaw = rawValue;
    this.lowPass += this.lowPassAlpha * (this.highPass - this.lowPass);
    const derivative = (this.lowPass - this.previousFiltered) * this.sampleRateHz;
    this.previousFiltered = this.lowPass;
    const squared = derivative * derivative;
    this.integrationValues.push(squared);
    this.integrationSum += squared;
    if (this.integrationValues.length > this.integrationLength) {
      this.integrationSum -= this.integrationValues.shift();
    }
    const integrated = this.integrationSum / this.integrationValues.length;
    this.recentAbsolute.push(Math.abs(this.lowPass));
    if (this.recentAbsolute.length > this.sampleRateHz * 2) {
      this.recentAbsolute.shift();
    }

    let rWave = false;
    let rWaveTimeMs = null;
    const candidateIsPeak =
      this.previousIntegrated1 > this.previousIntegrated2
      && this.previousIntegrated1 >= integrated;
    if (candidateIsPeak && this.previousTime1 !== null) {
      const candidate = this.previousIntegrated1;
      const warmedUp = this.sampleCount > this.warmupSamples;
      const outsideRefractory =
        this.previousTime1 - this.lastRWaveMs >= this.refractoryMs;
      if (warmedUp && candidate > this.threshold && outsideRefractory) {
        this.signalPeak = this.signalPeak
          ? 0.125 * candidate + 0.875 * this.signalPeak
          : candidate;
        this.lastRWaveMs = this.previousTime1;
        this.lastAcceptedPeak = candidate;
        rWave = true;
        rWaveTimeMs = this.previousTime1;
      } else {
        this.noisePeak = this.noisePeak
          ? 0.125 * candidate + 0.875 * this.noisePeak
          : candidate;
      }
      this.threshold = this.noisePeak + 0.25 * (this.signalPeak - this.noisePeak);
    }
    if (this.sampleCount <= this.warmupSamples && integrated > this.signalPeak) {
      this.signalPeak = integrated;
      this.threshold = Math.max(this.threshold, integrated * 0.3);
    }

    this.previousIntegrated2 = this.previousIntegrated1;
    this.previousIntegrated1 = integrated;
    this.previousTime1 = timeMs;
    const amplitude = this.recentAbsolute.length
      ? Math.max(...this.recentAbsolute) - Math.min(...this.recentAbsolute)
      : 0;
    const quality =
      this.sampleCount <= this.warmupSamples
        ? "warming"
        : amplitude < 0.02 || timeMs - this.lastRWaveMs > 3000
          ? "poor"
          : "good";
    return {
      timeMs,
      rawValue,
      filteredValue: this.lowPass,
      integratedValue: integrated,
      rWave,
      rWaveTimeMs,
      quality,
      threshold: this.threshold,
    };
  }
}

export class TiltEstimator {
  constructor({ timeConstantSeconds = 0.35 } = {}) {
    this.timeConstantSeconds = timeConstantSeconds;
    this.filtered = null;
    this.lastTimeMs = null;
    this.zeroPitchDegrees = null;
    this.zeroRollDegrees = null;
    this.stationaryWindow = [];
  }

  addSample(sample) {
    const acceleration = [
      sample.accelerationX,
      sample.accelerationY,
      sample.accelerationZ,
    ];
    const angularVelocity = [
      sample.angularVelocityX,
      sample.angularVelocityY,
      sample.angularVelocityZ,
    ];
    if (![...acceleration, ...angularVelocity, sample.timeMs].every(Number.isFinite)) {
      throw new TypeError("IMU sample values must be finite.");
    }
    const dt = this.lastTimeMs === null
      ? 0
      : Math.max(0.001, (sample.timeMs - this.lastTimeMs) / 1000);
    this.lastTimeMs = sample.timeMs;
    if (!this.filtered) {
      this.filtered = [...acceleration];
    } else {
      const alpha = dt / (this.timeConstantSeconds + dt);
      this.filtered = this.filtered.map(
        (value, index) => value + alpha * (acceleration[index] - value),
      );
    }
    const accelerationMagnitude = magnitude(acceleration);
    const gyroscopeMagnitude = magnitude(angularVelocity);
    this.stationaryWindow.push({
      timeMs: sample.timeMs,
      accelerationMagnitude,
      gyroscopeMagnitude,
    });
    while (
      this.stationaryWindow.length
      && sample.timeMs - this.stationaryWindow[0].timeMs > 3000
    ) {
      this.stationaryWindow.shift();
    }
    const pitch = Math.atan2(
      this.filtered[1],
      this.filtered[2],
    ) * 180 / Math.PI;
    const roll = Math.atan2(
      this.filtered[0],
      Math.hypot(this.filtered[1], this.filtered[2]),
    ) * 180 / Math.PI;
    const zeroReady =
      this.stationaryWindow.length >= 20
      && sample.timeMs - this.stationaryWindow[0].timeMs >= 2800
      && Math.abs(mean(
        this.stationaryWindow.map((value) => value.accelerationMagnitude),
      ) - STANDARD_GRAVITY) <= 1
      && standardDeviation(
        this.stationaryWindow.map((value) => value.accelerationMagnitude),
      ) <= 0.12
      && mean(
        this.stationaryWindow.map((value) => value.gyroscopeMagnitude),
      ) <= 8;
    const tiltDegrees = this.zeroPitchDegrees === null
      ? null
      : pitch - this.zeroPitchDegrees;
    const rollDegrees = this.zeroRollDegrees === null
      ? null
      : roll - this.zeroRollDegrees;
    return {
      timeMs: sample.timeMs,
      pitchDegrees: pitch,
      rollDegrees: roll,
      tiltDegrees,
      offAxisRollDegrees: rollDegrees,
      accelerationMagnitude,
      gyroscopeMagnitude,
      zeroReady,
      quality:
        Math.abs(accelerationMagnitude - STANDARD_GRAVITY) <= 1.5
          ? "good"
          : "dynamic",
    };
  }

  acceptZero() {
    if (!this.filtered || !this.lastTimeMs) {
      throw new Error("No stable IMU data are available for zeroing.");
    }
    this.zeroPitchDegrees = Math.atan2(
      this.filtered[1],
      this.filtered[2],
    ) * 180 / Math.PI;
    this.zeroRollDegrees = Math.atan2(
      this.filtered[0],
      Math.hypot(this.filtered[1], this.filtered[2]),
    ) * 180 / Math.PI;
    return {
      acceptedAtTimeMs: this.lastTimeMs,
      accelerationVector: [...this.filtered],
      pitchDegrees: this.zeroPitchDegrees,
      rollDegrees: this.zeroRollDegrees,
    };
  }
}
