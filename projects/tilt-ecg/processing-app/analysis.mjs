import { DatabaseSync } from "node:sqlite";

import {
  PanTompkinsDetector,
  TiltEstimator,
} from "../app/signal-processing.mjs";

const MINIMUM_RR_MS = 300;
const MAXIMUM_RR_MS = 2_000;

function mean(values) {
  if (!values.length) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function round(value, digits = 6) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function activeEvents(events) {
  const undone = new Set(
    events
      .filter((event) => event.type === "annotation_undo")
      .map((event) => event.data.targetEventId),
  );
  return events.filter((event) => !undone.has(event.id));
}

function phaseTime(events, label) {
  return events.find(
    (event) => event.type === "phase" && event.label === label,
  )?.relativeSeconds ?? null;
}

function interpolate(samples, timeSeconds, property) {
  if (!samples.length || timeSeconds < samples[0].timeSeconds) return null;
  if (timeSeconds > samples.at(-1).timeSeconds) return null;
  let low = 0;
  let high = samples.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (samples[middle].timeSeconds < timeSeconds) low = middle + 1;
    else high = middle - 1;
  }
  const right = samples[Math.min(samples.length - 1, low)];
  const left = samples[Math.max(0, low - 1)];
  if (right.timeSeconds === left.timeSeconds) return right[property];
  const fraction =
    (timeSeconds - left.timeSeconds)
    / (right.timeSeconds - left.timeSeconds);
  return left[property] + fraction * (right[property] - left[property]);
}

function windowMean(samples, start, end, property) {
  return mean(
    samples
      .filter((sample) => (
        sample.timeSeconds >= start && sample.timeSeconds <= end
      ))
      .map((sample) => sample[property])
      .filter(Number.isFinite),
  );
}

export function linearRegression(points) {
  if (points.length < 2) {
    return { slope: null, intercept: null, rSquared: null, count: points.length };
  }
  const xMean = mean(points.map((point) => point.x));
  const yMean = mean(points.map((point) => point.y));
  const denominator = points.reduce(
    (total, point) => total + (point.x - xMean) ** 2,
    0,
  );
  if (denominator <= Number.EPSILON) {
    return { slope: null, intercept: null, rSquared: null, count: points.length };
  }
  const numerator = points.reduce(
    (total, point) => total + (point.x - xMean) * (point.y - yMean),
    0,
  );
  const slope = numerator / denominator;
  const intercept = yMean - slope * xMean;
  const residualSum = points.reduce(
    (total, point) => total + (point.y - (slope * point.x + intercept)) ** 2,
    0,
  );
  const totalSum = points.reduce(
    (total, point) => total + (point.y - yMean) ** 2,
    0,
  );
  const rSquared = totalSum <= Number.EPSILON
    ? null
    : 1 - residualSum / totalSum;
  return {
    slope: round(slope),
    intercept: round(intercept),
    rSquared: round(rSquared),
    count: points.length,
  };
}

