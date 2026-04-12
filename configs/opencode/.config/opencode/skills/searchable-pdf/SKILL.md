---
name: searchable-pdf
description: Make scanned PDFs searchable by adding an OCR text layer
---

## What I do

- Add searchable text layer to scanned PDFs using OCRmyPDF
- Support multiple languages and page correction options
- Preserve original PDF structure while adding text layer

## Commands

**Basic OCR:**

```bash
ocrmypdf input.pdf output.pdf
```

**With language support:**

```bash
ocrmypdf -l eng+afr input.pdf output.pdf
```

**Full options:**

```bash
ocrmypdf -l eng+afr --deskew --rotate-pages --skip-text input.pdf output.pdf
```

## Options

| Option           | Description                        |
| ---------------- | ---------------------------------- |
| `-l LANG`        | Languages: `eng`, `afr`, `eng+afr` |
| `--skip-text`    | Skip pages with existing text      |
| `--force-ocr`    | OCR all pages even with text       |
| `--deskew`       | Straighten crooked pages           |
| `--rotate-pages` | Auto-rotate misoriented pages      |
| `--jobs N`       | Use N CPU cores                    |

## When to use me

Use this skill when you need to make a scanned PDF searchable.

- Use `--skip-text` by default to avoid re-processing
- Default to `eng+afr` for South African documents
- Output to same directory unless specified otherwise
