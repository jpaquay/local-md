"""
FastAPI Server for Local Markdown & Dev Folder Explorer.
Serves directory navigation, search, file metadata, and the built Vite React GUI.
"""

import os
import re
import json
import time
import mimetypes
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Base root directory to browse
DEV_ROOT = Path(os.environ.get("DEV_ROOT", "/usr/local/google/home/jpaquay/dev")).resolve()
DIST_DIR = Path(__file__).parent / "dist"

app = FastAPI(title="Local Markdown & Dev Folder Explorer", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories to ignore during recursive search or heavy browsing
IGNORED_DIRS = {".git", "node_modules", ".venv", "__pycache__", ".cache", ".next", ".turbo", "dist", "build"}
MD_EXTENSIONS = {".md", ".markdown", ".lab.md", ".lab"}

def safe_resolve(rel_path: str) -> Path:
    """Resolves and validates that a relative path stays within DEV_ROOT."""
    clean = rel_path.strip().lstrip("/")
    target = (DEV_ROOT / clean).resolve()
    try:
        target.relative_to(DEV_ROOT)
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied: path outside root directory")
    return target

def get_rel_path(p: Path) -> str:
    """Returns path relative to DEV_ROOT."""
    try:
        return str(p.relative_to(DEV_ROOT))
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
            # Clean title of markdown formatting for slug
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
    return {"status": "ok", "root": str(DEV_ROOT), "timestamp": datetime.now(timezone.utc).isoformat()}

@app.get("/api/browse")
def browse_directory(path: str = Query("", description="Relative path from DEV_ROOT")):
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
                    # show hidden dotfiles except heavy internal ones
                    pass
                
                is_directory = entry.is_dir(follow_symlinks=False)
                entry_path = Path(entry.path)
                rel = get_rel_path(entry_path)
                ext = entry_path.suffix.lower()
                
                # Check for compound extensions like .lab.md
                if entry.name.endswith(".lab.md"):
                    ext = ".lab.md"

                stat = entry.stat()
                items.append({
                    "name": entry.name,
                    "path": rel,
                    "is_dir": is_directory,
                    "extension": ext if not is_directory else None,
                    "is_markdown": ext in MD_EXTENSIONS,
                    "size_bytes": stat.st_size if not is_directory else None,
                    "modified_time": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                })
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
    parent_rel = get_rel_path(target_dir.parent) if target_dir != DEV_ROOT else None

    # Calculate breadcrumb components
    breadcrumbs = [{"name": "dev", "path": ""}]
    if rel_current and rel_current != ".":
        accum = ""
        for seg in rel_current.split(os.sep):
            accum = f"{accum}/{seg}" if accum else seg
            breadcrumbs.append({"name": seg, "path": accum})

    return {
        "current_path": rel_current if rel_current != "." else "",
        "parent_path": parent_rel if parent_rel != "." else "",
        "is_root": target_dir == DEV_ROOT,
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

    breadcrumbs = [{"name": "dev", "path": ""}]
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
    """Full-text and filename search across files in DEV_ROOT."""
    query = q.lower()
    results = []
    
    for root, dirs, files in os.walk(DEV_ROOT):
        # Prune ignored directories in-place
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS and not d.startswith(".")]
        
        for file in files:
            if file.startswith("."):
                continue
                
            file_path = Path(root) / file
            f_ext = file_path.suffix.lower()
            
            if ext_filter == "md" and f_ext not in MD_EXTENSIONS:
                continue
                
            rel = get_rel_path(file_path)
            
            # Check filename match
            file_match = query in file.lower() or query in rel.lower()
            matched_snippets = []
            
            try:
                # Limit content scan to first 250KB for speed
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
        "total_matches": len(results),
        "results": results
    }

@app.get("/api/stats")
def get_stats():
    """Returns repository stats for markdown documentation."""
    total_md = 0
    total_dirs = 0
    recent_files = []
    
    for root, dirs, files in os.walk(DEV_ROOT):
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
        "root": str(DEV_ROOT),
        "total_markdown_files": total_md,
        "total_directories": total_dirs,
        "recent_files": top_recent
    }

# Mount static frontend if built
if DIST_DIR.exists() and (DIST_DIR / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_target = DIST_DIR / full_path
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
            <p>API endpoints available at <a style="color:#a6e3a1" href="/api/stats">/api/stats</a>, <a style="color:#a6e3a1" href="/api/browse">/api/browse</a>, and <a style="color:#a6e3a1" href="/api/search?q=elevate">/api/search</a>.</p>
            </body>
            </html>"""
        )

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    print(f"🌟 Starting Local Markdown Explorer server on http://{host}:{port}")
    print(f"📁 Browsing Root Directory: {DEV_ROOT}")
    uvicorn.run("server:app", host=host, port=port, reload=True)
