# Workflow scripts

## HMS Lab Zotero literature

The read-only Zotero helper searches the HMS Lab group library, resolves locally
synchronized PDF attachments, and extracts temporary searchable text without
copying papers into this repository.

Keep Zotero Desktop open, enable **Settings > Advanced > Allow other
applications on this computer to communicate with Zotero**, and allow group
attachments to synchronize.

```console
node scripts/zotero-library.mjs find "bilateral shank gait"
node scripts/zotero-library.mjs pdf ITEM_KEY
node scripts/zotero-library.mjs text ITEM_KEY
node scripts/zotero-library.mjs clean
```

`pdftotext`, provided by Poppler, is required for text extraction. Temporary
text is written under the operating system's private temporary directory in a
`movesense-opensense-zotero` folder. PDFs and extracted text must not be
committed.
