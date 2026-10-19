import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { CanvasError } from "@github/copilot-sdk/extension";

const CANVAS_ID = "movesense-opensense-processing-studio";
const FORMAT = "movesense-processing-studio-state";
const VERSION = 6;

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

function defaultState() {
  return {
    format: FORMAT,
    version: VERSION,
    updatedAt: new Date().toISOString(),
    governedRoot: "",
    recordingId: "",
    calibration: {
      startSeconds: 0,
      endSeconds: 3,
    },
    annotations: [],
    oneDofMapping: {
      firstMovement: "unassigned",
      positiveDirection: "unassigned",
    },
    opensimRuntime: {
      pythonExecutable: "",
      sdkPythonPath: "",
      modelPath: "",
    },
  };
}

function migrateState(value) {
  if (value?.format === FORMAT && value.version === 1) {
    return {
      ...value,
      version: VERSION,
      annotations: [],
      oneDofMapping: {
        firstMovement: "unassigned",
        positiveDirection: "unassigned",
      },
      opensimRuntime: {
        pythonExecutable: "",
        sdkPythonPath: "",
        modelPath: "",
      },
      updatedAt: new Date().toISOString(),
    };
  }
  if (value?.format === FORMAT && value.version === 2) {
    return {
      ...value,
      version: VERSION,
      oneDofMapping: {
        firstMovement: "unassigned",
        positiveDirection: "unassigned",
      },
      opensimRuntime: {
        pythonExecutable: "",
        sdkPythonPath: "",
        modelPath: "",
      },
      updatedAt: new Date().toISOString(),
    };
  }
  if (value?.format === FORMAT && value.version === 3) {
    return {
      ...value,
      version: VERSION,
      opensimRuntime: {
        pythonExecutable: "",
        sdkPythonPath: "",
        modelPath: "",
      },
      updatedAt: new Date().toISOString(),
    };
  }
  if (value?.format === FORMAT && value.version === 4) {
    return {
      ...value,
      version: VERSION,
      oneDofMapping: {
        ...value.oneDofMapping,
        positiveDirection:
          value.oneDofMapping?.firstMovement === "unassigned"
            ? "unassigned"
            : value.oneDofMapping?.positiveDirection,
      },
      opensimRuntime: {
        ...value.opensimRuntime,
        modelPath: "",
      },
      updatedAt: new Date().toISOString(),
    };
  }
  if (value?.format === FORMAT && value.version === 5) {
    return {
      ...value,
      version: VERSION,
      opensimRuntime: {
        ...value.opensimRuntime,
        modelPath: "",
      },
      updatedAt: new Date().toISOString(),
    };
  }
  return value;
}

function validateState(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CanvasError("CORRUPT_STATE", "The saved processing state is not an object.");
  }
  if (value.format !== FORMAT || value.version !== VERSION) {
    throw new CanvasError(
      "UNSUPPORTED_STATE",
      "The saved processing state uses an unrecognized format or version.",
    );
  }
  if (
    typeof value.governedRoot !== "string" ||
    typeof value.recordingId !== "string" ||
    !value.calibration ||
    !Number.isFinite(value.calibration.startSeconds) ||
    !Number.isFinite(value.calibration.endSeconds) ||
    value.calibration.startSeconds < 0 ||
    value.calibration.endSeconds <= value.calibration.startSeconds ||
    !Array.isArray(value.annotations) ||
    !value.oneDofMapping ||
    !["unassigned", "pronation", "supination", "flexion", "extension"].includes(
      value.oneDofMapping.firstMovement,
    ) ||
    !["unassigned", "pronation", "flexion"].includes(value.oneDofMapping.positiveDirection) ||
    !value.opensimRuntime ||
    typeof value.opensimRuntime.pythonExecutable !== "string" ||
    typeof value.opensimRuntime.sdkPythonPath !== "string" ||
    typeof value.opensimRuntime.modelPath !== "string" ||
    value.annotations.some(
      (annotation) =>
        !annotation ||
        typeof annotation.id !== "string" ||
        typeof annotation.label !== "string" ||
        !Number.isFinite(annotation.startSeconds) ||
        !Number.isFinite(annotation.endSeconds) ||
        annotation.startSeconds < 0 ||
        annotation.endSeconds <= annotation.startSeconds,
    )
  ) {
    throw new CanvasError("CORRUPT_STATE", "The saved processing state has invalid fields.");
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
    throw new CanvasError("STORAGE_WRITE_FAILED", `Could not save processing state: ${error.message}`);
  }
}

export async function loadProcessingState(identity) {
  const target = statePath(identity);
  try {
    const parsed = JSON.parse(await readFile(target, "utf8"));
    const state = validateState(migrateState(parsed));
    if (parsed.version !== state.version) {
      await writeState(identity, state);
    }
    return state;
  } catch (error) {
    if (error?.code === "ENOENT") {
      const state = defaultState();
      await writeState(identity, state);
      return state;
    }
    if (error instanceof CanvasError) {
      throw error;
    }
    if (error instanceof SyntaxError) {
      throw new CanvasError("CORRUPT_STATE", "The saved processing state is not valid JSON.");
    }
    throw new CanvasError("STORAGE_READ_FAILED", `Could not read processing state: ${error.message}`);
  }
}

