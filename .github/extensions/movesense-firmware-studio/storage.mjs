import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { CanvasError } from "@github/copilot-sdk/extension";

export const CANVAS_ID = "movesense-opensense-firmware-update-studio";
const FORMAT = "movesense-firmware-update-plan";
const VERSION = 1;

function copilotHome() {
  return process.env.COPILOT_HOME?.trim() || path.join(os.homedir(), ".copilot");
}

export function workspaceIdentity(workspaceRoot) {
  const root = path.resolve(workspaceRoot);
  return {
    root,
    projectKey: createHash("sha256").update(root).digest("hex").slice(0, 20),
  };
}

export function dataDirectory(identity) {
  return path.join(copilotHome(), "extension-data", CANVAS_ID, identity.projectKey);
}

function statePath(identity) {
  return path.join(dataDirectory(identity), "plan.json");
}

function initialState() {
  return {
    format: FORMAT,
    version: VERSION,
    updatedAt: new Date().toISOString(),
    targetCount: 10,
    dfuTransportStatus: "not-validated",
    package: {
      model: "SS2",
      fileName: "Movesense-default_firmware-SS2_w_bootloader.zip",
      commit: "87254d2a34b9e3569817e9218fb1a059c9c7b3e2",
      expectedSha256: "d0690ef72fa2ab2a3973944b8696523eebdcace3fbeb7ae7cf1073610865e9f9",
      localPath: null,
      verified: false,
      inspection: null,
    },
    devices: [],
  };
}

function validate(state) {
  if (
    !state ||
    state.format !== FORMAT ||
    state.version !== VERSION ||
    state.targetCount !== 10 ||
    !state.package ||
    !Array.isArray(state.devices)
  ) {
    throw new CanvasError("CORRUPT_STATE", "The firmware update plan is invalid or unsupported.");
  }
  return state;
}

async function write(identity, state) {
  const directory = dataDirectory(identity);
  await mkdir(directory, { recursive: true });
  const target = statePath(identity);
  const temporary = path.join(directory, `.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    await rename(temporary, target);
  } catch (error) {
    throw new CanvasError("STORAGE_WRITE_FAILED", `Could not save the firmware plan: ${error.message}`);
  }
}

export async function loadPlan(identity) {
  try {
    return validate(JSON.parse(await readFile(statePath(identity), "utf8")));
  } catch (error) {
    if (error?.code === "ENOENT") {
      const state = initialState();
      await write(identity, state);
      return state;
    }
    if (error instanceof CanvasError) throw error;
    throw new CanvasError("STORAGE_READ_FAILED", `Could not load the firmware plan: ${error.message}`);
  }
}

export async function savePackage(identity, packagePatch) {
  const state = await loadPlan(identity);
  state.package = { ...state.package, ...packagePatch };
  state.updatedAt = new Date().toISOString();
  await write(identity, validate(state));
  return state;
}

export async function upsertDevice(identity, device) {
  if (
    !device ||
    typeof device.name !== "string" ||
    typeof device.address !== "string" ||
    !["gsp-ready", "legacy-mds", "unknown"].includes(device.profile)
  ) {
    throw new CanvasError("INVALID_DEVICE", "The sensor inventory record is invalid.");
  }
  const state = await loadPlan(identity);
  const existingIndex = state.devices.findIndex(
    (item) => item.serial && device.serial ? item.serial === device.serial : item.address === device.address,
  );
  const record = {
    ...device,
    status: device.profile === "gsp-ready" ? "verified" : "needs-update",
    inspectedAt: new Date().toISOString(),
  };
  if (existingIndex >= 0) state.devices[existingIndex] = record;
  else state.devices.push(record);
  state.updatedAt = new Date().toISOString();
  await write(identity, validate(state));
  return state;
}

export async function setDeviceStatus(identity, input) {
  const statuses = new Set(["needs-update", "ready-for-dfu", "updated", "verified", "blocked"]);
  if (!input || typeof input.deviceId !== "string" || !statuses.has(input.status)) {
    throw new CanvasError("INVALID_INPUT", "Device ID and a valid update status are required.");
  }
  const state = await loadPlan(identity);
  const device = state.devices.find(
    (item) => item.serial === input.deviceId || item.address === input.deviceId,
  );
  if (!device) throw new CanvasError("DEVICE_NOT_FOUND", "The sensor is not in the update plan.");
  device.status = input.status;
  device.notes = typeof input.notes === "string" ? input.notes.slice(0, 1000) : "";
  state.updatedAt = new Date().toISOString();
  await write(identity, validate(state));
  return state;
}
