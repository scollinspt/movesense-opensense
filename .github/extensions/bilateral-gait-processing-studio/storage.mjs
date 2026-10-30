import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { CanvasError } from "@github/copilot-sdk/extension";

import { defaultGovernedRoot } from "./config.mjs";

const CANVAS_ID = "movesense-bilateral-gait-processing-studio";
const FORMAT = "bilateral-gait-processing-studio-state";
const VERSION = 1;

function copilotHome() {
  return process.env.COPILOT_HOME?.trim() || path.join(os.homedir(), ".copilot");
}

export function workspaceIdentity(workspaceRoot) {
  const resolvedRoot = path.resolve(workspaceRoot);
  return {
    workspaceRoot: resolvedRoot,
    projectKey: createHash("sha256").update(resolvedRoot).digest("hex").slice(0, 20),
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

function defaultState(identity) {
  return {
    format: FORMAT,
    version: VERSION,
    updatedAt: new Date().toISOString(),
    governedRoot: defaultGovernedRoot(identity.workspaceRoot),
    recordingId: "",
  };
}

function validateState(value) {
  if (
    !value ||
    value.format !== FORMAT ||
    value.version !== VERSION ||
    typeof value.governedRoot !== "string" ||
    typeof value.recordingId !== "string"
  ) {
    throw new CanvasError(
      "CORRUPT_STATE",
      "The saved bilateral-gait processing state is invalid or unsupported.",
    );
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
    throw new CanvasError(
      "STORAGE_WRITE_FAILED",
      `Could not save bilateral-gait processing state: ${error.message}`,
    );
  }
}

export async function loadProcessingState(identity) {
  try {
    const state = validateState(JSON.parse(await readFile(statePath(identity), "utf8")));
    if (state.governedRoot) return state;
    const updated = {
      ...state,
      governedRoot: defaultGovernedRoot(identity.workspaceRoot),
      updatedAt: new Date().toISOString(),
    };
    await writeState(identity, updated);
    return updated;
  } catch (error) {
    if (error?.code === "ENOENT") {
      const state = defaultState(identity);
      await writeState(identity, state);
      return state;
    }
    if (error instanceof CanvasError) throw error;
    if (error instanceof SyntaxError) {
      throw new CanvasError("CORRUPT_STATE", "The saved processing state is not valid JSON.");
    }
    throw new CanvasError(
      "STORAGE_READ_FAILED",
      `Could not read bilateral-gait processing state: ${error.message}`,
    );
  }
}

export async function configureRecording(identity, input) {
  if (
    !input ||
    typeof input.governedRoot !== "string" ||
    !path.isAbsolute(input.governedRoot) ||
    typeof input.recordingId !== "string" ||
    !/^\d{8}T\d{6}Z-[A-Za-z0-9_-]+$/.test(input.recordingId)
  ) {
    throw new CanvasError(
      "INVALID_INPUT",
      "An absolute governed-storage root and bilateral-gait recording ID are required.",
    );
  }
  const state = validateState({
    format: FORMAT,
    version: VERSION,
    updatedAt: new Date().toISOString(),
    governedRoot: path.resolve(input.governedRoot),
    recordingId: input.recordingId,
  });
  await writeState(identity, state);
  return state;
}
