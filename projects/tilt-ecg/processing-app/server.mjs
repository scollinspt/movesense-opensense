import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { RecordingStore } from "./recording-store.mjs";

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
    if (length > 256 * 1024) throw new Error("Request body is too large.");
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

export async function createProcessingServer({
  port = 4175,
  dataRoot = DEFAULT_DATA_ROOT,
  store = new RecordingStore(dataRoot),
} = {}) {
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    try {
      if (request.method === "GET" && url.pathname === "/api/config") {
        sendJson(response, 200, {
          dataRoot: path.resolve(dataRoot),
          disclaimer:
            "Research review interface only; not a diagnostic interpretation.",
        });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/recordings") {
        sendJson(response, 200, { recordings: await store.refresh() });
        return;
      }
      const descriptionMatch = url.pathname.match(
        /^\/api\/recordings\/([^/]+)$/,
      );
      if (request.method === "GET" && descriptionMatch) {
        sendJson(
          response,
          200,
          await store.describe(decodeURIComponent(descriptionMatch[1])),
        );
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/analyze") {
        const input = await readJson(request);
        sendJson(
          response,
          200,
          await store.analyze(input.recordingId, input.settings),
        );
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/reviews") {
        const input = await readJson(request);
        sendJson(
          response,
          201,
          await store.saveReview(
            input.recordingId,
            input.settings,
            input.reviewerConclusion,
          ),
        );
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
    throw new Error("Could not determine the local processing address.");
  }
  return {
    url: `http://127.0.0.1:${address.port}/`,
    store,
    async close() {
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
  const options = { port: 4175, dataRoot: DEFAULT_DATA_ROOT, open: true };
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
  const application = await createProcessingServer(options);
  process.stdout.write(`HMS Lab Tilt ECG Processing is running at ${application.url}${os.EOL}`);
  process.stdout.write(`Governed data root: ${options.dataRoot}${os.EOL}`);
  if (options.open) openBrowser(application.url);
  const shutdown = async () => {
    await application.close();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
