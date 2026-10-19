import { createCanvas, CanvasError, joinSession } from "@github/copilot-sdk/extension";

import {
  analyzeRecording,
  listRecordings,
  loadOpenSenseResult,
  ProcessingError,
} from "./processing.mjs";
import { runOpenSensePipeline } from "./opensense-runner.mjs";
import { createProcessingServer } from "./server.mjs";
import {
  addAnnotation,
  configureOpenSimRuntime,
  configureRecording,
  loadProcessingState,
  removeAnnotation,
  updateCalibration,
  updateOneDofMapping,
  workspaceIdentity,
} from "./storage.mjs";

const canvasId = "movesense-opensense-processing-studio";
const workspaceRoot = process.cwd();
const identity = workspaceIdentity(workspaceRoot);
const servers = new Map();

function requireInstanceId(context) {
  const instanceId = context?.instanceId;
  if (typeof instanceId !== "string" || instanceId.trim() === "") {
    throw new CanvasError("INVALID_INSTANCE", "A non-empty canvas instance ID is required.");
  }
  return instanceId;
}

async function openStudio(context) {
  const instanceId = requireInstanceId(context);
  const existing = servers.get(instanceId);
  if (existing) {
    return { url: existing.url, title: "Movesense Processing Studio" };
  }
  try {
    await loadProcessingState(identity);
    const server = await createProcessingServer(identity);
    servers.set(instanceId, server);
    return { url: server.url, title: "Movesense Processing Studio" };
  } catch (error) {
    if (error instanceof CanvasError) {
      throw error;
    }
    throw new CanvasError("OPEN_FAILED", `Could not open the processing studio: ${error.message}`);
  }
}

async function closeStudio(context) {
  const instanceId = context?.instanceId;
  if (typeof instanceId !== "string") {
    return;
  }
  const server = servers.get(instanceId);
  if (!server) {
    return;
  }
  servers.delete(instanceId);
  await server.close();
}

const canvas = createCanvas({
  id: canvasId,
  displayName: "Movesense Processing Studio",
  description: "Inspect governed Movesense recordings and prepare calibration for OpenSense processing.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {},
  },
  actions: [
    {
      name: "get-processing-state",
      description: "Read the selected recording and calibration state.",
      handler: async () => loadProcessingState(identity),
    },
    {
      name: "configure-recording",
      description: "Select a recording from an absolute governed-storage root.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["governedRoot", "recordingId"],
        properties: {
          governedRoot: { type: "string", minLength: 1, maxLength: 2000 },
          recordingId: { type: "string", pattern: "^[A-Za-z0-9_-]{1,120}$" },
        },
      },
      handler: async (context) => {
        try {
          const state = await configureRecording(identity, context.input);
          const report = await analyzeRecording(state.governedRoot, state.recordingId);
          return { state, integrity: report.integrity, timing: report.timing };
        } catch (error) {
          if (error instanceof CanvasError) {
            throw error;
          }
          if (error instanceof ProcessingError) {
            throw new CanvasError(error.code, error.message);
          }
          throw new CanvasError("CONFIGURE_FAILED", `Could not configure the recording: ${error.message}`);
        }
      },
    },
    {
      name: "set-calibration-interval",
      description: "Save the static anatomical-pose interval in sensor-time seconds.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["startSeconds", "endSeconds"],
        properties: {
          startSeconds: { type: "number", minimum: 0 },
          endSeconds: { type: "number", exclusiveMinimum: 0 },
        },
      },
      handler: async (context) => updateCalibration(identity, context.input),
    },
    {
      name: "list-recordings",
      description: "List valid raw-recording manifests under the configured governed root.",
      handler: async () => {
        const state = await loadProcessingState(identity);
        try {
          return await listRecordings(state.governedRoot);
        } catch (error) {
          if (error instanceof ProcessingError) {
            throw new CanvasError(error.code, error.message);
          }
          throw error;
        }
      },
    },
    {
      name: "add-movement-interval",
      description: "Annotate a selected sensor-time interval without modifying the raw recording.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["label", "startSeconds", "endSeconds"],
        properties: {
          label: { type: "string", minLength: 1, maxLength: 80 },
          startSeconds: { type: "number", minimum: 0 },
          endSeconds: { type: "number", exclusiveMinimum: 0 },
        },
      },
      handler: async (context) => addAnnotation(identity, context.input),
    },
    {
      name: "remove-movement-interval",
      description: "Remove a private movement interval annotation.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["id"],
        properties: {
          id: { type: "string", minLength: 1 },
        },
      },
      handler: async (context) => removeAnnotation(identity, context.input),
    },
    {
      name: "set-one-dof-mapping",
      description: "Identify the protocol-specific first movement direction from neutral.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["firstMovement"],
        properties: {
          firstMovement: {
            type: "string",
            enum: ["unassigned", "pronation", "supination", "flexion", "extension"],
          },
        },
      },
      handler: async (context) => updateOneDofMapping(identity, context.input),
    },
    {
      name: "get-opensense-result",
      description: "Read and checksum-verify generated one- or two-DOF OpenSense artifacts.",
      handler: async () => {
        const state = await loadProcessingState(identity);
        try {
          return await loadOpenSenseResult(state.governedRoot, state.recordingId);
        } catch (error) {
          if (error instanceof ProcessingError) {
            throw new CanvasError(error.code, error.message);
          }
          throw error;
        }
      },
    },
    {
      name: "configure-opensim-runtime",
      description: "Save host-specific OpenSim Python runtime paths in private extension state.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["pythonExecutable", "sdkPythonPath", "modelPath"],
        properties: {
          pythonExecutable: { type: "string", minLength: 1, maxLength: 2000 },
          sdkPythonPath: { type: "string", minLength: 1, maxLength: 2000 },
          modelPath: { type: "string", maxLength: 2000 },
        },
      },
      handler: async (context) => configureOpenSimRuntime(identity, context.input),
    },
    {
      name: "run-opensense",
      description: "Generate quaternion STO and model files, run OpenSense IK, and validate the result.",
      handler: async () => {
        const state = await loadProcessingState(identity);
        await runOpenSensePipeline(identity.workspaceRoot, state);
        return loadOpenSenseResult(state.governedRoot, state.recordingId);
      },
    },
  ],
  open: openStudio,
  onClose: closeStudio,
});

const session = await joinSession({ canvases: [canvas] });
session.log(`Registering ${canvasId} for ${identity.projectKey}`);
