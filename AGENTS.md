# AGENTS.md — Visual HTML Editor for VS Code

Instructions and guidelines for AI agents and human developers modifying or extending the **Visual HTML Editor** VS Code extension.

---

## Workspace Context & Cross-References

- **Parent Workspace Context**: This repository operates alongside the CV Generator workspace. See main workspace instructions at [`/home/hao/Desktop/labs/CV/AGENTS.md`](file:///home/hao/Desktop/labs/CV/AGENTS.md).
- **Extension Repository**: Located at [`/home/hao/Desktop/labs/vscode-visual-html-editor`](file:///home/hao/Desktop/labs/vscode-visual-html-editor).

---

## Core Guidelines & Rules

1. **Language Policy**:
   - Communicate with the user in **Vietnamese**.
   - Maintain all code, comments, documentation (`README.md`, `ARCHITECTURE.md`), and commit/packaging metadata in **English**.

2. **Safety & Security Constraints**:
   - Never execute untrusted scripts inside the extension host context.
   - Maintain webview sandbox boundaries (`enableScripts: true`, `retainContextWhenHidden: true`).
   - Sanitize or pass document content safely using `JSON.stringify()` when generating webview HTML.
   - Do **NOT** introduce telemetry, remote network requests, or external tracking dependencies.

3. **Code Modification Rules**:
   - Keep the codebase modular (`src/utils`, `src/webview`, `src/extension.js`).
   - Before saving to disk, ensure transient styles (such as `style="zoom: ..."` applied during live preview) are temporarily stripped so source files are not polluted.
   - Always run unit tests (`npm test`) before packaging.

---

## Commands & Workflows

### Running Unit Tests
```bash
npm test
```

### Packaging the Extension (.vsix)
```bash
npm run package
```

### Installing the Packaged Extension Locally
```bash
code --install-extension visual-html-editor-0.0.1.vsix --force
```

---

## Testing Strategy
- Unit tests reside in `test/*.test.js`.
- Use Node.js built-in test runner (`node --test`).
- Every new utility function added to `src/utils/` must have accompanying unit tests in `test/`.
