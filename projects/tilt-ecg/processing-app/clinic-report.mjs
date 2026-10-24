export const CLINIC_REPORT_METHOD = Object.freeze({
  reportMethodVersion: "panther-pt-passive-hut-report-v0.1.0",
  evidenceSetVersion: "tilt-ecg-evidence-2026-10-24-v1",
  title: "Passive Head-Up Tilt Physiological Response Report",
  plannedProtocol: {
    baselineSeconds: 600,
    targetAngleDegrees: 70,
    uprightSeconds: 600,
    recoverySeconds: 600,
  },
  attestation:
    "I reviewed the source recording, analysis decisions, physiological findings, and stated limitations and approve this report for the documented clinical purpose.",
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

function roundedDuration(start, end) {
  return Number.isFinite(start) && Number.isFinite(end) && end >= start
    ? Number((end - start).toFixed(1))
    : null;
}

function statusLabel(status) {
  if (status === "met") return "Criterion observed";
  if (status === "not_met") return "Criterion not observed";
  return "Not assessable";
}

export function buildClinicReport({
  recording,
  settings,
  calibration,
  clinical,
  quality,
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
  const protocolNarrative = [
    `The planned protocol was ${CLINIC_REPORT_METHOD.plannedProtocol.baselineSeconds / 60} minutes supine, passive head-up tilt to ${CLINIC_REPORT_METHOD.plannedProtocol.targetAngleDegrees}°, ${CLINIC_REPORT_METHOD.plannedProtocol.uprightSeconds / 60} minutes upright, and ${CLINIC_REPORT_METHOD.plannedProtocol.recoverySeconds / 60} minutes supine recovery.`,
    `The recorded test included ${actualProtocol.baselineSeconds ?? "an unrecorded"} seconds before tilt, reached a reviewed angle of ${actualProtocol.achievedAngleDegrees.toFixed(1)}°, included ${actualProtocol.uprightSeconds ?? "an unrecorded"} seconds upright, and included ${actualProtocol.recoverySeconds ?? "an unrecorded"} seconds of recorded recovery.${actualProtocol.earlyReturn ? " Return to supine began before the planned upright duration was completed." : ""}`,
  ].join(" ");

  const hrStatus = !clinical.heartRate.orthostaticAssessable
    ? "not_assessable"
    : clinical.heartRate.orthostaticThresholdMet
      ? "met"
      : "not_met";
  const classicOhStatus =
    clinical.bloodPressure.classic.status ?? "not_assessable";
  const delayedOhStatus =
    clinical.bloodPressure.delayed.status ?? "not_assessable";
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
        `${clinical.heartRate.orthostaticThresholdBpm} bpm threshold during the configured ${clinical.heartRate.orthostaticAssessmentSeconds}-second assessment`,
      limitation: clinical.heartRate.orthostaticAssessable
        ? "A threshold-level physiological response is not a diagnosis."
        : `Recorded upright duration was ${clinical.heartRate.uprightDurationSeconds.toFixed(1)} seconds.`,
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
      id: "initial-oh",
      name: "Initial orthostatic hypotension",
      status: "not_assessable",
      label: statusLabel("not_assessable"),
      result: "Continuous beat-to-beat BP was not recorded during an active stand.",
      basis: "Transient decrease greater than 40 mmHg systolic or 20 mmHg diastolic within approximately 15 seconds",
      limitation:
        "The acquisition uses intermittent BP and passive tilt; this criterion generally requires continuous BP during active standing.",
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

  const plainLanguageSummary = [
    Number.isFinite(clinical.heartRate.maximumChangeBpm)
      ? `Heart rate reached a peak change of ${clinical.heartRate.maximumChangeBpm.toFixed(1)} bpm above the supine baseline median.`
      : "A peak upright heart-rate change could not be calculated.",
    Number.isFinite(clinical.heartRate.maximumSustainedChangeBpm)
      ? `The largest ${clinical.heartRate.sustainedWindowSeconds}-second sustained change was ${clinical.heartRate.maximumSustainedChangeBpm.toFixed(1)} bpm.`
      : "A sustained upright heart-rate change could not be calculated.",
    clinical.bloodPressure.observations.length
      ? `Blood pressure was recorded ${clinical.bloodPressure.observations.length} time(s) after baseline; criteria are reported only where timing and sampling permitted assessment.`
      : "No upright blood-pressure observation was available.",
    clinical.etco2.observations.length
      ? `End-tidal CO2 was recorded ${clinical.etco2.observations.length} time(s) after baseline.`
      : "No post-baseline end-tidal CO2 observation was available.",
    clinical.symptoms.filter((event) => event.semantics === "onset").length
      ? `${clinical.symptoms.filter((event) => event.semantics === "onset").length} symptom onset event(s) were documented and aligned with the available measurements.`
      : "No symptom onset event was documented.",
  ];

  const assessableCount = criteria.filter(
    (criterion) => criterion.status !== "not_assessable",
  ).length;
  const limitations = [
    "This report describes a single passive head-up tilt recording and does not establish a diagnosis.",
    "Active standing and passive tilt produce related but non-identical physiological responses.",
    "Intermittent BP cannot characterize beat-to-beat or initial orthostatic BP responses.",
    "Symptoms and measurements are temporally associated; the report does not infer causation.",
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
      planned: CLINIC_REPORT_METHOD.plannedProtocol,
      actual: actualProtocol,
      narrative: protocolNarrative,
    },
    plainLanguageSummary,
    criteria,
    impression: {
      observedResponse: plainLanguageSummary,
      assessability: [
        `${assessableCount} of ${criteria.length} displayed consensus criteria were assessable from the recorded protocol and measurements.`,
        "A not-assessable result does not mean that the physiological response was absent.",
      ],
      limitations,
    },
  };
}
