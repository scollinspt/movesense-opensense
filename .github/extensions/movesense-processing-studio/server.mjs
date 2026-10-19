import http from "node:http";
import { readFile } from "node:fs/promises";

import { CanvasError } from "@github/copilot-sdk/extension";

import {
  analyzeRecording,
  listRecordings,
  loadOpenSenseResult,
  ProcessingError,
} from "./processing.mjs";
import { runOpenSensePipeline } from "./opensense-runner.mjs";
import {
  addAnnotation,
  configureOpenSimRuntime,
  configureRecording,
  loadProcessingState,
  removeAnnotation,
  updateCalibration,
  updateOneDofMapping,
} from "./storage.mjs";

const MAX_BODY_BYTES = 8 * 1024;

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(value));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
        reject(new CanvasError("REQUEST_TOO_LARGE", "The update is too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new CanvasError("INVALID_JSON", "The request is not valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

function page() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Movesense Processing Studio</title>
  <style>
    :root { color-scheme: dark; --bg:#081018; --panel:#111c27; --line:#294052; --ink:#edf7ff; --muted:#9bb1c2; --cyan:#62d8ff; --green:#6ce3a1; --amber:#ffc96b; --red:#ff8174; }
    * { box-sizing:border-box; }
    body { margin:0; min-height:100vh; color:var(--ink); background:radial-gradient(circle at 15% 0, #15354a 0, transparent 34%),var(--bg); font:14px/1.5 ui-sans-serif,system-ui,-apple-system,sans-serif; }
    header, main { width:min(1180px,calc(100% - 32px)); margin:auto; }
    header { padding:36px 0 22px; }
    .eyebrow { color:var(--cyan); font-size:11px; font-weight:800; letter-spacing:.16em; text-transform:uppercase; }
    h1 { margin:5px 0; font-size:clamp(30px,6vw,54px); line-height:1; letter-spacing:-.045em; }
    header p, .muted { color:var(--muted); }
    main { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; padding-bottom:44px; }
    .panel { min-width:0; padding:20px; border:1px solid var(--line); border-radius:16px; background:rgba(17,28,39,.9); }
    .wide { grid-column:1/-1; }
    h2 { margin:0 0 14px; font-size:18px; }
    .metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }
    .metric { padding:12px; border:1px solid var(--line); border-radius:11px; background:#0b151e; }
    .metric strong { display:block; color:var(--cyan); font-size:20px; }
    .metric span { color:var(--muted); font-size:10px; letter-spacing:.08em; text-transform:uppercase; }
    .ok { color:var(--green)!important; } .warn { color:var(--amber)!important; } .bad { color:var(--red)!important; }
    .toolbar { display:grid; grid-template-columns:minmax(0,1fr) auto auto; gap:10px; align-items:end; }
    .workflow { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:9px; }
    .stage { padding:12px; border:1px solid var(--line); border-radius:11px; background:#0b151e; }
    .stage strong { display:block; margin-bottom:4px; }
    .stage small { color:var(--muted); }
    .stage.complete { border-color:rgba(108,227,161,.5); }
    .stage.active { border-color:var(--cyan); box-shadow:0 0 0 1px rgba(98,216,255,.2) inset; }
    .stage.locked { opacity:.58; }
    .charts { display:grid; gap:14px; }
    .chart { padding:12px; border:1px solid var(--line); border-radius:12px; }
    canvas { width:100%; height:210px; display:block; background:#071018; border-radius:8px; cursor:crosshair; touch-action:none; }
    .legend { display:flex; gap:14px; margin:0 0 8px; color:var(--muted); font-size:12px; }
    .legend i { display:inline-block; width:9px; height:9px; margin-right:4px; border-radius:50%; }
    .axis-controls { display:flex; flex-wrap:wrap; gap:12px; padding:10px 0 2px; }
    .axis-controls label { display:flex; grid-template-columns:auto 1fr; align-items:center; gap:6px; }
    .axis-controls input { width:auto; }
    dl { display:grid; grid-template-columns:max-content 1fr; gap:7px 12px; margin:0; }
    dt { color:var(--muted); } dd { margin:0; overflow-wrap:anywhere; }
    .fields { display:grid; grid-template-columns:1fr 1fr auto auto; gap:10px; align-items:end; }
    label { display:grid; gap:6px; color:var(--muted); font-weight:700; }
    input, select { width:100%; padding:9px 11px; color:var(--ink); background:#08131c; border:1px solid var(--line); border-radius:9px; font:inherit; }
    button { padding:10px 16px; color:#04141c; background:var(--cyan); border:0; border-radius:999px; font:inherit; font-weight:850; cursor:pointer; }
    button.secondary { color:var(--ink); background:#1d3445; border:1px solid var(--line); }
    button.danger { color:#ffd9d4; background:#40201f; border:1px solid #713934; padding:6px 11px; }
    input:focus-visible, select:focus-visible, button:focus-visible { outline:3px solid rgba(98,216,255,.4); outline-offset:2px; }
    #status { min-height:22px; margin-top:8px; color:var(--muted); }
    .empty { padding:22px; border:1px dashed var(--line); border-radius:12px; color:var(--muted); }
    .instruction { padding:12px 14px; margin-bottom:12px; color:#cbefff; background:#0d2a3b; border-left:3px solid var(--cyan); border-radius:8px; }
    .annotations { display:grid; gap:8px; margin-top:12px; }
    .annotation { display:grid; grid-template-columns:1fr auto; gap:10px; align-items:center; padding:10px 12px; border:1px solid var(--line); border-radius:10px; }
    .phase-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:9px; }
    .phase { padding:10px 12px; border:1px solid rgba(191,139,255,.35); border-radius:10px; background:rgba(191,139,255,.07); }
    .phase strong { display:block; }
    .artifact-links { display:flex; flex-wrap:wrap; gap:9px; margin-top:14px; }
    .artifact-links a { padding:8px 12px; color:var(--cyan); border:1px solid var(--line); border-radius:999px; text-decoration:none; }
    .artifact-links a:hover { background:#183144; }
    .motion-viewer { margin-top:16px; padding:16px; border:1px solid var(--line); border-radius:12px; background:#071018; }
    .motion-viewer canvas { height:360px; cursor:default; }
    .playback { display:grid; grid-template-columns:auto minmax(120px,1fr) auto; gap:12px; align-items:center; margin-top:12px; }
    .playback input { padding:0; }
    .pipeline { display:flex; justify-content:center; flex-wrap:wrap; gap:8px; margin:0 0 12px; color:var(--muted); }
    .pipeline span { padding:5px 10px; border:1px solid var(--line); border-radius:999px; }
    .pipeline b { color:var(--cyan); }
    @media(max-width:760px){ main{grid-template-columns:1fr}.wide{grid-column:auto}.metrics{grid-template-columns:repeat(2,1fr)}.fields,.toolbar{grid-template-columns:1fr}.workflow{grid-template-columns:1fr 1fr}.phase-grid{grid-template-columns:1fr} }
  </style>
</head>
<body>
  <header>
    <div class="eyebrow">Movesense · OpenSense</div>
    <h1>Processing Studio</h1>
    <p>Inspect governed IMU data, calibrate neutral, and build a protocol-specific constrained orientation for OpenSense export.</p>
  </header>
  <main id="content"><section class="panel wide"><div class="empty">Loading governed recording…</div></section></main>
  <script>
    const colors = ["#62d8ff", "#6ce3a1", "#ffc96b"];
    const escapeHtml = (value) => String(value).replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]));
    const fixed = (value, digits = 2) => Number(value).toFixed(digits);
    let current = null;
    let selection = null;
    let viewerPlayback = null;
    const enabledAxes = [true, true, true];

    async function request(url, options = {}) {
      const response = await fetch(url, options);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Request failed.");
      return result;
    }

    function xForTime(time, width, duration, padding) {
      return padding + (time / duration) * (width - padding * 2);
    }

    function draw(canvas, rows, key, state) {
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      const context = canvas.getContext("2d");
      context.scale(ratio, ratio);
      context.clearRect(0, 0, width, height);
      const duration = rows.at(-1).timeSeconds;
      const values = rows.flatMap(row => row[key].filter((_, axis) => enabledAxes[axis]));
      if (values.length === 0) {
        context.fillStyle = "#9bb1c2";
        context.fillText("Enable at least one axis to display this signal.", 18, 28);
        return;
      }
      let minimum = Math.min(...values);
      let maximum = Math.max(...values);
      if (maximum === minimum) { maximum += 1; minimum -= 1; }
      const padding = 14;
      const shade = (start, end, color) => {
        context.fillStyle = color;
        const left = xForTime(Math.max(0, start), width, duration, padding);
        const right = xForTime(Math.min(duration, end), width, duration, padding);
        context.fillRect(left, padding, Math.max(1, right - left), height - padding * 2);
      };
      shade(state.calibration.startSeconds, state.calibration.endSeconds, "rgba(108,227,161,.12)");
      state.annotations.forEach(annotation => shade(annotation.startSeconds, annotation.endSeconds, "rgba(255,201,107,.09)"));
      (current?.report?.phases || []).forEach(phase => {
        const x = xForTime(phase.timeSeconds, width, duration, padding);
        context.save();
        context.strokeStyle = "#bf8bff";
        context.setLineDash([4, 3]);
        context.beginPath();
        context.moveTo(x, padding);
        context.lineTo(x, height - padding);
        context.stroke();
        context.restore();
      });
      if (selection) shade(selection.startSeconds, selection.endSeconds, "rgba(98,216,255,.18)");
      context.strokeStyle = "#203646";
      context.beginPath();
      context.moveTo(padding, height / 2);
      context.lineTo(width - padding, height / 2);
      context.stroke();
      for (let axis = 0; axis < 3; axis += 1) {
        if (!enabledAxes[axis]) continue;
        context.strokeStyle = colors[axis];
        context.lineWidth = 1.5;
        context.beginPath();
        rows.forEach((row, index) => {
          const x = xForTime(row.timeSeconds, width, duration, padding);
          const y = padding + ((maximum - row[key][axis]) / (maximum - minimum)) * (height - padding * 2);
          if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
        });
        context.stroke();
      }
      context.fillStyle = "#9bb1c2";
      context.font = "11px ui-sans-serif, system-ui";
      context.fillText("0 s", padding, height - 2);
      context.textAlign = "right";
      context.fillText(fixed(duration, 2) + " s", width - padding, height - 2);
      context.textAlign = "left";
    }

    function chart(title, key, unit) {
      return \`<section class="chart"><h2>\${escapeHtml(title)} <span class="muted">(\${escapeHtml(unit)})</span></h2><canvas id="chart-\${key}" data-signal="\${key}" aria-label="\${escapeHtml(title)} chart; drag to select a time interval"></canvas></section>\`;
    }

    function drawAngle(canvas, oneDof) {
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      const context = canvas.getContext("2d");
      context.scale(ratio, ratio);
      const key = oneDof.mappingAssigned ? "anatomicalAngleDegrees" : "sensorAngleDegrees";
      const values = oneDof.plot.map(row => row[key]);
      let minimum = Math.min(...values);
      let maximum = Math.max(...values);
      if (minimum === maximum) { minimum -= 1; maximum += 1; }
      const padding = 18;
      context.strokeStyle = "#203646";
      context.beginPath();
      context.moveTo(padding, height - padding);
      context.lineTo(width - padding, height - padding);
      context.stroke();
      context.strokeStyle = "#62d8ff";
      context.lineWidth = 2;
      context.beginPath();
      oneDof.plot.forEach((row, index) => {
        const x = padding + (index / Math.max(1, oneDof.plot.length - 1)) * (width - padding * 2);
        const y = padding + ((maximum - row[key]) / (maximum - minimum)) * (height - padding * 2);
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      });
      context.stroke();
      context.fillStyle = "#9bb1c2";
      context.font = "11px ui-sans-serif, system-ui";
      context.fillText(fixed(maximum,1) + "°", 4, 12);
      context.fillText(fixed(minimum,1) + "°", 4, height - 4);
    }

    function drawElbowPose(context, centerX, frame, angleDegrees, color, label, side) {
      const shoulderY = 78;
      const elbowY = 184;
      const length = 118;
      const direction = side === "left" ? -1 : 1;
      const angle = (angleDegrees * Math.PI) / 180;
      const wristX = centerX + direction * Math.sin(angle) * length;
      const wristY = elbowY + Math.cos(angle) * length;
      context.fillStyle = "#9bb1c2";
      context.font = "700 12px ui-sans-serif, system-ui";
      context.textAlign = "center";
      context.fillText(label, centerX, 27);
      context.fillStyle = color;
      context.font = "800 22px ui-sans-serif, system-ui";
      context.fillText(fixed(angleDegrees, 2) + "°", centerX, 53);
      context.lineCap = "round";
      context.strokeStyle = "#4a83ad";
      context.lineWidth = 18;
      context.beginPath();
      context.moveTo(centerX, shoulderY);
      context.lineTo(centerX, elbowY);
      context.stroke();
      context.strokeStyle = color;
      context.lineWidth = 15;
      context.beginPath();
      context.moveTo(centerX, elbowY);
      context.lineTo(wristX, wristY);
      context.stroke();
      for (const [x, y] of [[centerX, shoulderY], [centerX, elbowY], [wristX, wristY]]) {
        context.fillStyle = "#edf7ff";
        context.beginPath();
        context.arc(x, y, 7, 0, Math.PI * 2);
        context.fill();
      }
      context.save();
      context.translate(wristX, wristY);
      context.rotate(-direction * angle);
      context.fillStyle = "#ff8174";
      context.fillRect(-15, -7, 30, 14);
      context.restore();
      context.fillStyle = "#9bb1c2";
      context.font = "11px ui-sans-serif, system-ui";
      context.fillText(frame, centerX, 335);
    }

    function drawForearmPose(context, centerX, frame, angleDegrees, color, label) {
      const axisY = 180;
      const radius = 48;
      const angle = (angleDegrees * Math.PI) / 180;
      context.fillStyle = "#9bb1c2";
      context.font = "700 12px ui-sans-serif, system-ui";
      context.textAlign = "center";
      context.fillText(label, centerX, 27);
      context.fillStyle = color;
      context.font = "800 22px ui-sans-serif, system-ui";
      context.fillText(fixed(angleDegrees, 2) + "°", centerX, 53);
      context.strokeStyle = "#4a83ad";
      context.lineWidth = 22;
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(centerX, 90);
      context.lineTo(centerX, 286);
      context.stroke();
      context.strokeStyle = color;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(centerX, axisY, radius, 0, Math.PI * 2);
      context.stroke();
      const markerX = centerX + Math.sin(angle) * radius;
      const markerY = axisY - Math.cos(angle) * radius;
      context.fillStyle = "#ff8174";
      context.beginPath();
      context.arc(markerX, markerY, 10, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#9bb1c2";
      context.font = "11px ui-sans-serif, system-ui";
      context.fillText(frame, centerX, 335);
    }

    function renderMotionFrame(index) {
      const visualization = current?.opensense?.visualization;
      const canvas = document.getElementById("opensense-motion-viewer");
      if (!visualization || !canvas) return;
      const frameIndex = Math.max(0, Math.min(visualization.frames.length - 1, Number(index)));
      const frame = visualization.frames[frameIndex];
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      const context = canvas.getContext("2d");
      context.scale(ratio, ratio);
      context.clearRect(0, 0, width, height);
      context.strokeStyle = "#203646";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(width / 2, 18);
      context.lineTo(width / 2, height - 18);
      context.stroke();
      const drawPose = visualization.motionType === "elbow_flexion" ? drawElbowPose : drawForearmPose;
      drawPose(context, width * 0.25, "Quaternion orientation", frame.sourceAngleDegrees, "#ffc96b", "Movesense → OpenSense", visualization.side);
      drawPose(context, width * 0.75, visualization.coordinateName, frame.ikAngleDegrees, "#62d8ff", "OpenSim inverse kinematics", visualization.side);
      document.getElementById("viewer-time").textContent = fixed(frame.timeSeconds, 3) + " s";
      document.getElementById("viewer-source-angle").textContent = fixed(frame.sourceAngleDegrees, 3) + "°";
      document.getElementById("viewer-ik-angle").textContent = fixed(frame.ikAngleDegrees, 3) + "°";
      document.getElementById("viewer-error").textContent = fixed(frame.errorDegrees, 6) + "°";
      document.getElementById("viewer-slider").value = String(frameIndex);
    }

    function stopViewer() {
      if (!viewerPlayback) return;
      cancelAnimationFrame(viewerPlayback.requestId);
      viewerPlayback = null;
      const button = document.getElementById("viewer-play");
      if (button) button.textContent = "Play";
    }

    function toggleViewer() {
      if (viewerPlayback) {
        stopViewer();
        return;
      }
      const visualization = current.opensense.visualization;
      const slider = document.getElementById("viewer-slider");
      let index = Number(slider.value);
      if (index >= visualization.frames.length - 1) index = 0;
      viewerPlayback = {
        index,
        timeSeconds: visualization.frames[index].timeSeconds,
        previousTimestamp: null,
        requestId: 0,
      };
      document.getElementById("viewer-play").textContent = "Pause";
      const step = timestamp => {
        if (!viewerPlayback) return;
        if (viewerPlayback.previousTimestamp !== null) {
          const speed = Number(document.getElementById("viewer-speed").value);
          const elapsed = ((timestamp - viewerPlayback.previousTimestamp) / 1000) * speed;
          viewerPlayback.timeSeconds += elapsed;
          while (
            viewerPlayback.index < visualization.frames.length - 1 &&
            visualization.frames[viewerPlayback.index + 1].timeSeconds <= viewerPlayback.timeSeconds
          ) viewerPlayback.index += 1;
        }
        viewerPlayback.previousTimestamp = timestamp;
        renderMotionFrame(viewerPlayback.index);
        if (viewerPlayback.index >= visualization.frames.length - 1) {
          stopViewer();
          return;
        }
        viewerPlayback.requestId = requestAnimationFrame(step);
      };
      viewerPlayback.requestId = requestAnimationFrame(step);
    }

    function redraw() {
      if (!current) return;
      for (const key of ["acceleration", "angularVelocity", "magneticField"]) {
        draw(document.getElementById(\`chart-\${key}\`), current.report.plot.rows, key, current.state);
      }
    }

    function eventTime(canvas, event) {
      const rectangle = canvas.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (event.clientX - rectangle.left - 14) / Math.max(1, rectangle.width - 28)));
      return fraction * current.report.timing.spanSeconds;
    }

    function updateSelectionFields() {
      if (!selection) return;
      document.getElementById("selection-start").value = fixed(selection.startSeconds, 3);
      document.getElementById("selection-end").value = fixed(selection.endSeconds, 3);
      document.getElementById("selection-duration").textContent = fixed(selection.endSeconds - selection.startSeconds, 3) + " s selected";
    }

    function attachSelection(canvas) {
      let anchor = null;
      canvas.addEventListener("pointerdown", event => {
        anchor = eventTime(canvas, event);
        selection = { startSeconds: anchor, endSeconds: anchor };
        canvas.setPointerCapture(event.pointerId);
        redraw();
      });
      canvas.addEventListener("pointermove", event => {
        if (anchor === null) return;
        const value = eventTime(canvas, event);
        selection = {
          startSeconds: Math.min(anchor, value),
          endSeconds: Math.max(anchor, value),
        };
        updateSelectionFields();
        redraw();
      });
      canvas.addEventListener("pointerup", event => {
        if (anchor === null) return;
        const value = eventTime(canvas, event);
        selection = {
          startSeconds: Math.min(anchor, value),
          endSeconds: Math.max(anchor, value),
        };
        anchor = null;
        updateSelectionFields();
        redraw();
      });
    }

    function selectedInterval() {
      const startSeconds = Number(document.getElementById("selection-start").value);
      const endSeconds = Number(document.getElementById("selection-end").value);
      if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || endSeconds <= startSeconds) {
        throw new Error("Drag across a chart or enter a valid non-empty interval.");
      }
      return { startSeconds, endSeconds };
    }

    async function saveCalibration() {
      const status = document.getElementById("status");
      status.textContent = "Saving…";
      await request("/api/calibration", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(selectedInterval()),
      });
      status.textContent = "Calibration interval saved and recalculated.";
      await load();
    }

    async function addMovement() {
      const status = document.getElementById("status");
      const interval = selectedInterval();
      const label = document.getElementById("annotation-label").value.trim();
      if (!label) throw new Error("Enter a movement label.");
      await request("/api/annotations", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ label, ...interval }),
      });
      status.textContent = "Movement interval added.";
      await load();
    }

    async function removeMovement(id) {
      await request("/api/annotations", {
        method: "DELETE",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ id }),
      });
      await load();
    }

    async function switchRecording() {
      await request("/api/recording", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ recordingId: document.getElementById("recording-select").value }),
      });
      selection = null;
      await load();
    }

    async function saveOneDofMapping() {
      await request("/api/one-dof-mapping", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          firstMovement: document.getElementById("first-movement").value,
        }),
      });
      await load();
    }

    async function configureRuntime() {
      await request("/api/opensim-runtime", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          pythonExecutable: document.getElementById("opensim-python").value,
          sdkPythonPath: document.getElementById("opensim-sdk").value,
        }),
      });
      await load();
    }

    async function runOpenSense() {
      const status = document.getElementById("opensense-status");
      status.textContent = "Running OpenSim inverse kinematics…";
      await request("/api/run-opensense", { method: "POST" });
      status.textContent = "OpenSense processing completed.";
      await load();
    }

    function calibrationMetrics(summary) {
      if (!summary || !summary.sampleCount) return \`<div class="empty">The saved interval contains no samples.</div>\`;
      return \`<div class="metrics">
        <div class="metric"><strong>\${summary.sampleCount}</strong><span>Calibration samples</span></div>
        <div class="metric"><strong>\${fixed(summary.accelerationMagnitude.mean,3)}</strong><span>Mean |a| m/s²</span></div>
        <div class="metric"><strong>\${fixed(summary.angularVelocityMagnitude.mean,3)}</strong><span>Mean |ω| deg/s</span></div>
        <div class="metric"><strong>\${fixed(summary.magneticFieldMagnitude.mean,2)}</strong><span>Mean |B| µT</span></div>
      </div><p class="muted">Variability: |a| SD \${fixed(summary.accelerationMagnitude.standardDeviation,4)} m/s²; |ω| SD \${fixed(summary.angularVelocityMagnitude.standardDeviation,4)} deg/s; |B| SD \${fixed(summary.magneticFieldMagnitude.standardDeviation,3)} µT. These are diagnostics, not automatic acceptance criteria.</p>\`;
    }

    async function load() {
      const content = document.getElementById("content");
      let result;
      try {
        result = await request("/api/report");
      } catch (error) {
        content.innerHTML = \`<section class="panel wide"><h2>Recording setup required</h2><div class="empty">\${escapeHtml(error.message)}</div></section>\`;
        return;
      }
      current = result;
      const { state, report, recordings, opensense } = result;
      const integrity = report.integrity;
      const timing = report.timing;
      const protocol = report.manifest.protocol;
      const isMultiDofProtocol = protocol.movement === "combined_elbow_forearm";
      const isElbowProtocol = protocol.movement === "isolated_elbow_flexion_extension";
      const positiveDirectionLabel = isElbowProtocol ? "Flexion" : "Pronation";
      const negativeDirectionLabel = isElbowProtocol ? "Extension" : "Supination";
      const positiveDirectionValue = isElbowProtocol ? "flexion" : "pronation";
      const negativeDirectionValue = isElbowProtocol ? "extension" : "supination";
      const motionLabel = isElbowProtocol ? "elbow" : "forearm";
      const oneDof = report.oneDof;
      const calibrationComplete = Boolean(report.calibration?.sampleCount);
      const mappingComplete = Boolean(oneDof?.mappingAssigned);
      const opensenseComplete = Boolean(opensense?.validation?.passed);
      stopViewer();
      if (!selection) selection = { ...state.calibration };
      const annotations = state.annotations.length
        ? state.annotations.map(annotation => \`<div class="annotation"><div><strong>\${escapeHtml(annotation.label)}</strong><div class="muted">\${fixed(annotation.startSeconds,3)}–\${fixed(annotation.endSeconds,3)} s</div></div><button class="danger remove-annotation" data-id="\${escapeHtml(annotation.id)}" type="button">Remove</button></div>\`).join("")
        : \`<div class="empty">No movement intervals annotated yet.</div>\`;
      const phaseCards = report.phases.length
        ? report.phases.map(phase => \`<div class="phase"><strong>\${phase.sequence} · \${escapeHtml(phase.label.replaceAll("_", " "))}</strong><span class="muted">\${fixed(phase.timeSeconds,3)}–\${fixed(phase.endTimeSeconds,3)} s · sample \${phase.sampleIndex.toLocaleString()}</span></div>\`).join("")
        : \`<div class="empty">This recording has no acquired phase markers.</div>\`;
      content.innerHTML = \`
        <section class="panel wide">
          <div class="toolbar">
            <label>Governed recording<select id="recording-select">\${recordings.map(recording => \`<option value="\${escapeHtml(recording.recordingId)}" \${recording.recordingId === state.recordingId ? "selected" : ""}>\${escapeHtml(recording.recordingId)} · \${escapeHtml(recording.movement)}</option>\`).join("")}</select></label>
            <button id="load-recording" type="button">Load recording</button>
            <button id="refresh" class="secondary" type="button">Refresh</button>
          </div>
        </section>
        <section class="panel wide workflow" aria-label="Processing stages">
          \${isMultiDofProtocol ? \`
            <div class="stage complete"><strong>1 · Integrity</strong><small>Verified raw input</small></div>
            <div class="stage \${report.phases.length ? "complete" : "active"}"><strong>2 · Phases</strong><small>\${report.phases.length} acquired markers</small></div>
            <div class="stage active"><strong>3 · 3-D orientation</strong><small>Fusion implementation required</small></div>
            <div class="stage locked"><strong>4 · Frame mapping</strong><small>Calibrate wrist IMU to model</small></div>
            <div class="stage locked"><strong>5 · 2-DOF OpenSense</strong><small>Elbow flexion plus forearm rotation</small></div>\`
          : \`
            <div class="stage complete"><strong>1 · Integrity</strong><small>Verified raw input</small></div>
            <div class="stage \${calibrationComplete ? "complete" : "active"}"><strong>2 · Calibrate</strong><small>\${calibrationComplete ? fixed(state.calibration.startSeconds,3) + "–" + fixed(state.calibration.endSeconds,3) + " s saved" : "Select static pose"}</small></div>
            <div class="stage \${oneDof ? "complete" : "active"}"><strong>3 · 1-DOF estimate</strong><small>\${oneDof ? "Sensor " + oneDof.dominantAxis.toUpperCase() + " · " + fixed(oneDof.axisEnergyFraction * 100,2) + "% energy" : "Estimate rotation axis"}</small></div>
            <div class="stage \${mappingComplete ? "complete" : "active"}"><strong>4 · Sign mapping</strong><small>\${mappingComplete ? positiveDirectionLabel + "-positive assigned" : "Confirm first movement"}</small></div>
            <div class="stage \${opensenseComplete ? "complete" : mappingComplete ? "active" : "locked"}"><strong>5 · Quaternion/OpenSense</strong><small>\${opensenseComplete ? opensense.validation.sampleCount + " samples validated" : mappingComplete ? "Next: neutral-referenced export" : "Complete sign mapping first"}</small></div>\`}
        </section>
        <section class="panel wide">
          <h2>Recording integrity</h2>
          <div class="metrics">
            <div class="metric"><strong class="\${integrity.checksumMatches ? "ok" : "bad"}">\${integrity.checksumMatches ? "Verified" : "Mismatch"}</strong><span>SHA-256</span></div>
            <div class="metric"><strong>\${integrity.parsedSamples}</strong><span>Valid samples</span></div>
            <div class="metric"><strong class="\${integrity.malformedRows ? "bad" : "ok"}">\${integrity.malformedRows}</strong><span>Malformed rows</span></div>
            <div class="metric"><strong>\${fixed(timing.spanSeconds)} s</strong><span>Sensor-time span</span></div>
          </div>
        </section>
        <section class="panel">
          <h2>Timing</h2>
          <dl>
            <dt>Effective rate</dt><dd>\${fixed(timing.effectiveRateHz, 3)} Hz</dd>
            <dt>Sample step</dt><dd>\${timing.minimumStepMs}–\${timing.maximumStepMs} ms; median \${timing.medianStepMs} ms</dd>
            <dt>Nonpositive steps</dt><dd>\${timing.nonpositiveSteps}</dd>
            <dt>Gaps over 30 ms</dt><dd>\${timing.gapsOver30Ms}</dd>
            <dt>Repeated host receipts</dt><dd>\${timing.repeatedHostMonotonicTimestamps} (expected from packet batching)</dd>
          </dl>
        </section>
        <section class="panel">
          <h2>Protocol provenance</h2>
          <dl>
            <dt>Recording</dt><dd>\${escapeHtml(report.manifest.recordingId)}</dd>
            <dt>Movement</dt><dd>\${escapeHtml(protocol.movement)}</dd>
            <dt>Placement</dt><dd>\${escapeHtml(protocol.placement)}</dd>
            <dt>Anatomical start</dt><dd>\${protocol.anatomicalStartConfirmed ? "Confirmed" : "Not confirmed"}</dd>
            <dt>Proximal control</dt><dd>\${protocol.proximalControlConfirmed ? "Confirmed" : "Not confirmed"}</dd>
          </dl>
        </section>
        <section class="panel wide charts">
          <div>
            <div class="instruction"><strong>Interact with the data:</strong> drag left-to-right across any plot to select a sensor-time interval. The same selection appears on all plots.</div>
            <div class="axis-controls" aria-label="Visible axes">
              <label><input class="axis-toggle" data-axis="0" type="checkbox" checked> X axis</label>
              <label><input class="axis-toggle" data-axis="1" type="checkbox" checked> Y axis</label>
              <label><input class="axis-toggle" data-axis="2" type="checkbox" checked> Z axis</label>
              <span class="muted">Green = saved calibration · Amber = annotation · Blue = current selection</span>
              <span class="muted">Purple lines = acquired phase markers</span>
            </div>
          </div>
          \${chart("Acceleration", "acceleration", "m/s²")}
          \${chart("Angular velocity", "angularVelocity", "deg/s")}
          \${chart("Magnetic field", "magneticField", "µT")}
        </section>
        <section class="panel wide">
          <h2>Acquired protocol phases</h2>
          <p class="muted">These markers were written during acquisition. Check their boundaries against the traces without changing the raw recording.</p>
          <div class="phase-grid">\${phaseCards}</div>
        </section>
        <section class="panel wide">
          <h2>\${isMultiDofProtocol ? "Two-DOF processing readiness" : "Constrained one-DOF " + motionLabel + " estimate"}</h2>
          \${isMultiDofProtocol
            ? \`<div class="instruction"><strong>Correctly gated:</strong> this recording changes elbow flexion and forearm rotation across moving reference frames. The one-axis estimator is disabled. Full 3-D orientation, wrist-to-model calibration, and a two-coordinate OpenSim model are required next.</div>\`
            : oneDof ? \`
            <p class="muted">After subtracting static gyroscope bias, sensor <strong>\${oneDof.dominantAxis.toUpperCase()}</strong> accounts for <strong>\${fixed(oneDof.axisEnergyFraction * 100,2)}%</strong> of rotational energy. This supports a constrained one-axis estimator for this trial; it is not a general orientation solution.</p>
            <div class="metrics">
              <div class="metric"><strong>\${oneDof.dominantAxis.toUpperCase()}</strong><span>Dominant sensor axis</span></div>
              <div class="metric"><strong>\${fixed(oneDof.sensorAngle.minimum,1)}°</strong><span>Sensor-angle minimum</span></div>
              <div class="metric"><strong>\${fixed(oneDof.sensorAngle.maximum,1)}°</strong><span>Sensor-angle maximum</span></div>
              <div class="metric"><strong>\${fixed(oneDof.sensorAngle.final,1)}°</strong><span>Sensor-angle final</span></div>
            </div>
            <div class="chart" style="margin-top:12px"><h2>\${oneDof.mappingAssigned ? positiveDirectionLabel + "-positive " + motionLabel + " angle" : "Unmapped sensor-relative angle"} <span class="muted">(degrees)</span></h2><canvas id="chart-one-dof" aria-label="Constrained one degree of freedom angle estimate"></canvas></div>
            <div class="instruction" style="margin-top:12px">\${oneDof.mappingAssigned
              ? "Mapping saved: the first intentional movement was " + state.oneDofMapping.firstMovement + ", so this trace is now displayed with " + positiveDirectionLabel.toLowerCase() + " positive."
              : "One decision remains before calling this an anatomical angle: identify the first intentional movement after neutral. The studio detected an initial sensor-" + oneDof.initialSensorDirection + " " + oneDof.dominantAxis.toUpperCase() + " excursion and will use your answer to make " + positiveDirectionLabel.toLowerCase() + " positive."}</div>
            <div class="fields">
              <label style="grid-column:span 2">First intentional movement from anatomical neutral
                <select id="first-movement">
                  <option value="unassigned" \${state.oneDofMapping.firstMovement === "unassigned" ? "selected" : ""}>Choose direction…</option>
                  <option value="\${positiveDirectionValue}" \${state.oneDofMapping.firstMovement === positiveDirectionValue ? "selected" : ""}>\${positiveDirectionLabel}</option>
                  <option value="\${negativeDirectionValue}" \${state.oneDofMapping.firstMovement === negativeDirectionValue ? "selected" : ""}>\${negativeDirectionLabel}</option>
                </select>
              </label>
              <button id="save-mapping" type="button">Save sign mapping</button>
            </div>\`
            : \`<div class="empty">Save a calibration interval and movement annotation to calculate the constrained estimator.</div>\`}
        </section>
        <section class="panel wide">
          <h2>Selected interval</h2>
          <div class="fields">
            <label>Start (seconds)<input id="selection-start" type="number" min="0" step="0.001" value="\${fixed(selection.startSeconds,3)}"></label>
            <label>End (seconds)<input id="selection-end" type="number" min="0" step="0.001" value="\${fixed(selection.endSeconds,3)}"></label>
            <button id="save-calibration" type="button">Use as calibration</button>
            <span id="selection-duration" class="muted">\${fixed(selection.endSeconds - selection.startSeconds,3)} s selected</span>
          </div>
          <div id="status" role="status" aria-live="polite"></div>
        </section>
        <section class="panel wide">
          <h2>OpenSense export and inverse kinematics</h2>
          \${isMultiDofProtocol
            ? \`<div class="empty">The validated one-DOF runner is intentionally unavailable for this recording. Build and validate the full-orientation, two-coordinate pipeline before running OpenSense.</div>\`
            : opensenseComplete ? \`
            <div class="instruction"><strong>Validated:</strong> OpenSim 4.6 tracked the generated <code>forearm_\${opensense.estimator.side === "left" ? "l" : "r"}_imu</code> quaternions with the project-owned one-DOF model across the full movement interval.</div>
            <div class="metrics">
              <div class="metric"><strong class="ok">Passed</strong><span>IK validation</span></div>
              <div class="metric"><strong>\${opensense.validation.sampleCount}</strong><span>Samples</span></div>
              <div class="metric"><strong>\${fixed(opensense.validation.maximumAbsoluteCoordinateErrorDegrees,6)}°</strong><span>Maximum error</span></div>
              <div class="metric"><strong>\${fixed(opensense.validation.rmsCoordinateErrorDegrees,6)}°</strong><span>RMS error</span></div>
            </div>
            <p class="muted">\${isElbowProtocol
              ? "This constrained model fixes the humerus and exposes only the " + opensense.estimator.coordinateName + " coordinate."
              : "Arm26 was not used because it has shoulder elevation and elbow flexion coordinates but no forearm pronation/supination coordinate. This constrained model fixes the humerus and exposes only " + opensense.estimator.coordinateName + "."}</p>
            <div class="motion-viewer">
              <div class="pipeline" aria-label="Visualization data flow">
                <span><b>Movesense</b> gyroscope</span><span>→</span><span><b>OpenSense</b> quaternion STO</span><span>→</span><span><b>OpenSim</b> IK motion</span>
              </div>
              <canvas id="opensense-motion-viewer" aria-label="Synchronized comparison of the Movesense-derived OpenSense orientation and OpenSim inverse kinematics motion"></canvas>
              <div class="metrics" style="margin-top:12px">
                <div class="metric"><strong id="viewer-time">0.000 s</strong><span>Movement time</span></div>
                <div class="metric"><strong id="viewer-source-angle">0.000°</strong><span>OpenSense angle</span></div>
                <div class="metric"><strong id="viewer-ik-angle">0.000°</strong><span>OpenSim IK angle</span></div>
                <div class="metric"><strong id="viewer-error" class="ok">0.000000°</strong><span>Frame error</span></div>
              </div>
              <div class="playback">
                <button id="viewer-play" type="button">Play</button>
                <label>Playback position<input id="viewer-slider" type="range" min="0" max="\${opensense.visualization.frames.length - 1}" value="0" step="1"></label>
                <label>Speed<select id="viewer-speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select></label>
              </div>
            </div>
            <div class="artifact-links">
              <a href="/api/artifact?kind=orientationsSto" target="_blank">Quaternion STO</a>
              <a href="/api/artifact?kind=model" target="_blank">One-DOF OpenSim model</a>
              <a href="/api/artifact?kind=inverseKinematicsMotion" target="_blank">IK motion</a>
              <a href="/api/artifact?kind=processingManifest" target="_blank">Processing manifest</a>
            </div>\`
            : \`<div class="empty">No checksum-verified OpenSense result is available for this recording yet.</div>\`}
          <div style="margin-top:16px">
            <button id="run-opensense" type="button" \${!isMultiDofProtocol && state.opensimRuntime.pythonExecutable && mappingComplete && state.annotations.length ? "" : "disabled"}>\${opensenseComplete ? "Re-run OpenSense" : "Run OpenSense"}</button>
            <span id="opensense-status" class="muted" role="status" aria-live="polite"></span>
          </div>
          <details style="margin-top:14px">
            <summary>Host-specific OpenSim runtime</summary>
            <p class="muted">These paths stay in private extension state and are never committed.</p>
            <div class="fields">
              <label style="grid-column:span 2">Python executable<input id="opensim-python" value="\${escapeHtml(state.opensimRuntime.pythonExecutable)}"></label>
              <label style="grid-column:span 2">OpenSim SDK Python folder<input id="opensim-sdk" value="\${escapeHtml(state.opensimRuntime.sdkPythonPath)}"></label>
              <button id="save-runtime" type="button">Save runtime</button>
            </div>
          </details>
        </section>
        <section class="panel wide">
          <h2>Saved calibration diagnostics</h2>
          \${calibrationMetrics(report.calibration)}
        </section>
        <section class="panel wide">
          <h2>Movement interval annotations</h2>
          <p class="muted">Select a plot interval, give it a descriptive label, and save it privately. Raw data is never modified.</p>
          <div class="fields">
            <label style="grid-column:span 2">Label<input id="annotation-label" value="\${isElbowProtocol ? "elbow flexion/extension" : "forearm pronation/supination"}" maxlength="80"></label>
            <button id="add-annotation" type="button">Add selected interval</button>
          </div>
          <div class="annotations">\${annotations}</div>
        </section>\`;
      document.getElementById("load-recording").addEventListener("click", () => switchRecording().catch(showError));
      document.getElementById("refresh").addEventListener("click", () => load().catch(showError));
      document.getElementById("save-calibration").addEventListener("click", () => saveCalibration().catch(showError));
      document.getElementById("add-annotation").addEventListener("click", () => addMovement().catch(showError));
      document.getElementById("save-mapping")?.addEventListener("click", () => saveOneDofMapping().catch(showError));
      document.getElementById("save-runtime").addEventListener("click", () => configureRuntime().catch(showError));
      document.getElementById("run-opensense").addEventListener("click", () => runOpenSense().catch(showError));
      document.getElementById("viewer-play")?.addEventListener("click", toggleViewer);
      document.getElementById("viewer-slider")?.addEventListener("input", event => {
        stopViewer();
        renderMotionFrame(event.target.value);
      });
      document.querySelectorAll(".remove-annotation").forEach(button => button.addEventListener("click", () => removeMovement(button.dataset.id).catch(showError)));
      document.querySelectorAll(".axis-toggle").forEach(input => input.addEventListener("change", () => {
        enabledAxes[Number(input.dataset.axis)] = input.checked;
        redraw();
      }));
      for (const key of ["acceleration", "angularVelocity", "magneticField"]) {
        attachSelection(document.getElementById(\`chart-\${key}\`));
      }
      redraw();
      if (oneDof) drawAngle(document.getElementById("chart-one-dof"), oneDof);
      if (opensenseComplete) renderMotionFrame(0);
    }

    function showError(error) {
      const status = document.getElementById("status");
      if (status) status.textContent = error.message;
    }
    load().catch(error => {
      document.getElementById("content").innerHTML = \`<section class="panel wide"><div class="empty">\${escapeHtml(error.message)}</div></section>\`;
    });
  </script>
</body>
</html>`;
}

export async function createProcessingServer(identity) {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      if (request.method === "GET" && url.pathname === "/") {
        response.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        });
        response.end(page());
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/report") {
        const state = await loadProcessingState(identity);
        if (!state.governedRoot || !state.recordingId) {
          throw new CanvasError(
            "NOT_CONFIGURED",
            "Use the configure-recording canvas action to select a governed recording.",
          );
        }
        const [report, recordings, opensense] = await Promise.all([
          analyzeRecording(
            state.governedRoot,
            state.recordingId,
            state.calibration,
            state.annotations,
            state.oneDofMapping,
          ),
          listRecordings(state.governedRoot),
          loadOpenSenseResult(state.governedRoot, state.recordingId),
        ]);
        sendJson(response, 200, { state, report, recordings, opensense });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/artifact") {
        const state = await loadProcessingState(identity);
        const result = await loadOpenSenseResult(state.governedRoot, state.recordingId);
        if (!result) {
          throw new CanvasError("RESULT_NOT_FOUND", "No OpenSense result is available.");
        }
        const kind = url.searchParams.get("kind");
        const artifacts = {
          orientationsSto: result.outputs.orientationsSto.path,
          model: result.outputs.model.path,
          inverseKinematicsMotion: result.outputs.inverseKinematicsMotion.path,
          processingManifest: result.manifestPath,
        };
        if (!kind || !(kind in artifacts)) {
          throw new CanvasError("INVALID_ARTIFACT", "Requested OpenSense artifact is invalid.");
        }
        const contentType =
          kind === "processingManifest"
            ? "application/json; charset=utf-8"
            : "text/plain; charset=utf-8";
        response.writeHead(200, {
          "Content-Type": contentType,
          "Cache-Control": "no-store",
        });
        response.end(await readFile(artifacts[kind]));
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/recording") {
        const current = await loadProcessingState(identity);
        const input = await readJson(request);
        const state = await configureRecording(identity, {
          governedRoot: current.governedRoot,
          recordingId: input.recordingId,
        });
        sendJson(response, 200, state);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/calibration") {
        const state = await updateCalibration(identity, await readJson(request));
        sendJson(response, 200, state);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/annotations") {
        const state = await addAnnotation(identity, await readJson(request));
        sendJson(response, 200, state);
        return;
      }
      if (request.method === "DELETE" && url.pathname === "/api/annotations") {
        const state = await removeAnnotation(identity, await readJson(request));
        sendJson(response, 200, state);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/one-dof-mapping") {
        const state = await updateOneDofMapping(identity, await readJson(request));
        sendJson(response, 200, state);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/opensim-runtime") {
        const state = await configureOpenSimRuntime(identity, await readJson(request));
        sendJson(response, 200, state);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/run-opensense") {
        const state = await loadProcessingState(identity);
        await runOpenSensePipeline(identity.workspaceRoot, state);
        const result = await loadOpenSenseResult(state.governedRoot, state.recordingId);
        sendJson(response, 200, result);
        return;
      }
      sendJson(response, 404, { error: "Not found." });
    } catch (error) {
      const status = error instanceof CanvasError || error instanceof ProcessingError ? 400 : 500;
      sendJson(response, status, {
        error:
          error instanceof CanvasError || error instanceof ProcessingError
            ? error.message
            : `Processing server failed: ${error.message}`,
      });
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}
