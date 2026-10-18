import { createCanvas, CanvasError, joinSession } from "@github/copilot-sdk/extension";

import { AcquisitionManager } from "./acquisition.mjs";
import { createStudioServer } from "./server.mjs";
import {
  addDecision,
  loadDesign,
  updateDesign,
  updateMilestoneStatuses,
  workspaceIdentity,
} from "./storage.mjs";

const canvasId = "movesense-opensense-acquisition-studio";
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
    return { url: existing.url, title: "Movesense Acquisition Studio" };
  }

  try {
    const state = await loadDesign(identity);
    const acquisition = new AcquisitionManager(workspaceRoot);
    const server = await createStudioServer({
      acquisition,
      initialState: state,
      onSave: (patch) => updateDesign(identity, patch),
    });
    servers.set(instanceId, server);
    return { url: server.url, title: "Movesense Acquisition Studio" };
  } catch (error) {
    if (error instanceof CanvasError) {
      throw error;
    }
    throw new CanvasError("OPEN_FAILED", `Could not open the acquisition studio: ${error.message}`);
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
  await server.acquisition.stop();
  await server.close();
}

const canvas = createCanvas({
  id: canvasId,
  displayName: "Movesense Acquisition Studio",
  description: "Design and refine the Movesense multi-sensor acquisition application architecture.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {},
  },
  actions: [
    {
      name: "get-design",
      description: "Read the current acquisition application design.",
      handler: async () => loadDesign(identity),
    },
    {
      name: "update-design",
      description: "Update top-level acquisition design choices.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          vision: { type: "string", maxLength: 1200 },
          targetPlatform: { type: "string", enum: ["macOS", "iOS", "macOS then iOS"] },
          transport: { type: "string", enum: ["BLE/GSP live", "Flash/offline", "Hybrid"] },
          sampleRateHz: { type: "integer", minimum: 1, maximum: 1600 },
          targetSensorCount: { type: "integer", minimum: 1, maximum: 32 },
          dataRoot: { type: "string", maxLength: 2000 },
        },
        minProperties: 1,
      },
      handler: async (context) => updateDesign(identity, context.input),
    },
    {
      name: "add-decision",
      description: "Add an evidence-backed architecture decision or unresolved question.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["title", "status", "detail"],
        properties: {
          title: { type: "string", minLength: 1, maxLength: 160 },
          status: { type: "string", enum: ["proposed", "accepted", "needs-evidence"] },
          detail: { type: "string", minLength: 1, maxLength: 2000 },
        },
      },
      handler: async (context) => addDecision(identity, context.input),
    },
    {
      name: "update-milestones",
      description: "Update evidence-gated sensor-count milestone statuses.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["statuses"],
        properties: {
          statuses: {
            type: "object",
            additionalProperties: false,
            properties: {
              "1": { type: "string", enum: ["planned", "active", "complete", "covered-externally"] },
              "2": { type: "string", enum: ["planned", "active", "complete", "covered-externally"] },
              "3": { type: "string", enum: ["planned", "active", "complete", "covered-externally"] },
              "5": { type: "string", enum: ["planned", "active", "complete", "covered-externally"] },
              "10": { type: "string", enum: ["planned", "active", "complete", "covered-externally"] },
            },
            minProperties: 1,
          },
        },
      },
      handler: async (context) => updateMilestoneStatuses(identity, context.input),
    },
  ],
  open: openStudio,
  onClose: closeStudio,
});

const session = await joinSession({ canvases: [canvas] });
session.log(`Registering ${canvasId} for ${identity.projectKey}`);
