# Contributing to `local-md`

Thank you for your interest in contributing to **`local-md` (Local Markdown Explorer & Zero-Trust Codelab Viewer)**, created and maintained by **Jerome CG Paquay (`@jpaquay`)**.

This repository adheres to strict **Zero-Trust Security**, **Strict De-ID (Zero PII)**, and **CC BY-SA 4.0** open collaboration standards.

---

## 🛠️ Development Environment Setup

### Prerequisites
- **Python 3.11+** (FastAPI / Uvicorn / Markdown parsing backend)
- **Node.js 20+ & npm** (React 19 + TypeScript + Vite frontend)
- **Git** with pre-commit secret scanning (`git-secrets`)

### Local Quickstart
```bash
# Clone the repository
git clone https://github.com/jpaquay/local-md.git
cd local-md

# Copy environment configuration template
cp .env.example .env

# Run idempotent launcher (installs deps, builds frontend, starts server)
./run.sh
```

### Running Backend & Frontend in Dev Mode
```bash
# Run Python unit tests
pytest test_server.py

# Run Vite dev server with hot-reload
npm install
npm run dev
```

---

## 🔒 Security & Strict De-ID Guardrails

1. **Zero Hardcoded Secrets**: Never commit API keys, tokens, or `.env` files. Only `.env.example` with safe placeholders may be tracked in Git.
2. **Strict Path De-Identification (`De-ID`)**: All API payloads, UI breadcrumbs, logs, and documentation must scrub real usernames, home directory paths, and hostnames (`~`, `<user>`, `<cloudtop-host>`).
3. **Loopback Isolation**: When operating behind Local Proxy Guard (`:8000`), the Python backend must bind exclusively to `127.0.0.1:18000` so unauthenticated network peers cannot bypass UberProxy/IAP verification.

---

## 📋 Pull Request & Commit Conventions

- Follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `security:`, `refactor:`).
- Ensure `pytest test_server.py` and `npm run build` pass with zero errors before submitting a PR.
- Include attribution metadata tags at the footer of automated/assisted commits:
  ```text
  TAG=agy
  CONV=<conversation_id>
  ```

---

## 📜 License Agreement

By contributing to `local-md`, you agree that your contributions will be licensed under the **Creative Commons Attribution-ShareAlike 4.0 International License (`CC BY-SA 4.0`)**, attributed to **Jerome CG Paquay (`@jpaquay`)** and project contributors. See [LICENSE](./LICENSE) for full details.
