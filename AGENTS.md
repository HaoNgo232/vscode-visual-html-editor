# AGENTS.md — Visual HTML Editor for VS Code

Instructions and guidelines for AI agents and human developers modifying or extending the **Visual HTML Editor** VS Code extension.

---

## Project Overview

**Visual HTML Editor** is a lightweight, privacy-focused VS Code extension built with **TypeScript** and **Bun** to allow users to visually edit rendered static HTML files directly inside VS Code and save changes back to source files using `Ctrl + S`.

---

## Tech Stack & Tooling

- **Language**: TypeScript (`src/*.ts`)
- **Bundler & Test Runner**: Bun (`bun build`, `bun test`)
- **Target Runtime**: VS Code Node.js Extension Host (`dist/extension.js`)
- **Package Manager**: Bun (`bun install`)

---

## Core Guidelines & Rules

1. **Language Policy**:
   - Communicate with the user in **Vietnamese**.
   - Maintain all code, comments, documentation (`README.md`, `ARCHITECTURE.md`, `PROGRESS.md`), and commit/packaging metadata in **English**.

2. **Safety & Security Constraints**:
   - Never execute untrusted scripts inside the extension host context.
   - Maintain webview sandbox boundaries (`enableScripts: true`, `retainContextWhenHidden: true`).
   - Sanitize or pass document content safely using `JSON.stringify()` & script escaping (`\u003c`) when generating webview HTML.
   - Do **NOT** introduce telemetry, remote network requests, or external tracking dependencies.

3. **Code Modification Rules**:
   - Keep the codebase modular (`src/utils/`, `src/webview/`, `src/extension.ts`).
   - Before saving to disk, ensure transient styles (such as `style="zoom: ..."` applied during live preview) are temporarily stripped so source files are not polluted.
   - Always run unit tests (`bun test`) and compilation (`bun run build`) before packaging.

---

## Commands & Workflows

### Building TypeScript Source
```bash
bun run build
```

### Running Bun Unit Tests
```bash
bun test
```

### Packaging the Extension (.vsix)
```bash
bun run package
```

### Installing the Packaged Extension Locally
```bash
code --install-extension visual-html-editor-0.0.1.vsix --force
```

---

## Testing Strategy
- Unit tests reside in `test/*.test.ts`.
- Powered by `bun:test` runner (`<20ms` total execution).
- Every new utility function added to `src/utils/` must have accompanying unit tests in `test/`.
