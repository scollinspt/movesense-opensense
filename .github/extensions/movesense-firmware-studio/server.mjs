import http from "node:http";

import { CanvasError } from "@github/copilot-sdk/extension";

const MAX_BODY = 8 * 1024;
const MAX_PACKAGE_BODY = 10 * 1024 * 1024;

function json(response, status, value) {
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
      if (Buffer.byteLength(body) > MAX_BODY) {
        request.destroy();
        reject(new CanvasError("REQUEST_TOO_LARGE", "Request is too large."));
      }
    });
    request.on("end", () => {
      try { resolve(JSON.parse(body)); }
      catch { reject(new CanvasError("INVALID_JSON", "Request is not valid JSON.")); }
    });
    request.on("error", reject);
  });
}

function readBuffer(request, maximumBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > maximumBytes) {
        request.destroy();
        reject(new CanvasError("REQUEST_TOO_LARGE", "Firmware package exceeds the 10 MB limit."));
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function page() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Movesense Firmware Update Studio</title>
  <style>
    :root { color-scheme: dark; --bg:#0b1017; --panel:#131c27; --line:#29394c; --ink:#eef6ff; --muted:#9cb0c6; --blue:#63b3ff; --green:#5ce0a2; --amber:#ffc66d; --red:#ff7d6b; }
    * { box-sizing:border-box; }
    body { margin:0; background:radial-gradient(circle at 10% 0,#18304a 0,transparent 32%),var(--bg); color:var(--ink); font:15px/1.5 system-ui,sans-serif; }
    header,main { width:min(1120px,calc(100% - 32px)); margin:auto; }
    header { padding:42px 0 24px; }
    .eyebrow { color:var(--blue); font-size:12px; font-weight:800; letter-spacing:.15em; text-transform:uppercase; }
    h1 { margin:6px 0; font-size:clamp(31px,5vw,54px); line-height:1; letter-spacing:-.04em; }
    header p,.muted { color:var(--muted); }
    main { display:grid; grid-template-columns:1fr 1fr; gap:16px; padding-bottom:48px; }
    .panel { padding:20px; border:1px solid var(--line); border-radius:17px; background:rgba(19,28,39,.92); }
    .wide { grid-column:1/-1; }
    h2 { margin:0 0 13px; font-size:18px; }
    button { border:0; border-radius:999px; padding:10px 16px; color:#06131f; background:var(--blue); font:inherit; font-weight:800; cursor:pointer; }
    button:focus-visible { outline:3px solid rgba(99,179,255,.45); outline-offset:2px; }
    button:disabled { opacity:.5; cursor:not-allowed; }
    .secondary { color:var(--ink); background:#223247; }
    .package { display:grid; grid-template-columns:1fr auto; gap:12px; align-items:center; }
    code { overflow-wrap:anywhere; color:var(--green); }
    .status { min-height:24px; margin-top:10px; color:var(--muted); }
    .warning { padding:12px; border-left:3px solid var(--amber); background:rgba(255,198,109,.08); color:#ffe4b5; }
    .toolbar { display:flex; gap:10px; flex-wrap:wrap; }
    table { width:100%; border-collapse:collapse; }
    th,td { padding:10px 8px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }
    th { color:var(--muted); font-size:11px; text-transform:uppercase; letter-spacing:.08em; }
    .badge { display:inline-block; border-radius:999px; padding:3px 8px; background:#26384b; font-size:11px; }
    .badge.verified,.badge.gsp-ready { color:#071a12; background:var(--green); }
    .badge.needs-update,.badge.legacy-mds { color:#201500; background:var(--amber); }
    .progress { height:8px; margin-top:12px; overflow:hidden; border-radius:99px; background:#243143; }
    .progress span { display:block; height:100%; background:var(--green); }
    .package-tools { display:flex; gap:10px; flex-wrap:wrap; margin-top:12px; }
    input[type=file] { max-width:100%; color:var(--muted); }
    .manifest { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin-top:12px; }
    .manifest div { padding:9px; border:1px solid var(--line); border-radius:9px; }
    .workflow { display:grid; gap:8px; padding:0; list-style:none; counter-reset:steps; }
    .workflow li { position:relative; padding:10px 10px 10px 42px; border:1px solid var(--line); border-radius:10px; color:var(--muted); }
    .workflow li::before { counter-increment:steps; content:counter(steps); position:absolute; left:10px; top:9px; display:grid; place-items:center; width:22px; height:22px; border-radius:50%; color:#06131f; background:var(--blue); font-weight:900; }
    @media(max-width:760px){ main{grid-template-columns:1fr}.wide{grid-column:auto}.package{grid-template-columns:1fr} table{display:block;overflow:auto} }
  </style>
</head>
<body>
  <header>
    <div class="eyebrow">Movesense · Fleet Operations</div>
    <h1>Firmware Update Studio</h1>
    <p>Inventory, stage, and verify firmware consistently across a ten-sensor fleet.</p>
  </header>
  <main>
    <section class="panel" aria-labelledby="package-heading">
      <h2 id="package-heading">Official firmware package</h2>
      <div class="package">
        <div><strong id="package-name"></strong><br><span class="muted">Pinned official SS2 default firmware</span></div>
        <button id="prepare-package" type="button">Download & verify</button>
      </div>
      <div class="package-tools">
        <input id="package-file" type="file" accept=".zip,application/zip" aria-label="Choose firmware ZIP">
        <button id="import-package" class="secondary" type="button">Import ZIP</button>
      </div>
      <p>SHA-256<br><code id="checksum"></code></p>
      <div id="manifest" class="manifest"></div>
      <div id="package-status" class="status" role="status" aria-live="polite"></div>
    </section>
    <section class="panel" aria-labelledby="safety-heading">
      <h2 id="safety-heading">DFU safety gate</h2>
      <div class="warning"><strong>Flashing is locked.</strong> BLE discovery alone is not a validated Nordic DFU transport. Validate bootloader entry, transfer, rollback behavior, and post-flash verification on one test sensor before enabling fleet updates.</div>
      <p class="muted">Do not use SS2_NAND firmware on standard SS2 sensors. Never downgrade a 2.x sensor to the public 1.9.4 package.</p>
      <ol class="workflow">
        <li>Inventory one sensor and confirm model, battery, and current BLE profile.</li>
        <li>Verify the firmware ZIP and retain its SHA-256 and DFU manifest.</li>
        <li>Release the computer BLE connection and perform DFU using the maintained Nordic/Movesense mobile transport.</li>
        <li>Reconnect from this studio and verify the sensor now exposes GSP.</li>
        <li>Only then repeat sequentially for the remaining fleet.</li>
      </ol>
    </section>
    <section class="panel wide" aria-labelledby="fleet-heading">
      <h2 id="fleet-heading">Ten-sensor update queue</h2>
      <div class="toolbar">
        <button id="scan" type="button">Scan nearby sensors</button>
        <button id="inspect" class="secondary" type="button" disabled>Inventory selected sensor</button>
        <select id="sensor" aria-label="Discovered sensor"><option value="">No scan results</option></select>
      </div>
      <div class="progress" aria-label="Fleet verification progress"><span id="progress" style="width:0%"></span></div>
      <div id="fleet-status" class="status" role="status" aria-live="polite"></div>
      <table>
        <thead><tr><th>Sensor</th><th>Battery</th><th>BLE profile</th><th>Workflow status</th></tr></thead>
        <tbody id="devices"></tbody>
      </table>
    </section>
  </main>
  <script>
    const sensorSelect = document.querySelector("#sensor");
    const scanButton = document.querySelector("#scan");
    const inspectButton = document.querySelector("#inspect");
    const fleetStatus = document.querySelector("#fleet-status");
    const packageStatus = document.querySelector("#package-status");
    let scanned = [];

    function cell(text) { const value=document.createElement("td"); value.textContent=text; return value; }
    function badge(text) { const value=document.createElement("span"); value.className="badge "+text; value.textContent=text; return value; }
    function render(state) {
      document.querySelector("#package-name").textContent=state.package.fileName;
      document.querySelector("#checksum").textContent=state.package.expectedSha256;
      packageStatus.textContent=state.package.verified ? "Verified package stored privately at "+state.package.localPath : "Package not prepared.";
      const inspection=state.package.inspection;
      const manifest=document.querySelector("#manifest");
      if(inspection){
        const records=[
          ["Application",inspection.application.bin_file+" · "+inspection.application.bin_bytes+" bytes"],
          ["Bootloader included",inspection.contains_bootloader?"Yes":"No"],
        ];
        manifest.replaceChildren(...records.map(([label,value])=>{
          const item=document.createElement("div"); const strong=document.createElement("strong");
          strong.textContent=label; item.append(strong,document.createElement("br"),document.createTextNode(value)); return item;
        }));
      }else manifest.replaceChildren();
      const rows=state.devices.map((device)=>{
        const row=document.createElement("tr");
        row.append(cell(device.name+(device.serial ? " · "+device.serial : "")),cell(device.battery_percent === null ? "—" : device.battery_percent+"%"));
        const profile=document.createElement("td"); profile.append(badge(device.profile)); row.append(profile);
        const status=document.createElement("td"); status.append(badge(device.status)); row.append(status);
        return row;
      });
      document.querySelector("#devices").replaceChildren(...rows);
      const verified=state.devices.filter((device)=>device.status==="verified").length;
      document.querySelector("#progress").style.width=Math.min(100,verified/state.targetCount*100)+"%";
      fleetStatus.textContent=state.devices.length+" of "+state.targetCount+" sensors inventoried; "+verified+" verified.";
    }
    async function api(path, options={}) {
      const response=await fetch(path,options); const value=await response.json();
      if(!response.ok) throw new Error(value.error||"Operation failed."); return value;
    }
    document.querySelector("#prepare-package").addEventListener("click",async(event)=>{
      event.currentTarget.disabled=true; packageStatus.textContent="Downloading and verifying official package…";
      try{render(await api("/api/package",{method:"POST"}));}catch(error){packageStatus.textContent=error.message;}finally{event.currentTarget.disabled=false;}
    });
    document.querySelector("#import-package").addEventListener("click",async(event)=>{
      const file=document.querySelector("#package-file").files[0];
      if(!file){packageStatus.textContent="Choose a firmware ZIP first.";return;}
      event.currentTarget.disabled=true; packageStatus.textContent="Validating firmware structure and checksum…";
      try{
        const response=await fetch("/api/package/import",{
          method:"POST",
          headers:{"Content-Type":"application/zip","X-Firmware-Filename":encodeURIComponent(file.name)},
          body:file,
        });
        const value=await response.json(); if(!response.ok)throw new Error(value.error||"Import failed.");
        render(value);
        if(!value.package.verified)packageStatus.textContent="Structurally valid ZIP imported, but its checksum is not the pinned official package. Do not deploy until provenance is approved.";
      }catch(error){packageStatus.textContent=error.message;}finally{event.currentTarget.disabled=false;}
    });
    scanButton.addEventListener("click",async()=>{
      scanButton.disabled=true; fleetStatus.textContent="Scanning…";
      try{
        const result=await api("/api/scan",{method:"POST"}); scanned=result.sensors;
        sensorSelect.replaceChildren(new Option(scanned.length ? "Choose a sensor" : "No sensors found",""));
        scanned.forEach((sensor)=>sensorSelect.append(new Option(sensor.name+(sensor.rssi===null?"":" · "+sensor.rssi+" dBm"),sensor.address)));
        fleetStatus.textContent="Found "+scanned.length+" sensor"+(scanned.length===1?".":"s.");
      }catch(error){fleetStatus.textContent=error.message;}finally{scanButton.disabled=false;}
    });
    sensorSelect.addEventListener("change",()=>{inspectButton.disabled=!sensorSelect.value;});
    inspectButton.addEventListener("click",async()=>{
      const sensor=scanned.find((item)=>item.address===sensorSelect.value); if(!sensor)return;
      inspectButton.disabled=true; fleetStatus.textContent="Reading sensor inventory…";
      try{render(await api("/api/inspect",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(sensor)}));}
      catch(error){fleetStatus.textContent=error.message;}finally{inspectButton.disabled=false;}
    });
    api("/api/state").then(render).catch((error)=>{fleetStatus.textContent=error.message;});
  </script>
</body>
</html>`;
}

export async function createFirmwareServer({
  manager,
  loadState,
  preparePackage,
  importPackage,
  saveDevice,
  updateDevice,
}) {
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    try {
      if (request.method === "GET" && url.pathname === "/") {
        response.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy": "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'",
          "X-Content-Type-Options": "nosniff",
        });
        response.end(page());
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/state") {
        json(response, 200, await loadState()); return;
      }
      if (request.method === "POST" && url.pathname === "/api/package") {
        json(response, 200, await preparePackage()); return;
      }
      if (request.method === "POST" && url.pathname === "/api/package/import") {
        const encodedName = request.headers["x-firmware-filename"];
        const name = typeof encodedName === "string" ? decodeURIComponent(encodedName) : "firmware.zip";
        json(response, 200, await importPackage(await readBuffer(request, MAX_PACKAGE_BODY), name)); return;
      }
      if (request.method === "POST" && url.pathname === "/api/scan") {
        json(response, 200, await manager.scan()); return;
      }
      if (request.method === "POST" && url.pathname === "/api/inspect") {
        const input = await readJson(request);
        if (typeof input?.address !== "string" || typeof input?.name !== "string") {
          throw new CanvasError("INVALID_INPUT", "Sensor name and address are required.");
        }
        json(response, 200, await saveDevice(await manager.inspect(input.address, input.name))); return;
      }
      if (request.method === "POST" && url.pathname === "/api/device-status") {
        json(response, 200, await updateDevice(await readJson(request))); return;
      }
      json(response, 404, { error: "Not found." });
    } catch (error) {
      json(response, error instanceof CanvasError ? 400 : 500, {
        error: error instanceof Error ? error.message : "Operation failed.",
      });
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new CanvasError("SERVER_FAILED", "Could not start firmware studio.");
  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}
