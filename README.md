# Visual HTML Editor for VS Code

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![VS Code Extension](https://img.shields.io/badge/VS%20Code-v1.75%2B-blue)](https://marketplace.visualstudio.com/)

Visually edit rendered static HTML files directly in VS Code with real-time preview, device frame switching, auto-save, and clean formatting-preserving save.

---

## 🎯 Why Use This Extension?

1. **Visual Editing**: Edit rendered text directly instead of hunting through messy, hard-to-read inline HTML code.
2. **Save AI Tokens & Time**: Quickly tweak minor text/typos in **AI-generated CVs and documents** without wasting tokens on AI re-prompts.

---

## 📦 Installation & Build

Run the following commands in your terminal to clone, package, and install the extension into VS Code:

```bash
git clone https://github.com/HaoNgo232/vscode-visual-html-editor.git
cd vscode-visual-html-editor
bun install
bun run package
code --install-extension visual-html-live-editor-0.0.1.vsix --force
```

---

## ✨ Features

- **Visual Text Editing**: Click any text in the preview to edit directly, just like a word processor.
- **Clean File Saving**: Keeps 100% of your original HTML structure, comments, and formatting intact when saving.
- **Auto-Save**: Automatically saves your edits in the background as you type.
- **Device Preview**: Switch between Desktop, Tablet, and Mobile views to test responsive layouts.
- **Instant PDF Export**: Export your rendered HTML directly to a PDF document in one click.

---

## 🚀 Quick Start

1. Open any `.html` file.
2. Right-click in the file/editor tab and select **`Visual HTML Editor: Open Visual Editor`**.
3. Click text to edit.
4. Press `Ctrl + S` to save.

---

## ⌨️ Shortcuts

- `Ctrl + S`: Save changes
- `Ctrl + Z` / `Ctrl + Y`: Undo / Redo
- `Ctrl + Scroll` / `Ctrl + +/-`: Zoom canvas

---

## 📄 License

MIT
