const byId = (id) => document.getElementById(id);

const elements = {
  scan: byId("scan"),
  sensorSelect: byId("sensor-select"),
  connect: byId("connect"),
  demo: byId("demo"),
  disconnect: byId("disconnect"),
  connectionState: byId("connection-state"),
  acceptZero: byId("accept-zero"),
  zeroReadiness: byId("zero-readiness"),
  zeroStatus: byId("zero-status"),
  ecgQuality: byId("ecg-quality"),
  heartRate: byId("heart-rate"),
  heartRateAge: byId("heart-rate-age"),
  tiltAngle: byId("tilt-angle"),
  rollAngle: byId("roll-angle"),
  tiltFill: byId("tilt-fill"),
  tiltQuality: byId("tilt-quality"),
  beatProgress: byId("beat-progress"),
  dataRoot: byId("data-root"),
  baselineSbp: byId("baseline-sbp"),
  baselineDbp: byId("baseline-dbp"),
  baselineEtco2: byId("baseline-etco2"),
  startTest: byId("start-test"),
  setupControls: byId("setup-controls"),
  operatorControls: byId("operator-controls"),
  operatorGuidance: byId("operator-guidance"),
  recordingBadge: byId("recording-badge"),
  operatorStatus: byId("operator-status"),
  testClock: byId("test-clock"),
  sbp: byId("sbp"),
  dbp: byId("dbp"),
  etco2: byId("etco2"),
  logBp: byId("log-bp"),
  logEtco2: byId("log-etco2"),
  undo: byId("undo"),
  endTest: byId("end-test"),
  endDialog: byId("end-dialog"),
  endConfirmation: byId("end-confirmation"),
  confirmEnd: byId("confirm-end"),
  fullscreen: byId("fullscreen"),
  ecgChart: byId("ecg-chart"),
};

let applicationState = null;
let recordingStart = null;
let clockTimer = null;
let ecgPoints = [];
const activeSymptoms = new Set();

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
  return body;
}

function setStatus(message, isError = false) {
  elements.operatorStatus.textContent = message;
  elements.operatorStatus.style.color = isError ? "var(--danger)" : "";
}

function formatAngle(value) {
  return Number.isFinite(value) ? value.toFixed(1) : "—";
}

function renderState(state) {
  applicationState = state;
  const connected = state.connectionState === "connected";
  const recording = Boolean(state.recording);
  elements.connectionState.textContent = state.connectionState.replaceAll("_", " ");
  elements.connect.disabled = !elements.sensorSelect.value || connected || recording;
  elements.demo.disabled = connected || recording;
  elements.scan.disabled = connected || recording;
  elements.disconnect.disabled = !connected || recording;
  elements.acceptZero.disabled = !connected || !state.zeroReady || recording;
  elements.zeroReadiness.textContent = state.zero
    ? "Accepted at 0°"
    : state.zeroReady
      ? "Stable supine candidate"
      : connected
        ? "Hold still in supine"
        : "Waiting for data";
  elements.zeroStatus.textContent = state.zero
    ? `Reference accepted at sensor time ${(state.zero.acceptedAtTimeMs / 1000).toFixed(1)} s`
    : "";
  elements.startTest.disabled = !connected || !state.zero || recording;
  elements.recordingBadge.hidden = !recording;
  elements.setupControls.hidden = recording;
  elements.operatorControls.classList.toggle("inactive", !recording);
  elements.operatorControls.setAttribute("aria-disabled", String(!recording));
  elements.operatorGuidance.hidden = recording;
  elements.operatorControls.querySelectorAll("button, input").forEach((control) => {
    control.disabled = !recording;
  });

  const quality = state.ecgQuality ?? "unavailable";
  elements.ecgQuality.textContent = quality;
  elements.ecgQuality.className = `quality ${quality}`;
  elements.heartRate.textContent = state.latestHeartRate
    ? Math.round(state.latestHeartRate.bpm)
    : "—";
  if (state.latestHeartRate && state.latestTilt) {
    const ageSeconds = Math.max(
      0,
      (state.latestTilt.timeMs - state.latestHeartRate.timeMs) / 1000,
    );
    elements.heartRateAge.textContent =
      `Five-beat estimate · ${ageSeconds.toFixed(1)} s old`;
  } else {
    elements.heartRateAge.textContent = "No valid estimate yet";
  }
  const dots = elements.beatProgress.querySelectorAll("i");
  dots.forEach((dot, index) => dot.classList.toggle(
    "filled",
    index < state.fiveWaveProgress,
  ));
  const tilt = state.latestTilt?.tiltDegrees;
  const roll = state.latestTilt?.offAxisRollDegrees;
  elements.tiltAngle.textContent = formatAngle(tilt);
  elements.rollAngle.textContent = Number.isFinite(roll)
    ? `${roll.toFixed(1)}°`
    : "—";
  elements.tiltFill.style.width = `${Math.min(100, Math.max(0, Math.abs(tilt ?? 0) / 90 * 100))}%`;
  elements.tiltQuality.textContent = state.zero
    ? `Signal quality: ${state.latestTilt?.quality ?? "unavailable"}`
    : "Accept supine zero to begin";
  if (state.errorMessage) setStatus(state.errorMessage, true);

  if (recording && !recordingStart) {
    recordingStart = new Date(state.recording.startedAt).getTime();
    clockTimer = setInterval(updateClock, 250);
  } else if (!recording && recordingStart) {
    recordingStart = null;
    clearInterval(clockTimer);
    clockTimer = null;
    elements.testClock.textContent = "00:00";
  }
}

