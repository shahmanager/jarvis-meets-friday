"""Bounded, local-only document extraction and SQLite FTS retrieval."""
import hashlib
import base64
import json
import os
import re
import sqlite3
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
import zipfile
from io import BytesIO
from pathlib import Path

from policy import MAX_FILE, TEXT_TYPES, selected_path

DOCX_MAX_FILE = 5_000_000
DOCX_MAX_EXPANDED = 10_000_000
PDF_MAX_FILE = 5_000_000
PDF_MAX_PAGES = 100
MAX_EXTRACTED_TEXT = 2_000_000
PARSER_TIMEOUT = 20
PARSER_MEMORY = 512 * 1024 * 1024
MAX_SOURCES = 500
MAX_SCAN_BYTES = 50_000_000
MAX_INDEX_TEXT = 20_000_000
MAX_CHUNKS = 5000
SUPPORTED = TEXT_TYPES | {'.docx', '.pdf'}


def _paragraphs(content):
    # Keep each indexed row and returned excerpt small, including for minified files.
    out = []
    for paragraph_number, paragraph in enumerate(re.split(r'\n\s*\n', content), 1):
        paragraph = paragraph.strip()
        for offset in range(0, len(paragraph), 1800):
            part = paragraph[offset:offset + 1800]
            if part:
                location = f'paragraph {paragraph_number}'
                if offset:
                    location += f', part {offset // 1800 + 1}'
                out.append((location, part))
                if len(out) >= MAX_CHUNKS:
                    return out
    return out


def extract(path, data):
    suffix = path.suffix.lower()
    if suffix in TEXT_TYPES:
        if len(data) > MAX_FILE:
            raise ValueError('File exceeds the local retrieval limit.')
        return 'utf-8', _paragraphs(data.decode('utf-8', errors='replace'))
    max_size = DOCX_MAX_FILE if suffix == '.docx' else PDF_MAX_FILE if suffix == '.pdf' else 0
    if not max_size:
        raise ValueError('File type is not supported for local indexing.')
    if len(data) > max_size:
        raise ValueError(f'{suffix[1:].upper()} exceeds the local retrieval limit.')
    request = json.dumps({'name': path.name, 'data': base64.b64encode(data).decode('ascii')})
    try:
        result = subprocess.run([sys.executable, str(Path(__file__).resolve()), '--extract'],
                                input=request, text=True, encoding='utf-8',
                                stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                timeout=PARSER_TIMEOUT, check=False)
    except subprocess.TimeoutExpired as error:
        raise ValueError(f'Document parser exceeded the {PARSER_TIMEOUT}-second limit.') from error
    except OSError as error:
        raise ValueError('Document parser could not be started.') from error
    if result.returncode != 0 or len(result.stdout) > 12_000_000:
        raise ValueError('Document parser exceeded its memory or output limit.')
    try:
        parsed = json.loads(result.stdout)
    except (json.JSONDecodeError, TypeError) as error:
        raise ValueError('Document parser returned an invalid result.') from error
    if 'error' in parsed:
        raise ValueError(str(parsed['error'])[:300])
    return parsed['parser'], [tuple(chunk) for chunk in parsed['chunks']]


def _limit_parser():
    try:
        import resource
        limit = PARSER_MEMORY
        current = resource.getrlimit(resource.RLIMIT_AS)
        if current[1] != resource.RLIM_INFINITY:
            limit = min(limit, current[1])
        resource.setrlimit(resource.RLIMIT_AS, (limit, limit))
        resource.setrlimit(resource.RLIMIT_CPU, (15, 18))
    except (ImportError, OSError, ValueError):
        pass


