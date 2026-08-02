# Visual HTML Live Editor for VS Code

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.75%2B-blue)](https://code.visualstudio.com/)

Edit rendered static HTML directly inside VS Code without searching through deeply nested source code.

This extension is especially useful for AI-generated CVs, landing pages, reports, portfolios, and other HTML documents where the layout is already finished but the content still needs small corrections.

---

## Why Use It?

AI can generate complete HTML pages quickly, but using AI again just to fix a typo, name, title, or number is often unnecessary—and may accidentally change the layout.

Visual HTML Live Editor lets you:

- Click and edit visible text directly
- Save changes back to the original HTML file
- Avoid regenerating an entire document for small corrections
- Preview the page at Desktop, Tablet, and Mobile widths
- Export the finished document to PDF

---

## Who Is It For?

- Developers working with AI-generated HTML
- People creating CVs, portfolios, or printable documents
- Designers and content editors making quick text changes
- Freelancers maintaining static client pages
- Anyone who wants to edit HTML content visually inside VS Code

It works best with static, content-focused HTML. It is not intended to replace a complete website builder or code editor.

---

## Features

- **Visual Editing**: Click visible text and edit it directly in the rendered page.
- **Clean Saving**: Updates edited content while preserving surrounding source formatting when possible.
- **Auto Save**: Automatically saves changes after you stop typing.
- **Responsive Preview**: Switch between Desktop, Tablet, and Mobile views.
- **Zoom Controls**: Use the toolbar or `Ctrl/Cmd + Scroll`.
- **Undo and Redo**: Use familiar editing shortcuts.
- **Reload from Disk**: Re-sync the preview with the source file.
- **PDF Export**: Export the rendered document through a Chromium-based browser.
- **Local Resources**: Load relative CSS, JavaScript, images, and local HTML references.

---

## Quick Start

1. Open an `.html` file in VS Code.
2. Right-click the file or editor tab.
3. Select **Visual HTML Editor: Open Visual Editor**.
4. Click the text you want to change.
5. Press `Ctrl/Cmd + S` to save.

For important files, use Git and review the changes before committing.

---

## Installation

```bash
git clone https://github.com/HaoNgo232/vscode-visual-html-editor.git
cd vscode-visual-html-editor

bun install
bun run package

code --install-extension visual-html-live-editor-0.0.3.vsix --force
```

Requirements:

- Bun
- Node.js with `npx`

---

## Shortcuts

| Shortcut            | Action         |
| ------------------- | -------------- |
| `Ctrl/Cmd + S`      | Save           |
| `Ctrl/Cmd + Z`      | Undo           |
| `Ctrl/Cmd + Y`      | Redo           |
| `Ctrl/Cmd + Scroll` | Zoom           |
| `Ctrl/Cmd + +/-`    | Zoom in or out |

---

## Current Limitations

- Best suited for static HTML.
- Complex JavaScript applications may not behave predictably.
- Structural edits may require the document to be re-serialized.
- Nested local HTML files can be previewed, but full multi-file save-back is not guaranteed.
- This is a content editor, not a drag-and-drop website builder.

---

## License

[MIT](LICENSE)
