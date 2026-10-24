import { DatabaseSync } from "node:sqlite";

import {
  PanTompkinsDetector,
  TiltEstimator,
} from "../app/signal-processing.mjs";
import { buildClinicReport } from "./clinic-report.mjs";

const MINIMUM_RR_MS = 300;
const MAXIMUM_RR_MS = 2_000;

function mean(values) {
  if (!values.length) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function sampleStandardDeviation(values) {
  if (values.length < 2) return null;
  const average = mean(values);
  return Math.sqrt(
    values.reduce(
      (total, value) => total + (value - average) ** 2,
      0,
    ) / (values.length - 1),
  );
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
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

function recentValue(values, timeSeconds) {
  return values
    .filter((value) => value.timeSeconds <= timeSeconds)
    .at(-1) ?? null;
}

function highestPowerOfTwoAtMost(value) {
  if (value < 1) return 0;
  return 2 ** Math.floor(Math.log2(value));
}

function frequencyDomain(intervals, eligibility) {
  if (!eligibility.hfEligible && !eligibility.lfEligible) return null;
  if (intervals.length < 3) return null;
  const sampleRateHz = 4;
  const start = intervals[0].timeSeconds;
  const end = intervals.at(-1).timeSeconds;
  const sampleCount = Math.floor((end - start) * sampleRateHz) + 1;
  const resampled = Array.from({ length: sampleCount }, (_, index) => {
    const timeSeconds = start + index / sampleRateHz;
    return interpolate(intervals, timeSeconds, "rrMs");
  }).filter(Number.isFinite);
  const segmentLength = Math.min(
    1_024,
    highestPowerOfTwoAtMost(resampled.length),
  );
  if (segmentLength < 128) return null;
  const step = Math.max(1, segmentLength / 2);
  const spectrum = new Map();
  let segmentCount = 0;
  const windowPower = Array.from({ length: segmentLength }, (_, index) => (
    0.5 - 0.5 * Math.cos(2 * Math.PI * index / (segmentLength - 1))
  ));
  const windowNormalization = windowPower.reduce(
    (total, value) => total + value ** 2,
    0,
  );
  const frequencyResolution = sampleRateHz / segmentLength;
  const firstBin = Math.ceil(0.04 / frequencyResolution);
  const lastBin = Math.floor(0.4 / frequencyResolution);
  for (
    let offset = 0;
    offset + segmentLength <= resampled.length;
    offset += step
  ) {
    const segment = resampled.slice(offset, offset + segmentLength);
    const segmentMean = mean(segment);
    for (let bin = firstBin; bin <= lastBin; bin += 1) {
      let real = 0;
      let imaginary = 0;
      for (let index = 0; index < segmentLength; index += 1) {
        const value = (segment[index] - segmentMean) * windowPower[index];
        const angle = 2 * Math.PI * bin * index / segmentLength;
        real += value * Math.cos(angle);
        imaginary -= value * Math.sin(angle);
      }
      const density =
        2 * (real ** 2 + imaginary ** 2)
        / (sampleRateHz * windowNormalization);
      spectrum.set(bin, (spectrum.get(bin) ?? 0) + density);
    }
    segmentCount += 1;
  }
  if (!segmentCount) return null;
  let lfPower = 0;
  let hfPower = 0;
  for (const [bin, accumulated] of spectrum) {
    const frequency = bin * frequencyResolution;
    const power = accumulated / segmentCount * frequencyResolution;
    if (frequency >= 0.04 && frequency < 0.15) lfPower += power;
    if (frequency >= 0.15 && frequency <= 0.4) hfPower += power;
  }
  return {
    method: "4 Hz interpolation; mean detrending; Hann-window Welch periodogram",
    sampleRateHz,
    segmentLengthSamples: segmentLength,
    segmentLengthSeconds: segmentLength / sampleRateHz,
    segmentCount,
    frequencyResolutionHz: round(frequencyResolution, 6),
    lfPowerMs2: eligibility.lfEligible ? round(lfPower, 3) : null,
    hfPowerMs2: eligibility.hfEligible ? round(hfPower, 3) : null,
    lfHfRatio:
      eligibility.lfEligible && eligibility.hfEligible && hfPower > 0
        ? round(lfPower / hfPower, 4)
        : null,
  };
}

function hrvSegment({
  name,
  startSeconds,
  endSeconds,
  intervals,
  timeline,
  settings,
}) {
  const candidates = intervals.filter((interval) => (
    interval.timeSeconds >= startSeconds && interval.timeSeconds <= endSeconds
  ));
  const accepted = candidates.filter((interval) => interval.accepted);
  const nn = accepted.map((interval) => interval.rrMs);
  const successivePairs = [];
  for (let index = 1; index < candidates.length; index += 1) {
    if (!candidates[index - 1].accepted || !candidates[index].accepted) continue;
    successivePairs.push({
      x: candidates[index - 1].rrMs,
      y: candidates[index].rrMs,
    });
  }
  const differences = successivePairs.map((pair) => pair.y - pair.x);
  const sdnn = sampleStandardDeviation(nn);
  const differenceSd = sampleStandardDeviation(differences);
  const sd1 = Number.isFinite(differenceSd)
    ? Math.sqrt(0.5) * differenceSd
    : null;
  const sd2 =
    Number.isFinite(sdnn) && Number.isFinite(differenceSd)
      ? Math.sqrt(Math.max(0, 2 * sdnn ** 2 - 0.5 * differenceSd ** 2))
      : null;
  const segmentAngles = timeline
    .filter((sample) => (
      sample.timeSeconds >= startSeconds && sample.timeSeconds <= endSeconds
    ))
    .map((sample) => sample.correctedAngleDegrees)
    .filter(Number.isFinite);
  const robustAngleRange = segmentAngles.length
    ? percentile(segmentAngles, 0.95) - percentile(segmentAngles, 0.05)
    : null;
  const durationSeconds = endSeconds - startSeconds;
  const acceptedPercent = candidates.length
    ? accepted.length / candidates.length * 100
    : 0;
  const excludedPercent = 100 - acceptedPercent;
  const stationary =
    Number.isFinite(robustAngleRange)
    && robustAngleRange <= settings.maximumStationaryAngleRangeDegrees;
  const qualityEligible =
    acceptedPercent >= settings.minimumAcceptedNnPercent
    && excludedPercent <= settings.maximumExcludedNnPercent
    && (!settings.requireStationarity || stationary);
  const frequencyRequested = settings.frequencyDomainMode !== "exclude";
  const override = settings.frequencyEligibilityOverride;
  const hfDurationEligible = durationSeconds >= settings.minimumHfSeconds;
  const lfDurationEligible = durationSeconds >= settings.minimumLfSeconds;
  const hfEligible =
    frequencyRequested && ((hfDurationEligible && qualityEligible) || override);
  const lfEligible =
    frequencyRequested && ((lfDurationEligible && qualityEligible) || override);
  const eligibility = {
    frequencyRequested,
    qualityEligible,
    stationary,
    robustAngleRangeDegrees: round(robustAngleRange, 3),
    acceptedPercent: round(acceptedPercent, 2),
    excludedPercent: round(excludedPercent, 2),
    hfDurationEligible,
    lfDurationEligible,
    hfEligible,
    lfEligible,
    overrideApplied: override,
    overrideRationale: override ? settings.frequencyOverrideRationale : null,
    reasons: [
      ...(!frequencyRequested ? ["Frequency-domain HRV excluded by reviewer."] : []),
      ...(!hfDurationEligible
        ? [`HF requires ${settings.minimumHfSeconds} seconds; segment has ${round(durationSeconds, 1)} seconds.`]
        : []),
      ...(!lfDurationEligible
        ? [`LF requires ${settings.minimumLfSeconds} seconds; segment has ${round(durationSeconds, 1)} seconds.`]
        : []),
      ...(acceptedPercent < settings.minimumAcceptedNnPercent
        ? [`Accepted NN percentage is ${round(acceptedPercent, 1)}%; minimum is ${settings.minimumAcceptedNnPercent}%.`]
        : []),
      ...(excludedPercent > settings.maximumExcludedNnPercent
        ? [`Excluded NN percentage is ${round(excludedPercent, 1)}%; maximum is ${settings.maximumExcludedNnPercent}%.`]
        : []),
      ...(settings.requireStationarity && !stationary
        ? [`Corrected-angle 5th–95th percentile range is ${round(robustAngleRange, 1)}°; maximum is ${settings.maximumStationaryAngleRangeDegrees}°.`]
        : []),
    ],
  };
  return {
    name,
    startSeconds: round(startSeconds, 3),
    endSeconds: round(endSeconds, 3),
    durationSeconds: round(durationSeconds, 3),
    candidateNnCount: candidates.length,
    acceptedNnCount: accepted.length,
    metrics: {
      meanNnMs: round(mean(nn), 3),
      medianNnMs: round(median(nn), 3),
      meanHeartRateBpm: nn.length ? round(60_000 / mean(nn), 3) : null,
      sdnnMs: round(sdnn, 3),
      rmssdMs: differences.length
        ? round(Math.sqrt(mean(differences.map((value) => value ** 2))), 3)
        : null,
      pnn50Percent: differences.length
        ? round(
          differences.filter((value) => Math.abs(value) > 50).length
          / differences.length * 100,
          3,
        )
        : null,
      sd1Ms: round(sd1, 3),
      sd2Ms: round(sd2, 3),
      sd1Sd2Ratio:
        Number.isFinite(sd1) && Number.isFinite(sd2) && sd2 > 0
          ? round(sd1 / sd2, 4)
          : null,
    },
    poincarePoints: successivePairs.map((pair) => ({
      x: round(pair.x, 3),
      y: round(pair.y, 3),
    })),
    eligibility,
    frequency: frequencyDomain(accepted, eligibility),
  };
}

function maximumSustainedHeartRate(intervals, windowSeconds) {
  let best = null;
  for (const interval of intervals) {
    const end = interval.timeSeconds + windowSeconds;
    const values = intervals.filter((candidate) => (
      candidate.timeSeconds >= interval.timeSeconds
      && candidate.timeSeconds <= end
    ));
    if (
      values.length < 3
      || values.at(-1).timeSeconds - values[0].timeSeconds
        < windowSeconds * 0.8
    ) continue;
    const average = mean(values.map((value) => value.heartRateBpm));
    if (!best || average > best.heartRateBpm) {
      best = {
        heartRateBpm: average,
        startSeconds: interval.timeSeconds,
        endSeconds: values.at(-1).timeSeconds,
      };
    }
  }
  return best;
}

function clinicalAnalysis({
  recording,
  intervals,
  timeline,
  settings,
  baselineIntervals,
  hrRegression,
}) {
  const accepted = intervals.filter((interval) => interval.accepted);
  const baselineHeartRates = baselineIntervals.map(
    (interval) => interval.heartRateBpm,
  );
  const baselineMedianHeartRate = median(baselineHeartRates);
  const uprightStartSeconds = settings.ascentEndSeconds;
  const returnTime =
    phaseTime(recording.events, "begin_return")
    ?? phaseTime(recording.events, "begin_return_early")
    ?? phaseTime(recording.events, "supine_recovery")
    ?? recording.durationSeconds;
  const uprightEndSeconds = Math.max(uprightStartSeconds, returnTime);
  const uprightIntervals = accepted.filter((interval) => (
    interval.timeSeconds >= uprightStartSeconds
    && interval.timeSeconds <= uprightEndSeconds
  ));
  const assessmentIntervals = accepted.filter((interval) => (
    interval.timeSeconds >= uprightStartSeconds
    && interval.timeSeconds <= Math.min(
      uprightEndSeconds,
      uprightStartSeconds + settings.orthostaticAssessmentSeconds,
    )
  ));
  const sustained = maximumSustainedHeartRate(
    assessmentIntervals,
    settings.sustainedHrWindowSeconds,
  );
  const peak = uprightIntervals.length
    ? uprightIntervals.reduce(
      (best, interval) => (
        interval.heartRateBpm > best.heartRateBpm ? interval : best
      ),
    )
    : null;
  const uprightDurationSeconds = uprightEndSeconds - uprightStartSeconds;
  const sustainedDelta = sustained && Number.isFinite(baselineMedianHeartRate)
    ? sustained.heartRateBpm - baselineMedianHeartRate
    : null;
  const orthostaticThresholdObserved =
    Number.isFinite(sustainedDelta)
    && sustainedDelta >= settings.orthostaticHrThresholdBpm;
  const orthostaticAssessable =
    Number.isFinite(baselineMedianHeartRate)
    && sustained !== null
    && (
      orthostaticThresholdObserved
      || uprightDurationSeconds >= settings.orthostaticAssessmentSeconds
    );

  const heartRateAt = (timeSeconds) => interpolate(
    accepted,
    timeSeconds,
    "heartRateBpm",
  );
  const angleAt = (timeSeconds) => interpolate(
    timeline,
    timeSeconds,
    "correctedAngleDegrees",
  );
  const baselineBp = recording.metadata.baselineBloodPressure ?? null;
  const bloodPressure = recording.events
    .filter((event) => event.type === "blood_pressure")
    .map((event) => ({
      timeSeconds: event.relativeSeconds,
      systolic: Number(event.data.systolic),
      diastolic: Number(event.data.diastolic),
      systolicChange: baselineBp
        ? Number(event.data.systolic) - baselineBp.systolic
        : null,
      diastolicChange: baselineBp
        ? Number(event.data.diastolic) - baselineBp.diastolic
        : null,
      correctedAngleDegrees: angleAt(event.relativeSeconds),
      heartRateBpm: heartRateAt(event.relativeSeconds),
    }));
  const earlyUprightBp = bloodPressure.filter((observation) => (
    observation.timeSeconds >= uprightStartSeconds
    && observation.timeSeconds <= Math.min(
      uprightEndSeconds,
      uprightStartSeconds + 180,
    )
  ));
  const maximumSystolicDrop =
    baselineBp && earlyUprightBp.length
      ? Math.max(0, ...earlyUprightBp.map(
        (observation) => baselineBp.systolic - observation.systolic,
      ))
      : null;
  const maximumDiastolicDrop =
    baselineBp && earlyUprightBp.length
      ? Math.max(0, ...earlyUprightBp.map(
        (observation) => baselineBp.diastolic - observation.diastolic,
      ))
      : null;
  const orthostaticHypotensionAssessable =
    Boolean(baselineBp) && earlyUprightBp.length > 0;
  const orthostaticHypotensionCriteriaMet =
    orthostaticHypotensionAssessable
      ? maximumSystolicDrop >= 20 || maximumDiastolicDrop >= 10
      : null;
  const delayedUprightBp = bloodPressure.filter((observation) => (
    observation.timeSeconds > uprightStartSeconds + 180
    && observation.timeSeconds <= uprightEndSeconds
  ));
  const delayedMaximumSystolicDrop =
    baselineBp && delayedUprightBp.length
      ? Math.max(0, ...delayedUprightBp.map(
        (observation) => baselineBp.systolic - observation.systolic,
      ))
      : null;
  const delayedMaximumDiastolicDrop =
    baselineBp && delayedUprightBp.length
      ? Math.max(0, ...delayedUprightBp.map(
        (observation) => baselineBp.diastolic - observation.diastolic,
      ))
      : null;
  const delayedAssessable = Boolean(baselineBp) && delayedUprightBp.length > 0;
  const delayedCriteriaMet = delayedAssessable
    ? delayedMaximumSystolicDrop >= 20 || delayedMaximumDiastolicDrop >= 10
    : null;

  const recoveryStartSeconds =
    phaseTime(recording.events, "supine_recovery")
    ?? returnTime;
  const recoveryIntervals = accepted.filter(
    (interval) => interval.timeSeconds >= recoveryStartSeconds,
  );
  const recoveryAtSeconds = [30, 60, 120, 300].map((offsetSeconds) => {
    const targetSeconds = recoveryStartSeconds + offsetSeconds;
    const heartRateBpm = targetSeconds <= recording.durationSeconds
      ? interpolate(accepted, targetSeconds, "heartRateBpm")
      : null;
    return {
      offsetSeconds,
      heartRateBpm: round(heartRateBpm, 3),
      changeFromBaselineBpm:
        Number.isFinite(heartRateBpm) && Number.isFinite(baselineMedianHeartRate)
          ? round(heartRateBpm - baselineMedianHeartRate, 3)
          : null,
    };
  });
  const recoveredWithinTen = Number.isFinite(baselineMedianHeartRate)
    ? recoveryIntervals.find(
      (interval) => (
        Math.abs(interval.heartRateBpm - baselineMedianHeartRate) <= 10
      ),
    )
    : null;

  const baselineEtco2 = Number(recording.metadata.baselineEtco2);
  const etco2 = recording.events
    .filter((event) => event.type === "etco2")
    .map((event) => ({
      timeSeconds: event.relativeSeconds,
      value: Number(event.data.value),
      change: Number.isFinite(baselineEtco2)
        ? Number(event.data.value) - baselineEtco2
        : null,
      correctedAngleDegrees: angleAt(event.relativeSeconds),
      heartRateBpm: heartRateAt(event.relativeSeconds),
    }));
  const symptomEvents = recording.events
    .filter((event) => event.type === "symptom")
    .map((event) => {
      const priorBp = recentValue(bloodPressure, event.relativeSeconds);
      const priorEtco2 = recentValue(etco2, event.relativeSeconds);
      return {
        label: event.label,
        semantics: event.semantics,
        timeSeconds: event.relativeSeconds,
        correctedAngleDegrees: angleAt(event.relativeSeconds),
        heartRateBpm: heartRateAt(event.relativeSeconds),
        heartRateChangeBpm:
          Number.isFinite(baselineMedianHeartRate)
          && Number.isFinite(heartRateAt(event.relativeSeconds))
            ? heartRateAt(event.relativeSeconds) - baselineMedianHeartRate
            : null,
        bloodPressure: priorBp
          ? {
            systolic: priorBp.systolic,
            diastolic: priorBp.diastolic,
            ageSeconds: event.relativeSeconds - priorBp.timeSeconds,
          }
          : null,
        etco2: priorEtco2
          ? {
            value: priorEtco2.value,
            ageSeconds: event.relativeSeconds - priorEtco2.timeSeconds,
          }
          : null,
      };
    });
  const summary = [
    Number.isFinite(hrRegression.slope)
      ? `Ascending heart-rate response was ${round(hrRegression.slope, 3)} bpm per corrected degree; a protocol-specific reference range has not been established.`
      : "Ascending heart-rate slope was not available.",
    orthostaticAssessable
      ? sustainedDelta >= settings.orthostaticHrThresholdBpm
        ? `The sustained heart-rate increase met the configured ${settings.orthostaticHrThresholdBpm} bpm orthostatic tachycardia threshold.`
        : `The sustained heart-rate increase did not meet the configured ${settings.orthostaticHrThresholdBpm} bpm threshold.`
      : `The configured ${settings.orthostaticAssessmentSeconds}-second orthostatic heart-rate assessment was not possible because upright duration was ${round(uprightDurationSeconds, 1)} seconds.`,
    orthostaticHypotensionAssessable
      ? orthostaticHypotensionCriteriaMet
        ? "Recorded early-upright blood pressure met the configured orthostatic hypotension decrease criterion."
        : "Recorded early-upright blood pressure did not meet the configured orthostatic hypotension decrease criterion."
      : "Orthostatic blood-pressure criteria were not assessable because no BP was recorded within three minutes of reaching upright.",
    symptomEvents.filter((event) => event.semantics === "onset").length
      ? `${symptomEvents.filter((event) => event.semantics === "onset").length} symptom onset event(s) were recorded and correlated with the available physiology.`
      : "No symptom onset was recorded.",
  ];
  return {
    heartRate: {
      baselineMedianBpm: round(baselineMedianHeartRate, 3),
      baselineMinimumBpm: baselineHeartRates.length
        ? round(Math.min(...baselineHeartRates), 3)
        : null,
      baselineMaximumBpm: baselineHeartRates.length
        ? round(Math.max(...baselineHeartRates), 3)
        : null,
      peakUprightBpm: round(peak?.heartRateBpm, 3),
      peakUprightTimeSeconds: round(peak?.timeSeconds, 3),
      maximumChangeBpm:
        peak && Number.isFinite(baselineMedianHeartRate)
          ? round(peak.heartRateBpm - baselineMedianHeartRate, 3)
          : null,
      maximumSustainedBpm: round(sustained?.heartRateBpm, 3),
      maximumSustainedChangeBpm: round(sustainedDelta, 3),
      sustainedWindowSeconds: settings.sustainedHrWindowSeconds,
      uprightDurationSeconds: round(uprightDurationSeconds, 3),
      orthostaticAssessmentSeconds: settings.orthostaticAssessmentSeconds,
      orthostaticThresholdBpm: settings.orthostaticHrThresholdBpm,
      orthostaticAssessable,
      orthostaticThresholdMet:
        orthostaticAssessable
          ? orthostaticThresholdObserved
          : null,
      angleRegression: hrRegression,
      recovery: {
        startSeconds: round(recoveryStartSeconds, 3),
        fixedTimes: recoveryAtSeconds,
        timeToWithinTenBpmSeconds: recoveredWithinTen
          ? round(recoveredWithinTen.timeSeconds - recoveryStartSeconds, 3)
          : null,
        reachedWithinTenBpm: Boolean(recoveredWithinTen),
      },
    },
    bloodPressure: {
      baseline: baselineBp,
      observations: bloodPressure.map((observation) => ({
        ...observation,
        correctedAngleDegrees: round(observation.correctedAngleDegrees, 3),
        heartRateBpm: round(observation.heartRateBpm, 3),
      })),
      maximumSystolicDropMmHg: round(maximumSystolicDrop, 3),
      maximumDiastolicDropMmHg: round(maximumDiastolicDrop, 3),
      orthostaticHypotensionAssessable,
      orthostaticHypotensionCriteriaMet,
      classic: {
        status: orthostaticHypotensionAssessable
          ? orthostaticHypotensionCriteriaMet ? "met" : "not_met"
          : "not_assessable",
        result: orthostaticHypotensionAssessable
          ? `Maximum early-upright decrease ${round(maximumSystolicDrop, 1)} mmHg systolic and ${round(maximumDiastolicDrop, 1)} mmHg diastolic.`
          : "No BP observation was recorded within 3 minutes upright.",
        limitation: orthostaticHypotensionAssessable
          ? "Assessment is based on available intermittent measurements."
          : "Baseline and at least one BP observation within 3 minutes upright are required.",
      },
      delayed: {
        status: delayedAssessable
          ? delayedCriteriaMet ? "met" : "not_met"
          : "not_assessable",
        result: delayedAssessable
          ? `Maximum decrease after 3 minutes ${round(delayedMaximumSystolicDrop, 1)} mmHg systolic and ${round(delayedMaximumDiastolicDrop, 1)} mmHg diastolic.`
          : "No BP observation was recorded after 3 minutes upright.",
        limitation: delayedAssessable
          ? "Assessment is based on available intermittent measurements."
          : "Baseline and at least one BP observation after 3 minutes upright are required.",
      },
    },
    etco2: {
      baseline: Number.isFinite(baselineEtco2) ? baselineEtco2 : null,
      observations: etco2.map((observation) => ({
        ...observation,
        correctedAngleDegrees: round(observation.correctedAngleDegrees, 3),
        heartRateBpm: round(observation.heartRateBpm, 3),
      })),
      nadir: etco2.length
        ? etco2.reduce(
          (lowest, observation) => (
            observation.value < lowest.value ? observation : lowest
          ),
        )
        : null,
    },
    symptoms: symptomEvents.map((event) => ({
      ...event,
      correctedAngleDegrees: round(event.correctedAngleDegrees, 3),
      heartRateBpm: round(event.heartRateBpm, 3),
      heartRateChangeBpm: round(event.heartRateChangeBpm, 3),
    })),
    summary,
  };
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
  const recoveryStart =
    phaseTime(recording.events, "supine_recovery")
    ?? Math.max(0, recording.durationSeconds - 30);
  const supineHrvStart = Math.max(0, Math.min(5, beginTilt - 1));
  const supineHrvEnd = Math.min(
    recording.durationSeconds,
    Math.max(supineHrvStart + 0.1, beginTilt - 5),
  );
  const uprightHrvStart = Math.min(
    Math.max(0, recording.durationSeconds - 0.1),
    ascentEnd,
  );
  const uprightHrvEnd = Math.min(
    recording.durationSeconds,
    Math.max(uprightHrvStart + 0.1, plateauEnd),
  );
  const recoveryHrvStart = Math.min(
    recoveryStart,
    Math.max(0, recording.durationSeconds - 0.1),
  );
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
    supineHrvStartSeconds: supineHrvStart,
    supineHrvEndSeconds: supineHrvEnd,
    uprightHrvStartSeconds: uprightHrvStart,
    uprightHrvEndSeconds: uprightHrvEnd,
    recoveryHrvStartSeconds: recoveryHrvStart,
    recoveryHrvEndSeconds: recording.durationSeconds,
    minimumRrMs: MINIMUM_RR_MS,
    maximumRrMs: MAXIMUM_RR_MS,
    orthostaticHrThresholdBpm: 30,
    orthostaticAssessmentSeconds: 600,
    sustainedHrWindowSeconds: 30,
    frequencyDomainMode: "automatic",
    minimumHfSeconds: 90,
    minimumLfSeconds: 300,
    minimumAcceptedNnPercent: 95,
    maximumExcludedNnPercent: 5,
    requireStationarity: true,
    maximumStationaryAngleRangeDegrees: 5,
    frequencyEligibilityOverride: false,
    frequencyOverrideRationale: "",
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
    "supineHrvStartSeconds",
    "supineHrvEndSeconds",
    "uprightHrvStartSeconds",
    "uprightHrvEndSeconds",
    "recoveryHrvStartSeconds",
    "recoveryHrvEndSeconds",
    "minimumRrMs",
    "maximumRrMs",
    "orthostaticHrThresholdBpm",
    "orthostaticAssessmentSeconds",
    "sustainedHrWindowSeconds",
    "minimumHfSeconds",
    "minimumLfSeconds",
    "minimumAcceptedNnPercent",
    "maximumExcludedNnPercent",
    "maximumStationaryAngleRangeDegrees",
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
    ["supineHrvStartSeconds", "supineHrvEndSeconds"],
    ["uprightHrvStartSeconds", "uprightHrvEndSeconds"],
    ["recoveryHrvStartSeconds", "recoveryHrvEndSeconds"],
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
  if (
    normalized.orthostaticHrThresholdBpm <= 0
    || normalized.orthostaticHrThresholdBpm > 100
    || normalized.orthostaticAssessmentSeconds < 60
    || normalized.orthostaticAssessmentSeconds > 3_600
    || normalized.sustainedHrWindowSeconds < 10
    || normalized.sustainedHrWindowSeconds > 300
  ) {
    throw new Error("Orthostatic HR criteria are outside the supported range.");
  }
  if (
    normalized.minimumHfSeconds < 30
    || normalized.minimumLfSeconds < normalized.minimumHfSeconds
    || normalized.minimumLfSeconds > 1_800
    || normalized.minimumAcceptedNnPercent < 50
    || normalized.minimumAcceptedNnPercent > 100
    || normalized.maximumExcludedNnPercent < 0
    || normalized.maximumExcludedNnPercent > 50
    || normalized.maximumStationaryAngleRangeDegrees <= 0
    || normalized.maximumStationaryAngleRangeDegrees > 30
  ) {
    throw new Error("Frequency-domain HRV eligibility parameters are outside the supported range.");
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
  normalized.frequencyDomainMode =
    settings.frequencyDomainMode === "exclude" ? "exclude" : "automatic";
  normalized.requireStationarity = settings.requireStationarity !== false;
  normalized.frequencyEligibilityOverride =
    settings.frequencyEligibilityOverride === true;
  normalized.frequencyOverrideRationale =
    typeof settings.frequencyOverrideRationale === "string"
      ? settings.frequencyOverrideRationale.trim()
      : "";
  if (
    normalized.frequencyEligibilityOverride
    && !normalized.frequencyOverrideRationale
  ) {
    throw new Error("A rationale is required to override frequency-domain HRV eligibility.");
  }
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
    heartRateBpm: 60_000 / interval.rrMs,
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
  const heartRateRegressionPoints = intervals
    .filter((interval) => (
      interval.accepted
      && interval.timeSeconds >= settings.ascentStartSeconds
      && interval.timeSeconds <= settings.ascentEndSeconds
      && Number.isFinite(interval.correctedAngleDegrees)
    ))
    .map((interval) => ({
      id: interval.id,
      x: round(interval.correctedAngleDegrees, 4),
      y: round(interval.heartRateBpm, 4),
      timeSeconds: round(interval.timeSeconds, 3),
    }));
  const heartRateRegression = linearRegression(heartRateRegressionPoints);
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
  const hrv = {
    segments: [
      hrvSegment({
        name: "supine",
        startSeconds: settings.supineHrvStartSeconds,
        endSeconds: settings.supineHrvEndSeconds,
        intervals,
        timeline,
        settings,
      }),
      hrvSegment({
        name: "upright",
        startSeconds: settings.uprightHrvStartSeconds,
        endSeconds: settings.uprightHrvEndSeconds,
        intervals,
        timeline,
        settings,
      }),
      hrvSegment({
        name: "recovery",
        startSeconds: settings.recoveryHrvStartSeconds,
        endSeconds: settings.recoveryHrvEndSeconds,
        intervals,
        timeline,
        settings,
      }),
    ],
    configuration: {
      frequencyDomainMode: settings.frequencyDomainMode,
      minimumHfSeconds: settings.minimumHfSeconds,
      minimumLfSeconds: settings.minimumLfSeconds,
      minimumAcceptedNnPercent: settings.minimumAcceptedNnPercent,
      maximumExcludedNnPercent: settings.maximumExcludedNnPercent,
      requireStationarity: settings.requireStationarity,
      maximumStationaryAngleRangeDegrees:
        settings.maximumStationaryAngleRangeDegrees,
      overrideApplied: settings.frequencyEligibilityOverride,
      overrideRationale: settings.frequencyEligibilityOverride
        ? settings.frequencyOverrideRationale
        : null,
    },
  };
  const clinical = clinicalAnalysis({
    recording,
    intervals,
    timeline,
    settings,
    baselineIntervals,
    hrRegression: {
      ...heartRateRegression,
      equation: heartRateRegression.slope === null
        ? null
        : `Heart rate (bpm) = ${heartRateRegression.slope.toFixed(3)} × corrected angle (°) + ${heartRateRegression.intercept.toFixed(3)}`,
      angleMinimum: heartRateRegressionPoints.length
        ? round(Math.min(...heartRateRegressionPoints.map((point) => point.x)), 3)
        : null,
      angleMaximum: heartRateRegressionPoints.length
        ? round(Math.max(...heartRateRegressionPoints.map((point) => point.x)), 3)
        : null,
    },
  });
  const quality = {
    detectedRWaveCount: recording.rWaveCount,
    rrIntervalCount: intervals.length,
    acceptedRrIntervalCount: acceptedIntervals.length,
    excludedRrIntervalCount: intervals.length - acceptedIntervals.length,
    acceptedPercent: intervals.length
      ? round(acceptedIntervals.length / intervals.length * 100, 2)
      : null,
  };
  const clinicReport = buildClinicReport({
    recording,
    settings,
    calibration: {
      achievedAngleDegrees: settings.achievedAngleDegrees,
    },
    clinical,
    quality,
    intervals: acceptedIntervals,
  });
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
    heartRateRegression: clinical.heartRate.angleRegression,
    quality,
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
    clinical,
    clinicReport,
    hrv,
    regressionPoints,
    heartRateRegressionPoints,
    intervals: intervals.map((interval) => ({
      id: interval.id,
      timeSeconds: round(interval.timeSeconds, 3),
      rrMs: round(interval.rrMs, 3),
      heartRateBpm: round(interval.heartRateBpm, 3),
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
