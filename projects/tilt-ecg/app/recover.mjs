import path from "node:path";
import { fileURLToPath } from "node:url";

import { recoverInterruptedRecordings } from "./recording.mjs";

function parseDataRoot(argv) {
  if (argv.length !== 2 || argv[0] !== "--data-root") {
    throw new Error("Usage: node recover.mjs --data-root /absolute/governed-storage");
  }
  return path.resolve(argv[1]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const recovered = await recoverInterruptedRecordings(
      parseDataRoot(process.argv.slice(2)),
    );
    if (!recovered.length) {
      process.stdout.write("No interrupted Tilt ECG recordings found.\n");
    } else {
      for (const result of recovered) {
        process.stdout.write(
          `Recovered ${result.recordingId} to ${result.databasePath}\n`,
        );
      }
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
