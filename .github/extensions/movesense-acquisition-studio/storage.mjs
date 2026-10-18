import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { CanvasError } from "@github/copilot-sdk/extension";

const CANVAS_ID = "movesense-opensense-acquisition-studio";
const FORMAT = "movesense-acquisition-studio-design";
const VERSION = 1;

const defaultState = {
  format: FORMAT,
  version: VERSION,
  updatedAt: null,
  vision:
    "Collect reproducible Movesense IMU streams from a growing sensor fleet on macOS, while keeping acquisition services portable to a future iOS client.",
  targetPlatform: "macOS then iOS",
  transport: "BLE/GSP live",
  sampleRateHz: 52,
  targetSensorCount: 1,
  dataRoot: "",
  signals: ["accelerometer", "gyroscope", "magnetometer"],
  principles: [
    "Preserve sensor-native timing separately from host receipt timing.",
    "Keep raw recordings and manifests in governed storage outside Git.",
    "Make sensor count a versioned configuration choice, not a code change.",
    "Use the same acquisition and processing services behind desktop and future iOS clients.",
  ],
  milestones: [
    { count: 1, label: "Bench feasibility", status: "active" },
    { count: 2, label: "Shared-event timing", status: "planned" },
    { count: 3, label: "Initial scaling", status: "planned" },
    { count: 5, label: "Mid-scale load test", status: "planned" },
    { count: 10, label: "Target fleet load test", status: "planned" },
  ],
  decisions: [
    {
      id: "initial-desktop-path",
      title: "Start with the official GSP Python client and Bleak",
      status: "accepted",
      detail: "Inventory firmware and confirm GSP before changing any sensor firmware.",
      createdAt: "2026-10-17T00:00:00.000Z",
    },
    {
      id: "synchronization-evidence",
      title: "Do not equate simultaneous BLE subscriptions with synchronization",
      status: "accepted",
      detail: "Measure clock offset, drift, packet loss, jitter, and residual alignment error.",
      createdAt: "2026-10-17T00:00:00.000Z",
    },
    {
      id: "ios-boundary",
      title: "Define a portable acquisition service boundary",
      status: "proposed",
      detail: "Separate BLE transport, stream decoding, recording, and UI so an iOS transport can replace Bleak later.",
      createdAt: "2026-10-17T00:00:00.000Z",
    },
  ],
};

function copilotHome() {
  return process.env.COPILOT_HOME?.trim() || path.join(os.homedir(), ".copilot");
}

export function workspaceIdentity(workspaceRoot) {
  const resolvedRoot = path.resolve(workspaceRoot);
  return {
    projectKey: createHash("sha256").update(resolvedRoot).digest("hex").slice(0, 20),
    workspaceRoot: resolvedRoot,
  };
}

function statePath(identity) {
  return path.join(
    copilotHome(),
    "extension-data",
    CANVAS_ID,
    `${identity.projectKey}.json`,
  );
}

function cloneDefault() {
  return structuredClone(defaultState);
}

function validateState(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CanvasError("CORRUPT_STATE", "The saved acquisition design is not an object.");
  }
  if (value.format !== FORMAT || value.version !== VERSION) {
    throw new CanvasError(
      "UNSUPPORTED_STATE",
      "The saved acquisition design uses an unrecognized format or version.",
    );
  }
  if (
    typeof value.vision !== "string" ||
    !["macOS", "iOS", "macOS then iOS"].includes(value.targetPlatform) ||
    !["BLE/GSP live", "Flash/offline", "Hybrid"].includes(value.transport) ||
    !Number.isInteger(value.sampleRateHz) ||
    value.sampleRateHz < 1 ||
    value.sampleRateHz > 1600 ||
    !Number.isInteger(value.targetSensorCount) ||
    value.targetSensorCount < 1 ||
    value.targetSensorCount > 32 ||
    !Array.isArray(value.decisions)
  ) {
    throw new CanvasError("CORRUPT_STATE", "The saved acquisition design has invalid fields.");
  }
  return value;
}

