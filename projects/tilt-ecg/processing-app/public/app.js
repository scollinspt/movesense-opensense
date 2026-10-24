const byId = (id) => document.getElementById(id);
const elements = {
  recordingSelect: byId("recording-select"),
  loadRecording: byId("load-recording"),
  recordingSummary: byId("recording-summary"),
  recordingId: byId("recording-id"),
  duration: byId("duration"),
  ecgSummary: byId("ecg-summary"),
  imuSummary: byId("imu-summary"),
  rawChecksum: byId("raw-checksum"),
  summaryChecksum: byId("summary-checksum"),
  integrityBadge: byId("integrity-badge"),
  reviewPanel: byId("review-panel"),
  analysisPanel: byId("analysis-panel"),
  reportPanel: byId("report-panel"),
  hmsReportDocument: byId("hms-report-document"),
  clinicReportDocument: byId("clinic-report-document"),
  showClinicReport: byId("show-clinic-report"),
  showHmsReport: byId("show-hms-report"),
  physiologyPanel: byId("physiology-panel"),
  achievedAngle: byId("achieved-angle"),
  confirmAngle: byId("confirm-angle"),
  baselineStart: byId("baseline-start"),
  baselineEnd: byId("baseline-end"),
  plateauStart: byId("plateau-start"),
  plateauEnd: byId("plateau-end"),
  ascentStart: byId("ascent-start"),
  ascentEnd: byId("ascent-end"),
  orthostaticThreshold: byId("orthostatic-threshold"),
  orthostaticDuration: byId("orthostatic-duration"),
  sustainedWindow: byId("sustained-window"),
  supineHrvStart: byId("supine-hrv-start"),
  supineHrvEnd: byId("supine-hrv-end"),
  uprightHrvStart: byId("upright-hrv-start"),
  uprightHrvEnd: byId("upright-hrv-end"),
  recoveryHrvStart: byId("recovery-hrv-start"),
  recoveryHrvEnd: byId("recovery-hrv-end"),
  frequencyMode: byId("frequency-mode"),
  minimumHfSeconds: byId("minimum-hf-seconds"),
  minimumLfSeconds: byId("minimum-lf-seconds"),
  minimumAcceptedNn: byId("minimum-accepted-nn"),
  maximumExcludedNn: byId("maximum-excluded-nn"),
  requireStationarity: byId("require-stationarity"),
  maximumStationaryAngle: byId("maximum-stationary-angle"),
  frequencyOverride: byId("frequency-override"),
  frequencyOverrideRationale: byId("frequency-override-rationale"),
  rrMinimum: byId("rr-minimum"),
  rrMaximum: byId("rr-maximum"),
  recalculate: byId("recalculate"),
  reviewStatus: byId("review-status"),
  calibrationBadge: byId("calibration-badge"),
  timelineChart: byId("timeline-chart"),
  scatterChart: byId("scatter-chart"),
  hrScatterChart: byId("hr-scatter-chart"),
  poincareChart: byId("poincare-chart"),
  reportTimelineChart: byId("report-timeline-chart"),
  reportScatterChart: byId("report-scatter-chart"),
  reportHrScatterChart: byId("report-hr-scatter-chart"),
  reportPoincareChart: byId("report-poincare-chart"),
  eventLegend: byId("event-legend"),
  equation: byId("equation"),
  regressionStatistics: byId("regression-statistics"),
  hrEquation: byId("hr-equation"),
  hrRegressionStatistics: byId("hr-regression-statistics"),
  rawBaseline: byId("raw-baseline"),
  rawPlateau: byId("raw-plateau"),
  scaleFactor: byId("scale-factor"),
  rWaveCount: byId("r-wave-count"),
  acceptedCount: byId("accepted-count"),
  excludedCount: byId("excluded-count"),
  baselineHr: byId("baseline-hr"),
  clinicalSummary: byId("clinical-summary"),
  heartRateSummary: byId("heart-rate-summary"),
  bloodPressureSummary: byId("blood-pressure-summary"),
  etco2Summary: byId("etco2-summary"),
  symptomSummary: byId("symptom-summary"),
  hrvTableBody: byId("hrv-table").querySelector("tbody"),
  reportState: byId("report-state"),
  reportRecordingId: byId("report-recording-id"),
  reportRecordingSummary: byId("report-recording-summary"),
  reportClinicalSummary: byId("report-clinical-summary"),
  reportReviewerConclusion: byId("report-reviewer-conclusion"),
  reportHeartRateSummary: byId("report-heart-rate-summary"),
  reportHrEquation: byId("report-hr-equation"),
  reportHrRegressionDetail: byId("report-hr-regression-detail"),
  reportBloodPressure: byId("report-blood-pressure"),
  reportEtco2: byId("report-etco2"),
  reportSymptoms: byId("report-symptoms"),
  reportHrvSummary: byId("report-hrv-summary"),
  reportEquation: byId("report-equation"),
  reportRegressionDetail: byId("report-regression-detail"),
  reportAnalysisSummary: byId("report-analysis-summary"),
  reportFooter: byId("report-footer"),
  reviewerConclusion: byId("reviewer-conclusion"),
  clinicTestDate: byId("clinic-test-date"),
  clinicPlainSummary: byId("clinic-plain-summary"),
  clinicProtocolNarrative: byId("clinic-protocol-narrative"),
  clinicProtocolSummary: byId("clinic-protocol-summary"),
  clinicHeartRateSummary: byId("clinic-heart-rate-summary"),
  clinicRecoverySummary: byId("clinic-recovery-summary"),
  clinicBloodPressure: byId("clinic-blood-pressure"),
  clinicEtco2: byId("clinic-etco2"),
  clinicSymptoms: byId("clinic-symptoms"),
  clinicCriteriaTableBody: byId("clinic-criteria-table").querySelector("tbody"),
  clinicImpressionObserved: byId("clinic-impression-observed"),
  clinicImpressionAssessability: byId("clinic-impression-assessability"),
  clinicImpressionLimitations: byId("clinic-impression-limitations"),
  clinicReviewerConclusion: byId("clinic-reviewer-conclusion"),
  clinicReferenceList: byId("clinic-reference-list"),
  clinicMethodSummary: byId("clinic-method-summary"),
  clinicApprovalSummary: byId("clinic-approval-summary"),
  clinicAttestation: byId("clinic-attestation"),
  clinicReportFooter: byId("clinic-report-footer"),
  clinicStudentName: byId("clinic-student-name"),
  clinicReviewerName: byId("clinic-reviewer-name"),
  clinicReviewerCredentials: byId("clinic-reviewer-credentials"),
  clinicSupervisorName: byId("clinic-supervisor-name"),
  clinicSupervisorCredentials: byId("clinic-supervisor-credentials"),
  clinicApprovalDate: byId("clinic-approval-date"),
  clinicAttestationAccepted: byId("clinic-attestation-accepted"),
  approveReview: byId("approve-review"),
  printClinicReport: byId("print-clinic-report"),
  printReport: byId("print-report"),
  reportStatus: byId("report-status"),
};

