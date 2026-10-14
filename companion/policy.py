"""Local retrieval policy. No network calls, model decisions, or file writes."""
import json
import re
from pathlib import Path

TEXT_TYPES = {'.txt', '.md', '.csv', '.json', '.py', '.js', '.ts', '.yaml', '.yml'}
MAX_FILE = 256_000

def selected_path(root, relative):
    root = Path(root).resolve(strict=True)
    requested = Path(str(relative))
    if requested.is_absolute() or requested.anchor or '..' in requested.parts:
        raise ValueError('Path is outside the selected folder.')
    result = (root / requested).resolve(strict=True)
    if not result.is_relative_to(root):
        raise ValueError('Resolved path leaves the selected folder.')
    if any(part.startswith('.') for part in requested.parts):
        raise ValueError('Hidden files are excluded.')
    return result

def readable(root, path):
    resolved = selected_path(root, path.relative_to(root))
    if not resolved.is_file() or resolved.suffix.lower() not in TEXT_TYPES:
        raise ValueError('Only supported text files can be read.')
    if resolved.stat().st_size > MAX_FILE:
        raise ValueError('File exceeds the local retrieval limit.')
    return resolved.read_text(encoding='utf-8', errors='replace')

def collect(root, request, index=None):
    if index is not None:
        return index.collect(request)
    root = Path(root).resolve(strict=True)
    operation = request.get('operation')
    if operation == 'read':
        return readable(root, selected_path(root, request.get('path', '')))[:8000]
    files = []
    # ponytail: scan at most 500 files per request; use an incremental SQLite index for larger folders.
    for path in root.rglob('*'):
        if len(files) >= 500:
            break
        if path.is_file() and path.suffix.lower() in TEXT_TYPES:
            try:
                selected_path(root, path.relative_to(root))
                files.append(path)
            except (ValueError, OSError):
                continue
    if operation == 'aggregate':
        return json.dumps({'supported_text_files': len(files), 'scan_limit': 500})
    if operation != 'search':
        raise ValueError('Operation is not permitted.')
    query = str(request.get('query', '')).strip().lower()
    if not query or len(query) > 1000:
        raise ValueError('A bounded search query is required.')
    hits = []
    for path in files:
        try:
            content = readable(root, path)
        except (ValueError, OSError):
            continue
        for line in content.splitlines():
            if query in line.lower() or query in path.name.lower():
                hits.append({'file': str(path.relative_to(root)), 'excerpt': line[:500]})
                break
        if len(hits) >= 12:
            break
    return json.dumps({'matches': hits, 'note': 'Bounded search; zero hits does not establish absence.'}, ensure_ascii=False)[:8000]

def minimize(content):
    content = re.sub(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?(?:-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|$)', '[private key withheld]', content)
    content = re.sub(r'\b(?:sk-(?:or-v1-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|(?:AKIA|ASIA)[A-Z0-9]{16})\b', '[credential withheld]', content)
    content = re.sub(r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}', '[email withheld]', content)
    content = re.sub(r'(?im)^.*(?:api[_ -]?key|password|secret|access[_ -]?token)\s*[:=].*$', '[credential line withheld]', content)
    return content[:8000]
