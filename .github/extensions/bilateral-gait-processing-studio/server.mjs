import http from "node:http";

import { CanvasError } from "@github/copilot-sdk/extension";

import {
  analyzeBilateralRecording,
  GaitProcessingError,
  listBilateralRecordings,
  loadBilateralSignalWindow,
} from "./processing.mjs";
import {
  configureRecording,
  loadProcessingState,
} from "./storage.mjs";

const MAX_BODY_BYTES = 8 * 1024;

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) {
      throw new CanvasError("REQUEST_TOO_LARGE", "The request body is too large.");
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new CanvasError("INVALID_JSON", "The request body is not valid JSON.");
  }
}

function page() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Bilateral Gait Processing Studio</title>
  <style>
    :root{color-scheme:dark;--bg:#07110f;--panel:#10201c;--line:#315347;--ink:#effbf6;--muted:#a4bdb4;--left:#52d3ff;--right:#ffb75c;--green:#77e0a1;--red:#ff7f73}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;color:var(--ink);background:radial-gradient(circle at 12% 0,#164638 0,transparent 36%),var(--bg);font:14px/1.5 ui-sans-serif,system-ui,-apple-system,sans-serif}
    header,main{width:min(1200px,calc(100% - 32px));margin:auto}header{padding:36px 0 22px}.eyebrow{color:var(--green);font-size:11px;font-weight:850;letter-spacing:.15em;text-transform:uppercase}
    h1{margin:5px 0;font-size:clamp(30px,6vw,54px);line-height:1;letter-spacing:-.045em}header p,.muted{color:var(--muted)}
    main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;padding-bottom:44px}.panel{min-width:0;padding:20px;border:1px solid var(--line);border-radius:16px;background:rgba(16,32,28,.94)}.wide{grid-column:1/-1}
    h2{margin:0 0 14px}.toolbar{display:grid;grid-template-columns:minmax(220px,2fr) minmax(220px,1fr) auto auto;gap:10px;align-items:end}
    label{display:grid;gap:6px;color:var(--muted);font-weight:750}input,select{width:100%;padding:10px;color:var(--ink);background:#071712;border:1px solid var(--line);border-radius:9px;font:inherit}
    button{padding:10px 16px;color:#041611;background:var(--green);border:0;border-radius:999px;font:inherit;font-weight:850;cursor:pointer}button.secondary{color:var(--ink);background:#1b392f;border:1px solid var(--line)}
    button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid rgba(119,224,161,.4);outline-offset:2px}.metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.metric{padding:12px;border:1px solid var(--line);border-radius:11px;background:#091813}.metric strong{display:block;font-size:20px}.metric span{color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em}
    .ok{color:var(--green)}.bad{color:var(--red)}.charts{display:grid;gap:14px}.chart{padding:12px;border:1px solid var(--line);border-radius:12px;background:#081611}canvas{display:block;width:100%;height:260px;cursor:crosshair}.legend{display:flex;flex-wrap:wrap;gap:16px;color:var(--muted);font-size:12px}.left{color:var(--left)}.right{color:var(--right)}
    .zoom{display:grid;grid-template-columns:minmax(220px,2fr) 1fr 1fr auto auto;gap:10px;align-items:end;margin:16px 0}.segment-table button{padding:6px 11px}.segment-calibration{color:#c9a8ff}.segment-gait_bout{color:var(--green)}.segment-path_segment{color:#ffcf7c}
    table{width:100%;border-collapse:collapse}th,td{padding:9px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{color:var(--muted);font-size:11px;text-transform:uppercase}.event-list{max-height:320px;overflow:auto}
    #status{min-height:24px;margin-top:10px;color:var(--muted)}.empty{padding:24px;border:1px dashed var(--line);border-radius:12px;color:var(--muted)}
    @media(max-width:800px){main{grid-template-columns:1fr}.wide{grid-column:auto}.toolbar,.zoom{grid-template-columns:1fr}.metrics{grid-template-columns:repeat(2,1fr)}}
  </style>
</head>
<body>
  <header>
    <div class="eyebrow">HMS Lab · Bilateral distal shank IMU</div>
    <h1>Bilateral Gait Processing Studio</h1>
    <p>Verify a governed recording, compare both streams, and review acquisition events before gait metrics are calculated.</p>
  </header>
  <main>
    <section class="panel wide">
      <div class="toolbar">
        <label>Governed storage root<input id="root" type="text" autocomplete="off"></label>
        <label>Recording<select id="recording"><option value="">Load recordings first</option></select></label>
        <button id="load" type="button" class="secondary">List recordings</button>
        <button id="open" type="button">Inspect recording</button>
      </div>
      <div id="status" role="status" aria-live="polite"></div>
    </section>
    <section id="content" class="panel wide"><div class="empty">Select a finalized bilateral-gait recording.</div></section>
  </main>
  <script>
    const root = document.getElementById("root");
    const recording = document.getElementById("recording");
    const status = document.getElementById("status");
    const content = document.getElementById("content");
    let currentReport = null;
    let currentWindow = null;
    const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
    const fixed = (value,digits=2) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—";
    async function request(url, options) {
      const response = await fetch(url, options);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Request failed.");
      return body;
    }
    function fillRecordings(items, selected="") {
      recording.innerHTML = items.length
        ? items.map(item => '<option value="'+escapeHtml(item.recordingId)+'" '+(item.recordingId===selected?"selected":"")+'>'+escapeHtml(new Date(item.startedAt).toLocaleString())+' · '+escapeHtml(item.recordingId)+'</option>').join("")
        : '<option value="">No finalized bilateral recordings found</option>';
    }
    function markerColor(type,alpha=1) {
      const color = type==="calibration" ? "201,168,255" : type==="gait_bout" ? "119,224,161" : type==="path_segment" ? "255,207,124" : "164,189,180";
      return "rgba("+color+","+alpha+")";
    }
    function draw(canvas, leftRows, rightRows, key, events, segments, requestedStart, requestedEnd) {
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth, height = canvas.clientHeight;
      canvas.width = width * ratio; canvas.height = height * ratio;
      const context = canvas.getContext("2d"); context.scale(ratio,ratio);
      const all = [...leftRows,...rightRows];
      if (!all.length) return;
      const start = Number.isFinite(requestedStart) ? requestedStart : Math.min(...all.map(row=>row.timeSeconds));
      const end = Number.isFinite(requestedEnd) ? requestedEnd : Math.max(...all.map(row=>row.timeSeconds));
      const values = all.map(row=>row[key]);
      let min = Math.min(...values), max = Math.max(...values);
      if (min===max){min-=1;max+=1}
      context.strokeStyle="#315347";context.lineWidth=1;
      for(let i=0;i<=4;i++){const y=12+(height-28)*i/4;context.beginPath();context.moveTo(42,y);context.lineTo(width-8,y);context.stroke()}
      for(const segment of segments){const x1=Math.max(42,42+(segment.startSeconds-start)/(end-start)*(width-50));const x2=Math.min(width-8,42+(segment.endSeconds-start)/(end-start)*(width-50));if(x2<=42||x1>=width-8)continue;context.fillStyle=markerColor(segment.type,.08);context.fillRect(x1,8,Math.max(1,x2-x1),height-26)}
      events.forEach((event,index)=>{const x=42+(event.relativeSeconds-start)/(end-start)*(width-50);if(x<42||x>width-8)return;context.strokeStyle=markerColor(event.type,.65);context.beginPath();context.moveTo(x,8);context.lineTo(x,height-18);context.stroke();context.fillStyle=markerColor(event.type,.95);context.font="10px system-ui";context.save();context.translate(Math.min(x+3,width-110),18+(index%3)*12);context.fillText(event.label+" · "+event.semantics,0,0);context.restore()});
      const plot=(rows,color)=>{context.strokeStyle=color;context.lineWidth=1.4;context.beginPath();rows.forEach((row,index)=>{const x=42+(row.timeSeconds-start)/(end-start)*(width-50);const y=12+(max-row[key])/(max-min)*(height-30);index?context.lineTo(x,y):context.moveTo(x,y)});context.stroke()};
      plot(leftRows,"#52d3ff");plot(rightRows,"#ffb75c");
      context.fillStyle="#a4bdb4";context.font="11px system-ui";context.fillText(fixed(max,1),4,16);context.fillText(fixed(min,1),4,height-20);context.fillText(fixed(start,1)+" s",42,height-3);context.fillText(fixed(end,1)+" s",width-48,height-3);
    }
    function drawCurrent(windowData) {
      currentWindow = windowData;
      draw(document.getElementById("gyro"),windowData.signals.left_distal_shank,windowData.signals.right_distal_shank,"angularVelocityMagnitude",windowData.events,windowData.segments,windowData.startSeconds,windowData.endSeconds);
      draw(document.getElementById("accel"),windowData.signals.left_distal_shank,windowData.signals.right_distal_shank,"accelerationMagnitude",windowData.events,windowData.segments,windowData.startSeconds,windowData.endSeconds);
      document.getElementById("zoomStart").value=fixed(windowData.startSeconds,3);
      document.getElementById("zoomEnd").value=fixed(windowData.endSeconds,3);
    }
    async function zoom(startSeconds,endSeconds) {
      status.textContent="Loading high-resolution stream window…";
      try {
        const windowData=await request("/api/window",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({startSeconds,endSeconds})});
        drawCurrent(windowData);status.textContent="Showing "+fixed(startSeconds,3)+"–"+fixed(endSeconds,3)+" seconds.";
      } catch(error){status.textContent=error.message}
    }
    function render(report) {
      currentReport = report;
      const qualities = Object.fromEntries(report.timing.roleQuality.map(item=>[item.role,item]));
      const left = qualities.left_distal_shank, right = qualities.right_distal_shank;
      const integrityOk = report.integrity.checksumMatches && report.integrity.sqliteIntegrity==="ok";
      content.innerHTML = \`
        <div class="metrics">
          <div class="metric"><strong class="\${integrityOk?"ok":"bad"}">\${integrityOk?"Verified":"Review"}</strong><span>source integrity</span></div>
          <div class="metric"><strong>\${fixed(left.effectiveRateHz)} Hz</strong><span>left effective rate</span></div>
          <div class="metric"><strong>\${fixed(right.effectiveRateHz)} Hz</strong><span>right effective rate</span></div>
          <div class="metric"><strong>\${report.timing.sampleCountDifference}</strong><span>sample imbalance</span></div>
          <div class="metric"><strong>\${report.events.length}</strong><span>recorded events</span></div>
        </div>
        <div class="zoom">
          <label>Marker-derived segment<select id="segmentSelect"><option value="">Entire recording</option>\${report.segments.map(segment=>\`<option value="\${escapeHtml(segment.id)}">\${escapeHtml(segment.type.replaceAll("_"," "))} · \${escapeHtml(segment.label)} · \${fixed(segment.startSeconds,2)}–\${fixed(segment.endSeconds,2)} s</option>\`).join("")}</select></label>
          <label>Start (s)<input id="zoomStart" type="number" min="0" step="0.001"></label>
          <label>End (s)<input id="zoomEnd" type="number" min="0" step="0.001"></label>
          <button id="applyZoom" type="button">Apply zoom</button>
          <button id="resetZoom" type="button" class="secondary">Full recording</button>
        </div>
        <div class="charts" style="margin-top:16px">
          <div class="chart"><h2>Angular velocity magnitude</h2><div class="legend"><b class="left">Left distal shank</b><b class="right">Right distal shank</b><span class="segment-calibration">Calibration</span><span class="segment-gait_bout">Gait bout</span><span class="segment-path_segment">Path segment</span></div><canvas id="gyro"></canvas></div>
          <div class="chart"><h2>Acceleration magnitude</h2><div class="legend"><b class="left">Left distal shank</b><b class="right">Right distal shank</b></div><canvas id="accel"></canvas></div>
        </div>
        <h2 style="margin-top:20px">Stream quality</h2>
        <table><thead><tr><th>Role</th><th>Samples</th><th>Packets</th><th>Missing packets</th><th>Max gap</th><th>Large gaps</th></tr></thead><tbody>
          \${report.timing.roleQuality.map(item=>\`<tr><td>\${escapeHtml(item.role)}</td><td>\${item.samples}</td><td>\${item.packets}</td><td>\${item.missingPackets}</td><td>\${fixed(item.maximumGapMs,1)} ms</td><td>\${item.gapsOverTwoPointFivePeriods}</td></tr>\`).join("")}
        </tbody></table>
        <h2 style="margin-top:20px">Marker-derived segments</h2>
        <div class="event-list segment-table"><table><thead><tr><th>Type</th><th>Label</th><th>Start</th><th>End</th><th>Duration</th><th></th></tr></thead><tbody>
          \${report.segments.map(segment=>\`<tr><td class="segment-\${escapeHtml(segment.type)}">\${escapeHtml(segment.type)}</td><td>\${escapeHtml(segment.label)}</td><td>\${fixed(segment.startSeconds,3)} s</td><td>\${fixed(segment.endSeconds,3)} s</td><td>\${fixed(segment.durationSeconds,3)} s</td><td><button type="button" class="secondary segmentZoom" data-segment="\${escapeHtml(segment.id)}">Zoom</button></td></tr>\`).join("")}
        </tbody></table></div>
        <h2 style="margin-top:20px">Acquisition events</h2>
        <div class="event-list"><table><thead><tr><th>Time</th><th>Type</th><th>Label</th><th>Semantics</th></tr></thead><tbody>
          \${report.events.map(event=>\`<tr><td>\${fixed(event.relativeSeconds,3)} s</td><td>\${escapeHtml(event.type)}</td><td>\${escapeHtml(event.label)}</td><td>\${escapeHtml(event.semantics)}</td></tr>\`).join("")}
        </tbody></table></div>
        <p class="muted">Alignment is provisional host packet time. Metric-grade bilateral synchronization and reviewed gait-event detection remain later processing stages.</p>\`;
      const times=[...report.signals.left_distal_shank,...report.signals.right_distal_shank].map(row=>row.timeSeconds);
      const full={startSeconds:Math.min(...times),endSeconds:Math.max(...times),signals:report.signals,events:report.events,segments:report.segments};
      drawCurrent(full);
      const zoomSegment = id => {
        const segment=report.segments.find(item=>item.id===id);
        if(segment) zoom(Math.max(0,segment.startSeconds-.5),segment.endSeconds+.5);
      };
      document.getElementById("segmentSelect").addEventListener("change",event=>event.target.value?zoomSegment(event.target.value):drawCurrent(full));
      document.querySelectorAll(".segmentZoom").forEach(button=>button.addEventListener("click",()=>zoomSegment(button.dataset.segment)));
      document.getElementById("applyZoom").addEventListener("click",()=>zoom(Number(document.getElementById("zoomStart").value),Number(document.getElementById("zoomEnd").value)));
      document.getElementById("resetZoom").addEventListener("click",()=>drawCurrent(full));
    }
    async function list() {
      status.textContent="Reading bilateral manifests…";
      try {
        const items=await request("/api/list",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({governedRoot:root.value})});
        fillRecordings(items);status.textContent=items.length+" finalized bilateral recording(s) found.";
      } catch(error){status.textContent=error.message}
    }
    async function inspect() {
      status.textContent="Verifying checksum and reading both streams…";
      try {
        const result=await request("/api/configure",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({governedRoot:root.value,recordingId:recording.value})});
        render(result.analysis);status.textContent="Recording verified and loaded.";
      } catch(error){status.textContent=error.message}
    }
    document.getElementById("load").addEventListener("click",list);
    document.getElementById("open").addEventListener("click",inspect);
    window.addEventListener("resize",()=>{});
    (async()=>{try{const state=await request("/api/state");root.value=state.state.governedRoot||"";fillRecordings(state.recordings||[],state.state.recordingId);if(state.analysis)render(state.analysis)}catch(error){status.textContent=error.message}})();
  </script>
</body>
</html>`;
}

function asCanvasError(error) {
  if (error instanceof CanvasError) return error;
  if (error instanceof GaitProcessingError) return new CanvasError(error.code, error.message);
  return new CanvasError("PROCESSING_FAILED", error.message);
}

export async function createBilateralGaitServer(identity) {
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    try {
      if (request.method === "GET" && url.pathname === "/") {
        response.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Security-Policy":
            "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'",
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
        });
        response.end(page());
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/state") {
        const state = await loadProcessingState(identity);
        const recordings = state.governedRoot
          ? await listBilateralRecordings(state.governedRoot)
          : [];
        const analysis = state.governedRoot && state.recordingId
          ? await analyzeBilateralRecording(state.governedRoot, state.recordingId)
          : null;
        sendJson(response, 200, { state, recordings, analysis });
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/list") {
        const input = await readJson(request);
        sendJson(response, 200, await listBilateralRecordings(input.governedRoot));
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/configure") {
        const input = await readJson(request);
        const state = await configureRecording(identity, input);
        const analysis = await analyzeBilateralRecording(state.governedRoot, state.recordingId);
        sendJson(response, 200, { state, analysis });
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/window") {
        const input = await readJson(request);
        const state = await loadProcessingState(identity);
        if (!state.governedRoot || !state.recordingId) {
          throw new CanvasError("RECORDING_NOT_CONFIGURED", "Select a bilateral-gait recording first.");
        }
        sendJson(
          response,
          200,
          await loadBilateralSignalWindow(
            state.governedRoot,
            state.recordingId,
            input.startSeconds,
            input.endSeconds,
          ),
        );
        return;
      }
      sendJson(response, 404, { error: "Not found." });
    } catch (error) {
      const converted = asCanvasError(error);
      sendJson(response, 400, { error: converted.message, code: converted.code });
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}
