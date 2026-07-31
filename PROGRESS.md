# Project Progress & Roadmap — Visual HTML Editor

This document tracks the development milestones, feature statuses, and future roadmap for the **Visual HTML Editor** VS Code extension.

---

## 📊 Milestone Summary

| Milestone | Status | Description |
| :--- | :---: | :--- |
| **v0.0.1 - Proof of Concept** | ✅ Completed | Standalone HTML editor prototype using File System Access API. |
| **v0.0.1 - VS Code Extension Core** | ✅ Completed | Webview integration with `document.designMode = 'on'` & `Ctrl+S` save. |
| **v0.0.1 - Localization & Standalone Repo** | ✅ Completed | Full English translation & migration to `/home/hao/Desktop/labs/vscode-visual-html-editor`. |
| **v0.0.1 - Zoom Controls** | ✅ Completed | Added `Ctrl + Scroll Up/Down`, `Ctrl + +/-`, and Toolbar Zoom controls. |
| **v0.0.1 - Modular Architecture & Tests** | ✅ Completed | Split codebase into `src/utils`, `src/webview`, `src/extension.js`, and added `node --test` suite. |
| **v0.0.1 - Documentation** | ✅ Completed | Added `AGENTS.md`, `ARCHITECTURE.md`, and `PROGRESS.md`. |

---

## 🎯 Feature Matrix

| Feature | Status | Notes |
| :--- | :---: | :--- |
| **Visual Text Editing** | ✅ Active | Powered by browser `document.designMode = 'on'` in Webview iframe. |
| **Instant Save (`Ctrl + S`)** | ✅ Active | Intercepts `Ctrl+S` and updates source file via `vscode.workspace.applyEdit()`. |
| **Zoom In / Out** | ✅ Active | Supports `Ctrl + Mouse Wheel`, `Ctrl + +/-`, and Toolbar buttons (`0.3x` to `3.0x`). |
| **Clean Save Guard** | ✅ Active | Temporarily strips preview `style.zoom` before writing `outerHTML` to disk. |
| **Unit Test Suite** | ✅ Active | 100% pass rate using Node.js native test runner (`npm test`). |
| **Automated Packaging** | ✅ Active | Packaged via `@vscode/vsce` and installed automatically (`code --install-extension`). |

---

## 🔮 Roadmap / Future Enhancements

- [ ] **AST Surgical Text Editing**: Replace only changed text ranges instead of full `outerHTML` overwrite to preserve original indentations/comments 100%.
- [ ] **Device Viewport Toggle**: Add quick toggle buttons for Mobile (`375px`), Tablet (`768px`), and Desktop (`100%`) preview modes.
- [ ] **Custom Style Bar**: Add floating formatting toolbar for Bold, Italic, Link, and Heading tags.
- [ ] **Theme Customization**: Add option to switch Toolbar themes matching VS Code's active color theme.
