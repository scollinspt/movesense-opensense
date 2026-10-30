import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { defaultGovernedRoot } from "./config.mjs";

test("defaults to the governed storage beside the workspace", async () => {
  const workspaceRoot = path.join("/tmp", "projects", "movesense-opensense");
  assert.equal(
    defaultGovernedRoot(workspaceRoot),
    path.resolve(workspaceRoot, "../governed-storage"),
  );
});
