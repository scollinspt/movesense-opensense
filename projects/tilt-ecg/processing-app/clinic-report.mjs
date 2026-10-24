export const CLINIC_REPORT_METHOD = Object.freeze({
  reportMethodVersion: "panther-pt-passive-hut-report-v0.2.0",
  evidenceSetVersion: "tilt-ecg-evidence-2026-10-24-v1",
  title: "Passive Head-Up Tilt Physiological Response Report",
  plannedProtocol: {
    baselineSeconds: 600,
    targetAngleDegrees: 70,
    uprightSeconds: 600,
    recoverySeconds: 600,
  },
  attestation:
    "I reviewed the source recording, analysis decisions, physiological findings, and stated limitations and approve this report for use alongside other physical therapy examination findings in developing a movement system interpretation.",
  references: [
    {
      id: "thijs-2021",
      citation:
        "Thijs RD, et al. Recommendations for tilt table testing and other provocative cardiovascular autonomic tests. Clin Auton Res. 2021.",
      doi: "10.1007/s10286-020-00738-6",
      supports: "Passive head-up tilt protocol and interpretation context",
    },
    {
      id: "freeman-2011",
      citation:
        "Freeman R, et al. Consensus statement on the definition of orthostatic hypotension, neurally mediated syncope and the postural tachycardia syndrome. Clin Auton Res. 2011.",
      doi: "10.1007/s10286-011-0119-5",
      supports: "Orthostatic HR and blood-pressure criteria",
    },
    {
      id: "sheldon-2015",
      citation:
        "Sheldon RS, et al. 2015 Heart Rhythm Society Expert Consensus Statement on POTS, inappropriate sinus tachycardia, and vasovagal syncope. Heart Rhythm. 2015.",
      doi: "10.1016/j.hrthm.2015.03.029",
      supports: "Orthostatic HR criterion and diagnostic limitations",
    },
    {
      id: "wieling-2007",
      citation:
        "Wieling W, et al. Initial orthostatic hypotension: review of a forgotten condition. Clin Sci. 2007.",
      doi: "10.1042/CS20060091",
      supports: "Initial orthostatic hypotension and active-standing distinction",
    },
    {
      id: "plash-2013",
      citation:
        "Plash WB, et al. Diagnosing postural tachycardia syndrome: comparison of tilt testing compared with standing haemodynamics. Clin Sci. 2013.",
      doi: "10.1042/CS20120276",
      supports: "Active-standing versus passive-tilt comparability",
    },
    {
      id: "stewart-2006",
      citation:
        "Stewart JM, et al. Postural hypocapnic hyperventilation is associated with enhanced peripheral vasoconstriction in POTS. Am J Physiol Heart Circ Physiol. 2006.",
      doi: "10.1152/ajpheart.01359.2005",
      supports: "End-tidal CO2 response context",
    },
    {
      id: "task-force-1996",
      citation:
        "Task Force of the ESC and NASPE. Heart rate variability: standards of measurement, physiological interpretation, and clinical use. Circulation. 1996.",
      doi: "10.1161/01.CIR.93.5.1043",
      supports: "HRV methods and interpretive limitations",
    },
  ],
});

function phaseTime(events, label) {
  return events.find(
    (event) => event.type === "phase" && event.label === label,
  )?.relativeSeconds ?? null;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return "not available";
  const roundedSeconds = Math.max(0, Math.round(seconds));
  return `${Math.floor(roundedSeconds / 60)}:${String(
    roundedSeconds % 60,
  ).padStart(2, "0")}`;
}

