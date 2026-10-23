import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeRecording,
  linearRegression,
} from "../analysis.mjs";

function settings(durationSeconds, overrides = {}) {
  return {
    achievedAngleDegrees: 70,
    achievedAngleSource: "reviewer_confirmed",
    baselineStartSeconds: 0,
    baselineEndSeconds: 1,
    plateauStartSeconds: durationSeconds - 1,
    plateauEndSeconds: durationSeconds,
    ascentStartSeconds: 0,
    ascentEndSeconds: durationSeconds,
    supineHrvStartSeconds: 0,
    supineHrvEndSeconds: 1,
    uprightHrvStartSeconds: 1,
    uprightHrvEndSeconds: 2,
    recoveryHrvStartSeconds: durationSeconds - 1,
    recoveryHrvEndSeconds: durationSeconds,
    minimumRrMs: 300,
    maximumRrMs: 2_000,
    orthostaticHrThresholdBpm: 30,
    orthostaticAssessmentSeconds: 600,
    sustainedHrWindowSeconds: 30,
    frequencyDomainMode: "exclude",
    minimumHfSeconds: 90,
    minimumLfSeconds: 300,
    minimumAcceptedNnPercent: 95,
    maximumExcludedNnPercent: 5,
    requireStationarity: true,
    maximumStationaryAngleRangeDegrees: 5,
    frequencyEligibilityOverride: false,
    frequencyOverrideRationale: "",
    excludedIntervalIds: [],
    ...overrides,
  };
}

test("computes an ordinary least-squares line", () => {
  const result = linearRegression([
    { x: 0, y: 900 },
    { x: 10, y: 880 },
    { x: 20, y: 860 },
    { x: 30, y: 840 },
  ]);

  assert.equal(result.slope, -2);
  assert.equal(result.intercept, 900);
  assert.equal(result.rSquared, 1);
  assert.equal(result.count, 4);
});

test("fits raw RR intervals against corrected angle during ascent only", () => {
  const tiltSamples = Array.from({ length: 101 }, (_, timeSeconds) => ({
    timeSeconds,
    rawTiltDegrees: timeSeconds * 0.8 - 2,
    rollDegrees: 0,
    quality: "good",
  }));
  const rrIntervals = Array.from({ length: 10 }, (_, index) => {
    const timeSeconds = index * 10 + 5;
    const correctedAngle = timeSeconds / 100 * 70;
    return {
      id: `rr-${index}`,
      timeSeconds,
      rrMs: 900 - 2 * correctedAngle,
      rawTiltDegrees: timeSeconds * 0.8 - 2,
      automaticallyAccepted: true,
    };
  });
  const recording = {
    durationSeconds: 100,
    metadata: {},
    rWaveCount: 11,
    tiltSamples,
    rrIntervals,
    events: [
      {
        id: "begin",
        type: "phase",
        label: "begin_tilt",
        semantics: "phase",
        relativeSeconds: 0,
        data: {},
      },
      {
        id: "target",
        type: "phase",
        label: "target_angle_reached",
        semantics: "phase",
        relativeSeconds: 100,
        data: {},
      },
    ],
  };
  const analysis = analyzeRecording(recording, settings(100));

  assert.equal(analysis.calibration.valid, true);
  assert.ok(Math.abs(analysis.regression.slope + 2) < 0.05);
  assert.ok(analysis.regression.rSquared > 0.999);
  assert.equal(analysis.regression.count, 10);
  assert.equal(analysis.regression.scope, "ascending_tilt");
});

test("excludes reviewer-selected RR intervals from regression", () => {
  const recording = {
    durationSeconds: 20,
    metadata: {},
    rWaveCount: 4,
    tiltSamples: [
      { timeSeconds: 0, rawTiltDegrees: 0, rollDegrees: 0, quality: "good" },
      { timeSeconds: 10, rawTiltDegrees: 35, rollDegrees: 0, quality: "good" },
      { timeSeconds: 20, rawTiltDegrees: 70, rollDegrees: 0, quality: "good" },
    ],
    rrIntervals: [
      { id: "rr-1", timeSeconds: 5, rrMs: 850, rawTiltDegrees: 17.5 },
      { id: "rr-2", timeSeconds: 10, rrMs: 780, rawTiltDegrees: 35 },
      { id: "rr-3", timeSeconds: 15, rrMs: 710, rawTiltDegrees: 52.5 },
    ],
    events: [],
  };
  const analysis = analyzeRecording(recording, settings(20, {
    excludedIntervalIds: ["rr-2"],
  }));

  assert.equal(analysis.regression.count, 2);
  assert.equal(analysis.quality.excludedRrIntervalCount, 1);
  assert.equal(
    analysis.intervals.find((interval) => interval.id === "rr-2").accepted,
    false,
  );
});

test("gates HF and LF by independent duration requirements", () => {
  const durationSeconds = 400;
  const tiltSamples = Array.from({ length: 401 }, (_, timeSeconds) => ({
    timeSeconds,
    rawTiltDegrees: timeSeconds < 399 ? 0 : 70,
    rollDegrees: 0,
    quality: "good",
  }));
  const rrIntervals = Array.from({ length: 390 }, (_, index) => {
    const timeSeconds = index + 5;
    return {
      id: `rr-${index}`,
      timeSeconds,
      rrMs: 800 + 30 * Math.sin(index / 8),
      rawTiltDegrees: timeSeconds < 399 ? 0 : 70,
    };
  });
  const recording = {
    durationSeconds,
    metadata: {},
    rWaveCount: 391,
    tiltSamples,
    rrIntervals,
    events: [],
  };
  const short = analyzeRecording(recording, settings(durationSeconds, {
    supineHrvStartSeconds: 5,
    supineHrvEndSeconds: 100,
    frequencyDomainMode: "automatic",
    requireStationarity: false,
  })).hrv.segments[0];

  assert.equal(short.eligibility.hfEligible, true);
  assert.equal(short.eligibility.lfEligible, false);
  assert.ok(Number.isFinite(short.frequency.hfPowerMs2));
  assert.equal(short.frequency.lfPowerMs2, null);

  const long = analyzeRecording(recording, settings(durationSeconds, {
    supineHrvStartSeconds: 5,
    supineHrvEndSeconds: 355,
    frequencyDomainMode: "automatic",
    requireStationarity: false,
  })).hrv.segments[0];

  assert.equal(long.eligibility.hfEligible, true);
  assert.equal(long.eligibility.lfEligible, true);
  assert.ok(Number.isFinite(long.frequency.hfPowerMs2));
  assert.ok(Number.isFinite(long.frequency.lfPowerMs2));
  assert.ok(Number.isFinite(long.frequency.lfHfRatio));

  assert.throws(
    () => analyzeRecording(recording, settings(durationSeconds, {
      frequencyDomainMode: "automatic",
      frequencyEligibilityOverride: true,
      frequencyOverrideRationale: "",
    })),
    /rationale is required/,
  );
  const overridden = analyzeRecording(recording, settings(durationSeconds, {
    supineHrvStartSeconds: 5,
    supineHrvEndSeconds: 100,
    frequencyDomainMode: "automatic",
    frequencyEligibilityOverride: true,
    frequencyOverrideRationale: "Development validation",
  })).hrv.segments[0];
  assert.equal(overridden.eligibility.overrideApplied, true);
  assert.equal(overridden.eligibility.lfEligible, true);
});
