#!/usr/bin/env node

import { access, mkdir, rm, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const groupId = process.env.ZOTERO_GROUP_ID ?? "6710776";
const apiBase = process.env.ZOTERO_LOCAL_API ?? "http://127.0.0.1:23119/api";
const cacheRoot = join(tmpdir(), "movesense-opensense-zotero");
const pageSize = 100;

function usage() {
  return `Usage:
  node scripts/zotero-library.mjs find "search terms"
  node scripts/zotero-library.mjs pdf ITEM_KEY
  node scripts/zotero-library.mjs text ITEM_KEY
  node scripts/zotero-library.mjs clean

The helper reads the HMS Lab group through Zotero's local API. Keep Zotero open and
enable Settings > Advanced > Allow other applications on this computer to communicate
with Zotero. Extracted text is stored temporarily under ${cacheRoot}.`;
}

async function apiRequest(path, options = {}) {
  let response;

  try {
    response = await fetch(`${apiBase}/groups/${groupId}${path}`, {
      ...options,
      headers: {
        "Zotero-API-Version": "3",
        ...options.headers,
      },
    });
  } catch (error) {
    throw new Error(
      `Could not connect to Zotero at ${apiBase}. Open Zotero and enable its local API.`,
      { cause: error },
    );
  }

  if (response.status === 403) {
    throw new Error(
      "Zotero denied local API access. Enable the local API in Settings > Advanced.",
    );
  }

  return response;
}

async function getJson(path) {
  const response = await apiRequest(path);

  if (!response.ok) {
    throw new Error(`Zotero returned ${response.status} ${response.statusText} for ${path}.`);
  }

  return response.json();
}

async function getTopLevelItems() {
  const items = [];

  for (let start = 0; ; start += pageSize) {
    const params = new URLSearchParams({
      start: String(start),
      limit: String(pageSize),
      sort: "title",
      direction: "asc",
    });
    const page = await getJson(`/items/top?${params}`);

    items.push(...page);
    if (page.length < pageSize) {
      return items;
    }
  }
}

function creatorName(creator) {
  if (creator.name) {
    return creator.name;
  }

  return [creator.firstName, creator.lastName].filter(Boolean).join(" ");
}

function itemSearchText(item) {
  const data = item.data;
  const creators = (data.creators ?? []).map(creatorName);

  return [item.key, data.title, data.DOI, data.date, ...creators]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}

async function findItems(query) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) {
    throw new Error("Provide a title, author, DOI, or Zotero item key to search for.");
  }

  const terms = normalizedQuery.split(/\s+/);
  const items = await getTopLevelItems();
  const matches = items.filter((item) => {
    const searchText = itemSearchText(item);
    return terms.every((term) => searchText.includes(term));
  });

  return {
    query,
    count: matches.length,
    items: matches.map((item) => ({
      key: item.key,
      title: item.data.title,
      creators: (item.data.creators ?? []).map(creatorName),
      date: item.data.date || null,
      doi: item.data.DOI || null,
      collections: item.data.collections ?? [],
    })),
  };
}

async function getPdfAttachment(itemKey) {
  const children = await getJson(`/items/${encodeURIComponent(itemKey)}/children`);
  const attachments = children.filter(
    (item) =>
      item.data.itemType === "attachment" && item.data.contentType === "application/pdf",
  );

  if (attachments.length === 0) {
    throw new Error(`No PDF attachment was found for Zotero item ${itemKey}.`);
  }

  const storedAttachment = attachments.find((item) =>
    ["imported_file", "imported_url"].includes(item.data.linkMode),
  );

  if (!storedAttachment) {
    throw new Error(
      `The PDF for Zotero item ${itemKey} is linked rather than stored in Zotero.`,
    );
  }

  return storedAttachment;
}

async function resolvePdf(itemKey) {
  const attachment = await getPdfAttachment(itemKey);
  const response = await apiRequest(`/items/${attachment.key}/file`, {
    redirect: "manual",
  });
  const location = response.headers.get("location");

  if (!response.ok && ![301, 302, 303, 307, 308].includes(response.status)) {
    throw new Error(
      `Zotero returned ${response.status} ${response.statusText} for attachment ${attachment.key}.`,
    );
  }

  if (!location?.startsWith("file:")) {
    throw new Error(
      `Zotero did not provide a local file for attachment ${attachment.key}. Synchronize the PDF and try again.`,
    );
  }

  const path = fileURLToPath(location);
  await access(path, constants.R_OK);
  const fileStat = await stat(path);

  return {
    itemKey,
    attachmentKey: attachment.key,
    filename: attachment.data.filename || basename(path),
    path,
    bytes: fileStat.size,
  };
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      reject(
        new Error(
          command === "pdftotext"
            ? "pdftotext is unavailable. Install Poppler and try again."
            : `Could not run ${command}.`,
          { cause: error },
        ),
      );
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code}: ${stderr.trim()}`));
    });
  });
}

async function extractText(itemKey) {
  const pdf = await resolvePdf(itemKey);
  await mkdir(cacheRoot, { recursive: true });

  const textPath = join(cacheRoot, `${pdf.attachmentKey}.txt`);
  await run("pdftotext", ["-enc", "UTF-8", pdf.path, textPath]);
  const textStat = await stat(textPath);

  return {
    ...pdf,
    textPath,
    textBytes: textStat.size,
  };
}

async function cleanCache() {
  await rm(cacheRoot, { recursive: true, force: true });
  return { removed: cacheRoot };
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "find":
      console.log(JSON.stringify(await findItems(args.join(" ")), null, 2));
      break;
    case "pdf":
      if (args.length !== 1) {
        throw new Error(`The pdf command requires one Zotero item key.\n\n${usage()}`);
      }
      console.log(JSON.stringify(await resolvePdf(args[0]), null, 2));
      break;
    case "text":
      if (args.length !== 1) {
        throw new Error(`The text command requires one Zotero item key.\n\n${usage()}`);
      }
      console.log(JSON.stringify(await extractText(args[0]), null, 2));
      break;
    case "clean":
      console.log(JSON.stringify(await cleanCache(), null, 2));
      break;
    case "help":
    case "--help":
    case "-h":
      console.log(usage());
      break;
    default:
      throw new Error(usage());
  }
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