def _extract_local(path, data):
    suffix = path.suffix.lower()
    if suffix == '.docx':
        try:
            with zipfile.ZipFile(BytesIO(data)) as archive:
                entries = archive.infolist()
                if len(entries) > 500 or sum(item.file_size for item in entries) > DOCX_MAX_EXPANDED:
                    raise ValueError('DOCX archive exceeds the local expansion limit.')
                document = archive.getinfo('word/document.xml')
                if document.file_size > DOCX_MAX_EXPANDED:
                    raise ValueError('DOCX document XML exceeds the local expansion limit.')
                xml = ET.fromstring(archive.read(document))
        except (KeyError, zipfile.BadZipFile, ET.ParseError, OSError) as error:
            raise ValueError('DOCX could not be read safely.') from error
        namespace = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
        paragraphs = []
        total = 0
        truncated = False
        for number, node in enumerate(xml.iter(namespace + 'p'), 1):
            text = ''.join(part.text or '' for part in node.iter(namespace + 't')).strip()
            if text:
                for _, part in _paragraphs(text):
                    part = part[:MAX_EXTRACTED_TEXT - total]
                    if not part:
                        break
                    paragraphs.append((f'paragraph {number}', part))
                    total += len(part)
            if len(paragraphs) >= MAX_CHUNKS:
                break
            if total >= MAX_EXTRACTED_TEXT:
                truncated = True
                break
        return ('docx-stdlib/truncated' if truncated else 'docx-stdlib'), paragraphs[:MAX_CHUNKS]
    if suffix == '.pdf':
        try:
            from pypdf import PdfReader
        except ImportError as error:
            raise ValueError('PDF indexing needs pypdf. Install it locally with: python -m pip install pypdf') from error
        try:
            reader = PdfReader(BytesIO(data), strict=False)
            if reader.is_encrypted:
                raise ValueError('Encrypted PDFs are not indexed.')
            if len(reader.pages) > PDF_MAX_PAGES:
                raise ValueError('PDF exceeds the 100-page local retrieval limit.')
            pages = []
            total = 0
            for number, page in enumerate(reader.pages, 1):
                text = (page.extract_text() or '')[:50_000]
                total += len(text)
                if total > 2_000_000:
                    raise ValueError('PDF extracted text exceeds the local retrieval limit.')
                pages.extend((f'page {number}', part) for _, part in _paragraphs(text))
            return 'pypdf', pages[:MAX_CHUNKS]
        except (ValueError, OSError):
            raise
        except Exception as error:
            raise ValueError('PDF could not be read.') from error
    raise ValueError('File type is not supported for local indexing.')


def _extract_cli():
    _limit_parser()
    try:
        payload = json.load(sys.stdin)
        data = base64.b64decode(payload['data'], validate=True)
        parser, chunks = _extract_local(Path(payload['name']), data)
        print(json.dumps({'parser': parser, 'chunks': chunks}, ensure_ascii=False))
    except Exception as error:
        print(json.dumps({'error': str(error)[:300]}))


if __name__ == '__main__' and sys.argv[1:] == ['--extract']:
    _extract_cli()


