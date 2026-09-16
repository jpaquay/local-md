# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
FastAPI Server for Local Markdown & Directory Explorer.
Serves directory navigation, search, file metadata, and the built Vite React GUI.
Features dynamically configurable and pinnable root directories (via .env, CLI, or GUI),
strict De-ID (zero PII in API responses or configs), and Zero-Trust Proxy Guard compatibility.
"""

import os
import re
import json
import time
import socket
import getpass
import argparse
import mimetypes
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Query, Request, Body
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

APP_DIR = Path(__file__).parent.resolve()
ENV_FILE = APP_DIR / ".env"
ENV_EXAMPLE_FILE = APP_DIR / ".env.example"
DIST_DIR = APP_DIR / "dist"


def get_home_dir() -> Path:
    return Path.home().resolve()


def deid_path(p: Path | str) -> str:
    """Strictly formats any path for UI/API/config display, removing PII (username, hostname, home prefix)."""
    home = get_home_dir()
    path_str = str(p)
    try:
        resolved = Path(p).resolve()
        rel = resolved.relative_to(home)
        return f"~/{rel}" if str(rel) != "." else "~"
    except Exception:
        pass

    home_str = str(home)
    if path_str == home_str:
        return "~"
    if path_str.startswith(home_str + "/"):
        return "~/" + path_str[len(home_str) + 1:]

    # De-ID fallback if path is outside home but contains OS username or hostname
    try:
        user = getpass.getuser()
        if user and len(user) > 2:
            path_str = path_str.replace(f"/{user}/", "/<user>/").replace(f"/{user}", "/<user>")
    except Exception:
        pass
    try:
        host = socket.gethostname()
        if host and len(host) > 2:
            path_str = path_str.replace(host, "<cloudtop-host>")
    except Exception:
        pass
    return path_str


def resolve_user_path(raw_path: str) -> Path:
    """Resolves a user-provided or De-ID path (~ or relative) to an absolute filesystem Path."""
    clean = raw_path.strip()
    if clean == "~" or clean.startswith("~/"):
        return Path(clean.replace("~", str(get_home_dir()), 1)).expanduser().resolve()
    return Path(clean).expanduser().resolve()


def load_env_file() -> Dict[str, str]:
    """Loads environment variables from .env (or .env.example fallback) without external dependencies."""
    env_vars: Dict[str, str] = {}
    target = ENV_FILE if ENV_FILE.exists() else (ENV_EXAMPLE_FILE if ENV_EXAMPLE_FILE.exists() else None)
    if target and target.exists():
        try:
            for line in target.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip("\"'")
                env_vars[k] = v
                if k not in os.environ:
                    os.environ[k] = v
        except Exception:
            pass
    return env_vars


def save_env_updates(updates: Dict[str, str]) -> None:
    """Updates or appends key-value pairs in .env using strictly De-ID'd values."""
    lines: List[str] = []
    existing_keys = set()
    if ENV_FILE.exists():
        try:
            lines = ENV_FILE.read_text(encoding="utf-8").splitlines()
        except Exception:
            lines = []
    elif ENV_EXAMPLE_FILE.exists():
        try:
            lines = ENV_EXAMPLE_FILE.read_text(encoding="utf-8").splitlines()
        except Exception:
            lines = []

    new_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped and not stripped.startswith("#") and "=" in stripped:
            k = stripped.split("=", 1)[0].strip()
            if k in updates:
                new_lines.append(f"{k}={updates[k]}")
                existing_keys.add(k)
                os.environ[k] = updates[k]
                continue
        new_lines.append(line)

    for k, v in updates.items():
        if k not in existing_keys:
            new_lines.append(f"{k}={v}")
            os.environ[k] = v

    try:
        ENV_FILE.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
    except Exception:
        pass


# Load .env at module initialization
load_env_file()

# Global Configurable Root Directory
DEFAULT_ROOT_STR = os.environ.get("ROOT_DIR", os.environ.get("DOCS_ROOT", os.environ.get("DEV_ROOT", "~/dev/cloud-gtm")))
try:
    DEFAULT_ROOT = resolve_user_path(DEFAULT_ROOT_STR)
    if not DEFAULT_ROOT.exists():
        DEFAULT_ROOT = get_home_dir()
