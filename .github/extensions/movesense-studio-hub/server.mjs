import http from "node:http";

export const STUDIOS = [
  {
    id: "movesense-opensense-acquisition-studio",
    name: "Acquisition Studio",
    prompt: "Open Movesense Acquisition Studio",
    purpose: "Connect Movesense sensors, inspect live IMU9 signals, and record governed data.",
    next: "Use this for the next repeatability, one-sensor two-DOF, and multi-sensor sessions.",
  },
  {
    id: "movesense-opensense-processing-studio",
    name: "Processing Studio",
    prompt: "Open Movesense Processing Studio",
    purpose: "Inspect recordings, select calibration and movement intervals, run OpenSense, and view OpenSim motion.",
    next: "Use this after each recording passes acquisition integrity checks.",
  },
  {
    id: "movesense-opensense-firmware-update-studio",
    name: "Firmware Update Studio",
    prompt: "Open Movesense Firmware Update Studio",
    purpose: "Inventory the sensor fleet and prepare verified firmware update packages.",
    next: "Use this before scaling collection to additional sensors.",
  },
];

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
      character
    ],
  );
}

function page() {
  const cards = STUDIOS.map(
    (studio) => `
      <article class="card">
        <div class="canvas-id">${escapeHtml(studio.id)}</div>
        <h2>${escapeHtml(studio.name)}</h2>
        <p>${escapeHtml(studio.purpose)}</p>
        <p class="next">${escapeHtml(studio.next)}</p>
        <button type="button" data-prompt="${escapeHtml(studio.prompt)}">
          Copy “${escapeHtml(studio.prompt)}”
        </button>
      </article>`,
  ).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Movesense Studio Hub</title>
  <style>
    :root { color-scheme:dark; --bg:#071018; --panel:#101e29; --line:#29475b; --ink:#eff9ff; --muted:#a7bac7; --cyan:#61d8ff; --green:#6ce3a1; }
    * { box-sizing:border-box; }
    body { margin:0; min-height:100vh; color:var(--ink); background:radial-gradient(circle at 12% 0,#17415a 0,transparent 36%),var(--bg); font:15px/1.5 ui-sans-serif,system-ui,-apple-system,sans-serif; }
    header, main, footer { width:min(1080px,calc(100% - 32px)); margin:auto; }
    header { padding:48px 0 24px; }
    .eyebrow,.canvas-id { color:var(--cyan); font-size:11px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; }
    h1 { margin:5px 0 12px; font-size:clamp(34px,6vw,62px); line-height:1; letter-spacing:-.05em; }
    header p, footer, .next { color:var(--muted); }
    .instruction { padding:14px 16px; margin:0 0 20px; border-left:3px solid var(--green); border-radius:9px; background:#0c2934; }
    main { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:16px; }
    .card { display:flex; flex-direction:column; min-width:0; padding:22px; border:1px solid var(--line); border-radius:16px; background:rgba(16,30,41,.94); }
    h2 { margin:8px 0; font-size:23px; }
    .next { flex:1; }
    button { width:100%; padding:11px 14px; color:#03151d; background:var(--cyan); border:0; border-radius:999px; font:inherit; font-weight:850; cursor:pointer; }
    button:focus-visible { outline:3px solid rgba(97,216,255,.4); outline-offset:3px; }
    #status { min-height:24px; margin:18px auto; color:var(--green); font-weight:750; text-align:center; }
    footer { padding:0 0 40px; text-align:center; }
    code { color:var(--cyan); }
    @media(max-width:800px){ main{grid-template-columns:1fr} }
  </style>
</head>
<body>
  <header>
    <div class="eyebrow">Movesense · OpenSense · OpenSim</div>
    <h1>Studio Hub</h1>
    <p>Choose the workspace for the next part of the sensor-to-simulation workflow.</p>
    <div class="instruction"><strong>How launching works:</strong> select a studio below, paste the copied phrase into Copilot Chat, and the matching canvas will open. Project canvas pages cannot directly control the VS Code host.</div>
  </header>
  <main>${cards}</main>
  <div id="status" role="status" aria-live="polite"></div>
  <footer>Reopen this hub at any time with <code>Open Movesense Studio Hub</code>.</footer>
  <script>
    const status = document.getElementById("status");
    document.querySelectorAll("button[data-prompt]").forEach(button => {
      button.addEventListener("click", async () => {
        const prompt = button.dataset.prompt;
        try {
          await navigator.clipboard.writeText(prompt);
          status.textContent = "Copied: " + prompt + ". Paste it into Copilot Chat.";
        } catch {
          status.textContent = prompt + " — copy this phrase into Copilot Chat.";
        }
      });
    });
  </script>
</body>
</html>`;
}

export async function createHubServer() {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (request.method !== "GET" || url.pathname !== "/") {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found.");
      return;
    }
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(page());
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
