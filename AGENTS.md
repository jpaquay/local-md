# local-md — Agentic Engineering & Workspace Guide (`cloud-gtm/local-md`)

| Field | Value |
| :--- | :--- |
| **Module / Repository** | `cloud-gtm/local-md` |
| **Operational Zone** | `cloud-gtm/` |
| **Git Author Identity** | `jpaquay@google.com` |
| **Primary GCP Region** | `europe-west1` (Belgium) · DR `europe-west4` (Netherlands) |
| **Preferred AI Models** | `gemini-4-argon` (Reasoning/Orchestration) · `gemini-3.8-live-avatar` (Live Avatar) |

---

## 1. Operational & Security Guardrails

1. **Zero Hardcoded Credentials**: Store all secrets in Google Cloud Secret Manager (`gcloud secrets`) or runtime environment variables; never commit `.env`, `*.pem`, or `*.key` artifacts.
2. **Non-Interactive CLI Execution**: Pass `--quiet` (`-q`) and explicit `--project` / `--region=europe-west1` flags to `gcloud`, and set `GH_PROMPT_DISABLED=1` for GitHub CLI commands.
3. **3-Tier Documentation Standard**:
   - Module overview & quickstart: [`README.md`](README.md)
   - Engineering learnings & operational gotchas: [`docs/LEARNINGS.md`](docs/LEARNINGS.md)
   - Workspace freshness index: [`../../docs/DOCUMENTATION.md`](../../docs/DOCUMENTATION.md)