function roundedDuration(start, end) {
  return Number.isFinite(start) && Number.isFinite(end) && end >= start
    ? Number((end - start).toFixed(1))
    : null;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function statusLabel(status) {
  if (status === "met") return "Criterion observed";
  if (status === "not_met") return "Criterion not observed";
  return "Not assessable";
}

export function classifyEtco2Response({
  baseline,
  observations,
  uprightStartSeconds,
  uprightEndSeconds,
  recoveryStartSeconds,
}) {
  const thresholdMmHg = 30;
  const validObservations = observations.filter((observation) => (
    Number.isFinite(observation.timeSeconds)
    && Number.isFinite(observation.value)
  ));
  const upright = validObservations.filter((observation) => (
    observation.timeSeconds >= uprightStartSeconds
    && observation.timeSeconds <= uprightEndSeconds
  ));
  const recovery = Number.isFinite(recoveryStartSeconds)
    ? validObservations.filter(
      (observation) => observation.timeSeconds >= recoveryStartSeconds,
    )
    : [];
  const uprightValues = upright.map((observation) => observation.value);
  const recoveryValues = recovery.map((observation) => observation.value);
  const hypocapnicUprightCount = uprightValues.filter(
    (value) => value < thresholdMmHg,
  ).length;
  const uprightNadirMmHg = uprightValues.length
    ? Math.min(...uprightValues)
    : null;
  const maximumDecreaseMmHg =
    Number.isFinite(baseline) && Number.isFinite(uprightNadirMmHg)
      ? Math.max(0, baseline - uprightNadirMmHg)
      : null;
  const base = {
    thresholdMmHg,
    baselineMmHg: Number.isFinite(baseline) ? baseline : null,
    uprightValuesMmHg: uprightValues,
    uprightNadirMmHg,
    uprightObservationCount: uprightValues.length,
    hypocapnicUprightCount,
    maximumDecreaseMmHg,
    recoveryValuesMmHg: recoveryValues,
    recoveryMinimumMmHg: recoveryValues.length
      ? Math.min(...recoveryValues)
      : null,
    recoveryMaximumMmHg: recoveryValues.length
      ? Math.max(...recoveryValues)
      : null,
    basis:
      "Stewart et al. described a modest normal upright decrease near 40 to 36 mmHg and marked postural hypocapnia below 30 mmHg, often below 25 mmHg, in orthostatic-intolerance cohorts.",
    limitation:
      "This is a descriptive literature-grounded classification, not a consensus diagnostic criterion; end-tidal CO₂ is a capnographic surrogate for arterial CO₂.",
  };

  if (!Number.isFinite(baseline) || !uprightValues.length) {
    return {
      ...base,
      status: "not_assessable",
      classification: "Not assessable",
      interpretation:
        "A baseline value and at least one upright end-tidal CO₂ observation are required.",
    };
  }

  if (baseline < thresholdMmHg) {
    if (hypocapnicUprightCount > 0) {
      const persistence = hypocapnicUprightCount > 1
        ? "Repeated hypocapnic-range values were observed upright."
        : "One hypocapnic-range value was observed upright.";
      return {
        ...base,
        status: "baseline_hypocapnia",
        classification: "Baseline hypocapnic-range etCO₂ persisted upright",
        interpretation:
          `Supine baseline end-tidal CO₂ was already below ${thresholdMmHg} mmHg at ${baseline} mmHg. ${persistence} The upright nadir was ${uprightNadirMmHg} mmHg, ${maximumDecreaseMmHg} mmHg below baseline. This does not establish a new postural transition from normocapnia to hypocapnia.`,
      };
    }
    return {
      ...base,
      status: "baseline_hypocapnia",
      classification: "Baseline hypocapnic-range etCO₂ without upright persistence",
      interpretation:
        `Supine baseline end-tidal CO₂ was below ${thresholdMmHg} mmHg at ${baseline} mmHg, while the available upright values were at or above ${thresholdMmHg} mmHg.`,
    };
  }

  if (hypocapnicUprightCount > 0) {
    const observationDescription = hypocapnicUprightCount > 1
      ? `${hypocapnicUprightCount} upright values were below ${thresholdMmHg} mmHg`
      : `one upright value was below ${thresholdMmHg} mmHg`;
    return {
      ...base,
      status: "observed",
      classification: hypocapnicUprightCount > 1
        ? "Repeated postural hypocapnic-range etCO₂ observed"
        : "Single postural hypocapnic-range etCO₂ reading observed",
      interpretation:
        `Baseline end-tidal CO₂ was ${baseline} mmHg and ${observationDescription}. The upright nadir was ${uprightNadirMmHg} mmHg, ${maximumDecreaseMmHg} mmHg below baseline.`,
    };
  }

  return {
    ...base,
    status: "not_observed",
    classification: "Postural hypocapnic-range etCO₂ not observed",
    interpretation:
      `Baseline end-tidal CO₂ was ${baseline} mmHg and all ${uprightValues.length} available upright ${uprightValues.length === 1 ? "value was" : "values were"} at or above ${thresholdMmHg} mmHg. The upright nadir was ${uprightNadirMmHg} mmHg.`,
  };
}

export function buildClinicReport({
  recording,
  settings,
  calibration,
  clinical,
  quality,
  intervals,
}) {
  const beginTilt = phaseTime(recording.events, "begin_tilt");
  const targetReached = phaseTime(recording.events, "target_angle_reached");
  const beginReturn =
    phaseTime(recording.events, "begin_return")
    ?? phaseTime(recording.events, "begin_return_early");
  const recoveryStart = phaseTime(recording.events, "supine_recovery");
  const uprightStart = targetReached ?? settings.ascentEndSeconds;
  const uprightEnd = beginReturn ?? recoveryStart ?? recording.durationSeconds;
  const actualProtocol = {
    baselineSeconds: roundedDuration(0, beginTilt),
    ascentSeconds: roundedDuration(beginTilt, uprightStart),
    uprightSeconds: roundedDuration(uprightStart, uprightEnd),
    recoverySeconds: roundedDuration(recoveryStart, recording.durationSeconds),
    achievedAngleDegrees: calibration.achievedAngleDegrees,
    earlyReturn: phaseTime(recording.events, "begin_return_early") !== null,
  };
  const protocolNarrative =
    "The performed protocol included a recorded supine baseline, passive transition to the reviewed head-up angle, an upright phase, return to supine, and recorded recovery. Actual phase durations are reported below.";

  const stageDefinitions = [
    {
      id: "baseline",
      name: "Supine baseline",
      startSeconds: 0,
      endSeconds: beginTilt,
    },
    {
      id: "ascent",
      name: "Passive transition",
      startSeconds: beginTilt,
      endSeconds: uprightStart,
    },
    {
      id: "upright",
      name: "Head-up tilt",
      startSeconds: uprightStart,
      endSeconds: uprightEnd,
    },
    {
      id: "return",
      name: "Return to supine",
      startSeconds: beginReturn,
      endSeconds: recoveryStart,
    },
    {
      id: "recovery",
      name: "Supine recovery",
      startSeconds: recoveryStart,
      endSeconds: recording.durationSeconds,
    },
  ].filter((stage) => (
    Number.isFinite(stage.startSeconds)
    && Number.isFinite(stage.endSeconds)
    && stage.endSeconds >= stage.startSeconds
  ));
  const stageForTime = (timeSeconds) => (
    stageDefinitions.find((stage, index) => (
      timeSeconds >= stage.startSeconds
      && (
        timeSeconds < stage.endSeconds
        || (
          index === stageDefinitions.length - 1
          && timeSeconds <= stage.endSeconds
        )
      )
    ))
  );
  const baselineBpObservation = clinical.bloodPressure.baseline
    ? [{
      timeSeconds: 0,
      systolic: clinical.bloodPressure.baseline.systolic,
      diastolic: clinical.bloodPressure.baseline.diastolic,
      systolicChange: 0,
      diastolicChange: 0,
    }]
    : [];
  const baselineEtco2Observation = Number.isFinite(clinical.etco2.baseline)
    ? [{ timeSeconds: 0, value: clinical.etco2.baseline, change: 0 }]
    : [];
  const allBloodPressure = [
    ...baselineBpObservation,
    ...clinical.bloodPressure.observations,
  ];
  const allEtco2 = [
    ...baselineEtco2Observation,
    ...clinical.etco2.observations,
  ];
  const stages = stageDefinitions.map((stage) => {
    const stageIntervals = intervals.filter(
      (interval) => stageForTime(interval.timeSeconds)?.id === stage.id,
    );
    return {
      ...stage,
      durationSeconds: roundedDuration(stage.startSeconds, stage.endSeconds),
      medianHeartRateBpm: Number.isFinite(median(
        stageIntervals.map((interval) => interval.heartRateBpm),
      ))
        ? Number(median(
          stageIntervals.map((interval) => interval.heartRateBpm),
        ).toFixed(1))
        : null,
      sustainedHeartRateChangeBpm:
        stage.id === "upright"
          ? clinical.heartRate.maximumSustainedChangeBpm
          : null,
      sustainedWindowSeconds:
        stage.id === "upright"
          ? clinical.heartRate.sustainedWindowSeconds
          : null,
      bloodPressure: allBloodPressure.filter(
        (observation) => stageForTime(observation.timeSeconds)?.id === stage.id,
      ),
      etco2: allEtco2.filter(
        (observation) => stageForTime(observation.timeSeconds)?.id === stage.id,
      ),
      symptoms: clinical.symptoms.filter(
        (observation) => stageForTime(observation.timeSeconds)?.id === stage.id,
      ),
    };
  });

  const hrStatus = !clinical.heartRate.orthostaticAssessable
    ? "not_assessable"
    : clinical.heartRate.orthostaticThresholdMet
      ? "met"
      : "not_met";
  const classicOhStatus =
    clinical.bloodPressure.classic.status ?? "not_assessable";
  const delayedOhStatus =
    clinical.bloodPressure.delayed.status ?? "not_assessable";
  const uprightSymptomRecorded = clinical.symptoms.some((event) => (
    event.semantics === "onset"
    && stageForTime(event.timeSeconds)?.id === "upright"
  ));
  const heartRateQualification = [
    "A threshold-level physiological response is not a diagnosis.",
    clinical.heartRate.uprightDurationSeconds
      < clinical.heartRate.orthostaticAssessmentSeconds
      ? `The upright position was maintained for ${formatDuration(clinical.heartRate.uprightDurationSeconds)} rather than the full ${formatDuration(clinical.heartRate.orthostaticAssessmentSeconds)} assessment.`
      : null,
    uprightSymptomRecorded
      ? "Symptom onset was recorded during upright tilt before return to supine."
      : null,
  ].filter(Boolean).join(" ");
  const criteria = [
    {
      id: "sustained-orthostatic-hr",
      name: "Sustained orthostatic HR increase",
      status: hrStatus,
      label: statusLabel(hrStatus),
      result: Number.isFinite(clinical.heartRate.maximumSustainedChangeBpm)
        ? `${clinical.heartRate.maximumSustainedChangeBpm.toFixed(1)} bpm over ${clinical.heartRate.sustainedWindowSeconds} seconds`
        : "No qualifying sustained window",
      basis:
        `${clinical.heartRate.orthostaticThresholdBpm} bpm threshold during the configured ${formatDuration(clinical.heartRate.orthostaticAssessmentSeconds)} assessment`,
      limitation: heartRateQualification,
    },
    {
      id: "classic-oh",
      name: "Classic orthostatic hypotension",
      status: classicOhStatus,
      label: statusLabel(classicOhStatus),
      result: clinical.bloodPressure.classic.result,
      basis: "Sustained decrease of at least 20 mmHg systolic or 10 mmHg diastolic within 3 minutes",
      limitation: clinical.bloodPressure.classic.limitation,
    },
    {
      id: "delayed-oh",
      name: "Delayed orthostatic hypotension",
      status: delayedOhStatus,
      label: statusLabel(delayedOhStatus),
      result: clinical.bloodPressure.delayed.result,
      basis: "Sustained decrease of at least 20 mmHg systolic or 10 mmHg diastolic after 3 minutes upright",
      limitation: clinical.bloodPressure.delayed.limitation,
    },
  ];
  const etco2Response = classifyEtco2Response({
    baseline: clinical.etco2.baseline,
    observations: clinical.etco2.observations,
    uprightStartSeconds: uprightStart,
    uprightEndSeconds: uprightEnd,
    recoveryStartSeconds: recoveryStart,
  });

  const plainLanguageSummary = [
    Number.isFinite(clinical.heartRate.maximumSustainedChangeBpm)
      ? `The largest reviewed ${clinical.heartRate.sustainedWindowSeconds}-second sustained upright heart-rate change was ${clinical.heartRate.maximumSustainedChangeBpm.toFixed(1)} bpm above the supine baseline median.`
      : "A sustained upright heart-rate change could not be calculated.",
  ];

  const limitations = [
    "This report describes a single passive head-up tilt recording and does not establish a diagnosis.",
    "Active standing and passive tilt produce related but non-identical physiological responses.",
    "Intermittent BP cannot characterize beat-to-beat or initial orthostatic BP responses.",
    "Symptoms and measurements are temporally associated; the report does not infer causation.",
    "End-tidal CO₂ is a capnographic surrogate for arterial CO₂ and may be affected by breathing route, ventilation pattern, dead space, sampling quality, and equipment setup.",
    "Corrected-angle HR and R–R slopes are exploratory because protocol-specific clinical reference ranges have not been established.",
  ];
  if (quality.acceptedPercent < 95) {
    limitations.push(
      `Accepted R–R intervals comprised ${quality.acceptedPercent.toFixed(1)}% of detected intervals.`,
    );
  }
  if (actualProtocol.earlyReturn) {
    limitations.push("The upright phase ended before the planned protocol duration.");
  }

  return {
    reportMethod: CLINIC_REPORT_METHOD,
    testDate:
      recording.manifest?.startedAt?.slice(0, 10)
      ?? recording.manifest?.startTime?.slice(0, 10)
      ?? null,
    protocol: {
      actual: actualProtocol,
      narrative: protocolNarrative,
      stages,
    },
    plainLanguageSummary,
    criteria,
    etco2Response,
    limitations,
  };
}
