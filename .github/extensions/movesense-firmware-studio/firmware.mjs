import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { CanvasError } from "@github/copilot-sdk/extension";

const FIRMWARE_URL =
  "https://api.bitbucket.org/2.0/repositories/movesense/movesense-device-lib/src/87254d2a34b9e3569817e9218fb1a059c9c7b3e2/samples/bin/release/default_firmware/Movesense-default_firmware-SS2_w_bootloader.zip";
const FILE_NAME = "Movesense-default_firmware-SS2_w_bootloader.zip";
const EXPECTED_SHA256 = "d0690ef72fa2ab2a3973944b8696523eebdcace3fbeb7ae7cf1073610865e9f9";

function pythonCommand(workspaceRoot) {
  const configured = process.env.PYTHON?.trim();
  if (configured) return configured;
  const candidate = process.platform === "win32"
    ? path.join(workspaceRoot, ".venv", "Scripts", "python.exe")
    : path.join(workspaceRoot, ".venv", "bin", "python");
  return existsSync(candidate) ? candidate : "python3";
}

async function runBridge(workspaceRoot, argumentsList, timeoutMs = 15000) {
  const sourceRoot = path.join(workspaceRoot, "src");
  const child = spawn(
    pythonCommand(workspaceRoot),
    ["-m", "movesense_opensense.acquisition.firmware_inventory", ...argumentsList],
    {
      cwd: workspaceRoot,
      env: { ...process.env, PYTHONPATH: sourceRoot, PYTHONUNBUFFERED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const events = [];
  let stderr = "";
  readline.createInterface({ input: child.stdout }).on("line", (line) => {
    try {
      events.push(JSON.parse(line));
    } catch {
      events.push({ event: "error", message: "Firmware bridge returned invalid data." });
    }
  });
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
  }, timeoutMs);
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", resolve);
  }).finally(() => clearTimeout(timeout));
  if (timedOut) throw new CanvasError("BLE_TIMEOUT", "Bluetooth operation timed out.");
  if (code !== 0) {
    throw new CanvasError(
      "BLE_FAILED",
      events.findLast((event) => event.event === "error")?.message || stderr || "Bluetooth operation failed.",
    );
  }
  return events;
}

export class FirmwareManager {
  constructor(workspaceRoot, packageDirectory) {
    this.workspaceRoot = workspaceRoot;
    this.packageDirectory = packageDirectory;
  }

  async scan() {
    const events = await runBridge(this.workspaceRoot, ["scan", "--timeout", "5"]);
    return events.findLast((event) => event.event === "scan-complete") ?? { sensors: [] };
  }

  async inspect(address, name) {
    const events = await runBridge(
      this.workspaceRoot,
      ["inspect", "--address", address, "--name", name],
    );
    const result = events.findLast((event) => event.event === "inventory");
    if (!result) throw new CanvasError("INVENTORY_FAILED", "Sensor returned no inventory.");
    return result.device;
  }

  async preparePackage() {
    await mkdir(this.packageDirectory, { recursive: true });
    const target = path.join(this.packageDirectory, FILE_NAME);
    const temporary = `${target}.${process.pid}.tmp`;
    const response = await fetch(FIRMWARE_URL, { redirect: "follow" });
    if (!response.ok || !response.body) {
      throw new CanvasError("DOWNLOAD_FAILED", `Official firmware download failed with HTTP ${response.status}.`);
    }
    const hash = createHash("sha256");
    const source = Readable.fromWeb(response.body);
    source.on("data", (chunk) => hash.update(chunk));
    try {
      await pipeline(source, createWriteStream(temporary, { flags: "wx", mode: 0o600 }));
      const actualSha256 = hash.digest("hex");
      if (actualSha256 !== EXPECTED_SHA256) {
        await unlink(temporary);
        throw new CanvasError("CHECKSUM_MISMATCH", "Downloaded firmware did not match the pinned SHA-256.");
      }
      await rename(temporary, target);
      const inspection = await this.inspectPackage(target);
      return { localPath: target, verified: true, actualSha256, inspection };
    } catch (error) {
      if (error instanceof CanvasError) throw error;
      await unlink(temporary).catch(() => {});
      throw new CanvasError("PACKAGE_PREPARE_FAILED", `Could not prepare firmware: ${error.message}`);
    }
  }

  async inspectPackage(packagePath) {
      const sourceRoot = path.join(this.workspaceRoot, "src");
      const child = spawn(
        pythonCommand(this.workspaceRoot),
        ["-m", "movesense_opensense.acquisition.firmware_package", packagePath],
        {
          cwd: this.workspaceRoot,
          env: { ...process.env, PYTHONPATH: sourceRoot, PYTHONUNBUFFERED: "1" },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      const events = [];
      let stderr = "";
      readline.createInterface({ input: child.stdout }).on("line", (line) => {
        try { events.push(JSON.parse(line)); }
        catch { events.push({ event: "error", message: "Package inspector returned invalid data." }); }
      });
      child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
      const code = await new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("exit", resolve);
      });
      const result = events.findLast((event) => event.event === "package-inspection");
      if (code !== 0 || !result) {
        throw new CanvasError(
          "PACKAGE_INVALID",
          events.findLast((event) => event.event === "error")?.message || stderr || "Firmware package is invalid.",
        );
      }
      return result;
    }

  async importPackage(contents, originalName) {
      if (!Buffer.isBuffer(contents) || contents.length === 0) {
        throw new CanvasError("PACKAGE_EMPTY", "The selected firmware package is empty.");
      }
      if (contents.length > 10 * 1024 * 1024) {
        throw new CanvasError("PACKAGE_TOO_LARGE", "Firmware package exceeds the 10 MB limit.");
      }
      const safeName = path.basename(originalName || "firmware.zip");
      if (!safeName.toLowerCase().endsWith(".zip")) {
        throw new CanvasError("PACKAGE_TYPE", "Firmware package must be a ZIP file.");
      }
      await mkdir(this.packageDirectory, { recursive: true });
      const temporary = path.join(this.packageDirectory, `.${process.pid}.${Date.now()}.tmp`);
      const target = path.join(this.packageDirectory, safeName);
      try {
        await writeFile(temporary, contents, { flag: "wx", mode: 0o600 });
        const inspection = await this.inspectPackage(temporary);
        await rename(temporary, target);
        return {
          fileName: safeName,
          localPath: target,
          actualSha256: inspection.sha256,
          verified: inspection.sha256 === EXPECTED_SHA256,
          inspection,
          source: inspection.sha256 === EXPECTED_SHA256 ? "pinned-official" : "user-supplied",
        };
      } catch (error) {
        await unlink(temporary).catch(() => {});
        if (error instanceof CanvasError) throw error;
        throw new CanvasError("PACKAGE_IMPORT_FAILED", `Could not import firmware: ${error.message}`);
    }
  }
}