let description = null;
let currentResult = null;
let excludedIntervalIds = new Set();
let scatterHitTargets = [];
let approvedReview = null;
let analysisDirty = false;

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
  return body;
}

function format(value, digits = 1, suffix = "") {
  return Number.isFinite(value) ? `${value.toFixed(digits)}${suffix}` : "—";
}

function setBadge(element, text, kind) {
  element.textContent = text;
  element.className = `badge ${kind}`;
}

function setInput(element, value) {
  element.value = Number(value).toFixed(1);
}

function collectSettings() {
  return {
    achievedAngleDegrees: Number(elements.achievedAngle.value),
    achievedAngleSource: elements.confirmAngle.disabled
      ? "acquisition_record"
      : elements.confirmAngle.checked
        ? "reviewer_confirmed"
        : "reviewer_confirmation_required",
    baselineStartSeconds: Number(elements.baselineStart.value),
    baselineEndSeconds: Number(elements.baselineEnd.value),
    plateauStartSeconds: Number(elements.plateauStart.value),
    plateauEndSeconds: Number(elements.plateauEnd.value),
    ascentStartSeconds: Number(elements.ascentStart.value),
    ascentEndSeconds: Number(elements.ascentEnd.value),
    supineHrvStartSeconds: Number(elements.supineHrvStart.value),
    supineHrvEndSeconds: Number(elements.supineHrvEnd.value),
    uprightHrvStartSeconds: Number(elements.uprightHrvStart.value),
    uprightHrvEndSeconds: Number(elements.uprightHrvEnd.value),
    recoveryHrvStartSeconds: Number(elements.recoveryHrvStart.value),
    recoveryHrvEndSeconds: Number(elements.recoveryHrvEnd.value),
    minimumRrMs: Number(elements.rrMinimum.value),
    maximumRrMs: Number(elements.rrMaximum.value),
    orthostaticHrThresholdBpm: Number(elements.orthostaticThreshold.value),
    orthostaticAssessmentSeconds: Number(elements.orthostaticDuration.value),
    sustainedHrWindowSeconds: Number(elements.sustainedWindow.value),
    frequencyDomainMode: elements.frequencyMode.value,
    minimumHfSeconds: Number(elements.minimumHfSeconds.value),
    minimumLfSeconds: Number(elements.minimumLfSeconds.value),
    minimumAcceptedNnPercent: Number(elements.minimumAcceptedNn.value),
    maximumExcludedNnPercent: Number(elements.maximumExcludedNn.value),
    requireStationarity: elements.requireStationarity.checked,
    maximumStationaryAngleRangeDegrees:
      Number(elements.maximumStationaryAngle.value),
    frequencyEligibilityOverride: elements.frequencyOverride.checked,
    frequencyOverrideRationale: elements.frequencyOverrideRationale.value,
    excludedIntervalIds: [...excludedIntervalIds],
  };
}

function collectClinicApproval() {
  return {
    studentName: elements.clinicStudentName.value,
    reviewerName: elements.clinicReviewerName.value,
    reviewerCredentials: elements.clinicReviewerCredentials.value,
    supervisingClinicianName: elements.clinicSupervisorName.value,
    supervisingClinicianCredentials:
      elements.clinicSupervisorCredentials.value,
    approvalDate: elements.clinicApprovalDate.value,
    attestationAccepted: elements.clinicAttestationAccepted.checked,
  };
}

function prepareCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  return { context, width, height };
}

function extents(values, paddingFraction = 0.05) {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const span = Math.max(1, maximum - minimum);
  return [
    minimum - span * paddingFraction,
    maximum + span * paddingFraction,
  ];
}

function axes(canvas, xDomain, yDomain, labels) {
  const { context, width, height } = prepareCanvas(canvas);
  const margin = { left: 58, right: 54, top: 20, bottom: 48 };
  const plot = {
    left: margin.left,
    right: width - margin.right,
    top: margin.top,
    bottom: height - margin.bottom,
  };
  const x = (value) => plot.left
    + (value - xDomain[0]) / (xDomain[1] - xDomain[0])
    * (plot.right - plot.left);
  const y = (value) => plot.bottom
    - (value - yDomain[0]) / (yDomain[1] - yDomain[0])
    * (plot.bottom - plot.top);
  context.strokeStyle = "#cad6d0";
  context.fillStyle = "#59635f";
  context.font = "12px sans-serif";
  context.lineWidth = 1;
  for (let index = 0; index <= 5; index += 1) {
    const fraction = index / 5;
    const xValue = xDomain[0] + fraction * (xDomain[1] - xDomain[0]);
    const yValue = yDomain[0] + fraction * (yDomain[1] - yDomain[0]);
    const xPixel = x(xValue);
    const yPixel = y(yValue);
    context.beginPath();
    context.moveTo(xPixel, plot.top);
    context.lineTo(xPixel, plot.bottom);
    context.stroke();
    context.beginPath();
    context.moveTo(plot.left, yPixel);
    context.lineTo(plot.right, yPixel);
    context.stroke();
    context.fillText(xValue.toFixed(0), xPixel - 9, plot.bottom + 19);
    context.fillText(yValue.toFixed(0), 8, yPixel + 4);
  }
  context.fillStyle = "#2e2e2e";
  context.fillText(labels.x, (plot.left + plot.right) / 2 - 55, height - 10);
  context.save();
  context.translate(15, (plot.top + plot.bottom) / 2 + 50);
  context.rotate(-Math.PI / 2);
  context.fillText(labels.y, 0, 0);
  context.restore();
  return { context, plot, x, y };
}

