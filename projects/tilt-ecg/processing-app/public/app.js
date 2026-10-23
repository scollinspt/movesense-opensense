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
  achievedAngle: byId("achieved-angle"),
  confirmAngle: byId("confirm-angle"),
  baselineStart: byId("baseline-start"),
  baselineEnd: byId("baseline-end"),
  plateauStart: byId("plateau-start"),
  plateauEnd: byId("plateau-end"),
  ascentStart: byId("ascent-start"),
  ascentEnd: byId("ascent-end"),
  rrMinimum: byId("rr-minimum"),
  rrMaximum: byId("rr-maximum"),
  recalculate: byId("recalculate"),
  reviewStatus: byId("review-status"),
  calibrationBadge: byId("calibration-badge"),
  timelineChart: byId("timeline-chart"),
  scatterChart: byId("scatter-chart"),
  reportTimelineChart: byId("report-timeline-chart"),
  reportScatterChart: byId("report-scatter-chart"),
  eventLegend: byId("event-legend"),
  equation: byId("equation"),
  regressionStatistics: byId("regression-statistics"),
  rawBaseline: byId("raw-baseline"),
  rawPlateau: byId("raw-plateau"),
  scaleFactor: byId("scale-factor"),
  rWaveCount: byId("r-wave-count"),
  acceptedCount: byId("accepted-count"),
  excludedCount: byId("excluded-count"),
  baselineHr: byId("baseline-hr"),
  reportState: byId("report-state"),
  reportRecordingId: byId("report-recording-id"),
  reportRecordingSummary: byId("report-recording-summary"),
  reportEquation: byId("report-equation"),
  reportRegressionDetail: byId("report-regression-detail"),
  reportAnalysisSummary: byId("report-analysis-summary"),
  reportFooter: byId("report-footer"),
  approveReview: byId("approve-review"),
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
    minimumRrMs: Number(elements.rrMinimum.value),
    maximumRrMs: Number(elements.rrMaximum.value),
    excludedIntervalIds: [...excludedIntervalIds],
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

function renderAnalysis(result) {
  currentResult = result;
  approvedReview = null;
  analysisDirty = false;
  elements.analysisPanel.hidden = false;
  elements.reportPanel.hidden = false;
  elements.printReport.disabled = true;
  setBadge(elements.reportState, "Draft", "warning");
  elements.reportFooter.textContent = "Draft review; not yet approved.";
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
  drawTimeline(elements.reportTimelineChart, analysis);
  drawScatter(elements.reportScatterChart, analysis);

  elements.reportRecordingId.textContent = `Recording ${recording.recordingId}`;
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
    elements.rrMinimum.value = defaults.minimumRrMs;
    elements.rrMaximum.value = defaults.maximumRrMs;
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
  elements.rrMinimum,
  elements.rrMaximum,
].forEach((control) => {
  control.addEventListener("change", invalidateAnalysis);
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
      }),
    });
    approvedReview = result.review;
    elements.printReport.disabled = false;
    setBadge(elements.reportState, "Approved", "");
    elements.reportFooter.textContent =
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
  if (approvedReview) window.print();
});
window.addEventListener("resize", () => {
  if (!currentResult) return;
  drawTimeline(elements.timelineChart, currentResult.analysis);
  drawScatter(elements.scatterChart, currentResult.analysis, true);
  drawTimeline(elements.reportTimelineChart, currentResult.analysis);
  drawScatter(elements.reportScatterChart, currentResult.analysis);
});

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
