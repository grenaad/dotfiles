---
name: ocr
description: Extract text from images and PDFs
---

## What I do

- Extract text from images using DeepSeek-OCR-2 vision model
- Convert PDF pages to PNG for OCR processing
- Support various prompts for different document types

## Commands

**Image OCR:**

```bash
mlx_vlm.generate --model mlx-community/DeepSeek-OCR-2-bf16 --image "IMAGE_PATH" --max-tokens 4000 --prompt "Extract all the text from this image."
```

**PDF OCR (convert to PNG first):**

```bash
pdftoppm -png -f PAGE -l PAGE -r 150 "FILE.pdf" /tmp/page && \
mlx_vlm.generate --model mlx-community/DeepSeek-OCR-2-bf16 --image "/tmp/page-1.png" --max-tokens 4000 --prompt "Extract all the text from this image."
```

## Prompts

| Use Case            | Prompt                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------- |
| Standard            | `Extract all the text from this image.`                                                      |
| Preserve formatting | `Transcribe the text accurately. Preserve line breaks. Return only plain text.`              |
| Legal documents     | `Transcribe this legal document exactly. Preserve section numbers and paragraph formatting.` |

## When to use me

Use this skill when you need to extract text from images or scanned PDFs.

- For PDFs, convert pages to PNG with pdftoppm before OCR
- Use 150 DPI for standard documents, 300 DPI for fine print
- Save extracted text to a file when requested