function drawScatter(canvas, analysis, interactive = false) {
  const settings = analysis.settings;
  const allPoints = analysis.intervals.filter((interval) => (
    interval.timeSeconds >= settings.ascentStartSeconds
    && interval.timeSeconds <= settings.ascentEndSeconds
    && Number.isFinite(interval.correctedAngleDegrees)
  ));
  if (!allPoints.length) return;
  const xDomain = extents(allPoints.map((point) => point.correctedAngleDegrees));
  const yDomain = extents(allPoints.map((point) => point.rrMs));
  const chart = axes(canvas, xDomain, yDomain, {
    x: "Corrected table angle (degrees)",
    y: "R–R interval (ms)",
  });
  const localTargets = [];
  for (const point of allPoints) {
    const x = chart.x(point.correctedAngleDegrees);
    const y = chart.y(point.rrMs);
    chart.context.beginPath();
    chart.context.arc(x, y, point.accepted ? 3.7 : 4.5, 0, Math.PI * 2);
    chart.context.fillStyle = point.accepted ? "#2f6f5e" : "#a5aaa7";
    chart.context.fill();
    if (!point.accepted) {
      chart.context.strokeStyle = "#9c2f2f";
      chart.context.stroke();
    }
    if (interactive) localTargets.push({ id: point.id, x, y });
  }
  const regression = analysis.regression;
  if (regression.slope !== null) {
    const startX = xDomain[0];
    const endX = xDomain[1];
    chart.context.beginPath();
    chart.context.moveTo(
      chart.x(startX),
      chart.y(regression.slope * startX + regression.intercept),
    );
    chart.context.lineTo(
      chart.x(endX),
      chart.y(regression.slope * endX + regression.intercept),
    );
    chart.context.strokeStyle = "#9c2f2f";
    chart.context.lineWidth = 2.5;
    chart.context.stroke();
  }
  if (interactive) scatterHitTargets = localTargets;
}

function drawHeartRateScatter(canvas, analysis) {
  const points = analysis.heartRateRegressionPoints;
  if (!points.length) return;
  const xDomain = extents(points.map((point) => point.x));
  const yDomain = extents(points.map((point) => point.y));
  const chart = axes(canvas, xDomain, yDomain, {
    x: "Corrected table angle (degrees)",
    y: "Beat-to-beat HR (bpm)",
  });
  for (const point of points) {
    chart.context.beginPath();
    chart.context.arc(chart.x(point.x), chart.y(point.y), 3.7, 0, Math.PI * 2);
    chart.context.fillStyle = "#2f6f5e";
    chart.context.fill();
  }
  const regression = analysis.heartRateRegression;
  if (regression.slope === null) return;
  chart.context.beginPath();
  chart.context.moveTo(
    chart.x(xDomain[0]),
    chart.y(regression.slope * xDomain[0] + regression.intercept),
  );
  chart.context.lineTo(
    chart.x(xDomain[1]),
    chart.y(regression.slope * xDomain[1] + regression.intercept),
  );
  chart.context.strokeStyle = "#9c2f2f";
  chart.context.lineWidth = 2.5;
  chart.context.stroke();
}

function drawPoincare(canvas, analysis) {
  const colors = {
    supine: "#2f6f5e",
    upright: "#a16518",
    recovery: "#6c6fb4",
  };
  const points = analysis.hrv.segments.flatMap((segment) => (
    segment.poincarePoints.map((point) => ({ ...point, segment: segment.name }))
  ));
  if (!points.length) return;
  const domain = extents(points.flatMap((point) => [point.x, point.y]));
  const chart = axes(canvas, domain, domain, {
    x: "NN interval n (ms)",
    y: "NN interval n+1 (ms)",
  });
  chart.context.beginPath();
  chart.context.moveTo(chart.x(domain[0]), chart.y(domain[0]));
  chart.context.lineTo(chart.x(domain[1]), chart.y(domain[1]));
  chart.context.strokeStyle = "#cad6d0";
  chart.context.setLineDash([5, 5]);
  chart.context.stroke();
  chart.context.setLineDash([]);
  for (const point of points) {
    chart.context.beginPath();
    chart.context.arc(chart.x(point.x), chart.y(point.y), 3.5, 0, Math.PI * 2);
    chart.context.fillStyle = colors[point.segment];
    chart.context.globalAlpha = 0.78;
    chart.context.fill();
  }
  chart.context.globalAlpha = 1;
}

function drawTimeline(canvas, analysis) {
  const timeline = analysis.timeline;
  const intervals = analysis.intervals.filter((interval) => interval.accepted);
  if (!timeline.length || !intervals.length) return;
  const duration = description.durationSeconds;
  const angleDomain = extents(
    timeline.map((point) => point.correctedAngleDegrees).filter(Number.isFinite),
  );
  const chart = axes(canvas, [0, duration], angleDomain, {
    x: "Recording time (seconds)",
    y: "Corrected angle (degrees)",
  });
  chart.context.beginPath();
  let started = false;
  for (const point of timeline) {
    if (!Number.isFinite(point.correctedAngleDegrees)) continue;
    const x = chart.x(point.timeSeconds);
    const y = chart.y(point.correctedAngleDegrees);
    if (!started) chart.context.moveTo(x, y);
    else chart.context.lineTo(x, y);
    started = true;
  }
  chart.context.strokeStyle = "#135841";
  chart.context.lineWidth = 2;
  chart.context.stroke();

  const rrDomain = extents(intervals.map((interval) => interval.rrMs));
  const rrY = (value) => chart.plot.bottom
    - (value - rrDomain[0]) / (rrDomain[1] - rrDomain[0])
    * (chart.plot.bottom - chart.plot.top);
  chart.context.beginPath();
  intervals.forEach((interval, index) => {
    const x = chart.x(interval.timeSeconds);
    const y = rrY(interval.rrMs);
    if (index === 0) chart.context.moveTo(x, y);
    else chart.context.lineTo(x, y);
  });
  chart.context.strokeStyle = "#a16518";
  chart.context.lineWidth = 1.4;
  chart.context.stroke();
  chart.context.fillStyle = "#a16518";
  chart.context.fillText("R–R interval (orange; independently scaled)", chart.plot.right - 245, chart.plot.top + 14);

  for (const event of analysis.events.filter((item) => item.type === "phase")) {
    const x = chart.x(event.relativeSeconds);
    chart.context.beginPath();
    chart.context.moveTo(x, chart.plot.top);
    chart.context.lineTo(x, chart.plot.bottom);
    chart.context.strokeStyle = "#2f6f5e";
    chart.context.setLineDash([4, 4]);
    chart.context.stroke();
    chart.context.setLineDash([]);
  }
}