function updateClock() {
  if (!recordingStart) return;
  const elapsed = Math.max(0, Math.floor((Date.now() - recordingStart) / 1000));
  const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");
  elements.testClock.textContent = `${minutes}:${seconds}`;
}

function drawEcg() {
  const canvas = elements.ecgChart;
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== Math.round(width * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.strokeStyle = "#e3e9e5";
  context.lineWidth = 1;
  for (let x = 0; x <= width; x += 25) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = 0; y <= height; y += 25) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  if (ecgPoints.length < 2) return;
  const latestTime = ecgPoints.at(-1).timeMs;
  const earliestTime = latestTime - 10_000;
  ecgPoints = ecgPoints.filter((point) => point.timeMs >= earliestTime);
  const values = ecgPoints.map((point) => point.value);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = Math.max(0.1, maximum - minimum);
  context.strokeStyle = "#135841";
  context.lineWidth = 2;
  context.beginPath();
  ecgPoints.forEach((point, index) => {
    const x = (point.timeMs - earliestTime) / 10_000 * width;
    const y = height - ((point.value - minimum) / range * (height - 30) + 15);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();
  context.fillStyle = "#9c2f2f";
  for (const point of ecgPoints.filter((candidate) => candidate.rWave)) {
    const x = (point.timeMs - earliestTime) / 10_000 * width;
    context.beginPath();
    context.arc(x, 12, 4, 0, Math.PI * 2);
    context.fill();
  }
}

async function postEvent(event) {
  const result = await api("/api/recording/event", {
    method: "POST",
    body: JSON.stringify(event),
  });
  setStatus(`${result.label.replaceAll("_", " ")} recorded at ${result.relativeSeconds.toFixed(1)} s.`);
  return result;
}

elements.scan.addEventListener("click", async () => {
  try {
    elements.scan.disabled = true;
    setStatus("Scanning for nearby Movesense sensors…");
    const result = await api("/api/scan", { method: "POST" });
    elements.sensorSelect.replaceChildren(
      new Option(
        result.devices.length ? "Select a sensor" : "No Movesense sensors found",
        "",
      ),
      ...result.devices.map((device) => new Option(
        `${device.name || "Movesense"} · ${device.address}`,
        device.address,
      )),
    );
    setStatus(`${result.devices.length} sensor${result.devices.length === 1 ? "" : "s"} found.`);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    elements.scan.disabled = false;
  }
});

elements.sensorSelect.addEventListener("change", () => renderState(applicationState));
elements.connect.addEventListener("click", async () => {
  try {
    setStatus("Connecting to ECG and IMU streams…");
    await api("/api/connect/hardware", {
      method: "POST",
      body: JSON.stringify({ address: elements.sensorSelect.value }),
    });
  } catch (error) {
    setStatus(error.message, true);
  }
});
elements.demo.addEventListener("click", async () => {
  try {
    setStatus("Starting deterministic ECG and tilt simulation…");
    renderState(await api("/api/connect/demo", { method: "POST" }));
  } catch (error) {
    setStatus(error.message, true);
  }
});
elements.disconnect.addEventListener("click", async () => {
  try {
    renderState(await api("/api/disconnect", { method: "POST" }));
    ecgPoints = [];
    drawEcg();
    setStatus("Disconnected.");
  } catch (error) {
    setStatus(error.message, true);
  }
});
elements.acceptZero.addEventListener("click", async () => {
  try {
    await api("/api/zero", { method: "POST" });
    setStatus("Supine gravity reference accepted as 0°.");
  } catch (error) {
    setStatus(error.message, true);
  }
});

elements.startTest.addEventListener("click", async () => {
  try {
    elements.sbp.value = elements.baselineSbp.value;
    elements.dbp.value = elements.baselineDbp.value;
    elements.etco2.value = elements.baselineEtco2.value;
    await api("/api/recording/start", {
      method: "POST",
      body: JSON.stringify({
        dataRoot: elements.dataRoot.value,
        baselineSystolic: Number(elements.baselineSbp.value),
        baselineDiastolic: Number(elements.baselineDbp.value),
        baselineEtco2: Number(elements.baselineEtco2.value),
      }),
    });
    setStatus("Recording started. Baseline supine phase logged.");
  } catch (error) {
    setStatus(error.message, true);
  }
});

document.querySelectorAll("[data-phase]").forEach((button) => {
  button.addEventListener("click", async () => {
    try {
      await postEvent({ type: "phase", label: button.dataset.phase });
    } catch (error) {
      setStatus(error.message, true);
    }
  });
});

document.querySelectorAll("[data-symptom]").forEach((button) => {
  button.addEventListener("click", async () => {
    const label = button.dataset.symptom;
    const resolving = activeSymptoms.has(label);
    try {
      await postEvent({
        type: "symptom",
        label,
        semantics: resolving ? "resolution" : "onset",
      });
      if (resolving) activeSymptoms.delete(label);
      else activeSymptoms.add(label);
      button.classList.toggle("active", !resolving);
      button.setAttribute("aria-pressed", String(!resolving));
    } catch (error) {
      setStatus(error.message, true);
    }
  });
});

document.querySelectorAll("[data-bp-step]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = button.dataset.bpTarget === "sbp" ? elements.sbp : elements.dbp;
    input.value = Number(input.value || 0) + Number(button.dataset.bpStep);
  });
});
elements.logBp.addEventListener("click", async () => {
  try {
    await postEvent({
      type: "blood_pressure",
      systolic: Number(elements.sbp.value),
      diastolic: Number(elements.dbp.value),
    });
  } catch (error) {
    setStatus(error.message, true);
  }
});
document.querySelectorAll("[data-etco2-step]").forEach((button) => {
  button.addEventListener("click", () => {
    elements.etco2.value =
      Number(elements.etco2.value || 0) + Number(button.dataset.etco2Step);
  });
});
elements.logEtco2.addEventListener("click", async () => {
  try {
    await postEvent({ type: "etco2", value: Number(elements.etco2.value) });
  } catch (error) {
    setStatus(error.message, true);
  }
});
elements.undo.addEventListener("click", async () => {
  try {
    const result = await postEvent({ type: "undo" });
    setStatus(`Last eligible annotation was undone at ${result.relativeSeconds.toFixed(1)} s.`);
  } catch (error) {
    setStatus(error.message, true);
  }
});

