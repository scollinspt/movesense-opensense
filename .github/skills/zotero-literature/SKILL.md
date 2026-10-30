---
name: zotero-literature
description: "Use when searching, reading, reviewing, citing, or synthesizing papers and PDFs from the HMS Lab Zotero library for a Movesense, OpenSense, gait, ECG, physiology, or measurement project."
---

# HMS Lab Zotero Literature

Use the workspace's read-only Zotero helper whenever a task depends on papers
already stored in the HMS Lab group library.

## Prerequisites

- Zotero Desktop must be open and synchronized.
- **Settings > Advanced > Allow other applications on this computer to
  communicate with Zotero** must be enabled.
- `pdftotext` must be available when paper text is needed.

Do not request or store a Zotero API key. The helper uses the local API at
`http://127.0.0.1:23119/api`.

## Workflow

1. Search by title, author, DOI, date, or item key:

   ```console
   node scripts/zotero-library.mjs find "search terms"
   ```

2. Use the returned top-level item key to resolve a synchronized PDF:

   ```console
   node scripts/zotero-library.mjs pdf ITEM_KEY
   ```

3. When full-text evidence is needed, extract temporary text:

   ```console
   node scripts/zotero-library.mjs text ITEM_KEY
   ```

4. Inspect only the relevant portions of the extracted text. Record the paper
   title, DOI, and Zotero item key in findings so the source can be traced.

5. Remove extracted text before finishing:

   ```console
   node scripts/zotero-library.mjs clean
   ```

## Evidence use

Before applying a paper, read the relevant project charter, processing plan,
validation plan, and clinical-development boundaries. Use the library for:

- selecting and implementing processing algorithms;
- identifying benchmark or validation datasets;
- defining reference standards and measurable error criteria;
- evaluating applicability across sensor placements, walking conditions, and
  populations; and
- informing cautious clinical interpretation alongside the physical therapy
  examination and movement system interpretation.

For every consequential source, identify its evidence role, population, sensor
placement, reference standard, outcomes, and limitations. Distinguish a
published method from a method validated in this project. Do not convert an
engineering metric into a diagnostic or clinical claim without the required
project-specific validation and governance.

## Boundaries

- Treat Zotero as the source of truth for citations, collection membership,
  and stored attachments.
- Do not commit PDFs or extracted full text to this public repository.
- Do not silently substitute a different paper when an attachment is missing.
- Report local-API, synchronization, attachment, and extraction failures
  explicitly.
- Use project-authored summaries and evidence maps for durable repository
  documentation; quote papers only when necessary and briefly.
- The helper is read-only. Use the Zotero interface for collection changes,
  metadata editing, and attachment uploads.
