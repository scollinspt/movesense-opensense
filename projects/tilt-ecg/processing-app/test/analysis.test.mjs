import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeRecording,
  linearRegression,
} from "../analysis.mjs";

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
  const analysis = analyzeRecording(recording, {
    achievedAngleDegrees: 70,
    achievedAngleSource: "reviewer_confirmed",
    baselineStartSeconds: 0,
    baselineEndSeconds: 1,
    plateauStartSeconds: 99,
    plateauEndSeconds: 100,
    ascentStartSeconds: 0,
    ascentEndSeconds: 100,
    minimumRrMs: 300,
    maximumRrMs: 2_000,
    excludedIntervalIds: [],
  });

  assert.equal(analysis.calibration.valid, true);
  assert.ok(Math.abs(analysis.regression.slope + 2) < 0.05);
  assert.ok(analysis.regression.rSquared > 0.999);
  assert.equal(analysis.regression.count, 10);
  assert.equal(analysis.regression.scope, "ascending_tilt");
});

test("excludes reviewer-selected RR intervals from regression", () => {
  const recording = {
    durationSeconds: 20,
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
  const analysis = analyzeRecording(recording, {
    achievedAngleDegrees: 70,
    achievedAngleSource: "reviewer_confirmed",
    baselineStartSeconds: 0,
    baselineEndSeconds: 1,
    plateauStartSeconds: 19,
    plateauEndSeconds: 20,
    ascentStartSeconds: 0,
    ascentEndSeconds: 20,
    minimumRrMs: 300,
    maximumRrMs: 2_000,
    excludedIntervalIds: ["rr-2"],
  });

  assert.equal(analysis.regression.count, 2);
  assert.equal(analysis.quality.excludedRrIntervalCount, 1);
  assert.equal(
    analysis.intervals.find((interval) => interval.id === "rr-2").accepted,
    false,
  );
});