function parseDatabase(databasePath, manifest) {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const metadata = Object.fromEntries(
      database
        .prepare("SELECT key, value_json FROM recording_metadata")
        .all()
        .map((row) => [row.key, JSON.parse(row.value_json)]),
    );
    const events = activeEvents(
      database
        .prepare(`
          SELECT id, type, label, semantics, relative_seconds, data_json
          FROM events
          ORDER BY relative_seconds
        `)
        .all()
        .map((row) => ({
          id: row.id,
          type: row.type,
          label: row.label,
          semantics: row.semantics,
          relativeSeconds: row.relative_seconds,
          data: JSON.parse(row.data_json),
        })),
    );
    const ecgRows = database.prepare(`
      SELECT sensor_timestamp_ms, raw_value
      FROM ecg_samples
      ORDER BY sequence
    `).all();
    const imuRows = database.prepare(`
      SELECT
        sensor_timestamp_ms,
        acceleration_x,
        acceleration_y,
        acceleration_z,
        angular_velocity_x,
        angular_velocity_y,
        angular_velocity_z
      FROM imu_samples
      ORDER BY sequence
    `).all();
    if (!ecgRows.length || !imuRows.length) {
      throw new Error("The recording does not contain both ECG and IMU samples.");
    }

    const ecgStartMs = ecgRows[0].sensor_timestamp_ms;
    const detector = new PanTompkinsDetector(
      Number(metadata.sensor?.ecgRateHz ?? manifest.sensor?.ecgRateHz),
    );
    const rWaves = [];
    for (const row of ecgRows) {
      const result = detector.addSample(row.sensor_timestamp_ms, row.raw_value);
      if (result.rWave) rWaves.push(result.rWaveTimeMs);
    }

    const zero = metadata.acceptedSupineZero ?? manifest.acceptedSupineZero;
    const tiltEstimator = new TiltEstimator();
    tiltEstimator.zeroPitchDegrees = zero.pitchDegrees;
    tiltEstimator.zeroRollDegrees = zero.rollDegrees;
    const tiltSamples = imuRows.map((row) => {
      const estimate = tiltEstimator.addSample({
        timeMs: row.sensor_timestamp_ms,
        accelerationX: row.acceleration_x,
        accelerationY: row.acceleration_y,
        accelerationZ: row.acceleration_z,
        angularVelocityX: row.angular_velocity_x,
        angularVelocityY: row.angular_velocity_y,
        angularVelocityZ: row.angular_velocity_z,
      });
      return {
        timeSeconds: (row.sensor_timestamp_ms - ecgStartMs) / 1_000,
        rawTiltDegrees: estimate.tiltDegrees,
        rollDegrees: estimate.offAxisRollDegrees,
        quality: estimate.quality,
      };
    });
    const rrIntervals = [];
    for (let index = 1; index < rWaves.length; index += 1) {
      const rrMs = rWaves[index] - rWaves[index - 1];
      const midpointMs = (rWaves[index] + rWaves[index - 1]) / 2;
      const timeSeconds = (midpointMs - ecgStartMs) / 1_000;
      rrIntervals.push({
        id: `rr-${index}`,
        startTimeSeconds: (rWaves[index - 1] - ecgStartMs) / 1_000,
        endTimeSeconds: (rWaves[index] - ecgStartMs) / 1_000,
        timeSeconds,
        rrMs,
        rawTiltDegrees: interpolate(
          tiltSamples,
          timeSeconds,
          "rawTiltDegrees",
        ),
        automaticallyAccepted:
          rrMs >= MINIMUM_RR_MS && rrMs <= MAXIMUM_RR_MS,
      });
    }
    return {
      metadata,
      events,
      tiltSamples,
      rrIntervals,
      rWaveCount: rWaves.length,
      ecgSampleCount: ecgRows.length,
      imuSampleCount: imuRows.length,
      durationSeconds: metadata.durationSeconds ?? manifest.durationSeconds,
    };
  } finally {
    database.close();
  }
}

export function defaultReviewSettings(recording) {
  const beginTilt = phaseTime(recording.events, "begin_tilt") ?? 0;
  const targetReached = phaseTime(recording.events, "target_angle_reached");
  const earlyReturn = phaseTime(recording.events, "begin_return_early");
  const beginReturn = phaseTime(recording.events, "begin_return");
  const ascentEnd =
    targetReached ?? earlyReturn ?? beginReturn ?? recording.durationSeconds;
  const plateauEnd =
    beginReturn ?? phaseTime(recording.events, "supine_recovery")
    ?? recording.durationSeconds;
  const manifestAngle =
    recording.manifest.protocol?.achievedAngleDegrees
    ?? recording.manifest.protocol?.commandedTargetAngleDegrees
    ?? recording.metadata.commandedTargetAngleDegrees
    ?? null;
  return {
    achievedAngleDegrees: manifestAngle ?? 70,
    achievedAngleSource: manifestAngle === null
      ? "reviewer_confirmation_required"
      : "acquisition_record",
    baselineStartSeconds: Math.max(0, beginTilt - 30),
    baselineEndSeconds: Math.max(0, beginTilt - 5),
    plateauStartSeconds: targetReached ?? Math.max(beginTilt, ascentEnd - 10),
    plateauEndSeconds: Math.max(
      targetReached ?? beginTilt,
      plateauEnd,
    ),
    ascentStartSeconds: beginTilt,
    ascentEndSeconds: ascentEnd,
    minimumRrMs: MINIMUM_RR_MS,
    maximumRrMs: MAXIMUM_RR_MS,
    excludedIntervalIds: [],
  };
}

