import path from "node:path";

import { recoverInterruptedRecordings } from "./recording.mjs";

const argumentIndex = process.argv.indexOf("--data-root");
if (argumentIndex === -1 || !process.argv[argumentIndex + 1]) {
  throw new Error("Usage: node recover.mjs --data-root /absolute/governed-storage");
}
const dataRoot = path.resolve(process.argv[argumentIndex + 1]);
const recovered = await recoverInterruptedRecordings(dataRoot);
if (!recovered.length) {
  process.stdout.write("No interrupted bilateral-gait recordings found.\n");
} else {
  for (const item of recovered) {
    process.stdout.write(
      `Recovered ${item.recordingId}: ${item.manifestPath}\n`,
    );
  }
}