function summaryRows(container, rows) {
  container.replaceChildren(...rows.map(([label, value]) => {
    const row = document.createElement("div");
    const term = document.createElement("span");
    const detail = document.createElement("strong");
    term.textContent = label;
    detail.textContent = value;
    row.append(term, detail);
    return row;
  }));
}

function renderClinicalSummary(container, statements) {
  container.replaceChildren(...statements.map((statement) => {
    const paragraph = document.createElement("p");
    paragraph.textContent = statement;
    return paragraph;
  }));
}

function renderList(container, statements) {
  container.replaceChildren(...statements.map((statement) => {
    const item = document.createElement("li");
    item.textContent = statement;
    return item;
  }));
}

function renderCriteria(criteria) {
  elements.clinicCriteriaTableBody.replaceChildren(...criteria.map((criterion) => {
    const row = document.createElement("tr");
    const values = [
      criterion.name,
      criterion.result,
      criterion.label,
      `${criterion.basis}. ${criterion.limitation}`,
    ];
    values.forEach((value, index) => {
      const cell = document.createElement(index === 0 ? "th" : "td");
      if (index === 0) cell.scope = "row";
      cell.textContent = value;
      if (index === 2) cell.className = `criterion-status ${criterion.status}`;
      row.append(cell);
    });
    return row;
  }));
}

function renderClinicApproval(approval, attestation) {
  if (!approval) {
    elements.clinicApprovalSummary.replaceChildren();
    elements.clinicAttestation.textContent =
      "Approval fields and licensed reviewer attestation are pending.";
    return;
  }
  summaryRows(elements.clinicApprovalSummary, [
    ["DPT student", approval.studentName],
    ["Licensed reviewer", `${approval.reviewerName}, ${approval.reviewerCredentials}`],
    ["Supervising clinician", `${approval.supervisingClinicianName}, ${approval.supervisingClinicianCredentials}`],
    ["Approval date", approval.approvalDate],
  ]);
  elements.clinicAttestation.textContent = `Electronic attestation: ${attestation}`;
}

function showReport(report) {
  const clinic = report === "clinic";
  elements.clinicReportDocument.hidden = !clinic;
  elements.hmsReportDocument.hidden = clinic;
  elements.showClinicReport.className = clinic ? "" : "secondary";
  elements.showHmsReport.className = clinic ? "secondary" : "";
  document.body.dataset.printReport = report;
}

function renderObservations(container, lines, emptyMessage) {
  container.className = "observation-list";
  container.replaceChildren(...(lines.length ? lines : [emptyMessage]).map((line) => {
    const paragraph = document.createElement("p");
    paragraph.textContent = line;
    return paragraph;
  }));
}

function frequencyValue(segment, property, suffix = " ms²") {
  if (Number.isFinite(segment.frequency?.[property])) {
    return `${segment.frequency[property].toFixed(1)}${suffix}`;
  }
  return "Not eligible";
}

function renderHrvTable(analysis) {
  elements.hrvTableBody.replaceChildren(...analysis.hrv.segments.map((segment) => {
    const row = document.createElement("tr");
    const values = [
      segment.name,
      `${segment.durationSeconds.toFixed(1)} s`,
      `${segment.acceptedNnCount}/${segment.candidateNnCount}`,
      format(segment.metrics.sdnnMs, 1, " ms"),
      format(segment.metrics.rmssdMs, 1, " ms"),
      format(segment.metrics.pnn50Percent, 1, "%"),
      `${format(segment.metrics.sd1Ms, 1)} / ${format(segment.metrics.sd2Ms, 1)}`,
      frequencyValue(segment, "hfPowerMs2"),
      frequencyValue(segment, "lfPowerMs2"),
      frequencyValue(segment, "lfHfRatio", ""),
    ];
    values.forEach((value, index) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      if (index === 7 && segment.eligibility.reasons.length) {
        const reason = document.createElement("span");
        reason.className = "eligibility-reason";
        reason.textContent = segment.eligibility.reasons.join(" ");
        cell.append(reason);
      }
      row.append(cell);
    });
    return row;
  }));
}

function renderHrvReport(container, analysis) {
  container.replaceChildren(...analysis.hrv.segments.map((segment) => {
    const section = document.createElement("section");
    const heading = document.createElement("h4");
    heading.textContent = `${segment.name[0].toUpperCase()}${segment.name.slice(1)} · ${segment.durationSeconds.toFixed(1)} seconds`;
    const metrics = document.createElement("p");
    metrics.textContent =
      `NN ${segment.acceptedNnCount}/${segment.candidateNnCount}; `
      + `SDNN ${format(segment.metrics.sdnnMs, 1, " ms")}; `
      + `RMSSD ${format(segment.metrics.rmssdMs, 1, " ms")}; `
      + `pNN50 ${format(segment.metrics.pnn50Percent, 1, "%")}; `
      + `SD1/SD2 ${format(segment.metrics.sd1Sd2Ratio, 3)}.`;
    const frequency = document.createElement("p");
    frequency.textContent = segment.frequency
      ? `HF ${frequencyValue(segment, "hfPowerMs2")}; LF ${frequencyValue(segment, "lfPowerMs2")}; LF/HF ${frequencyValue(segment, "lfHfRatio", "")}.`
      : segment.eligibility.reasons.join(" ");
    section.append(heading, metrics, frequency);
    return section;
  }));
}