export async function configureRecording(identity, input) {
  if (
    !input ||
    typeof input.governedRoot !== "string" ||
    !path.isAbsolute(input.governedRoot) ||
    typeof input.recordingId !== "string" ||
    !/^[A-Za-z0-9_-]{1,120}$/.test(input.recordingId)
  ) {
    throw new CanvasError(
      "INVALID_INPUT",
      "A valid absolute governed-storage root and recording ID are required.",
    );
  }
  const state = await loadProcessingState(identity);
  const recordingChanged = state.recordingId && state.recordingId !== input.recordingId;
  const updated = validateState({
    ...state,
    governedRoot: path.resolve(input.governedRoot),
    recordingId: input.recordingId,
    calibration: recordingChanged
      ? { startSeconds: 0, endSeconds: 3 }
      : state.calibration,
    annotations: recordingChanged ? [] : state.annotations,
    oneDofMapping: recordingChanged
      ? { firstMovement: "unassigned", positiveDirection: "unassigned" }
      : state.oneDofMapping,
    updatedAt: new Date().toISOString(),
  });
  await writeState(identity, updated);
  return updated;
}

export async function updateCalibration(identity, input) {
  if (
    !input ||
    !Number.isFinite(input.startSeconds) ||
    !Number.isFinite(input.endSeconds) ||
    input.startSeconds < 0 ||
    input.endSeconds <= input.startSeconds
  ) {
    throw new CanvasError(
      "INVALID_INPUT",
      "Calibration start must be non-negative and end must be greater than start.",
    );
  }
  const state = await loadProcessingState(identity);
  const updated = validateState({
    ...state,
    calibration: {
      startSeconds: input.startSeconds,
      endSeconds: input.endSeconds,
    },
    updatedAt: new Date().toISOString(),
  });
  await writeState(identity, updated);
  return updated;
}

export async function addAnnotation(identity, input) {
  if (
    !input ||
    typeof input.label !== "string" ||
    input.label.trim() === "" ||
    input.label.length > 80 ||
    !Number.isFinite(input.startSeconds) ||
    !Number.isFinite(input.endSeconds) ||
    input.startSeconds < 0 ||
    input.endSeconds <= input.startSeconds
  ) {
    throw new CanvasError("INVALID_INPUT", "A label and valid non-empty interval are required.");
  }
  const state = await loadProcessingState(identity);
  const updated = validateState({
    ...state,
    annotations: [
      ...state.annotations,
      {
        id: randomUUID(),
        label: input.label.trim(),
        startSeconds: input.startSeconds,
        endSeconds: input.endSeconds,
      },
    ],
    updatedAt: new Date().toISOString(),
  });
  await writeState(identity, updated);
  return updated;
}

export async function removeAnnotation(identity, input) {
  if (!input || typeof input.id !== "string" || input.id.trim() === "") {
    throw new CanvasError("INVALID_INPUT", "An annotation ID is required.");
  }
  const state = await loadProcessingState(identity);
  if (!state.annotations.some((annotation) => annotation.id === input.id)) {
    throw new CanvasError("ANNOTATION_NOT_FOUND", "The selected annotation was not found.");
  }
  const updated = validateState({
    ...state,
    annotations: state.annotations.filter((annotation) => annotation.id !== input.id),
    updatedAt: new Date().toISOString(),
  });
  await writeState(identity, updated);
  return updated;
}

export async function updateOneDofMapping(identity, input) {
  if (
    !input ||
    !["unassigned", "pronation", "supination", "flexion", "extension"].includes(
      input.firstMovement,
    )
  ) {
    throw new CanvasError(
      "INVALID_INPUT",
      "First movement must match the selected one-DOF protocol.",
    );
  }
  const state = await loadProcessingState(identity);
  const positiveDirection = ["pronation", "supination"].includes(input.firstMovement)
    ? "pronation"
    : ["flexion", "extension"].includes(input.firstMovement)
      ? "flexion"
      : "unassigned";
  const updated = validateState({
    ...state,
    oneDofMapping: {
      firstMovement: input.firstMovement,
      positiveDirection,
    },
    updatedAt: new Date().toISOString(),
  });
  await writeState(identity, updated);
  return updated;
}

export async function configureOpenSimRuntime(identity, input) {
  if (
    !input ||
    typeof input.pythonExecutable !== "string" ||
    !path.isAbsolute(input.pythonExecutable) ||
    typeof input.sdkPythonPath !== "string" ||
    !path.isAbsolute(input.sdkPythonPath) ||
    typeof input.modelPath !== "string" ||
    (input.modelPath !== "" && !path.isAbsolute(input.modelPath))
  ) {
    throw new CanvasError(
      "INVALID_INPUT",
      "Absolute OpenSim Python and SDK paths are required; the model path must be empty or absolute.",
    );
  }
  const state = await loadProcessingState(identity);
  const updated = validateState({
    ...state,
    opensimRuntime: {
      pythonExecutable: path.resolve(input.pythonExecutable),
      sdkPythonPath: path.resolve(input.sdkPythonPath),
      modelPath: input.modelPath ? path.resolve(input.modelPath) : "",
    },
    updatedAt: new Date().toISOString(),
  });
  await writeState(identity, updated);
  return updated;
}