async function writeState(identity, state) {
  const target = statePath(identity);
  const directory = path.dirname(target);
  await mkdir(directory, { recursive: true });
  const temporary = path.join(directory, `.${identity.projectKey}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    await rename(temporary, target);
  } catch (error) {
    throw new CanvasError("STORAGE_WRITE_FAILED", `Could not save the acquisition design: ${error.message}`);
  }
}

export async function loadDesign(identity) {
  const target = statePath(identity);
  try {
    const text = await readFile(target, "utf8");
    return validateState(JSON.parse(text));
  } catch (error) {
    if (error?.code === "ENOENT") {
      const state = cloneDefault();
      state.updatedAt = new Date().toISOString();
      await writeState(identity, state);
      return state;
    }
    if (error instanceof CanvasError) {
      throw error;
    }
    if (error instanceof SyntaxError) {
      throw new CanvasError("CORRUPT_STATE", "The saved acquisition design is not valid JSON.");
    }
    throw new CanvasError("STORAGE_READ_FAILED", `Could not read the acquisition design: ${error.message}`);
  }
}

function validatePatch(patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new CanvasError("INVALID_INPUT", "The design update must be an object.");
  }
  const allowed = new Set([
    "vision",
    "targetPlatform",
    "transport",
    "sampleRateHz",
    "targetSensorCount",
    "dataRoot",
  ]);
  for (const key of Object.keys(patch)) {
    if (!allowed.has(key)) {
      throw new CanvasError("INVALID_INPUT", `Unknown design field: ${key}`);
    }
  }
  if ("vision" in patch && (typeof patch.vision !== "string" || patch.vision.length > 1200)) {
    throw new CanvasError("INVALID_INPUT", "Vision must be a string of at most 1200 characters.");
  }
  if (
    "targetPlatform" in patch &&
    !["macOS", "iOS", "macOS then iOS"].includes(patch.targetPlatform)
  ) {
    throw new CanvasError("INVALID_INPUT", "Target platform is not supported.");
  }
  if (
    "transport" in patch &&
    !["BLE/GSP live", "Flash/offline", "Hybrid"].includes(patch.transport)
  ) {
    throw new CanvasError("INVALID_INPUT", "Transport is not supported.");
  }
  if (
    "dataRoot" in patch &&
    (typeof patch.dataRoot !== "string" || patch.dataRoot.length > 2000)
  ) {
    throw new CanvasError("INVALID_INPUT", "Data root must be a string of at most 2000 characters.");
  }
  if (
    "sampleRateHz" in patch &&
    (!Number.isInteger(patch.sampleRateHz) || patch.sampleRateHz < 1 || patch.sampleRateHz > 1600)
  ) {
    throw new CanvasError("INVALID_INPUT", "Sample rate must be an integer from 1 to 1600 Hz.");
  }
  if (
    "targetSensorCount" in patch &&
    (!Number.isInteger(patch.targetSensorCount) ||
      patch.targetSensorCount < 1 ||
      patch.targetSensorCount > 32)
  ) {
    throw new CanvasError("INVALID_INPUT", "Sensor count must be an integer from 1 to 32.");
  }
}

export async function updateDesign(identity, patch) {
  validatePatch(patch);
  const state = await loadDesign(identity);
  const updated = validateState({
    ...state,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
  await writeState(identity, updated);
  return updated;
}

export async function addDecision(identity, input) {
  if (
    !input ||
    typeof input.title !== "string" ||
    input.title.trim() === "" ||
    input.title.length > 160 ||
    !["proposed", "accepted", "needs-evidence"].includes(input.status) ||
    typeof input.detail !== "string" ||
    input.detail.trim() === "" ||
    input.detail.length > 2000
  ) {
    throw new CanvasError("INVALID_INPUT", "Decision title, status, or detail is invalid.");
  }
  const state = await loadDesign(identity);
  state.decisions.push({
    id: randomUUID(),
    title: input.title.trim(),
    status: input.status,
    detail: input.detail.trim(),
    createdAt: new Date().toISOString(),
  });
  state.updatedAt = new Date().toISOString();
  validateState(state);
  await writeState(identity, state);
  return state;
}

export async function updateMilestoneStatuses(identity, input) {
  const statuses = input?.statuses;
  const allowedCounts = new Set(["1", "2", "3", "5", "10"]);
  const allowedStatuses = new Set(["planned", "active", "complete", "covered-externally"]);
  if (
    !statuses ||
    typeof statuses !== "object" ||
    Array.isArray(statuses) ||
    Object.keys(statuses).length === 0
  ) {
    throw new CanvasError("INVALID_INPUT", "At least one milestone status is required.");
  }
  for (const [count, status] of Object.entries(statuses)) {
    if (!allowedCounts.has(count) || !allowedStatuses.has(status)) {
      throw new CanvasError("INVALID_INPUT", `Invalid milestone status for sensor count ${count}.`);
    }
  }
  const state = await loadDesign(identity);
  state.milestones = state.milestones.map((milestone) => ({
    ...milestone,
    status: statuses[String(milestone.count)] ?? milestone.status,
  }));
  state.updatedAt = new Date().toISOString();
  validateState(state);
  await writeState(identity, state);
  return state;
}