function renderAnalysis(result) {
  currentResult = result;
  approvedReview = null;
  analysisDirty = false;
  elements.analysisPanel.hidden = false;
  elements.physiologyPanel.hidden = false;
  elements.reportPanel.hidden = false;
  showReport("clinic");
  elements.printClinicReport.disabled = true;
  elements.printReport.disabled = true;
  setBadge(elements.reportState, "Draft", "warning");
  elements.reportFooter.textContent =
    "Computer-assisted physiologic analysis; clinician review and approval required.";
  elements.reportReviewerConclusion.textContent =
    elements.reviewerConclusion.value.trim() || "No reviewer conclusion entered.";
  elements.clinicReviewerConclusion.textContent =
    elements.reviewerConclusion.value.trim() || "No reviewer conclusion entered.";
  renderClinicApproval(null);
  const { analysis, recording } = result;
  const calibration = analysis.calibration;
  setBadge(
    elements.calibrationBadge,
    calibration.valid
      ? calibration.source === "reviewer_confirmation_required"
        ? "Angle confirmation required"
        : "Calibration valid"
      : "Calibration invalid",
    calibration.valid && calibration.source !== "reviewer_confirmation_required"
      ? ""
      : "warning",
  );
  elements.approveReview.disabled =
    !calibration.valid
    || calibration.source === "reviewer_confirmation_required";
  elements.rawBaseline.textContent = format(calibration.baselineRawDegrees, 2, "°");
  elements.rawPlateau.textContent = format(calibration.plateauRawDegrees, 2, "°");
  elements.scaleFactor.textContent = format(calibration.scaleFactor, 4);
  elements.rWaveCount.textContent = analysis.quality.detectedRWaveCount;
  elements.acceptedCount.textContent =
    `${analysis.quality.acceptedRrIntervalCount} (${format(analysis.quality.acceptedPercent, 1, "%")})`;
  elements.excludedCount.textContent = analysis.quality.excludedRrIntervalCount;
  elements.baselineHr.textContent = format(
    analysis.summary.baselineMeanHeartRateBpm,
    1,
    " bpm",
  );
  elements.equation.textContent = analysis.regression.equation ?? "Regression unavailable";
  elements.regressionStatistics.textContent =
    `R² ${format(analysis.regression.rSquared, 3)} · n=${analysis.regression.count}`;
  elements.hrEquation.textContent =
    analysis.heartRateRegression.equation ?? "Regression unavailable";
  elements.hrRegressionStatistics.textContent =
    `R² ${format(analysis.heartRateRegression.rSquared, 3)} · n=${analysis.heartRateRegression.count}`;
  elements.eventLegend.replaceChildren(
    ...analysis.events.filter((event) => event.type === "phase").map((event) => {
      const item = document.createElement("span");
      item.textContent =
        `${event.label.replaceAll("_", " ")} · ${event.relativeSeconds.toFixed(1)} s`;
      return item;
    }),
  );
  drawTimeline(elements.timelineChart, analysis);
  drawScatter(elements.scatterChart, analysis, true);
  drawHeartRateScatter(elements.hrScatterChart, analysis);
  drawPoincare(elements.poincareChart, analysis);
  drawTimeline(elements.reportTimelineChart, analysis);
  drawScatter(elements.reportScatterChart, analysis);
  drawHeartRateScatter(elements.reportHrScatterChart, analysis);
  drawPoincare(elements.reportPoincareChart, analysis);

  const clinical = analysis.clinical;
  const clinicReport = analysis.clinicReport;
  renderClinicalSummary(elements.clinicalSummary, clinical.summary);
  renderClinicalSummary(elements.reportClinicalSummary, clinical.summary);
  const heartRateRows = [
    ["Baseline median", format(clinical.heartRate.baselineMedianBpm, 1, " bpm")],
    ["Baseline range", `${format(clinical.heartRate.baselineMinimumBpm, 1)}–${format(clinical.heartRate.baselineMaximumBpm, 1)} bpm`],
    ["Peak upright", format(clinical.heartRate.peakUprightBpm, 1, " bpm")],
    ["Maximum change", format(clinical.heartRate.maximumChangeBpm, 1, " bpm")],
    ["Maximum sustained change", format(clinical.heartRate.maximumSustainedChangeBpm, 1, " bpm")],
    ["Upright duration", format(clinical.heartRate.uprightDurationSeconds, 1, " s")],
    ["Configured HR threshold", `${clinical.heartRate.orthostaticThresholdBpm} bpm over ${clinical.heartRate.orthostaticAssessmentSeconds} s`],
    ["Threshold assessment", clinical.heartRate.orthostaticAssessable
      ? clinical.heartRate.orthostaticThresholdMet ? "Met" : "Not met"
      : "Not assessable"],
  ];
  summaryRows(elements.heartRateSummary, heartRateRows);
  summaryRows(elements.reportHeartRateSummary, heartRateRows);
  summaryRows(elements.clinicHeartRateSummary, heartRateRows.slice(0, 6));
  const recoveryRows = clinical.heartRate.recovery.fixedTimes.map((point) => [
    `${point.offsetSeconds} seconds`,
    Number.isFinite(point.heartRateBpm)
      ? `${point.heartRateBpm.toFixed(1)} bpm · Δ ${format(point.changeFromBaselineBpm, 1, " bpm")}`
      : "Not available",
  ]);
  recoveryRows.push([
    "Return to within 10 bpm of baseline",
    clinical.heartRate.recovery.reachedWithinTenBpm
      ? `${clinical.heartRate.recovery.timeToWithinTenBpmSeconds.toFixed(1)} seconds`
      : "Not observed during recorded recovery",
  ]);
  summaryRows(elements.clinicRecoverySummary, recoveryRows);
  const bpLines = [
    ...(clinical.bloodPressure.baseline
      ? [`Baseline ${clinical.bloodPressure.baseline.systolic}/${clinical.bloodPressure.baseline.diastolic} mmHg.`]
      : []),
    ...clinical.bloodPressure.observations.map((observation) => (
      `${observation.timeSeconds.toFixed(1)} s · ${observation.systolic}/${observation.diastolic} mmHg · Δ ${observation.systolicChange}/${observation.diastolicChange} · angle ${format(observation.correctedAngleDegrees, 1, "°")} · HR ${format(observation.heartRateBpm, 1, " bpm")}`
    )),
    ...(clinical.bloodPressure.orthostaticHypotensionAssessable
      ? [clinical.bloodPressure.orthostaticHypotensionCriteriaMet
        ? "Configured orthostatic hypotension decrease criterion met."
        : "Configured orthostatic hypotension decrease criterion not met."]
      : ["Orthostatic BP criterion not assessable from available upright observations."]),
  ];
  renderObservations(elements.bloodPressureSummary, bpLines, "No BP observations recorded.");
  renderObservations(elements.reportBloodPressure, bpLines, "No BP observations recorded.");
  renderObservations(elements.clinicBloodPressure, bpLines, "No BP observations recorded.");
  const etco2Lines = [
    ...(Number.isFinite(clinical.etco2.baseline)
      ? [`Baseline ${clinical.etco2.baseline} mmHg.`]
      : []),
    ...clinical.etco2.observations.map((observation) => (
      `${observation.timeSeconds.toFixed(1)} s · ${observation.value} mmHg · Δ ${observation.change} · angle ${format(observation.correctedAngleDegrees, 1, "°")} · HR ${format(observation.heartRateBpm, 1, " bpm")}`
    )),
  ];
  renderObservations(elements.etco2Summary, etco2Lines, "No etCO₂ observations recorded.");
  renderObservations(elements.reportEtco2, etco2Lines, "No etCO₂ observations recorded.");
  renderObservations(elements.clinicEtco2, etco2Lines, "No etCO₂ observations recorded.");
  const symptomLines = clinical.symptoms.map((symptom) => (
    `${symptom.label.replaceAll("_", " ")} ${symptom.semantics} at ${symptom.timeSeconds.toFixed(1)} s · angle ${format(symptom.correctedAngleDegrees, 1, "°")} · HR ${format(symptom.heartRateBpm, 1, " bpm")} · ΔHR ${format(symptom.heartRateChangeBpm, 1, " bpm")}`
  ));
  renderObservations(elements.symptomSummary, symptomLines, "No symptoms recorded.");
  renderObservations(elements.reportSymptoms, symptomLines, "No symptoms recorded.");
  renderObservations(elements.clinicSymptoms, symptomLines, "No symptoms recorded.");
  renderHrvTable(analysis);
  renderHrvReport(elements.reportHrvSummary, analysis);

  elements.reportRecordingId.textContent = `Recording ${recording.recordingId}`;
  elements.clinicTestDate.textContent = clinicReport.testDate ?? recording.date;
  renderClinicalSummary(
    elements.clinicPlainSummary,
    clinicReport.plainLanguageSummary,
  );
  elements.clinicProtocolNarrative.textContent = clinicReport.protocol.narrative;
  summaryRows(elements.clinicProtocolSummary, [
    ["Planned supine baseline", `${clinicReport.protocol.planned.baselineSeconds / 60} min`],
    ["Planned target angle", `${clinicReport.protocol.planned.targetAngleDegrees}°`],
    ["Actual reviewed angle", `${clinicReport.protocol.actual.achievedAngleDegrees.toFixed(1)}°`],
    ["Actual upright duration", Number.isFinite(clinicReport.protocol.actual.uprightSeconds)
      ? `${clinicReport.protocol.actual.uprightSeconds.toFixed(1)} s`
      : "Not available"],
    ["Actual recovery duration", Number.isFinite(clinicReport.protocol.actual.recoverySeconds)
      ? `${clinicReport.protocol.actual.recoverySeconds.toFixed(1)} s`
      : "Not available"],
    ["Protocol outcome", clinicReport.protocol.actual.earlyReturn
      ? "Early return to supine"
      : "Recorded protocol progression"],
  ]);
  renderCriteria(clinicReport.criteria);
  renderClinicalSummary(
    elements.clinicImpressionObserved,
    clinicReport.impression.observedResponse,
  );
  renderClinicalSummary(
    elements.clinicImpressionAssessability,
    clinicReport.impression.assessability,
  );
  renderList(
    elements.clinicImpressionLimitations,
    clinicReport.impression.limitations,
  );
  elements.clinicReferenceList.replaceChildren(
    ...clinicReport.reportMethod.references.map((reference) => {
      const item = document.createElement("li");
      const citation = document.createElement("span");
      const support = document.createElement("small");
      citation.textContent = `${reference.citation} DOI: ${reference.doi}`;
      support.textContent = reference.supports;
      item.append(citation, support);
      return item;
    }),
  );
  summaryRows(elements.clinicMethodSummary, [
    ["Report method", clinicReport.reportMethod.reportMethodVersion],
    ["Evidence set", clinicReport.reportMethod.evidenceSetVersion],
    ["Source integrity", recording.integrity.databaseChecksumValid
      && recording.integrity.summaryChecksumValid ? "Verified" : "Not verified"],
    ["Patient identity", "Maintained outside this de-identified report"],
  ]);
  summaryRows(elements.reportRecordingSummary, [
    ["Date", recording.date],
    ["Duration", `${recording.durationSeconds.toFixed(1)} s`],
    ["ECG samples", recording.sampleCounts.ecg.toLocaleString()],
    ["IMU samples", recording.sampleCounts.imu.toLocaleString()],
    ["ECG rate", `${recording.sensor.ecgRateHz} Hz`],
    ["IMU rate", `${recording.sensor.imuRateHz} Hz`],
    ["Raw checksum", recording.integrity.databaseChecksumValid ? "Verified" : "Failed"],
    ["Summary checksum", recording.integrity.summaryChecksumValid ? "Verified" : "Failed"],
  ]);
  elements.reportEquation.textContent = analysis.regression.equation ?? "Regression unavailable.";
  elements.reportRegressionDetail.textContent =
    `Ordinary least-squares fit during ascending tilt: R² = ${format(analysis.regression.rSquared, 3)}, n = ${analysis.regression.count}, corrected-angle range ${format(analysis.regression.angleMinimum, 1, "°")} to ${format(analysis.regression.angleMaximum, 1, "°")}.`;
  elements.reportHrEquation.textContent =
    analysis.heartRateRegression.equation ?? "Regression unavailable.";
  elements.reportHrRegressionDetail.textContent =
    `Ordinary least-squares fit during ascending tilt: R² = ${format(analysis.heartRateRegression.rSquared, 3)}, n = ${analysis.heartRateRegression.count}. Protocol-specific normal slope ranges are not yet established.`;
  summaryRows(elements.reportAnalysisSummary, [
    ["Achieved angle", format(calibration.achievedAngleDegrees, 1, "°")],
    ["Raw baseline", format(calibration.baselineRawDegrees, 2, "°")],
    ["Raw plateau", format(calibration.plateauRawDegrees, 2, "°")],
    ["Calibration scale", format(calibration.scaleFactor, 4)],
    ["Detected R waves", String(analysis.quality.detectedRWaveCount)],
    ["Accepted R–R intervals", `${analysis.quality.acceptedRrIntervalCount} (${format(analysis.quality.acceptedPercent, 1, "%")})`],
    ["Excluded intervals", String(analysis.quality.excludedRrIntervalCount)],
    ["Baseline mean HR", format(analysis.summary.baselineMeanHeartRateBpm, 1, " bpm")],
  ]);
}

