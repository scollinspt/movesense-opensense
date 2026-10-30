const byId = (id) => document.getElementById(id);
const elements = {
  fullscreen: byId("fullscreen"),
  recordingBadge: byId("recording-badge"),
  runSimulator: byId("run-simulator"),
  scan: byId("scan"),
  connectHardware: byId("connect-hardware"),
  disconnect: byId("disconnect"),
  leftSensor: byId("left-sensor"),
  rightSensor: byId("right-sensor"),
  leftStatus: byId("left-status"),
  rightStatus: byId("right-status"),
  leftHardware: byId("left-hardware"),
  rightHardware: byId("right-hardware"),
  leftCount: byId("left-count"),
  rightCount: byId("right-count"),
  connectionMessage: byId("connection-message"),
  leftVelocity: byId("left-velocity"),
  rightVelocity: byId("right-velocity"),
  leftChart: byId("left-chart"),
  rightChart: byId("right-chart"),
  setupState: byId("setup-state"),
  proximalMalleoli: byId("proximal-malleoli"),
  symmetricalPlacement: byId("symmetrical-placement"),
  wordmarksParallel: byId("wordmarks-parallel"),
  mEndsProximal: byId("m-ends-proximal"),
  mountsStable: byId("mounts-stable"),
  leftMovementVerified: byId("left-movement-verified"),
  rightMovementVerified: byId("right-movement-verified"),
  leftKneeMovementMode: byId("left-knee-movement-mode"),
  rightKneeMovementMode: byId("right-knee-movement-mode"),
  assistiveDevice: byId("assistive-device"),
  assistanceLevel: byId("assistance-level"),
  orthosis: byId("orthosis"),
  otherDescription: byId("other-description"),
  confirmSetup: byId("confirm-setup"),
  setupMessage: byId("setup-message"),
  dataRoot: byId("data-root"),
  startRecording: byId("start-recording"),
  startControls: byId("start-controls"),
  acquisitionControls: byId("acquisition-controls"),
  acquisitionGuidance: byId("acquisition-guidance"),
  recordingClock: byId("recording-clock"),
  toggleGaitBout: byId("toggle-gait-bout"),
  recordContextChange: byId("record-context-change"),
  observationLabel: byId("observation-label"),
  observationNote: byId("observation-note"),
  recordObservation: byId("record-observation"),
  eventLog: byId("event-log"),
  stopRecording: byId("stop-recording"),
  recordingMessage: byId("recording-message"),
  stopDialog: byId("stop-dialog"),
  stopConfirmation: byId("stop-confirmation"),
  confirmStop: byId("confirm-stop"),
};

const confirmationIds = [
  "proximalMalleoli",
  "symmetricalPlacement",
  "wordmarksParallel",
  "mEndsProximal",
  "mountsStable",
  "leftMovementVerified",
  "rightMovementVerified",
];
const traces = {
  left_distal_shank: [],
  right_distal_shank: [],
};
let state = null;
let clockTimer = null;
let setupDirty = false;

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
  return body;
}

function contextInput() {
  return {
    assistiveDevice: elements.assistiveDevice.value,
    assistanceLevel: elements.assistanceLevel.value,
    orthosis: elements.orthosis.value,
    otherDescription: elements.otherDescription.value,
  };
}

function setupInput() {
  return {
    ...Object.fromEntries(
      confirmationIds.map((key) => [key, elements[key].checked]),
    ),
    leftKneeMovementMode: elements.leftKneeMovementMode.value,
    rightKneeMovementMode: elements.rightKneeMovementMode.value,
    ...contextInput(),
  };
}

function connected(role) {
  return state?.roles?.[role]?.connectionState === "connected";
}

