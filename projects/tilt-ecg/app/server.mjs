import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { TiltSessionManager } from "./session-manager.mjs";

const APP_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIRECTORY = path.join(APP_DIRECTORY, "public");
const REPOSITORY_ROOT = path.resolve(APP_DIRECTORY, "../../..");
const DEFAULT_DATA_ROOT = path.resolve(REPOSITORY_ROOT, "../governed-storage");

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

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
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 64 * 1024) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

async function serveAsset(response, pathname) {
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  if (!/^[a-zA-Z0-9._/-]+$/.test(relativePath) || relativePath.includes("..")) {
    sendJson(response, 404, { error: "Not found." });
    return;
  }
  const filePath = path.join(PUBLIC_DIRECTORY, relativePath);
  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": CONTENT_TYPES[path.extname(filePath)] ?? "application/octet-stream",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    });
    response.end(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendJson(response, 404, { error: "Not found." });
      return;
    }
    throw error;
  }
}

export async function createTiltEcgServer({
  port = 4173,
  dataRoot = DEFAULT_DATA_ROOT,
  manager = new TiltSessionManager(),
} = {}) {
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    try {
      if (request.method === "GET" && url.pathname === "/api/config") {
        sendJson(response, 200, {
          dataRoot,
          disclaimer:
            "Research acquisition interface only; not a diagnostic monitor or alarm.",
        });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/state") {
        sendJson(response, 200, manager.state);
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/events") {
        response.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no",
        });
        response.write(": connected\n\n");
        const remove = manager.addClient(response);
        request.on("close", remove);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/scan") {
        sendJson(response, 200, { devices: await manager.scan() });
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/connect/demo") {
        sendJson(response, 200, await manager.connectSynthetic());
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/connect/hardware") {
        sendJson(response, 202, await manager.connectHardware(await readJson(request)));
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/disconnect") {
        sendJson(response, 200, await manager.disconnect());
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/zero") {
        sendJson(response, 200, manager.acceptZero());
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/recording/start") {
        sendJson(response, 201, await manager.startRecording(await readJson(request)));
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/recording/event") {
        sendJson(response, 201, manager.recordEvent(await readJson(request)));
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/recording/stop") {
        const input = await readJson(request);
        if (input.confirmation !== "END TEST") {
          throw new Error('Enter "END TEST" to finalize the recording.');
        }
        sendJson(response, 200, await manager.stopRecording());
        return;
      }
      if (request.method === "GET") {
        await serveAsset(response, url.pathname);
        return;
      }
      sendJson(response, 404, { error: "Not found." });
    } catch (error) {
      sendJson(response, 400, { error: error.message || "The request failed." });
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not determine the local application address.");
  }
  return {
    url: `http://127.0.0.1:${address.port}/`,
    manager,
    async close() {
      await manager.close();
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    },
  };
}

function openBrowser(url) {
  const command =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
  const child = spawn(command[0], command[1], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

function parseArguments(argv) {
  const options = { port: 4173, dataRoot: DEFAULT_DATA_ROOT, open: true };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--no-open") options.open = false;
    else if (argument === "--port") options.port = Number(argv[++index]);
    else if (argument === "--data-root") options.dataRoot = path.resolve(argv[++index]);
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535) {
    throw new Error("Port must be an integer from 0 through 65535.");
  }
  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseArguments(process.argv.slice(2));
  const application = await createTiltEcgServer(options);
  process.stdout.write(`HMS Lab Tilt ECG is running at ${application.url}${os.EOL}`);
  process.stdout.write(`Governed data root: ${options.dataRoot}${os.EOL}`);
  if (options.open) openBrowser(application.url);
  const shutdown = async () => {
    await application.close();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
