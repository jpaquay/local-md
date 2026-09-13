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
Features dynamically configurable root directory defaulting to Home (~/).
"""

import os
import re
import json
import time
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

# Global Configurable Root Directory - Default to user home (~/)
DEFAULT_ROOT = Path(os.environ.get("ROOT_DIR", os.environ.get("DOCS_ROOT", os.environ.get("DEV_ROOT", str(Path.home()))))).expanduser().resolve()
CURRENT_ROOT: Path = DEFAULT_ROOT
DIST_DIR = Path(__file__).parent / "dist"

app = FastAPI(title="Local Markdown Explorer", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories to ignore during recursive search or heavy browsing
IGNORED_DIRS = {".git", "node_modules", ".venv", "venv", "__pycache__", ".cache", ".next", ".turbo", "dist", "build", ".npm", ".config"}
MD_EXTENSIONS = {".md", ".markdown", ".lab.md", ".lab"}

class SetRootRequest(BaseModel):
    root_path: str

def get_home_dir() -> Path:
    return Path.home().resolve()

def get_display_path(p: Path) -> str:
    """Formats path for UI display, replacing user home with ~ to avoid PII."""
    home = get_home_dir()
    try:
        rel = p.relative_to(home)
        return f"~/{rel}" if str(rel) != "." else "~"
    except ValueError:
        return str(p)

def safe_resolve(rel_path: str) -> Path:
    """Resolves and validates that a relative path stays within CURRENT_ROOT."""
    global CURRENT_ROOT
    clean = rel_path.strip().lstrip("/")
    target = (CURRENT_ROOT / clean).resolve()
    try:
        target.relative_to(CURRENT_ROOT)
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied: path outside active root directory")
    return target

def get_rel_path(p: Path) -> str:
    """Returns path relative to CURRENT_ROOT."""
    global CURRENT_ROOT
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

@app.get("/api/health")
def health():
    return {
        "status": "ok", 
        "root": get_display_path(CURRENT_ROOT), 
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.get("/api/config")
def get_config():
    """Returns current active root folder configuration."""
    home = get_home_dir()
    dev_candidate = (home / "dev").resolve()
    
    quick_roots = [
        {"name": "Home (~)", "path": str(home), "display": "~"},
    ]
    if dev_candidate.exists() and dev_candidate.is_dir():
        quick_roots.append({"name": "Dev Folder (~/dev)", "path": str(dev_candidate), "display": "~/dev"})

    return {
        "current_root": str(CURRENT_ROOT),
        "display_root": get_display_path(CURRENT_ROOT),
        "home_dir": str(home),
        "quick_roots": quick_roots
    }

@app.post("/api/config/root")
def set_root(req: SetRootRequest):
    """Updates the active root directory dynamically."""
    global CURRENT_ROOT
    raw_path = req.root_path.strip()
    if raw_path.startswith("~"):
        target = Path(raw_path.replace("~", str(get_home_dir()), 1)).resolve()
    else:
        target = Path(raw_path).resolve()
        
    if not target.exists():
        raise HTTPException(status_code=404, detail=f"Target directory does not exist: {raw_path}")
    if not target.is_dir():
        raise HTTPException(status_code=400, detail=f"Target path is a file, not a directory: {raw_path}")
        
    CURRENT_ROOT = target
    return {
        "status": "success",
        "current_root": str(CURRENT_ROOT),
        "display_root": get_display_path(CURRENT_ROOT)
    }

@app.get("/api/browse")
def browse_directory(path: str = Query("", description="Relative path from active root")):
    """Returns directory listing for the given relative path."""
    target_dir = safe_resolve(path)
    
    if not target_dir.exists():
        raise HTTPException(status_code=404, detail="Directory not found")
    if not target_dir.is_dir():
        raise HTTPException(status_code=400, detail="Target path is a file, not a directory")

    items = []
    try:
        with os.scandir(target_dir) as entries:
            for entry in entries:
                if entry.name in IGNORED_DIRS and entry.name.startswith("."):
                    continue
                
                try:
                    is_directory = entry.is_dir(follow_symlinks=False)
                    entry_path = Path(entry.path)
                    rel = get_rel_path(entry_path)
                    ext = entry_path.suffix.lower()
                    
                    if entry.name.endswith(".lab.md"):
                        ext = ".lab.md"

                    stat = entry.stat(follow_symlinks=False)
                    items.append({
                        "name": entry.name,
                        "path": rel,
                        "is_dir": is_directory,
                        "extension": ext if not is_directory else None,
                        "is_markdown": ext in MD_EXTENSIONS,
                        "size_bytes": stat.st_size if not is_directory else None,
                        "modified_time": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                    })
                except (PermissionError, FileNotFoundError):
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

    # Calculate breadcrumbs
    root_label = get_display_path(CURRENT_ROOT)
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

    root_label = get_display_path(CURRENT_ROOT)
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

@app.get("/api/search")
def search_files(
    q: str = Query(..., min_length=2, description="Search query"),
    ext_filter: Optional[str] = Query("md", description="Filter by extension (md, all)"),
    max_results: int = Query(30, le=100)
):
    """Full-text and filename search across files in CURRENT_ROOT."""
    query = q.lower()
    results = []
    
    for root, dirs, files in os.walk(CURRENT_ROOT):
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS and not d.startswith(".")]
        
        for file in files:
            if file.startswith("."):
                continue
                
            file_path = Path(root) / file
            f_ext = file_path.suffix.lower()
            
            if ext_filter == "md" and f_ext not in MD_EXTENSIONS and not file.endswith(".lab.md"):
                continue
                
            rel = get_rel_path(file_path)
            file_match = query in file.lower() or query in rel.lower()
            matched_snippets = []
            
            try:
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
        "root": get_display_path(CURRENT_ROOT),
        "total_matches": len(results),
        "results": results
    }

@app.get("/api/stats")
def get_stats():
    """Returns repository stats for markdown documentation in active root."""
    total_md = 0
    total_dirs = 0
    recent_files = []
    
    for root, dirs, files in os.walk(CURRENT_ROOT):
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS and not d.startswith(".")]
        total_dirs += len(dirs)
        for f in files:
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
        "root": get_display_path(CURRENT_ROOT),
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
    parser = argparse.ArgumentParser(description="Local Markdown Explorer Server")
    parser.add_argument("--root", type=str, default=str(DEFAULT_ROOT), help="Root directory to browse (default: ~/)")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8000)), help="Port to listen on (default: 8000)")
    parser.add_argument("--host", type=str, default=os.environ.get("HOST", "0.0.0.0"), help="Host to bind (default: 0.0.0.0)")
    args = parser.parse_args()

    CURRENT_ROOT = Path(args.root).expanduser().resolve()
    print(f"🌟 Starting Local Markdown Explorer server on http://{args.host}:{args.port}")
    print(f"📁 Active Root Directory: {CURRENT_ROOT} ({get_display_path(CURRENT_ROOT)})")
    uvicorn.run(app, host=args.host, port=args.port)
