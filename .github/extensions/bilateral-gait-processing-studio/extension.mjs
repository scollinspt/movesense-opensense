import { createCanvas, CanvasError, joinSession } from "@github/copilot-sdk/extension";

import {
  analyzeBilateralRecording,
  GaitProcessingError,
  listBilateralRecordings,
  loadBilateralSignalWindow,
} from "./processing.mjs";
import { createBilateralGaitServer } from "./server.mjs";
import {
  configureRecording,
  loadProcessingState,
  workspaceIdentity,
} from "./storage.mjs";

const CANVAS_ID = "movesense-bilateral-gait-processing-studio";
const identity = workspaceIdentity(process.cwd());
const servers = new Map();

function convertError(error, fallbackCode) {
  if (error instanceof CanvasError) return error;
  if (error instanceof GaitProcessingError) {
    return new CanvasError(error.code, error.message);
  }
  return new CanvasError(fallbackCode, error.message);
}

const canvas = createCanvas({
  id: CANVAS_ID,
  displayName: "Bilateral Gait Processing Studio",
  description: "Verify and inspect synchronized bilateral distal-shank gait recordings before deriving metrics.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {},
  },
  actions: [
    {
      name: "get-processing-state",
      description: "Read the selected bilateral-gait recording and private processing state.",
      handler: async () => loadProcessingState(identity),
    },
    {
      name: "list-bilateral-recordings",
      description: "List finalized bilateral-gait recordings under an absolute governed-storage root.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["governedRoot"],
        properties: {
          governedRoot: { type: "string", minLength: 1, maxLength: 2000 },
        },
      },
      handler: async (context) => {
        try {
          return await listBilateralRecordings(context.input.governedRoot);
        } catch (error) {
          throw convertError(error, "LIST_FAILED");
        }
      },
    },
    {
      name: "configure-recording",
      description: "Select and verify a finalized bilateral-gait recording.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["governedRoot", "recordingId"],
        properties: {
          governedRoot: { type: "string", minLength: 1, maxLength: 2000 },
          recordingId: {
            type: "string",
            pattern: "^\\d{8}T\\d{6}Z-[A-Za-z0-9_-]+$",
          },
        },
      },
      handler: async (context) => {
        try {
          const analysis = await analyzeBilateralRecording(
            context.input.governedRoot,
            context.input.recordingId,
          );
          const state = await configureRecording(identity, context.input);
          return { state, analysis };
        } catch (error) {
          throw convertError(error, "CONFIGURE_FAILED");
        }
      },
    },
    {
      name: "analyze-selected-recording",
      description: "Verify source integrity and summarize both IMU streams and acquisition events.",
      handler: async () => {
        const state = await loadProcessingState(identity);
        if (!state.governedRoot || !state.recordingId) {
          throw new CanvasError("RECORDING_NOT_CONFIGURED", "Select a bilateral-gait recording first.");
        }
        try {
          return await analyzeBilateralRecording(state.governedRoot, state.recordingId);
        } catch (error) {
          throw convertError(error, "ANALYSIS_FAILED");
        }
      },
    },
    {
      name: "get-signal-window",
      description: "Load higher-resolution bilateral signals for a selected recording-time window.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["startSeconds", "endSeconds"],
        properties: {
          startSeconds: { type: "number", minimum: 0 },
          endSeconds: { type: "number", exclusiveMinimum: 0 },
        },
      },
      handler: async (context) => {
        const state = await loadProcessingState(identity);
        if (!state.governedRoot || !state.recordingId) {
          throw new CanvasError("RECORDING_NOT_CONFIGURED", "Select a bilateral-gait recording first.");
        }
        try {
          return await loadBilateralSignalWindow(
            state.governedRoot,
            state.recordingId,
            context.input.startSeconds,
            context.input.endSeconds,
          );
        } catch (error) {
          throw convertError(error, "WINDOW_FAILED");
        }
      },
    },
  ],
  open: async (context) => {
    const instanceId = context?.instanceId;
    if (typeof instanceId !== "string" || instanceId.trim() === "") {
      throw new CanvasError("INVALID_INSTANCE", "A non-empty canvas instance ID is required.");
    }
    const existing = servers.get(instanceId);
    if (existing) {
      return { url: existing.url, title: "Bilateral Gait Processing Studio" };
    }
    try {
      await loadProcessingState(identity);
      const server = await createBilateralGaitServer(identity);
      servers.set(instanceId, server);
      return { url: server.url, title: "Bilateral Gait Processing Studio" };
    } catch (error) {
      throw convertError(error, "OPEN_FAILED");
    }
  },
  onClose: async (context) => {
    const server = servers.get(context?.instanceId);
    if (!server) return;
    servers.delete(context.instanceId);
    await server.close();
  },
});

const session = await joinSession({ canvases: [canvas] });
session.log(`Registered ${CANVAS_ID} for ${identity.projectKey}`);
