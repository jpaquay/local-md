# Local Markdown Explorer (`local-md`) — Documentation Index

Welcome to the documentation hub for **`local-md`**, a fast, single-page web GUI and Codelab presentation engine to browse, search, upload, and render Markdown documents (`.md`, `.lab.md`) across configurable workspace directory trees with strict De-ID and Zero-Trust Proxy Guard isolation.

---

## 📚 Documentation Catalog

| Section | Document | Description |
| :--- | :--- | :--- |
| **01** | [README.md](../README.md) | System overview, features, quickstart launcher (`run.sh`), `.env` configuration, and REST API reference |
| **02** | [ARCHITECTURE_REVIEW.md](./ARCHITECTURE_REVIEW.md) | Engineering, security, De-ID sanitization, and Zero-Trust Proxy Guard architecture review |
| **03** | [CONTRIBUTING.md](../CONTRIBUTING.md) | Contributor workflow, code quality standards, and pre-commit secret scanning guidelines |

---

## 🛡️ Security & Privacy Principles

1. **Strict De-ID Sanitization:** All API responses (`/api/browse`, `/api/file`, `/api/config`, `/api/search`, `/api/upload`, `/api/file/create`) automatically scrub local home directories, usernames, and hostnames (`~`, `<user>`, `<cloudtop-host>`).
2. **Loopback Isolation:** When running behind Local Proxy Guard (`:8000`), the FastAPI backend binds strictly to `127.0.0.1:18000`.
3. **Canonical Root Boundary Enforcement:** All file read, search, and upload operations resolve canonical paths (`os.path.realpath`) and enforce the active workspace root lock (`LOCK_ROOT`).