except Exception:
    DEFAULT_ROOT = get_home_dir()

CURRENT_ROOT: Path = DEFAULT_ROOT
LOCKED_ROOT: bool = os.environ.get("LOCK_ROOT", "false").lower() in ("true", "1", "yes")
STARTUP_PINNED_ROOT: Path = CURRENT_ROOT


def get_pinned_roots_list() -> List[str]:
    """Returns list of De-ID pinned root strings from environment / .env."""
    raw = os.environ.get("PINNED_ROOTS", "~/dev/cloud-gtm,~/dev,~")
    result = []
    for item in raw.split(","):
        clean = item.strip()
        if not clean:
            continue
        try:
            p = resolve_user_path(clean)
            if p.exists() and p.is_dir():
                deid = deid_path(p)
                if deid not in result:
                    result.append(deid)
        except Exception:
            continue
    current_deid = deid_path(CURRENT_ROOT)
    if current_deid not in result:
        result.insert(0, current_deid)
    return result


app = FastAPI(title="Local Markdown Explorer", version="1.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def proxy_guard_path_normalizer(request: Request, call_next):
    """Normalizes requests arriving through Zero-Trust Proxy Guard gateway routes (/port/<port>/...)."""
    path = request.scope.get("path", "")
    match = re.match(r"^/port/\d+(/.*)?$", path)
    if match:
        request.scope["path"] = match.group(1) or "/"
    return await call_next(request)


# Directories to ignore during recursive search or heavy browsing on Cloudtop
IGNORED_DIRS = {
    ".git", ".git.umbrella.bak", "node_modules", ".venv", "venv", "__pycache__",
    ".cache", ".next", ".turbo", "dist", "build", ".npm", ".config",
    "go", "google-cloud-sdk", "bazel-out", "blaze-out", "target", "vendor",
    ".gradle", ".cargo", ".dartServer", ".local", ".rustup", ".gsutil"
}
# Hidden directories that are always noisy even if show_hidden=True
ALWAYS_IGNORED_HIDDEN = {
    ".git", ".git.umbrella.bak", ".venv", ".cache", ".npm", ".gradle",
    ".cargo", ".dartServer", ".local", ".rustup", ".gsutil", "__pycache__"
}
MD_EXTENSIONS = {".md", ".markdown", ".lab.md", ".lab"}


class SetRootRequest(BaseModel):
    root_path: str
    pin_as_default: Optional[bool] = False


class PinRootRequest(BaseModel):
    path: str
    action: str = "pin"  # "pin", "unpin", "set_default", "toggle_lock"


def safe_resolve(rel_path: str) -> Path:
    """Resolves and validates that a relative path stays within CURRENT_ROOT."""
    clean = rel_path.strip().lstrip("/")
    target = (CURRENT_ROOT / clean).resolve()
    try:
        target.relative_to(CURRENT_ROOT)
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied: path outside active root directory")
    return target


def get_rel_path(p: Path) -> str:
    """Returns path relative to CURRENT_ROOT."""
    try:
        return str(p.relative_to(CURRENT_ROOT))
    except ValueError:
        return p.name


def extract_toc(content: str) -> List[Dict[str, Any]]:
    """Extracts markdown headings H1-H6 with slugs and line numbers."""
    toc = []
    lines = content.splitlines()
    code_block = False

    for idx, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped.startswith("```") or stripped.startswith("~~~"):
            code_block = not code_block
            continue
        if code_block:
            continue

        match = re.match(r"^(#{1,6})\s+(.+)$", stripped)
        if match:
            level = len(match.group(1))
            raw_title = match.group(2).strip()
            clean_title = re.sub(r"[\[\]`*_{}]", "", raw_title)
            slug = re.sub(r"[^\w\s-]", "", clean_title.lower()).strip().replace(" ", "-")
            toc.append({
                "level": level,
                "title": raw_title,
                "slug": slug,
                "line": idx
            })
    return toc


def parse_frontmatter(content: str) -> tuple[Dict[str, Any], str]:
    """Parses optional YAML frontmatter at the top of markdown."""
    if not content.startswith("---"):
        return {}, content

    parts = content.split("---", 2)
    if len(parts) >= 3:
        fm_text = parts[1].strip()
        body = parts[2].lstrip()
        fm_data = {}
        for line in fm_text.splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                fm_data[k.strip()] = v.strip().strip("\"'")
        return fm_data, body
    return {}, content


def build_quick_roots() -> List[Dict[str, Any]]:
    """Builds strictly De-ID'd quick root presets combining pinned roots and standard Cloudtop directories."""
    home = get_home_dir()
    pinned_deids = get_pinned_roots_list()
    default_deid = deid_path(resolve_user_path(os.environ.get("ROOT_DIR", "~/dev/cloud-gtm")))

    candidates = []
    # Add pinned roots first
    for p_deid in pinned_deids:
        try:
            p = resolve_user_path(p_deid)
            if p.exists() and p.is_dir():
                label = p.name if p != home else "Home (~)"
                if p_deid == "~/dev/cloud-gtm":
                    label = "Cloud GTM Workspace (~/dev/cloud-gtm)"
                elif p_deid == "~/dev":
                    label = "Dev Folder (~/dev)"
                elif p_deid == "~":
                    label = "Home (~)"
                candidates.append({
                    "name": label,
                    "path": p_deid,
                    "display": p_deid,
                    "is_pinned": True,
                    "is_default": p_deid == default_deid
                })
        except Exception:
            pass

    # Standard presets if not already in list
    std_presets = [
        ("Cloud GTM Workspace (~/dev/cloud-gtm)", home / "dev" / "cloud-gtm"),
        ("Dev Folder (~/dev)", home / "dev"),
        ("Home (~)", home),
    ]
    existing_displays = {c["display"] for c in candidates}
    for label, path_obj in std_presets:
        if path_obj.exists() and path_obj.is_dir():
            disp = deid_path(path_obj)
            if disp not in existing_displays:
                candidates.append({
                    "name": label,
                    "path": disp,
                    "display": disp,
                    "is_pinned": False,
                    "is_default": disp == default_deid
                })
                existing_displays.add(disp)

    return candidates


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "root": deid_path(CURRENT_ROOT),
        "locked": LOCKED_ROOT,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/api/config")
def get_config():
    """Returns current active root folder configuration (100% De-ID, zero PII)."""
    curr_deid = deid_path(CURRENT_ROOT)
    default_deid = deid_path(resolve_user_path(os.environ.get("ROOT_DIR", "~/dev/cloud-gtm")))
    pinned_list = get_pinned_roots_list()

    return {
        "current_root": curr_deid,
        "display_root": curr_deid,
        "home_dir": "~",
        "default_root": default_deid,
        "is_pinned": curr_deid in pinned_list,
        "is_default": curr_deid == default_deid,
        "is_locked": LOCKED_ROOT,
        "pinned_roots": pinned_list,
        "quick_roots": build_quick_roots()
    }


@app.post("/api/config/root")
def set_root(req: SetRootRequest):
    """Updates the active root directory dynamically (unless locked)."""
    global CURRENT_ROOT
    raw_path = req.root_path.strip()
    target = resolve_user_path(raw_path)

    if not target.exists():
        raise HTTPException(status_code=404, detail=f"Target directory does not exist: {deid_path(raw_path)}")
    if not target.is_dir():
        raise HTTPException(status_code=400, detail=f"Target path is a file, not a directory: {deid_path(raw_path)}")

    if LOCKED_ROOT and target != STARTUP_PINNED_ROOT:
        try:
            target.relative_to(STARTUP_PINNED_ROOT)
        except ValueError:
            raise HTTPException(
                status_code=403,
                detail=f"Root directory is locked to {deid_path(STARTUP_PINNED_ROOT)}. Unlock in GUI or .env (LOCK_ROOT=false) to switch outside."
            )

    CURRENT_ROOT = target
    deid_curr = deid_path(CURRENT_ROOT)

    if req.pin_as_default:
        pinned = get_pinned_roots_list()
        if deid_curr not in pinned:
            pinned.insert(0, deid_curr)
        save_env_updates({
            "ROOT_DIR": deid_curr,
            "PINNED_ROOTS": ",".join(pinned)
        })

    return {
        "status": "success",
        "current_root": deid_curr,
        "display_root": deid_curr,
        "is_locked": LOCKED_ROOT,
        "quick_roots": build_quick_roots()
    }


@app.post("/api/config/pin")
def pin_root_config(req: PinRootRequest):
    """Pins/unpins a directory preset, sets default startup root in .env, or toggles root lock."""
    global LOCKED_ROOT, CURRENT_ROOT, STARTUP_PINNED_ROOT
    target = resolve_user_path(req.path) if req.path else CURRENT_ROOT
    if not target.exists() or not target.is_dir():
        raise HTTPException(status_code=404, detail=f"Directory not found: {deid_path(req.path)}")

    deid_target = deid_path(target)
    pinned = get_pinned_roots_list()

    if req.action == "pin":
        if deid_target not in pinned:
            pinned.append(deid_target)
        save_env_updates({"PINNED_ROOTS": ",".join(pinned)})
    elif req.action == "unpin":
        pinned = [p for p in pinned if p != deid_target]
        if not pinned:
            pinned = ["~/dev/cloud-gtm"]
        save_env_updates({"PINNED_ROOTS": ",".join(pinned)})
    elif req.action == "set_default":
        CURRENT_ROOT = target
        STARTUP_PINNED_ROOT = target
        if deid_target not in pinned:
            pinned.insert(0, deid_target)
        save_env_updates({
            "ROOT_DIR": deid_target,
            "PINNED_ROOTS": ",".join(pinned)
        })
    elif req.action == "toggle_lock":
        LOCKED_ROOT = not LOCKED_ROOT
        if LOCKED_ROOT:
            STARTUP_PINNED_ROOT = CURRENT_ROOT
        save_env_updates({"LOCK_ROOT": "true" if LOCKED_ROOT else "false"})
    else:
        raise HTTPException(status_code=400, detail=f"Unknown pin action: {req.action}")

    return get_config()


@app.get("/api/browse")
def browse_directory(
    path: str = Query("", description="Relative path from active root"),
    show_hidden: bool = Query(False, description="Show hidden dotfiles and dot-directories")
):
    """Returns directory listing for the given relative path with clean Cloudtop filtering."""
    target_dir = safe_resolve(path)

    if not target_dir.exists():
        raise HTTPException(status_code=404, detail="Directory not found")
    if not target_dir.is_dir():
        raise HTTPException(status_code=400, detail="Target path is a file, not a directory")

    items = []
    try:
        with os.scandir(target_dir) as entries:
            for entry in entries:
                name = entry.name
                # Always skip heavy build/SDK directories
                if name in IGNORED_DIRS:
                    continue
                # Filter dotfiles/dot-directories unless show_hidden is enabled
                if name.startswith("."):
                    if not show_hidden or name in ALWAYS_IGNORED_HIDDEN:
                        continue

                try:
                    is_directory = entry.is_dir(follow_symlinks=False)
                    entry_path = Path(entry.path)
                    rel = get_rel_path(entry_path)
                    ext = entry_path.suffix.lower()

                    if name.endswith(".lab.md"):
                        ext = ".lab.md"

                    stat = entry.stat(follow_symlinks=False)
                    items.append({
                        "name": name,
                        "path": rel,
                        "is_dir": is_directory,
                        "extension": ext if not is_directory else None,
                        "is_markdown": ext in MD_EXTENSIONS,
                        "size_bytes": stat.st_size if not is_directory else None,
                        "modified_time": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                    })
                except (PermissionError, FileNotFoundError, OSError):
                    continue
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied reading directory")

    # Sort: directories first, then markdown files, then others
    def sort_key(x):
        if x["is_dir"]:
            return (0, x["name"].lower())
        if x["is_markdown"]:
            return (1, x["name"].lower())
        return (2, x["name"].lower())

    items.sort(key=sort_key)

    rel_current = get_rel_path(target_dir)
    parent_rel = get_rel_path(target_dir.parent) if target_dir != CURRENT_ROOT else None

    # Calculate breadcrumbs using De-ID root display
    root_label = deid_path(CURRENT_ROOT)
    breadcrumbs = [{"name": root_label, "path": ""}]
    if rel_current and rel_current != ".":
        accum = ""
        for seg in rel_current.split(os.sep):
            accum = f"{accum}/{seg}" if accum else seg
            breadcrumbs.append({"name": seg, "path": accum})

    return {
        "current_path": rel_current if rel_current != "." else "",
        "parent_path": parent_rel if parent_rel != "." else "",
        "is_root": target_dir == CURRENT_ROOT,
        "root_display": root_label,
        "show_hidden": show_hidden,
        "breadcrumbs": breadcrumbs,
        "items": items,
        "total_count": len(items),
    }


@app.get("/api/file")
def get_file_content(path: str = Query(..., description="Relative path of file")):
    """Reads and returns file content, metadata, and extracted TOC."""
    target_file = safe_resolve(path)

    if not target_file.exists():
        raise HTTPException(status_code=404, detail="File not found")
    if target_file.is_dir():
        raise HTTPException(status_code=400, detail="Target path is a directory")

    try:
        raw_text = target_file.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")

    frontmatter, body_content = parse_frontmatter(raw_text)
    toc = extract_toc(raw_text)
    stat = target_file.stat()

    words = len(raw_text.split())
    reading_time_minutes = max(1, round(words / 200))

    rel_p = get_rel_path(target_file)
    ext = target_file.suffix.lower()
    if target_file.name.endswith(".lab.md"):
        ext = ".lab.md"

    root_label = deid_path(CURRENT_ROOT)
    breadcrumbs = [{"name": root_label, "path": ""}]
    accum = ""
    for seg in rel_p.split(os.sep):
        accum = f"{accum}/{seg}" if accum else seg
        breadcrumbs.append({"name": seg, "path": accum})

    return {
        "name": target_file.name,
        "path": rel_p,
        "extension": ext,
        "is_markdown": ext in MD_EXTENSIONS,
        "size_bytes": stat.st_size,
        "modified_time": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        "lines_count": len(raw_text.splitlines()),
        "word_count": words,
        "reading_time_minutes": reading_time_minutes,
        "frontmatter": frontmatter,
        "toc": toc,
        "content": raw_text,
        "breadcrumbs": breadcrumbs,
    }


def walk_workspace(root_path: Path, max_depth: int = 5):
    """Generator that walks directory tree up to max_depth, pruning ignored and hidden folders."""
    root_depth = len(root_path.parts)
    for root, dirs, files in os.walk(root_path):
        current_depth = len(Path(root).parts) - root_depth
        if current_depth >= max_depth:
            dirs[:] = []
        else:
            dirs[:] = [
                d for d in dirs
                if d not in IGNORED_DIRS and (not d.startswith(".") or d == ".agents")
            ]
        yield root, dirs, files


@app.get("/api/search")
def search_files(
    q: str = Query(..., min_length=2, description="Search query"),
    ext_filter: Optional[str] = Query("md", description="Filter by extension (md, all)"),
    max_results: int = Query(30, le=100)
):
    """Full-text and filename search across files in CURRENT_ROOT."""
    query = q.lower()
    results = []

    for root, dirs, files in walk_workspace(CURRENT_ROOT, max_depth=5):
        for file in files:
            if file.startswith(".") and file != ".env.example":
                continue

            file_path = Path(root) / file
            f_ext = file_path.suffix.lower()

            if ext_filter == "md" and f_ext not in MD_EXTENSIONS and not file.endswith(".lab.md"):
                continue

            rel = get_rel_path(file_path)
            file_match = query in file.lower() or query in rel.lower()
            matched_snippets = []

            try:
                if file_path.stat().st_size <= 512 * 1024:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        for line_idx, line in enumerate(f, 1):
                            if query in line.lower():
                                matched_snippets.append({
                                    "line_number": line_idx,
                                    "text": line.strip()[:180]
                                })
                                if len(matched_snippets) >= 3:
                                    break
            except Exception:
                pass

            if file_match or matched_snippets:
                results.append({
                    "name": file,
                    "path": rel,
                    "extension": f_ext,
                    "matched_in_filename": file_match,
                    "matches_count": len(matched_snippets),
                    "snippets": matched_snippets
                })
                if len(results) >= max_results:
                    break
        if len(results) >= max_results:
            break

    return {
        "query": q,
        "root": deid_path(CURRENT_ROOT),
        "total_matches": len(results),
        "results": results
    }


@app.get("/api/stats")
def get_stats():
    """Returns repository stats for markdown documentation in active root (bounded depth for speed)."""
    total_md = 0
    total_dirs = 0
    recent_files = []

    for root, dirs, files in walk_workspace(CURRENT_ROOT, max_depth=4):
        total_dirs += len(dirs)
        for f in files:
            if f.startswith("."):
                continue
            p = Path(root) / f
            if p.suffix.lower() in MD_EXTENSIONS or f.endswith(".lab.md"):
                total_md += 1
                try:
                    stat = p.stat()
                    recent_files.append({
                        "name": f,
                        "path": get_rel_path(p),
                        "mtime": stat.st_mtime,
                        "size": stat.st_size
                    })
                except Exception:
                    pass

    recent_files.sort(key=lambda x: x["mtime"], reverse=True)
    top_recent = [
        {
            "name": r["name"],
            "path": r["path"],
            "size": r["size"],
            "modified_time": datetime.fromtimestamp(r["mtime"], tz=timezone.utc).isoformat()
        }
        for r in recent_files[:8]
    ]

    return {
        "root": deid_path(CURRENT_ROOT),
        "total_markdown_files": total_md,
        "total_directories": total_dirs,
        "recent_files": top_recent
    }


# Mount static frontend if built
if DIST_DIR.exists() and (DIST_DIR / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        clean_path = full_path.lstrip("/")
        file_target = (DIST_DIR / clean_path).resolve()
        try:
            file_target.relative_to(DIST_DIR.resolve())
        except ValueError:
            raise HTTPException(status_code=403, detail="Access denied: path outside distribution directory")
        if file_target.exists() and file_target.is_file():
            return FileResponse(file_target)
        return FileResponse(DIST_DIR / "index.html")
else:
    @app.get("/")
    def dev_fallback():
        return HTMLResponse(
            """<!DOCTYPE html>
            <html>
            <head><title>Local Markdown Explorer</title>
            <style>body{font-family:system-ui,-apple-system,sans-serif;padding:40px;background:#1e1e2e;color:#cdd6f4;line-height:1.6}
            h1{color:#89b4fa}code{background:#313244;padding:3px 8px;border-radius:4px;color:#f9e2af}</style>
            </head>
            <body>
            <h1>🚀 Local Markdown Explorer API Ready</h1>
            <p>FastAPI backend is running! To compile and launch the Vite React UI, run:</p>
            <pre><code>npm run build</code></pre>
            </body>
            </html>"""
        )


if __name__ == "__main__":
    import signal
    try:
        signal.signal(signal.SIGHUP, signal.SIG_IGN)
    except Exception:
        pass
    parser = argparse.ArgumentParser(description="Local Markdown Explorer Server")
    parser.add_argument("--root", type=str, default=None, help="Root directory to browse (default: from .env or ~/dev/cloud-gtm)")
    parser.add_argument("--pin-root", type=str, default=None, help="Pin and lock root directory at startup and persist to .env")
    parser.add_argument("--lock-root", action="store_true", help="Lock root directory to prevent switching outside startup root")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", 18000)), help="Port to listen on (default: 18000 for Proxy Guard)")
    parser.add_argument("--host", type=str, default=os.environ.get("HOST", "127.0.0.1"), help="Host to bind (default: 127.0.0.1)")
    args = parser.parse_args()

    if args.pin_root:
        target_root = resolve_user_path(args.pin_root)
        CURRENT_ROOT = target_root
        STARTUP_PINNED_ROOT = target_root
        LOCKED_ROOT = True
        deid_r = deid_path(target_root)
        pinned = get_pinned_roots_list()
        if deid_r not in pinned:
            pinned.insert(0, deid_r)
        save_env_updates({
            "ROOT_DIR": deid_r,
            "PINNED_ROOTS": ",".join(pinned),
            "LOCK_ROOT": "true"
        })
    elif args.root:
        target_root = resolve_user_path(args.root)
        CURRENT_ROOT = target_root
        STARTUP_PINNED_ROOT = target_root

    if args.lock_root:
        LOCKED_ROOT = True

    print(f"🌟 Starting Local Markdown Explorer server on http://{args.host}:{args.port}")
    print(f"📁 Active Root Directory (De-ID): {deid_path(CURRENT_ROOT)} (Locked: {LOCKED_ROOT})")
    uvicorn.run(app, host=args.host, port=args.port)
