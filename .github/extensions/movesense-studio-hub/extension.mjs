import { createCanvas, CanvasError, joinSession } from "@github/copilot-sdk/extension";

import { createHubServer, STUDIOS } from "./server.mjs";

const CANVAS_ID = "movesense-opensense-studio-hub";
const servers = new Map();

const canvas = createCanvas({
  id: CANVAS_ID,
  displayName: "Movesense Studio Hub",
  description: "Choose the Movesense studio needed for acquisition, processing, or firmware work.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {},
  },
  actions: [
    {
      name: "get-studio-catalog",
      description: "List the project canvas IDs, purposes, and recommended launch prompts.",
      handler: async () => ({ studios: STUDIOS }),
    },
  ],
  open: async (context) => {
    const instanceId = context?.instanceId;
    if (typeof instanceId !== "string" || instanceId.trim() === "") {
      throw new CanvasError("INVALID_INSTANCE", "A non-empty canvas instance ID is required.");
    }
    const existing = servers.get(instanceId);
    if (existing) {
      return { url: existing.url, title: "Movesense Studio Hub" };
    }
    try {
      const server = await createHubServer();
      servers.set(instanceId, server);
      return { url: server.url, title: "Movesense Studio Hub" };
    } catch (error) {
      throw new CanvasError("OPEN_FAILED", `Could not open the Studio Hub: ${error.message}`);
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
session.log(`Registered ${CANVAS_ID}`);
