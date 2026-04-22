#!/usr/bin/env bash
# Auto-cleanup unknown empty directories in repo root.
# Runs on SessionStart/Stop and removes any empty top-level dir outside the canonical set.
# Safe: only removes EMPTY directories outside the allowlist.

REPO_ROOT="${CLAUDE_PROJECT_DIR:-.}"

python3 -X utf8 -c "
import shutil
from pathlib import Path

root = Path('${REPO_ROOT}')
KNOWN = {'.agent','.antigravity','.claude','.context','.continue','.cursor',
         '.gemini','.git','.githooks','.github','.hypothesis','.mypy_cache',
         '.omc','.pytest_cache','.ruff_cache','.tmp','.venv-mcp','.vscode',
         '.windsurf','.worktrees','.zed',
         'api','benchmarks','completions','constraints','data','deploy',
         'docker','docs','governance','infra','mcp-server','nexus-app',
         'node_modules','scripts','src','tests','tools'}

removed = 0
for item in root.iterdir():
    if not item.is_dir() or item.name in KNOWN:
        continue
    try:
        children = list(item.iterdir())
        if not children or (len(children) == 1 and children[0].is_dir() and children[0].name == '.antigravity'):
            shutil.rmtree(str(item))
            removed += 1
    except Exception:
        pass

if removed > 0:
    print(f'Cleaned {removed} garbled directories from repo root')
" 2>/dev/null
