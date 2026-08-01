# Visual HTML Editor for VS Code

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![VS Code Extension](https://img.shields.io/badge/VS%20Code-v1.75%2B-blue)](https://marketplace.visualstudio.com/)

Visually edit rendered static HTML files directly in VS Code with real-time preview, device frame switching, debounced auto-save, and surgical formatting-preserving save.

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
code --install-extension visual-html-editor-0.0.1.vsix --force
```

---

## ✨ Features

- **WYSIWYG Editing**: Click and edit text directly inside the rendered preview.
- **Surgical Save**: Updates only modified text offsets—preserves original DOCTYPE, comments, and indentation.
- **Auto-Save**: Toggleable background save with 1000ms debounce.
- **Device Viewports**: Switch between Desktop (100%), Tablet (768px), and Mobile (375px).
- **Canvas Zoom**: Scale view (0.3x to 3.0x) with Ctrl+Scroll or Ctrl++/- without polluting source files.
- **100% Offline & Private**: Runs locally inside VS Code with zero telemetry.

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
- `Ctrl + 0`: Reset zoom (100%)

---

## 📄 License

MIT