elements.endTest.addEventListener("click", () => {
  elements.endConfirmation.value = "";
  elements.confirmEnd.disabled = true;
  elements.endDialog.showModal();
  elements.endConfirmation.focus();
});
elements.endConfirmation.addEventListener("input", () => {
  elements.confirmEnd.disabled = elements.endConfirmation.value !== "END TEST";
});
elements.endDialog.addEventListener("close", async () => {
  if (elements.endDialog.returnValue !== "confirm") return;
  try {
    const result = await api("/api/recording/stop", {
      method: "POST",
      body: JSON.stringify({ confirmation: elements.endConfirmation.value }),
    });
    activeSymptoms.clear();
    document.querySelectorAll("[data-symptom]").forEach((button) => {
      button.classList.remove("active");
      button.setAttribute("aria-pressed", "false");
    });
    setStatus(`Test finalized: ${result.recordingId}. Checksums and summary saved.`);
  } catch (error) {
    setStatus(error.message, true);
  }
});

elements.fullscreen.addEventListener("click", async () => {
  if (document.fullscreenElement) await document.exitFullscreen();
  else await document.documentElement.requestFullscreen();
});
document.addEventListener("fullscreenchange", () => {
  elements.fullscreen.textContent = document.fullscreenElement
    ? "Exit full screen"
    : "Full screen";
});
window.addEventListener("resize", drawEcg);

const stream = new EventSource("/api/events");
stream.addEventListener("state", (event) => renderState(JSON.parse(event.data)));
stream.addEventListener("ecg", (event) => {
  ecgPoints.push(...JSON.parse(event.data));
  drawEcg();
});
stream.addEventListener("recording-complete", (event) => {
  const result = JSON.parse(event.data);
  setStatus(`Recording finalized at ${result.databasePath}.`);
});
stream.onerror = () => setStatus("Live connection to the local server was interrupted.", true);

const config = await api("/api/config");
elements.dataRoot.value = config.dataRoot;
renderState(await api("/api/state"));
drawEcg();