class DocumentIndex:
    def __init__(self, root, database):
        self.root = Path(root).resolve(strict=True)
        database = Path(database)
        self.db = sqlite3.connect(database)
        if os.name != 'nt':
            database.chmod(0o600)
        self.db.execute('PRAGMA foreign_keys=ON')
        self.db.executescript('''
            CREATE TABLE IF NOT EXISTS index_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS sources(
                path TEXT PRIMARY KEY, content_hash TEXT NOT NULL, modified_ns INTEGER NOT NULL,
                size INTEGER NOT NULL, parser TEXT NOT NULL, indexed_at REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS chunks(
                id INTEGER PRIMARY KEY, path TEXT NOT NULL REFERENCES sources(path) ON DELETE CASCADE,
                location TEXT NOT NULL, content TEXT NOT NULL, content_hash TEXT NOT NULL);
            CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
                content, path UNINDEXED, location UNINDEXED, tokenize='unicode61');
        ''')
        root_hash = hashlib.sha256(str(self.root).encode()).hexdigest()
        previous = self.db.execute("SELECT value FROM index_meta WHERE key='root' ").fetchone()
        if previous and previous[0] != root_hash:
            with self.db:
                self.db.execute('DELETE FROM chunks_fts')
                self.db.execute('DELETE FROM chunks')
                self.db.execute('DELETE FROM sources')
                self.db.execute("INSERT INTO index_meta(key,value) VALUES('enabled','1') ON CONFLICT(key) DO UPDATE SET value='1'")
        self.db.execute("INSERT INTO index_meta(key,value) VALUES('root',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (root_hash,))
        self.db.execute("INSERT OR IGNORE INTO index_meta(key,value) VALUES('enabled','1')")
        self.db.commit()
        self.enabled = self.db.execute("SELECT value FROM index_meta WHERE key='enabled'").fetchone()[0] == '1'

    def close(self):
        self.db.close()

    def set_root(self, root):
        selected = Path(root).resolve(strict=True)
        if not selected.is_dir():
            raise ValueError('Select a folder.')
        if selected != self.root:
            with self.db:
                self.db.execute('DELETE FROM chunks_fts')
                self.db.execute('DELETE FROM chunks')
                self.db.execute('DELETE FROM sources')
                self.db.execute("UPDATE index_meta SET value=? WHERE key='root'", (hashlib.sha256(str(selected).encode()).hexdigest(),))
                self.db.execute("UPDATE index_meta SET value='1' WHERE key='enabled'")
            self.enabled = True
            self.root = selected

    def clear(self):
        with self.db:
            self.db.execute('DELETE FROM chunks_fts')
            self.db.execute('DELETE FROM chunks')
            self.db.execute('DELETE FROM sources')
            self.db.execute("UPDATE index_meta SET value='0' WHERE key='enabled'")
        self.enabled = False

    def _drop(self, relative):
        ids = [row[0] for row in self.db.execute('SELECT id FROM chunks WHERE path=?', (relative,))]
        self.db.executemany('DELETE FROM chunks_fts WHERE rowid=?', ((item,) for item in ids))
        self.db.execute('DELETE FROM sources WHERE path=?', (relative,))

    def forget(self, relative):
        selected_path(self.root, relative)
        with self.db:
            self._drop(str(Path(relative)))

    def refresh(self):
        if not self.enabled:
            return {'sources': 0, 'chunks': 0, 'changed': 0, 'scan_limit': MAX_SOURCES,
                    'truncated': False, 'disabled': True, 'skipped': 0, 'errors': []}
        candidates = []
        for path in self.root.rglob('*'):
            if len(candidates) >= MAX_SOURCES:
                break
            if path.is_symlink() or not path.is_file() or path.suffix.lower() not in SUPPORTED:
                continue
            try:
                resolved = selected_path(self.root, path.relative_to(self.root))
                candidates.append((resolved, str(path.relative_to(self.root))))
            except (ValueError, OSError):
                continue
        seen = set()
        errors = []
        changed = 0
        skipped = 0
        truncated = len(candidates) >= MAX_SOURCES
        scanned_bytes = 0
        indexed_chars = 0
        with self.db:
            for path, relative in candidates:
                seen.add(relative)
                try:
                    if indexed_chars >= MAX_INDEX_TEXT:
                        truncated = True
                        seen.discard(relative)
                        break
                    max_size = DOCX_MAX_FILE if path.suffix.lower() == '.docx' else PDF_MAX_FILE if path.suffix.lower() == '.pdf' else MAX_FILE
                    stat = path.stat()
                    if stat.st_size > max_size:
                        raise ValueError('File exceeds its local retrieval limit.')
                    if scanned_bytes + stat.st_size > MAX_SCAN_BYTES:
                        truncated = True
                        seen.discard(relative)
                        continue
                    scanned_bytes += stat.st_size
                    data = path.read_bytes()
                    digest = hashlib.sha256(data).hexdigest()
                    existing = self.db.execute('SELECT content_hash FROM sources WHERE path=?', (relative,)).fetchone()
                    if existing and existing[0] == digest:
                        self.db.execute('UPDATE sources SET modified_ns=?,size=? WHERE path=?', (stat.st_mtime_ns, stat.st_size, relative))
                        indexed_chars += sum(len(row[0]) for row in self.db.execute('SELECT content FROM chunks WHERE path=?', (relative,)))
                        continue
                    parser, chunks = extract(path, data)
                    if parser.endswith('/truncated'):
                        truncated = True
                    available = max(0, MAX_INDEX_TEXT - indexed_chars)
                    bounded = []
                    for location, content in chunks:
                        if available <= 0:
                            truncated = True
                            break
                        bounded.append((location, content[:available]))
                        available -= len(bounded[-1][1])
                    if len(bounded) < len(chunks):
                        truncated = True
                    chunks = bounded
                    indexed_chars += sum(len(content) for _, content in chunks)
                    self._drop(relative)
                    self.db.execute('INSERT INTO sources VALUES(?,?,?,?,?,?)',
                                    (relative, digest, stat.st_mtime_ns, stat.st_size, parser, time.time()))
                    for location, content in chunks:
                        cursor = self.db.execute('INSERT INTO chunks(path,location,content,content_hash) VALUES(?,?,?,?)',
                                                 (relative, location, content, hashlib.sha256(content.encode()).hexdigest()))
                        self.db.execute('INSERT INTO chunks_fts(rowid,content,path,location) VALUES(?,?,?,?)',
                                        (cursor.lastrowid, content, relative, location))
                    changed += 1
                except (OSError, ValueError) as error:
                    self._drop(relative)
                    errors.append(f'{relative}: {error}')
                    skipped += 1
            # Keep only sources verified in this scan; stale or out-of-budget entries cannot be released.
            for (relative,) in list(self.db.execute('SELECT path FROM sources')):
                if relative not in seen:
                    self._drop(relative)
        return {'sources': self.db.execute('SELECT count(*) FROM sources').fetchone()[0],
                'chunks': self.db.execute('SELECT count(*) FROM chunks').fetchone()[0],
                'changed': changed, 'scan_limit': MAX_SOURCES, 'truncated': truncated,
                'skipped': skipped, 'errors': errors[:20]}

    def sources(self):
        return self.db.execute('SELECT path,content_hash,modified_ns,size,parser,indexed_at FROM sources ORDER BY path').fetchall()

    def _provenance(self, path, digest, modified, size, parser, indexed_at, location):
        return {'source': path, 'content_hash': digest, 'modified_ns': modified, 'size_bytes': size,
                'parser': parser, 'indexed_at': indexed_at, 'location': location}

    @staticmethod
    def _result(hits, scan):
        result = {'matches': hits, 'bounded': True, 'note': 'Bounded local retrieval; zero hits do not establish absence.', 'scan_truncated': scan['truncated'],
                  'skipped_sources': scan['skipped']}
        encoded = json.dumps(result, ensure_ascii=False)
        while len(encoded) > 8000 and result['matches']:
            result['matches'].pop()
            result['result_truncated'] = True
            encoded = json.dumps(result, ensure_ascii=False)
        return encoded

    def collect(self, request):
        operation = request.get('operation')
        if operation not in {'search', 'read', 'aggregate'}:
            raise ValueError('Operation is not permitted.')
        relative = None
        terms = []
        if operation == 'read':
            relative = str(request.get('path', ''))
            try:
                selected_path(self.root, relative)
            except FileNotFoundError as error:
                raise ValueError('Source is no longer available in the selected folder.') from error
        elif operation == 'search':
            query = str(request.get('query', '')).strip()
            if not query or len(query) > 1000:
                raise ValueError('A bounded search query is required.')
            terms = re.findall(r'[^\W_]+', query, flags=re.UNICODE)
            if not terms:
                raise ValueError('Search query needs letters or numbers.')
            if len(terms) > 12:
                raise ValueError('Search query is limited to 12 words.')
        # Recheck source versions and deletions before preparing any release candidate.
        scan = self.refresh()
        if operation == 'aggregate':
            count, chunks = self.db.execute('SELECT count(*),(SELECT count(*) FROM chunks) FROM sources').fetchone()
            return json.dumps({'indexed_sources': count, 'indexed_paragraphs': chunks,
                               'scan_truncated': scan['truncated'],
                               'skipped_sources': scan['skipped']}, ensure_ascii=False)
        if operation == 'read':
            source = self.db.execute('SELECT content_hash,modified_ns,size,parser,indexed_at FROM sources WHERE path=?', (relative,)).fetchone()
            if not source:
                raise ValueError('Source is not indexed. Refresh the local index first.')
            rows = self.db.execute('SELECT location,content FROM chunks WHERE path=? ORDER BY id LIMIT 12', (relative,)).fetchall()
            hits = [{'provenance': self._provenance(relative, *source, location), 'excerpt': content[:700]} for location, content in rows]
            return self._result(hits, scan)
        expression = ' AND '.join('"' + term.replace('"', '""') + '"' for term in terms)
        rows = self.db.execute('''SELECT f.path,f.location,f.content,s.content_hash,s.modified_ns,s.size,s.parser,s.indexed_at
                                  FROM chunks_fts f JOIN sources s ON s.path=f.path
                                  WHERE chunks_fts MATCH ? ORDER BY bm25(chunks_fts) LIMIT 12''', (expression,)).fetchall()
        hits = [{'provenance': self._provenance(path, digest, modified, size, parser, indexed_at, location),
                 'excerpt': content[:700]} for path, location, content, digest, modified, size, parser, indexed_at in rows]
        return self._result(hits, scan)