function formatClock(seconds) {
  const value = Math.max(0, Math.floor(seconds ?? 0));
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function calibrationLabel(value) {
  if (value === "left_knee_extension_flexion") {
    return "left knee extension / flexion";
  }
  if (value === "right_knee_extension_flexion") {
    return "right knee extension / flexion";
  }
  if (value === "post_gait_seated_reference") {
    return "post-gait seated reference";
  }
  if (value === "post_walking_supported_standing") {
    return "post-walking supported standing";
  }
  return value.replaceAll("_", " ");
}

function drawTrace(canvas, values, color) {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
    canvas.width = width * ratio;
    canvas.height = height * ratio;
  }
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.strokeStyle = "#dbe4df";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(0, height / 2);
  context.lineTo(width, height / 2);
  context.stroke();
  if (values.length < 2) return;
  const maximum = Math.max(120, ...values.map((value) => Math.abs(value)));
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.beginPath();
  values.forEach((value, index) => {
    const x = index / (values.length - 1) * width;
    const y = height / 2 - value / maximum * height * 0.44;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();
}

function renderTraces() {
  drawTrace(elements.leftChart, traces.left_distal_shank, "#3679a8");
  drawTrace(elements.rightChart, traces.right_distal_shank, "#9a4d77");
}

function renderRole(role, prefix) {
  const roleState = state?.roles?.[role];
  elements[`${prefix}Status`].textContent =
    roleState?.connectionState ?? "idle";
  elements[`${prefix}Hardware`].textContent =
    roleState?.sensor?.hardwareId ?? roleState?.sensor?.address ?? "—";
  elements[`${prefix}Count`].textContent =
    (roleState?.sampleCount ?? 0).toLocaleString();
  elements[`${prefix}Velocity`].textContent =
    Number.isFinite(roleState?.latest?.sagittalAngularVelocity)
      ? `${roleState.latest.sagittalAngularVelocity.toFixed(1)} °/s`
      : "— °/s";
}

function renderState(nextState) {
  state = nextState;
  renderRole("left_distal_shank", "left");
  renderRole("right_distal_shank", "right");
  const anyConnected = connected("left_distal_shank")
    || connected("right_distal_shank");
  const bothConnected = connected("left_distal_shank")
    && connected("right_distal_shank");
  elements.disconnect.disabled = !anyConnected || Boolean(state.recording);
  elements.runSimulator.disabled = anyConnected;
  elements.scan.disabled = anyConnected;
  elements.connectHardware.disabled =
    anyConnected
    || !elements.leftSensor.value
    || !elements.rightSensor.value
    || elements.leftSensor.value === elements.rightSensor.value;
  elements.confirmSetup.disabled = !bothConnected || Boolean(state.recording);
  elements.setupState.textContent = state.setup ? "Confirmed" : "Pending";
  elements.startRecording.disabled =
    !state.ready || Boolean(state.recording) || setupDirty;
  elements.recordingBadge.hidden = !state.recording;
  elements.startControls.hidden = Boolean(state.recording);
  elements.acquisitionControls.classList.toggle("inactive", !state.recording);
  elements.acquisitionControls.setAttribute(
    "aria-disabled",
    String(!state.recording),
  );
  elements.acquisitionGuidance.textContent = state.recording
    ? `Recording ${state.recording.recordingId}. Mark calibration, gait-bout, and path events as they occur.`
    : state.lastFinalization
      ? `Finalized ${state.lastFinalization.recordingId}. Source checksum ${state.lastFinalization.checksum.slice(0, 12)}…`
      : "Recording controls activate after setup confirmation and recording start.";
  elements.toggleGaitBout.textContent = state.gaitBoutActive
    ? "End gait bout"
    : "Start gait bout";
  elements.toggleGaitBout.classList.toggle("active", state.gaitBoutActive);
  document.querySelectorAll("[data-path]").forEach((button) => {
    button.disabled = !state.recording || !state.gaitBoutActive;
    button.classList.toggle("current", state.currentPath === button.dataset.path);
  });
  document.querySelectorAll("[data-calibration]").forEach((button) => {
    const active = state.activeCalibration === button.dataset.calibration;
    button.disabled =
      !state.recording
      || Boolean(state.activeCalibration && !active)
      || (
        button.hasAttribute("data-post-session")
        && (!state.completedGaitBoutCount || state.gaitBoutActive)
      );
    button.classList.toggle("active", active);
    button.textContent =
      `${active ? "End" : "Start"} ${calibrationLabel(button.dataset.calibration)}`;
  });
  if (state.recording && !clockTimer) {
    const startedAt = Date.parse(state.recording.startedAt);
    clockTimer = setInterval(() => {
      elements.recordingClock.textContent =
        formatClock((Date.now() - startedAt) / 1000);
    }, 250);
  }
  if (!state.recording && clockTimer) {
    clearInterval(clockTimer);
    clockTimer = null;
    elements.recordingClock.textContent = "00:00";
  }
}

function appendEvent(event) {
  const item = document.createElement("li");
  item.value = event.sequence;
  item.textContent =
    `${event.type.replaceAll("_", " ")} · ${event.label.replaceAll("_", " ")} · ${event.semantics}`;
  elements.eventLog.prepend(item);
}

async function perform(action, statusElement) {
  try {
    statusElement.textContent = "";
    await action();
  } catch (error) {
    statusElement.textContent = error.message;
  }
}

elements.fullscreen.addEventListener("click", async () => {
  if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
  else await document.exitFullscreen();
});

elements.runSimulator.addEventListener("click", () => perform(async () => {
  renderState(await api("/api/connect/demo", { method: "POST" }));
  elements.connectionMessage.textContent =
    "Two-sensor simulator connected. It is not hardware validation.";
}, elements.connectionMessage));

elements.scan.addEventListener("click", () => perform(async () => {
  elements.connectionMessage.textContent = "Scanning…";
  const { devices } = await api("/api/scan", { method: "POST" });
  const options = [
    new Option("Select a sensor", ""),
    ...devices.map((device) => new Option(
      `${device.name ?? "Movesense"} · ${device.address}`,
      device.address,
    )),
  ];
  elements.leftSensor.replaceChildren(...options.map((option) => option.cloneNode(true)));
  elements.rightSensor.replaceChildren(...options.map((option) => option.cloneNode(true)));
  elements.connectionMessage.textContent =
    devices.length ? `Found ${devices.length} sensor(s).` : "No Movesense sensors found.";
}, elements.connectionMessage));

[elements.leftSensor, elements.rightSensor].forEach((select) => {
  select.addEventListener("change", () => renderState(state));
});

elements.connectHardware.addEventListener("click", () => perform(async () => {
  renderState(await api("/api/connect/hardware", {
    method: "POST",
    body: JSON.stringify({
      leftAddress: elements.leftSensor.value,
      rightAddress: elements.rightSensor.value,
      imuRateHz: 52,
    }),
  }));
  elements.connectionMessage.textContent = "Connecting assigned sensors…";
}, elements.connectionMessage));

elements.disconnect.addEventListener("click", () => perform(async () => {
  renderState(await api("/api/disconnect", { method: "POST" }));
  elements.connectionMessage.textContent = "Sensors disconnected.";
}, elements.connectionMessage));

elements.confirmSetup.addEventListener("click", () => perform(async () => {
  const nextState = await api("/api/setup", {
    method: "POST",
    body: JSON.stringify(setupInput()),
  });
  setupDirty = false;
  renderState(nextState);
  elements.setupMessage.textContent = "Placement, side verification, and context confirmed.";
}, elements.setupMessage));

[
  ...confirmationIds.map((key) => elements[key]),
  elements.assistiveDevice,
  elements.assistanceLevel,
  elements.orthosis,
  elements.otherDescription,
  elements.leftKneeMovementMode,
  elements.rightKneeMovementMode,
].forEach((control) => {
  control.addEventListener("change", () => {
    if (!state?.recording) {
      setupDirty = true;
      elements.startRecording.disabled = true;
      elements.setupMessage.textContent =
        "Setup or context changed; confirm it again before recording.";
    }
  });
});

elements.startRecording.addEventListener("click", () => perform(async () => {
  elements.eventLog.replaceChildren();
  await api("/api/recording/start", {
    method: "POST",
    body: JSON.stringify({ dataRoot: elements.dataRoot.value }),
  });
  elements.recordingMessage.textContent = "Governed recording started.";
}, elements.recordingMessage));

document.querySelectorAll("[data-calibration]").forEach((button) => {
  button.addEventListener("click", () => perform(async () => {
    await api("/api/recording/event", {
      method: "POST",
      body: JSON.stringify({
        type: "calibration",
        label: button.dataset.calibration,
        semantics:
          state.activeCalibration === button.dataset.calibration ? "end" : "start",
      }),
    });
  }, elements.recordingMessage));
});

elements.toggleGaitBout.addEventListener("click", () => perform(async () => {
  await api("/api/recording/event", {
    method: "POST",
    body: JSON.stringify({
      type: "gait_bout",
      semantics: state.gaitBoutActive ? "end" : "start",
    }),
  });
}, elements.recordingMessage));

document.querySelectorAll("[data-path]").forEach((button) => {
  button.addEventListener("click", () => perform(async () => {
    await api("/api/recording/event", {
      method: "POST",
      body: JSON.stringify({
        type: "path_segment",
        label: button.dataset.path,
      }),
    });
  }, elements.recordingMessage));
});

elements.recordContextChange.addEventListener("click", () => perform(async () => {
  await api("/api/recording/event", {
    method: "POST",
    body: JSON.stringify({
      type: "context_change",
      label: "gait_context",
      ...contextInput(),
    }),
  });
}, elements.recordingMessage));

elements.recordObservation.addEventListener("click", () => perform(async () => {
  await api("/api/recording/event", {
    method: "POST",
    body: JSON.stringify({
      type: "observation",
      label: elements.observationLabel.value,
      note: elements.observationNote.value,
    }),
  });
  elements.observationLabel.value = "";
  elements.observationNote.value = "";
}, elements.recordingMessage));

elements.stopRecording.addEventListener("click", () => {
  elements.stopConfirmation.value = "";
  elements.stopDialog.showModal();
});

elements.confirmStop.addEventListener("click", (event) => {
  event.preventDefault();
  perform(async () => {
    const result = await api("/api/recording/stop", {
      method: "POST",
      body: JSON.stringify({
        confirmation: elements.stopConfirmation.value,
      }),
    });
    elements.stopDialog.close();
    elements.recordingMessage.textContent =
      `Finalized ${result.recordingId}; ${result.eventCount} events; checksum ${result.checksum.slice(0, 12)}…`;
  }, elements.recordingMessage);
});

const eventSource = new EventSource("/api/events");
eventSource.addEventListener("state", (event) => renderState(JSON.parse(event.data)));
eventSource.addEventListener("samples", (event) => {
  for (const sample of JSON.parse(event.data)) {
    traces[sample.role].push(sample.sagittalAngularVelocity);
    if (traces[sample.role].length > 360) traces[sample.role].shift();
  }
  renderTraces();
});
eventSource.addEventListener("annotation", (event) => appendEvent(JSON.parse(event.data)));

const config = await api("/api/config");
elements.dataRoot.value = config.dataRoot;
renderState(await api("/api/state"));
renderTraces();
