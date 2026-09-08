# Local Markdown Explorer (`local-md`)

A fast, single-page web GUI and presentation engine to browse, search, and render Markdown documents, Codelabs, and repository structures across any configurable directory tree.

---

## ✨ Features

- ⚡ **Vite + React 19 + TypeScript**: Modern, ultra-fast frontend build.
- 📁 **Configurable Root Directory**: Defaults to Home (`~/`) or any custom directory with instant in-GUI switching.
- 🔍 **Live Full-Text Search (`Cmd+K`)**: Rapid keyword and filename search across all Markdown files in the active root with highlighted snippet previews.
- 📐 **Rich Markdown & Codelab Engine**:
  - Mermaid diagram rendering (`sequenceDiagram`, `graph`, `classDiagram`, `architectureDiagram`).
  - Google Cloud Codelab aside boxes (`> aside positive`, `> aside negative`) and GitHub callouts (`[!NOTE]`, `[!WARNING]`, `[!IMPORTANT]`).
  - LaTeX / KaTeX math support (`$inline$` and `$$block$$`).
  - Highlight.js syntax highlighting with language tags and 1-click **Copy Code** buttons.
- 📑 **Sticky Table of Contents**: Dynamic heading hierarchy with smooth section scrolling.
- 🌗 **Light / Dark Mode**: Theme toggle with persistent preferences.
- 🔒 **Privacy First**: Zero hardcoded personal paths or identifiers; clean `~/` path display.

---

## 🚀 Quickstart

### Running with the Launcher Script

```bash
# Starts the FastAPI server and serves the compiled GUI
./run.sh

# Or start with a custom root directory and port
ROOT_DIR=~/my-project PORT=8080 ./run.sh
```

### Manual Commands

```bash
# 1. Install dependencies
npm install

# 2. Build frontend production bundle
npm run build

# 3. Start Python backend
python3 server.py --root=~ --port=8000
```

---

## 🔌 API Endpoints

- `GET /api/config`: Returns active root directory and quick preset shortcuts.
- `POST /api/config/root`: Dynamically updates the active root directory (`{"root_path": "~/dev"}`).
- `GET /api/browse?path=...`: Returns directory items, file metadata, and breadcrumbs.
- `GET /api/file?path=...`: Returns file content, extracted TOC, frontmatter, and reading stats.
- `GET /api/search?q=...`: Performs full-text and filename search across the active root.
- `GET /api/stats`: Returns markdown file counts and recently modified documents.
