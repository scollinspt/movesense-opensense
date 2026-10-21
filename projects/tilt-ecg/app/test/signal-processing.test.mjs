import assert from "node:assert/strict";
import test from "node:test";

import {
  FiveWaveHeartRate,
  PanTompkinsDetector,
  TiltEstimator,
} from "../signal-processing.mjs";

function gaussian(x, center, width, amplitude) {
  return amplitude * Math.exp(-0.5 * ((x - center) / width) ** 2);
}

function ecgValue(timeSeconds, bpm = 72) {
  const period = 60 / bpm;
  const phase = timeSeconds % period;
  return (
    gaussian(phase, period * 0.18, 0.025, 0.08)
    + gaussian(phase, period * 0.4, 0.008, -0.18)
    + gaussian(phase, period * 0.42, 0.012, 1.4)
    + gaussian(phase, period * 0.45, 0.012, -0.3)
    + gaussian(phase, period * 0.7, 0.05, 0.24)
    + 0.018 * Math.sin(2 * Math.PI * 0.3 * timeSeconds)
  );
}

test("computes heart rate from exactly five consecutive R waves", () => {
  const heartRate = new FiveWaveHeartRate();
  assert.equal(heartRate.addRWave(0), null);
  assert.equal(heartRate.addRWave(1000), null);
  assert.equal(heartRate.addRWave(2000), null);
  assert.equal(heartRate.addRWave(3000), null);
  const estimate = heartRate.addRWave(4000);

  assert.equal(estimate.bpm, 60);
  assert.equal(estimate.durationMs, 4000);
  assert.equal(estimate.accepted, true);
  assert.equal(heartRate.progress, 0);
});

test("streaming Pan-Tompkins detector recovers synthetic heart rate", () => {
  const detector = new PanTompkinsDetector(250);
  const heartRate = new FiveWaveHeartRate();
  const estimates = [];

  for (let index = 0; index < 5000; index += 1) {
    const timeMs = index * 4;
    const result = detector.addSample(timeMs, ecgValue(timeMs / 1000));
    if (result.rWave) {
      const estimate = heartRate.addRWave(result.rWaveTimeMs);
      if (estimate?.accepted) estimates.push(estimate);
    }
  }

  assert.ok(estimates.length >= 3);
  assert.ok(estimates.every((estimate) => Math.abs(estimate.bpm - 72) < 0.25));
});

test("detector recovers after a large startup artifact", () => {
  const detector = new PanTompkinsDetector(125);
  const heartRate = new FiveWaveHeartRate();
  const estimates = [];

  for (let index = 0; index < 2500; index += 1) {
    const timeMs = index * 8;
    const timeSeconds = timeMs / 1000;
    const startupArtifact =
      timeSeconds >= 1 && timeSeconds < 1.25
        ? 100 * Math.sin(2 * Math.PI * 12 * timeSeconds)
        : 0;
    const result = detector.addSample(
      timeMs,
      ecgValue(timeSeconds) + startupArtifact,
    );
    if (result.rWave) {
      const estimate = heartRate.addRWave(result.rWaveTimeMs);
      if (estimate?.accepted) estimates.push(estimate);
    }
  }

  assert.ok(estimates.length >= 2);
  assert.ok(Math.abs(estimates.at(-1).bpm - 72) < 1);
});

test("requires stable gravity before zero and reports known tilt", () => {
  const estimator = new TiltEstimator({ timeConstantSeconds: 0.05 });
  let result;
  for (let index = 0; index <= 150; index += 1) {
    result = estimator.addSample({
      timeMs: index * 20,
      accelerationX: 0,
      accelerationY: 0,
      accelerationZ: 9.80665,
      angularVelocityX: 0,
      angularVelocityY: 0,
      angularVelocityZ: 0,
    });
  }
  assert.equal(result.zeroReady, true);
  estimator.acceptZero();

  for (let index = 151; index <= 200; index += 1) {
    const angle = 30 * Math.PI / 180;
    result = estimator.addSample({
      timeMs: index * 20,
      accelerationX: 0,
      accelerationY: 9.80665 * Math.sin(angle),
      accelerationZ: 9.80665 * Math.cos(angle),
      angularVelocityX: 0,
      angularVelocityY: 0,
      angularVelocityZ: 0,
    });
  }
  assert.ok(Math.abs(result.tiltDegrees - 30) < 0.1);
  assert.ok(Math.abs(result.offAxisRollDegrees) < 0.01);
});