function validateSettings(settings, durationSeconds) {
  const numericKeys = [
    "achievedAngleDegrees",
    "baselineStartSeconds",
    "baselineEndSeconds",
    "plateauStartSeconds",
    "plateauEndSeconds",
    "ascentStartSeconds",
    "ascentEndSeconds",
    "minimumRrMs",
    "maximumRrMs",
  ];
  const normalized = {};
  for (const key of numericKeys) {
    normalized[key] = Number(settings[key]);
    if (!Number.isFinite(normalized[key])) {
      throw new Error(`${key} must be a finite number.`);
    }
  }
  if (
    normalized.achievedAngleDegrees <= 0
    || normalized.achievedAngleDegrees > 90
  ) {
    throw new Error("Achieved table angle must be greater than 0 and at most 90 degrees.");
  }
  for (const [startKey, endKey] of [
    ["baselineStartSeconds", "baselineEndSeconds"],
    ["plateauStartSeconds", "plateauEndSeconds"],
    ["ascentStartSeconds", "ascentEndSeconds"],
  ]) {
    if (
      normalized[startKey] < 0
      || normalized[endKey] > durationSeconds
      || normalized[startKey] >= normalized[endKey]
    ) {
      throw new Error(`${startKey} and ${endKey} define an invalid interval.`);
    }
  }
  if (
    normalized.minimumRrMs < 250
    || normalized.maximumRrMs > 3_000
    || normalized.minimumRrMs >= normalized.maximumRrMs
  ) {
    throw new Error("The accepted R-R range must be within 250–3000 ms.");
  }
  normalized.excludedIntervalIds = Array.isArray(settings.excludedIntervalIds)
    ? settings.excludedIntervalIds.filter((value) => typeof value === "string")
    : [];
  normalized.achievedAngleSource =
    settings.achievedAngleSource === "acquisition_record"
      ? "acquisition_record"
      : settings.achievedAngleSource === "reviewer_confirmed"
        ? "reviewer_confirmed"
        : "reviewer_confirmation_required";
  return normalized;
}

