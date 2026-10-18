import http from "node:http";

import { CanvasError } from "@github/copilot-sdk/extension";

const MAX_BODY_BYTES = 16 * 1024;

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
        reject(new CanvasError("REQUEST_TOO_LARGE", "The design update is too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new CanvasError("INVALID_JSON", "The design update is not valid JSON."));
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
  <title>Movesense Acquisition Studio</title>
  <style>
    :root {
      color-scheme: dark;
      --ink: #edf7f2;
      --muted: #9db5aa;
      --panel: rgba(18, 34, 29, .88);
      --line: rgba(170, 220, 198, .18);
      --mint: #70e1b2;
      --amber: #ffc66d;
      --blue: #69b7ff;
      --bg: #07110e;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--ink);
      background:
        radial-gradient(circle at 12% 8%, rgba(30, 127, 95, .28), transparent 35%),
        radial-gradient(circle at 85% 30%, rgba(37, 86, 126, .2), transparent 30%),
        var(--bg);
      font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    header, main { width: min(1180px, calc(100% - 32px)); margin-inline: auto; }
    header { padding: 44px 0 26px; }
    .eyebrow { color: var(--mint); font-size: 12px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
    h1 { margin: 7px 0 6px; font-size: clamp(30px, 6vw, 58px); line-height: 1; letter-spacing: -.045em; }
    header p { max-width: 730px; color: var(--muted); font-size: 17px; }
    main { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(280px, .65fr); gap: 18px; padding-bottom: 48px; }
    .panel { padding: 22px; border: 1px solid var(--line); border-radius: 18px; background: var(--panel); backdrop-filter: blur(18px); }
    .wide { grid-column: 1 / -1; }
    h2 { margin: 0 0 15px; font-size: 18px; letter-spacing: -.02em; }
    h3 { margin: 0; font-size: 15px; }
    label { display: grid; gap: 7px; color: var(--muted); font-size: 13px; font-weight: 700; }
    textarea, select, input {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 10px 12px;
      color: var(--ink);
      background: #0b1814;
      font: inherit;
    }
    textarea { min-height: 105px; resize: vertical; }
    textarea:focus-visible, select:focus-visible, input:focus-visible, button:focus-visible {
      outline: 3px solid rgba(112, 225, 178, .42);
      outline-offset: 2px;
    }
    .fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .save-row { display: flex; align-items: center; gap: 12px; margin-top: 15px; }
    button {
      border: 0;
      border-radius: 999px;
      padding: 10px 17px;
      color: #052016;
      background: var(--mint);
      font: inherit;
      font-weight: 850;
      cursor: pointer;
    }
    button:hover { filter: brightness(1.08); }
    .status { min-height: 22px; color: var(--muted); font-size: 13px; }
    .flow { display: grid; gap: 8px; }
    .flow-step { display: grid; grid-template-columns: 28px 1fr; gap: 10px; align-items: center; padding: 11px; border: 1px solid var(--line); border-radius: 12px; }
    .flow-step b { display: grid; place-items: center; width: 28px; height: 28px; color: var(--mint); background: rgba(112,225,178,.1); border-radius: 50%; }
    .principles, .decisions { display: grid; gap: 10px; padding: 0; list-style: none; }
    .principles li { padding-left: 20px; position: relative; color: var(--muted); }
    .principles li::before { content: "→"; position: absolute; left: 0; color: var(--mint); }
    .milestones { display: grid; grid-template-columns: repeat(5, 1fr); gap: 9px; }
    .milestone { min-height: 104px; padding: 12px; border: 1px solid var(--line); border-radius: 12px; }
    .milestone strong { display: block; color: var(--mint); font-size: 25px; }
    .milestone span { display: block; color: var(--muted); font-size: 12px; }
    .decision { padding: 14px; border: 1px solid var(--line); border-radius: 12px; }
    .decision p { margin: 6px 0 0; color: var(--muted); }
    .badge { display: inline-block; margin-top: 8px; border-radius: 999px; padding: 3px 8px; color: #07110e; background: var(--amber); font-size: 10px; font-weight: 900; text-transform: uppercase; }
    .badge.accepted { background: var(--mint); }
    .badge.proposed { background: var(--blue); }
    .live-toolbar { display: grid; grid-template-columns: 1fr auto auto; gap: 10px; align-items: end; }
    .sensor-select { min-width: 0; }
    .secondary { color: var(--ink); background: rgba(105, 183, 255, .16); border: 1px solid rgba(105, 183, 255, .35); }
    .danger { color: #ffd7cf; background: rgba(255, 105, 84, .16); border: 1px solid rgba(255, 105, 84, .35); }
    .telemetry { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0; }
    .metric { padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: rgba(5, 15, 12, .35); }
    .metric strong { display: block; color: var(--mint); font-size: 20px; }
    .metric span { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
    .charts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .chart { min-width: 0; padding: 10px; border: 1px solid var(--line); border-radius: 12px; }
    .chart h3 { margin-bottom: 6px; color: var(--muted); }
    canvas { display: block; width: 100%; height: 150px; background: #08130f; border-radius: 8px; }
    .notice { margin: 12px 0 0; color: var(--muted); font-size: 13px; }
    .recording-controls { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin-top:16px; padding-top:16px; border-top:1px solid var(--line); }
    .recording-controls .full { grid-column:1/-1; }
    .recording-actions { display:flex; gap:10px; align-items:center; }
    @media (max-width: 780px) {
      main { grid-template-columns: 1fr; }
      .fields { grid-template-columns: 1fr; }
      .milestones { grid-template-columns: repeat(2, 1fr); }
      .live-toolbar { grid-template-columns: 1fr 1fr; }
      .sensor-select { grid-column: 1 / -1; }
      .telemetry { grid-template-columns: repeat(2, 1fr); }
      .charts { grid-template-columns: 1fr; }
      .recording-controls { grid-template-columns:1fr; }
      .recording-controls .full { grid-column:auto; }
    }
  </style>
</head>
<body>
  <header>
    <div class="eyebrow">Movesense · OpenSense</div>
    <h1>Acquisition Studio</h1>
    <p>Shape a portable, evidence-driven collection app for one sensor today and a growing BLE fleet tomorrow.</p>
  </header>
  <main>
    <section class="panel wide" aria-labelledby="live-heading">
      <h2 id="live-heading">Live Movesense IMU9</h2>
      <div class="live-toolbar">
        <label class="sensor-select">Nearby sensor
          <select id="sensor"><option value="">Scan to find a sensor</option></select>
        </label>
        <button id="scan" class="secondary" type="button">Scan</button>
        <button id="connect" type="button" disabled>Connect</button>
        <button id="disconnect" class="danger" type="button" hidden>Disconnect</button>
      </div>
      <div class="telemetry">
        <div class="metric"><strong id="connection-state">Idle</strong><span>Connection</span></div>
        <div class="metric"><strong id="sample-count">0</strong><span>Samples</span></div>
        <div class="metric"><strong id="effective-rate">—</strong><span>Effective Hz</span></div>
        <div class="metric"><strong id="sensor-time">—</strong><span>Sensor time</span></div>
      </div>
      <div class="charts">
        <div class="chart"><h3>Acceleration</h3><canvas id="acceleration-chart" width="360" height="150" aria-label="Live acceleration plot"></canvas></div>
        <div class="chart"><h3>Angular velocity</h3><canvas id="angular-chart" width="360" height="150" aria-label="Live angular velocity plot"></canvas></div>
        <div class="chart"><h3>Magnetic field</h3><canvas id="magnetic-chart" width="360" height="150" aria-label="Live magnetic field plot"></canvas></div>
      </div>
      <div class="recording-controls">
        <label class="full">Governed data root
          <input id="recording-root" type="text" placeholder="/absolute/path/to/governed-storage">
        </label>
        <label>Movement
          <select id="movement">
            <option value="static_neutral">Static neutral calibration</option>
            <option value="isolated_forearm_rotation">Stage 1: isolated forearm rotation (1 DOF)</option>
            <option value="isolated_elbow_flexion_extension">Stage 2: isolated elbow flexion / extension (1 DOF)</option>
            <option value="combined_elbow_forearm">Stage 3: elbow plus forearm (2 DOF)</option>
            <option value="isolated_shoulder">Future: isolated shoulder rotation (3 DOF)</option>
            <option value="shoulder_elbow">Future: shoulder plus elbow (4 DOF)</option>
            <option value="shoulder_elbow_forearm">Future: shoulder, elbow, and forearm (5 joint DOF)</option>
            <option value="non_human_bench">Non-human bench movement</option>
          </select>
        </label>
        <label>Placement
          <select id="placement">
            <option value="right_wrist">Right wrist</option>
            <option value="left_wrist">Left wrist</option>
            <option value="bench_fixture">Bench fixture</option>
          </select>
        </label>
        <label>Mounting orientation
          <select id="orientation">
            <option value="supplied_strap_side_specific_v1">Supplied strap, side-specific wordmark direction</option>
            <option value="custom_documented">Custom documented orientation</option>
          </select>
        </label>
        <label class="full">Orientation notes
          <input id="orientation-notes" type="text" maxlength="500" placeholder="Optional: strap landmarks, offsets, or reason for custom mounting">
        </label>
        <p id="protocol-guidance" class="notice full"></p>
        <label class="full">
          <span><input id="confirm-anatomical-start" type="checkbox"> Confirm the participant is in the protocol-defined anatomical starting position.</span>
        </label>
        <label class="full">
          <span><input id="confirm-proximal-control" type="checkbox"> Confirm the trunk, shoulder, and other non-target joints will remain in the protocol-defined position.</span>
        </label>
        <div class="recording-actions full">
          <button id="start-recording" type="button" disabled>Start recording</button>
          <button id="stop-recording" class="danger" type="button" hidden>Stop recording</button>
          <span id="recording-status" class="status" role="status" aria-live="polite"></span>
        </div>
      </div>
      <p class="notice">Raw CSV and a checksummed provenance manifest are written outside Git under the governed data root.</p>
      <div id="live-status" class="status" role="status" aria-live="polite"></div>
    </section>
    <section class="panel" aria-labelledby="design-heading">
      <h2 id="design-heading">Design target</h2>
      <form id="design-form">
        <label>Product vision<textarea id="vision" name="vision" maxlength="1200"></textarea></label>
        <div class="fields">
          <label>Platform sequence
            <select id="targetPlatform" name="targetPlatform">
              <option>macOS</option><option>iOS</option><option>macOS then iOS</option>
            </select>
          </label>
          <label>Acquisition transport
            <select id="transport" name="transport">
              <option>BLE/GSP live</option><option>Flash/offline</option><option>Hybrid</option>
            </select>
          </label>
          <label>Initial sample rate (Hz)<input id="sampleRateHz" name="sampleRateHz" type="number" min="1" max="1600"></label>
          <label>Target sensor count<input id="targetSensorCount" name="targetSensorCount" type="number" min="1" max="32"></label>
        </div>
        <div class="save-row">
          <button type="submit">Save direction</button>
          <span id="status" class="status" role="status" aria-live="polite"></span>
        </div>
      </form>
    </section>
    <aside class="panel" aria-labelledby="flow-heading">
      <h2 id="flow-heading">Portable service boundary</h2>
      <div class="flow">
        <div class="flow-step"><b>1</b><span><strong>Transport</strong><br>Bleak now · CoreBluetooth later</span></div>
        <div class="flow-step"><b>2</b><span><strong>GSP session</strong><br>discover · inspect · subscribe</span></div>
        <div class="flow-step"><b>3</b><span><strong>Stream core</strong><br>decode · timestamp · diagnose</span></div>
        <div class="flow-step"><b>4</b><span><strong>Recorder</strong><br>raw data · manifest · checksum</span></div>
      </div>
    </aside>
    <section class="panel wide" aria-labelledby="scale-heading">
      <h2 id="scale-heading">Evidence-gated scaling</h2>
      <div id="milestones" class="milestones"></div>
    </section>
    <section class="panel" aria-labelledby="principles-heading">
      <h2 id="principles-heading">Non-negotiable contracts</h2>
      <ul id="principles" class="principles"></ul>
    </section>
    <section class="panel" aria-labelledby="decisions-heading">
      <h2 id="decisions-heading">Decisions & open questions</h2>
      <div id="decisions" class="decisions"></div>
    </section>
  </main>
  <script>
    const form = document.querySelector("#design-form");
    const status = document.querySelector("#status");
    const liveStatus = document.querySelector("#live-status");
    const sensorSelect = document.querySelector("#sensor");
    const scanButton = document.querySelector("#scan");
    const connectButton = document.querySelector("#connect");
    const disconnectButton = document.querySelector("#disconnect");
    const startRecordingButton = document.querySelector("#start-recording");
    const stopRecordingButton = document.querySelector("#stop-recording");
    const recordingStatus = document.querySelector("#recording-status");
    const anatomicalStartCheckbox = document.querySelector("#confirm-anatomical-start");
    const proximalControlCheckbox = document.querySelector("#confirm-proximal-control");
    let streamConnected = false;
    const buffers = {
      acceleration: [[], [], []],
      angular: [[], [], []],
      magnetic: [[], [], []],
    };
    let firstHostTime = null;
    let latestHostTime = null;

    function textElement(tag, text) {
      const element = document.createElement(tag);
      element.textContent = text;
      return element;
    }

    function render(state) {
      for (const key of ["vision", "targetPlatform", "transport", "sampleRateHz", "targetSensorCount"]) {
        document.querySelector("#" + key).value = state[key];
      }
      document.querySelector("#recording-root").value = state.dataRoot || "";
      const principles = document.querySelector("#principles");
      principles.replaceChildren(...state.principles.map((item) => textElement("li", item)));

      const milestones = document.querySelector("#milestones");
      milestones.replaceChildren(...state.milestones.map((item) => {
        const card = document.createElement("div");
        card.className = "milestone";
        card.append(textElement("strong", item.count), textElement("span", item.label), textElement("span", item.status));
        return card;
      }));

      const decisions = document.querySelector("#decisions");
      decisions.replaceChildren(...state.decisions.map((item) => {
        const card = document.createElement("article");
        card.className = "decision";
        const badge = textElement("span", item.status);
        badge.className = "badge " + item.status;
        card.append(textElement("h3", item.title), textElement("p", item.detail), badge);
        return card;
      }));
    }

    async function load() {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load the design.");
      render(await response.json());
    }

    function drawChart(id, series) {
      const canvas = document.querySelector("#" + id);
      const context = canvas.getContext("2d");
      const width = canvas.width;
      const height = canvas.height;
      context.clearRect(0, 0, width, height);
      context.strokeStyle = "rgba(170, 220, 198, .12)";
      context.beginPath();
      context.moveTo(0, height / 2);
      context.lineTo(width, height / 2);
      context.stroke();
      const values = series.flat();
      const extent = Math.max(1, ...values.map((value) => Math.abs(value)));
      ["#70e1b2", "#69b7ff", "#ffc66d"].forEach((color, seriesIndex) => {
        context.strokeStyle = color;
        context.lineWidth = 1.5;
        context.beginPath();
        series[seriesIndex].forEach((value, index) => {
          const x = series[seriesIndex].length < 2 ? 0 : index * width / (series[seriesIndex].length - 1);
          const y = height / 2 - value / extent * (height * .42);
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        context.stroke();
      });
    }

    function appendSample(sample, sampleCount) {
      const groups = [
        [buffers.acceleration, [sample.acceleration_x, sample.acceleration_y, sample.acceleration_z]],
        [buffers.angular, [sample.angular_velocity_x, sample.angular_velocity_y, sample.angular_velocity_z]],
        [buffers.magnetic, [sample.magnetic_field_x, sample.magnetic_field_y, sample.magnetic_field_z]],
      ];
      groups.forEach(([buffer, values]) => values.forEach((value, index) => {
        buffer[index].push(value);
        if (buffer[index].length > 180) buffer[index].shift();
      }));
      if (firstHostTime === null) firstHostTime = sample.host_monotonic_ns;
      latestHostTime = sample.host_monotonic_ns;
      document.querySelector("#sample-count").textContent = sampleCount.toLocaleString();
      document.querySelector("#sensor-time").textContent = sample.sensor_timestamp_ms + " ms";
      const duration = (latestHostTime - firstHostTime) / 1e9;
      document.querySelector("#effective-rate").textContent =
        duration > .5 ? ((sampleCount - 1) / duration).toFixed(1) : "—";
      if (sampleCount % 2 === 0) {
        drawChart("acceleration-chart", buffers.acceleration);
        drawChart("angular-chart", buffers.angular);
        drawChart("magnetic-chart", buffers.magnetic);
      }
    }

    const events = new EventSource("/api/live/events");
    events.onmessage = (message) => {
      const event = JSON.parse(message.data);
      if (event.event === "sample") appendSample(event.sample, event.sample_count);
      if (event.event === "connecting") {
        document.querySelector("#connection-state").textContent = "Connecting";
        liveStatus.textContent = "Connecting to " + event.address + "…";
        connectButton.hidden = true;
        disconnectButton.hidden = false;
        startRecordingButton.disabled = true;
        streamConnected = false;
      }
      if (event.event === "connected") {
        document.querySelector("#connection-state").textContent = "Live";
        liveStatus.textContent = "Streaming IMU9 at " + event.sample_rate_hz + " Hz.";
        connectButton.hidden = true;
        disconnectButton.hidden = false;
        streamConnected = true;
        updateRecordingReadiness();
      }
      if (event.event === "error") {
        document.querySelector("#connection-state").textContent = "Error";
        liveStatus.textContent = event.message;
        connectButton.hidden = false;
        disconnectButton.hidden = true;
        startRecordingButton.disabled = true;
        streamConnected = false;
        stopRecordingButton.hidden = true;
      }
      if (event.event === "recording-started") {
        startRecordingButton.hidden = true;
        stopRecordingButton.hidden = false;
        recordingStatus.textContent = "Recording " + event.recordingId + "…";
      }
      if (event.event === "recording-stopped") {
        startRecordingButton.hidden = false;
        anatomicalStartCheckbox.checked = false;
        proximalControlCheckbox.checked = false;
        updateRecordingReadiness();
        stopRecordingButton.hidden = true;
        recordingStatus.textContent = "Saved " + event.sampleCount + " samples. Manifest: " + event.manifestPath;
      }
      if (event.event === "recording-error") {
        recordingStatus.textContent = event.message;
      }
      if (event.event === "idle" || event.event === "stopped") {
        document.querySelector("#connection-state").textContent = "Idle";
        connectButton.hidden = false;
        disconnectButton.hidden = true;
      }
    };
    events.onerror = () => { liveStatus.textContent = "Live event connection was interrupted."; };

    sensorSelect.addEventListener("change", () => {
      connectButton.disabled = !sensorSelect.value;
    });

    scanButton.addEventListener("click", async () => {
      scanButton.disabled = true;
      liveStatus.textContent = "Scanning for nearby Movesense sensors…";
      try {
        const response = await fetch("/api/live/scan", { method: "POST" });
        const value = await response.json();
        if (!response.ok) throw new Error(value.error || "Scan failed.");
        sensorSelect.replaceChildren();
        if (value.sensors.length === 0) {
          sensorSelect.append(new Option("No Movesense sensors found", ""));
          liveStatus.textContent = "No Movesense sensors found. Wake the sensor and check Bluetooth permission.";
        } else {
          sensorSelect.append(new Option("Choose a sensor", ""));
          value.sensors.forEach((sensor) => {
            sensorSelect.append(new Option(sensor.name + (sensor.rssi === null ? "" : " · " + sensor.rssi + " dBm"), sensor.address));
          });
          liveStatus.textContent = "Found " + value.sensors.length + " Movesense sensor" + (value.sensors.length === 1 ? "." : "s.");
        }
      } catch (error) {
        liveStatus.textContent = error.message;
      } finally {
        scanButton.disabled = false;
      }
    });

    connectButton.addEventListener("click", async () => {
      liveStatus.textContent = "Starting connection…";
      firstHostTime = null;
      latestHostTime = null;
      try {
        const response = await fetch("/api/live/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: sensorSelect.value,
            sensorName: sensorSelect.options[sensorSelect.selectedIndex]?.textContent || "",
            sampleRateHz: 52,
          }),
        });
        const value = await response.json();
        if (!response.ok) throw new Error(value.error || "Connection failed.");
        connectButton.hidden = true;
        disconnectButton.hidden = false;
      } catch (error) {
        liveStatus.textContent = error.message;
      }
    });

    disconnectButton.addEventListener("click", async () => {
      await fetch("/api/live/disconnect", { method: "POST" });
      connectButton.hidden = false;
      disconnectButton.hidden = true;
      liveStatus.textContent = "Disconnected.";
    });

    startRecordingButton.addEventListener("click", async () => {
      recordingStatus.textContent = "Starting recording…";
      try {
        const response = await fetch("/api/live/recording/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dataRoot: document.querySelector("#recording-root").value,
            movement: document.querySelector("#movement").value,
            placement: document.querySelector("#placement").value,
            orientation: document.querySelector("#orientation").value,
            orientationNotes: document.querySelector("#orientation-notes").value,
            anatomicalStartConfirmed: anatomicalStartCheckbox.checked,
            proximalControlConfirmed: proximalControlCheckbox.checked,
          }),
        });
        const value = await response.json();
        if (!response.ok) throw new Error(value.error || "Could not start recording.");
      } catch (error) {
        recordingStatus.textContent = error.message;
      }
    });

    const movementGuidance = {
      static_neutral: "Begin in anatomical position and remain still for 10 seconds.",
      isolated_forearm_rotation: "Keep trunk, shoulder, elbow, and wrist fixed in the protocol position; rotate only the forearm through controlled supination/pronation.",
      isolated_elbow_flexion_extension: "Keep trunk and shoulder fixed and maintain the defined forearm rotation; move only through elbow flexion/extension in the sagittal plane.",
      combined_elbow_forearm: "Use only after both isolated stages pass; elbow angle defines the moving reference frame in which forearm rotation is interpreted.",
      isolated_shoulder: "Future stage: lock elbow, forearm, and wrist while introducing the shoulder's three rotational DOFs.",
      shoulder_elbow: "Future stage: combine shoulder and elbow only after isolated shoulder and elbow stages pass.",
      shoulder_elbow_forearm: "Future stage: requires additional segment sensors or model constraints because one wrist orientation cannot uniquely identify five joint DOFs.",
      non_human_bench: "Move the unattached sensor through repeatable poses without interpreting the result as human joint motion.",
    };
    function updateProtocolGuidance() {
      const movement = document.querySelector("#movement").value;
      const placement = document.querySelector("#placement").value;
      const mounting = placement === "right_wrist"
        ? "Right wrist mounting: logo outward, M end distal toward hand."
        : placement === "left_wrist"
          ? "Left wrist mounting: logo outward, final E end distal toward hand."
          : "Document the fixture orientation.";
      document.querySelector("#protocol-guidance").textContent =
        mounting + " " + movementGuidance[movement];
    }
    function updateRecordingReadiness() {
      startRecordingButton.disabled =
        !streamConnected ||
        !anatomicalStartCheckbox.checked ||
        !proximalControlCheckbox.checked;
    }
    document.querySelector("#movement").addEventListener("change", updateProtocolGuidance);
    document.querySelector("#placement").addEventListener("change", updateProtocolGuidance);
    anatomicalStartCheckbox.addEventListener("change", updateRecordingReadiness);
    proximalControlCheckbox.addEventListener("change", updateRecordingReadiness);
    updateProtocolGuidance();
    updateRecordingReadiness();

    stopRecordingButton.addEventListener("click", async () => {
      stopRecordingButton.disabled = true;
      recordingStatus.textContent = "Finalizing checksum and manifest…";
      try {
        const response = await fetch("/api/live/recording/stop", { method: "POST" });
        const value = await response.json();
        if (!response.ok) throw new Error(value.error || "Could not stop recording.");
      } catch (error) {
        recordingStatus.textContent = error.message;
      } finally {
        stopRecordingButton.disabled = false;
      }
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      status.textContent = "Saving…";
      const patch = {
        vision: form.vision.value,
        targetPlatform: form.targetPlatform.value,
        transport: form.transport.value,
        sampleRateHz: Number(form.sampleRateHz.value),
        targetSensorCount: Number(form.targetSensorCount.value),
      };
      try {
        const response = await fetch("/api/state", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const value = await response.json();
        if (!response.ok) throw new Error(value.error || "Save failed.");
        render(value);
        status.textContent = "Saved.";
      } catch (error) {
        status.textContent = error.message;
      }
    });

    load().catch((error) => { status.textContent = error.message; });
  </script>
</body>
</html>`;
}

export async function createStudioServer({ acquisition, initialState, onSave }) {
  let state = initialState;
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    try {
      if (request.method === "GET" && url.pathname === "/") {
        response.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy":
            "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
        });
        response.end(page());
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/state") {
        sendJson(response, 200, state);
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/live/events") {
        response.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        });
        response.write(": connected\n\n");
        const remove = acquisition.addListener(response);
        request.on("close", remove);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/live/scan") {
        sendJson(response, 200, await acquisition.scan());
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/live/connect") {
        const input = await readJson(request);
        if (
          typeof input?.address !== "string" ||
          input.address.trim() === "" ||
          !Number.isInteger(input.sampleRateHz) ||
          input.sampleRateHz < 1 ||
          input.sampleRateHz > 1600
        ) {
          throw new CanvasError("INVALID_INPUT", "A device address and valid sample rate are required.");
        }
        sendJson(response, 202, acquisition.start(input.address, input.sampleRateHz, input.sensorName));
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/live/disconnect") {
        sendJson(response, 200, await acquisition.stop());
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/live/recording/start") {
        const input = await readJson(request);
        if (
          typeof input?.dataRoot !== "string" ||
          typeof input?.movement !== "string" ||
          typeof input?.placement !== "string" ||
          typeof input?.orientation !== "string" ||
          typeof input?.orientationNotes !== "string" ||
          input?.anatomicalStartConfirmed !== true ||
          input?.proximalControlConfirmed !== true
        ) {
          throw new CanvasError(
            "INVALID_INPUT",
            "Recording fields and both anatomical-position confirmations are required.",
          );
        }
        state = await onSave({ dataRoot: input.dataRoot });
        sendJson(response, 201, await acquisition.startRecording(input));
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/live/recording/stop") {
        sendJson(response, 200, await acquisition.stopRecording());
        return;
      }
      if (request.method === "PATCH" && url.pathname === "/api/state") {
        const patch = await readJson(request);
        state = await onSave(patch);
        sendJson(response, 200, state);
        return;
      }
      sendJson(response, 404, { error: "Not found." });
    } catch (error) {
      const message = error instanceof CanvasError ? error.message : "The request failed.";
      sendJson(response, error instanceof CanvasError ? 400 : 500, { error: message });
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new CanvasError("SERVER_START_FAILED", "Could not determine the acquisition studio address.");
  }
  return {
    acquisition,
    url: `http://127.0.0.1:${address.port}/`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}
