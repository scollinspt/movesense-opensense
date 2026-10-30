import path from "node:path";

export function defaultGovernedRoot(workspaceRoot) {
  return path.resolve(workspaceRoot, "../governed-storage");
}