export function analyzeRecording(recording, inputSettings) {
  const settings = validateSettings(inputSettings, recording.durationSeconds);
  const baselineRawDegrees = windowMean(
    recording.tiltSamples,
    settings.baselineStartSeconds,
    settings.baselineEndSeconds,
    "rawTiltDegrees",
  );
  const plateauRawDegrees = windowMean(
    recording.tiltSamples,
    settings.plateauStartSeconds,
    settings.plateauEndSeconds,
    "rawTiltDegrees",
  );
  const rawSpanDegrees = plateauRawDegrees - baselineRawDegrees;
  const calibrationValid =
    Number.isFinite(rawSpanDegrees) && Math.abs(rawSpanDegrees) >= 10;
  const scaleFactor = calibrationValid
    ? settings.achievedAngleDegrees / rawSpanDegrees
    : null;
  const corrected = (rawTiltDegrees) => (
    calibrationValid && Number.isFinite(rawTiltDegrees)
      ? (rawTiltDegrees - baselineRawDegrees) * scaleFactor
      : null
  );
  const excluded = new Set(settings.excludedIntervalIds);
  const intervals = recording.rrIntervals.map((interval) => ({
    ...interval,
    correctedAngleDegrees: corrected(interval.rawTiltDegrees),
    accepted:
      interval.rrMs >= settings.minimumRrMs
      && interval.rrMs <= settings.maximumRrMs
      && !excluded.has(interval.id),
  }));
  const regressionPoints = intervals
    .filter((interval) => (
      interval.accepted
      && interval.timeSeconds >= settings.ascentStartSeconds
      && interval.timeSeconds <= settings.ascentEndSeconds
      && Number.isFinite(interval.correctedAngleDegrees)
    ))
    .map((interval) => ({
      id: interval.id,
      x: round(interval.correctedAngleDegrees, 4),
      y: round(interval.rrMs, 3),
      timeSeconds: round(interval.timeSeconds, 3),
    }));
  const regression = linearRegression(regressionPoints);
  const acceptedIntervals = intervals.filter((interval) => interval.accepted);
  const baselineIntervals = acceptedIntervals.filter((interval) => (
    interval.timeSeconds >= settings.baselineStartSeconds
    && interval.timeSeconds <= settings.baselineEndSeconds
  ));
  const timelineStride = Math.max(
    1,
    Math.ceil(recording.tiltSamples.length / 1_500),
  );
  const timeline = recording.tiltSamples
    .filter((_, index) => index % timelineStride === 0)
    .map((sample) => ({
      timeSeconds: round(sample.timeSeconds, 3),
      rawTiltDegrees: round(sample.rawTiltDegrees, 4),
      correctedAngleDegrees: round(corrected(sample.rawTiltDegrees), 4),
      rollDegrees: round(sample.rollDegrees, 4),
      quality: sample.quality,
    }));
  return {
    settings,
    calibration: {
      valid: calibrationValid,
      baselineRawDegrees: round(baselineRawDegrees, 4),
      plateauRawDegrees: round(plateauRawDegrees, 4),
      rawSpanDegrees: round(rawSpanDegrees, 4),
      achievedAngleDegrees: settings.achievedAngleDegrees,
      scaleFactor: round(scaleFactor, 6),
      source: settings.achievedAngleSource,
    },
    regression: {
      ...regression,
      scope: "ascending_tilt",
      xVariable: "corrected_table_angle_degrees",
      yVariable: "raw_accepted_rr_interval_ms",
      angleMinimum: regressionPoints.length
        ? round(Math.min(...regressionPoints.map((point) => point.x)), 3)
        : null,
      angleMaximum: regressionPoints.length
        ? round(Math.max(...regressionPoints.map((point) => point.x)), 3)
        : null,
      equation: regression.slope === null
        ? null
        : `R–R interval (ms) = ${regression.slope.toFixed(3)} × corrected angle (°) + ${regression.intercept.toFixed(3)}`,
    },
    quality: {
      detectedRWaveCount: recording.rWaveCount,
      rrIntervalCount: intervals.length,
      acceptedRrIntervalCount: acceptedIntervals.length,
      excludedRrIntervalCount: intervals.length - acceptedIntervals.length,
      acceptedPercent: intervals.length
        ? round(acceptedIntervals.length / intervals.length * 100, 2)
        : null,
    },
    summary: {
      baselineMeanRrMs: round(mean(
        baselineIntervals.map((interval) => interval.rrMs),
      ), 3),
      baselineMeanHeartRateBpm: baselineIntervals.length
        ? round(60_000 / mean(
          baselineIntervals.map((interval) => interval.rrMs),
        ), 3)
        : null,
    },
    regressionPoints,
    intervals: intervals.map((interval) => ({
      id: interval.id,
      timeSeconds: round(interval.timeSeconds, 3),
      rrMs: round(interval.rrMs, 3),
      correctedAngleDegrees: round(interval.correctedAngleDegrees, 4),
      accepted: interval.accepted,
    })),
    timeline,
    events: recording.events,
  };
}

export function loadRecordingData({ databasePath, manifest }) {
  return {
    ...parseDatabase(databasePath, manifest),
    manifest,
  };
}