async function recalculate() {
  if (!description) return;
  elements.recalculate.disabled = true;
  elements.reviewStatus.textContent = "Analyzing native ECG and IMU timestamps…";
  try {
    const result = await api("/api/analyze", {
      method: "POST",
      body: JSON.stringify({
        recordingId: description.recordingId,
        settings: collectSettings(),
      }),
    });
    renderAnalysis(result);
    elements.reviewStatus.textContent =
      `${result.analysis.regression.count} accepted ascending R–R intervals analyzed.`;
  } catch (error) {
    elements.reviewStatus.textContent = error.message;
  } finally {
    elements.recalculate.disabled = false;
  }
}

function invalidateAnalysis() {
  if (!description) return;
  analysisDirty = true;
  approvedReview = null;
  elements.approveReview.disabled = true;
  elements.printReport.disabled = true;
  setBadge(elements.reportState, "Recalculation required", "warning");
  elements.reportFooter.textContent =
    "Draft review; recalculate after changing review inputs.";
}

async function loadSelectedRecording() {
  const recordingId = elements.recordingSelect.value;
  if (!recordingId) return;
  elements.loadRecording.disabled = true;
  try {
    description = await api(`/api/recordings/${encodeURIComponent(recordingId)}`);
    const integrityPassed =
      description.integrity.finalized
      && description.integrity.databaseChecksumValid
      && description.integrity.summaryChecksumValid;
    setBadge(
      elements.integrityBadge,
      integrityPassed ? "Integrity verified" : "Integrity problem",
      integrityPassed ? "" : "error",
    );
    elements.recordingId.textContent = description.recordingId;
    elements.duration.textContent = `${description.durationSeconds.toFixed(1)} s`;
    elements.ecgSummary.textContent =
      `${description.sampleCounts.ecg.toLocaleString()} · ${description.sensor.ecgRateHz} Hz`;
    elements.imuSummary.textContent =
      `${description.sampleCounts.imu.toLocaleString()} · ${description.sensor.imuRateHz} Hz`;
    elements.rawChecksum.textContent =
      description.integrity.databaseChecksumValid ? "Verified" : "Failed";
    elements.summaryChecksum.textContent =
      description.integrity.summaryChecksumValid ? "Verified" : "Failed";
    const defaults = description.defaults;
    setInput(elements.achievedAngle, defaults.achievedAngleDegrees);
    setInput(elements.baselineStart, defaults.baselineStartSeconds);
    setInput(elements.baselineEnd, defaults.baselineEndSeconds);
    setInput(elements.plateauStart, defaults.plateauStartSeconds);
    setInput(elements.plateauEnd, defaults.plateauEndSeconds);
    setInput(elements.ascentStart, defaults.ascentStartSeconds);
    setInput(elements.ascentEnd, defaults.ascentEndSeconds);
    setInput(elements.supineHrvStart, defaults.supineHrvStartSeconds);
    setInput(elements.supineHrvEnd, defaults.supineHrvEndSeconds);
    setInput(elements.uprightHrvStart, defaults.uprightHrvStartSeconds);
    setInput(elements.uprightHrvEnd, defaults.uprightHrvEndSeconds);
    setInput(elements.recoveryHrvStart, defaults.recoveryHrvStartSeconds);
    setInput(elements.recoveryHrvEnd, defaults.recoveryHrvEndSeconds);
    elements.rrMinimum.value = defaults.minimumRrMs;
    elements.rrMaximum.value = defaults.maximumRrMs;
    elements.orthostaticThreshold.value = defaults.orthostaticHrThresholdBpm;
    elements.orthostaticDuration.value = defaults.orthostaticAssessmentSeconds;
    elements.sustainedWindow.value = defaults.sustainedHrWindowSeconds;
    elements.frequencyMode.value = defaults.frequencyDomainMode;
    elements.minimumHfSeconds.value = defaults.minimumHfSeconds;
    elements.minimumLfSeconds.value = defaults.minimumLfSeconds;
    elements.minimumAcceptedNn.value = defaults.minimumAcceptedNnPercent;
    elements.maximumExcludedNn.value = defaults.maximumExcludedNnPercent;
    elements.requireStationarity.checked = defaults.requireStationarity;
    elements.maximumStationaryAngle.value =
      defaults.maximumStationaryAngleRangeDegrees;
    elements.frequencyOverride.checked =
      defaults.frequencyEligibilityOverride;
    elements.frequencyOverrideRationale.value =
      defaults.frequencyOverrideRationale;
    elements.frequencyOverrideRationale.disabled = true;
    elements.reviewerConclusion.value = "";
    elements.clinicStudentName.value = "";
    elements.clinicReviewerName.value = "";
    elements.clinicReviewerCredentials.value = "";
    elements.clinicSupervisorName.value = "";
    elements.clinicSupervisorCredentials.value = "";
    elements.clinicApprovalDate.value = new Date().toISOString().slice(0, 10);
    elements.clinicAttestationAccepted.checked = false;
    elements.confirmAngle.checked =
      defaults.achievedAngleSource === "acquisition_record";
    elements.confirmAngle.disabled =
      defaults.achievedAngleSource === "acquisition_record";
    excludedIntervalIds = new Set();
    elements.recordingSummary.hidden = false;
    elements.reviewPanel.hidden = false;
    await recalculate();
  } catch (error) {
    setBadge(elements.integrityBadge, "Load failed", "error");
    elements.reviewStatus.textContent = error.message;
  } finally {
    elements.loadRecording.disabled = false;
  }
}

