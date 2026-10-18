import { createCanvas, CanvasError, joinSession } from "@github/copilot-sdk/extension";

import { FirmwareManager } from "./firmware.mjs";
import { createFirmwareServer } from "./server.mjs";
import {
  CANVAS_ID,
  dataDirectory,
  loadPlan,
  savePackage,
  setDeviceStatus,
  upsertDevice,
  workspaceIdentity,
} from "./storage.mjs";

const workspaceRoot = process.cwd();
const identity = workspaceIdentity(workspaceRoot);
const servers = new Map();

async function prepareOfficialPackage() {
  const manager = new FirmwareManager(workspaceRoot, dataDirectory(identity));
  const result = await manager.preparePackage();
  return savePackage(identity, result);
}

const canvas = createCanvas({
  id: CANVAS_ID,
  displayName: "Movesense Firmware Update Studio",
  description: "Inventory and prepare safe, repeatable firmware updates for a Movesense sensor fleet.",
  inputSchema: { type: "object", additionalProperties: false, properties: {} },
  actions: [
    {
      name: "get-update-plan",
      description: "Read the ten-sensor firmware update plan and package status.",
      handler: async () => loadPlan(identity),
    },
    {
      name: "prepare-official-package",
      description: "Download and SHA-256 verify the pinned official SS2 default firmware package.",
      handler: prepareOfficialPackage,
    },
    {
      name: "set-device-status",
      description: "Update the workflow status for an inventoried sensor.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["deviceId", "status"],
        properties: {
          deviceId: { type: "string", minLength: 1, maxLength: 200 },
          status: {
            type: "string",
            enum: ["needs-update", "ready-for-dfu", "updated", "verified", "blocked"],
          },
          notes: { type: "string", maxLength: 1000 },
        },
      },
      handler: async (context) => setDeviceStatus(identity, context.input),
    },
  ],
  open: async (context) => {
    if (!context.instanceId) throw new CanvasError("INVALID_INSTANCE", "Instance ID is required.");
    const existing = servers.get(context.instanceId);
    if (existing) return { url: existing.url, title: "Movesense Firmware Update Studio" };
    const manager = new FirmwareManager(workspaceRoot, dataDirectory(identity));
    const server = await createFirmwareServer({
      manager,
      loadState: () => loadPlan(identity),
      preparePackage: async () => savePackage(identity, await manager.preparePackage()),
      importPackage: async (contents, name) =>
        savePackage(identity, await manager.importPackage(contents, name)),
      saveDevice: (device) => upsertDevice(identity, device),
      updateDevice: (input) => setDeviceStatus(identity, input),
    });
    servers.set(context.instanceId, server);
    return { url: server.url, title: "Movesense Firmware Update Studio" };
  },
  onClose: async (context) => {
    const server = servers.get(context.instanceId);
    if (!server) return;
    servers.delete(context.instanceId);
    await server.close();
  },
});

const session = await joinSession({ canvases: [canvas] });
session.log(`Registered ${CANVAS_ID} for ${identity.projectKey}`);