elements.recordingSelect.addEventListener("change", () => {
  elements.loadRecording.disabled = !elements.recordingSelect.value;
});
elements.loadRecording.addEventListener("click", loadSelectedRecording);
elements.recalculate.addEventListener("click", recalculate);
[
  elements.achievedAngle,
  elements.confirmAngle,
  elements.baselineStart,
  elements.baselineEnd,
  elements.plateauStart,
  elements.plateauEnd,
  elements.ascentStart,
  elements.ascentEnd,
  elements.supineHrvStart,
  elements.supineHrvEnd,
  elements.uprightHrvStart,
  elements.uprightHrvEnd,
  elements.recoveryHrvStart,
  elements.recoveryHrvEnd,
  elements.rrMinimum,
  elements.rrMaximum,
  elements.orthostaticThreshold,
  elements.orthostaticDuration,
  elements.sustainedWindow,
  elements.frequencyMode,
  elements.minimumHfSeconds,
  elements.minimumLfSeconds,
  elements.minimumAcceptedNn,
  elements.maximumExcludedNn,
  elements.requireStationarity,
  elements.maximumStationaryAngle,
].forEach((control) => {
  control.addEventListener("change", invalidateAnalysis);
});
elements.frequencyOverride.addEventListener("change", () => {
  elements.frequencyOverrideRationale.disabled =
    !elements.frequencyOverride.checked;
  invalidateAnalysis();
});
elements.frequencyOverrideRationale.addEventListener("change", invalidateAnalysis);
elements.reviewerConclusion.addEventListener("input", () => {
  approvedReview = null;
  elements.printReport.disabled = true;
  setBadge(elements.reportState, "Approval required", "warning");
  elements.reportReviewerConclusion.textContent =
    elements.reviewerConclusion.value.trim() || "No reviewer conclusion entered.";
  elements.clinicReviewerConclusion.textContent =
    elements.reviewerConclusion.value.trim() || "No reviewer conclusion entered.";
});
[
  elements.clinicStudentName,
  elements.clinicReviewerName,
  elements.clinicReviewerCredentials,
  elements.clinicSupervisorName,
  elements.clinicSupervisorCredentials,
  elements.clinicApprovalDate,
  elements.clinicAttestationAccepted,
].forEach((control) => {
  control.addEventListener("change", () => {
    approvedReview = null;
    elements.printClinicReport.disabled = true;
    elements.printReport.disabled = true;
    setBadge(elements.reportState, "Approval required", "warning");
    renderClinicApproval(null);
  });
});
elements.showClinicReport.addEventListener("click", () => showReport("clinic"));
elements.showHmsReport.addEventListener("click", () => {
  showReport("hms");
  redrawCharts();
});
elements.scatterChart.addEventListener("click", async (event) => {
  const bounds = elements.scatterChart.getBoundingClientRect();
  const x = event.clientX - bounds.left;
  const y = event.clientY - bounds.top;
  const closest = scatterHitTargets
    .map((target) => ({
      ...target,
      distance: Math.hypot(target.x - x, target.y - y),
    }))
    .sort((left, right) => left.distance - right.distance)[0];
  if (!closest || closest.distance > 10) return;
  if (excludedIntervalIds.has(closest.id)) excludedIntervalIds.delete(closest.id);
  else excludedIntervalIds.add(closest.id);
  await recalculate();
});
elements.approveReview.addEventListener("click", async () => {
  if (!currentResult || analysisDirty) return;
  elements.approveReview.disabled = true;
  elements.reportStatus.textContent = "Saving immutable review provenance…";
  try {
    const result = await api("/api/reviews", {
      method: "POST",
      body: JSON.stringify({
        recordingId: description.recordingId,
        settings: collectSettings(),
        reviewerConclusion: elements.reviewerConclusion.value,
        clinicApproval: collectClinicApproval(),
      }),
    });
    approvedReview = result.review;
    elements.printClinicReport.disabled = false;
    elements.printReport.disabled = false;
    setBadge(elements.reportState, "Approved", "");
    elements.reportFooter.textContent =
      `Approved review ${approvedReview.reviewId} · ${approvedReview.createdAt} · Source artifacts unchanged.`;
    elements.reportReviewerConclusion.textContent =
      approvedReview.reviewerConclusion || "No reviewer conclusion entered.";
    elements.clinicReviewerConclusion.textContent =
      approvedReview.reviewerConclusion || "No reviewer conclusion entered.";
    renderClinicApproval(
      approvedReview.clinicApproval,
      approvedReview.clinicApproval.attestation,
    );
    elements.clinicReportFooter.textContent =
      `Approved review ${approvedReview.reviewId} · ${approvedReview.createdAt} · Source artifacts unchanged.`;
    elements.reportStatus.textContent =
      "Review provenance saved. The report is ready to print or save as PDF.";
  } catch (error) {
    elements.reportStatus.textContent = error.message;
  } finally {
    elements.approveReview.disabled =
      analysisDirty
      || currentResult.analysis.calibration.source
        === "reviewer_confirmation_required";
  }
});
elements.printReport.addEventListener("click", () => {
  if (!approvedReview) return;
  showReport("hms");
  redrawCharts();
  window.print();
});
elements.printClinicReport.addEventListener("click", () => {
  if (!approvedReview) return;
  showReport("clinic");
  window.print();
});

function redrawCharts() {
  if (!currentResult) return;
  drawTimeline(elements.timelineChart, currentResult.analysis);
  drawScatter(elements.scatterChart, currentResult.analysis, true);
  drawHeartRateScatter(elements.hrScatterChart, currentResult.analysis);
  drawPoincare(elements.poincareChart, currentResult.analysis);
  drawTimeline(elements.reportTimelineChart, currentResult.analysis);
  drawScatter(elements.reportScatterChart, currentResult.analysis);
  drawHeartRateScatter(elements.reportHrScatterChart, currentResult.analysis);
  drawPoincare(elements.reportPoincareChart, currentResult.analysis);
}

window.addEventListener("resize", redrawCharts);
window.addEventListener("beforeprint", redrawCharts);
window.addEventListener("afterprint", redrawCharts);

const listing = await api("/api/recordings");
elements.recordingSelect.replaceChildren(
  new Option(
    listing.recordings.length ? "Select a finalized recording" : "No recordings found",
    "",
  ),
  ...listing.recordings.map((recording) => new Option(
    `${recording.date} · ${recording.recordingId} · ${recording.durationSeconds.toFixed(1)} s`,
    recording.recordingId,
  )),
);
