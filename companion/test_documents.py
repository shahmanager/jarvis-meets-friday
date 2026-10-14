import sys
import json
import os
import stat
import subprocess
import tempfile
import unittest
import zipfile
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from documents import DocumentIndex, _extract_local, extract


class DocumentIndexTests(unittest.TestCase):
    def test_bounded_results_preserve_complete_json_and_source_provenance(self):
        hits = [{'provenance': {'source': str(n) + '.txt', 'content_hash': 'a' * 64}, 'excerpt': 'quoted "evidence" ' * 60} for n in range(12)]
        result = DocumentIndex._result(hits, {'truncated': False, 'skipped': 0})
        self.assertLessEqual(len(result), 8000)
        parsed = json.loads(result)
        self.assertTrue(parsed['result_truncated'])
        self.assertTrue(parsed['matches'])
        self.assertTrue(all(len(hit['provenance']['content_hash']) == 64 for hit in parsed['matches']))
    def test_index_search_includes_bounded_source_provenance(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'plan.md').write_text('Project forecast\n\nRevenue grows steadily.')
            index = DocumentIndex(root, root / 'index.sqlite')
            try:
                if os.name != 'nt':
                    self.assertEqual(stat.S_IMODE((root / 'index.sqlite').stat().st_mode), 0o600)
                self.assertEqual(index.refresh()['sources'], 1)
                result = index.collect({'operation': 'search', 'query': 'revenue grows'})
                self.assertIn('plan.md', result)
                self.assertIn('content_hash', result)
                self.assertIn('paragraph 2', result)
                self.assertLessEqual(len(result), 8000)
            finally:
                index.close()

    def test_refresh_removes_deleted_source_from_search_and_read(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'private.txt'
            source.write_text('classified forecast')
            index = DocumentIndex(root, root / 'index.sqlite')
            try:
                index.refresh()
                source.unlink()
                search = index.collect({'operation': 'search', 'query': 'classified'})
                self.assertNotIn('classified', search)
                self.assertIn('"scan_truncated": false', search)
                self.assertRaises(ValueError, index.collect, {'operation': 'read', 'path': 'private.txt'})
                self.assertEqual(index.sources(), [])
            finally:
                index.close()

    def test_read_aggregate_and_clear_keep_content_local_until_refresh(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'brief.txt').write_text('private forecast')
            database = root / 'index.sqlite'
            index = DocumentIndex(root, database)
            try:
                index.refresh()
                read = index.collect({'operation': 'read', 'path': 'brief.txt'})
                self.assertIn('private forecast', read)
                self.assertIn('paragraph 1', read)
                aggregate = index.collect({'operation': 'aggregate'})
                self.assertIn('"indexed_sources": 1', aggregate)
                self.assertNotIn('private forecast', aggregate)
                index.clear()
                self.assertNotIn('private forecast', index.collect({'operation': 'search', 'query': 'forecast'}))
                index.close()
                resumed = DocumentIndex(root, database)
                try:
                    self.assertEqual(resumed.refresh()['sources'], 0)
                    self.assertEqual(resumed.sources(), [])
                finally:
                    resumed.close()
            finally:
                if index.db:
                    index.close()

    def test_docx_extraction_uses_stdlib_and_paragraph_locations(self):
        data = BytesIO()
        xml = ('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
               '<w:body><w:p><w:r><w:t>Quarterly forecast</w:t></w:r></w:p></w:body></w:document>')
        with zipfile.ZipFile(data, 'w') as archive:
            archive.writestr('word/document.xml', xml)
        parser, chunks = extract(Path('brief.docx'), data.getvalue())
        self.assertEqual(parser, 'docx-stdlib')
        self.assertEqual(chunks, [('paragraph 1', 'Quarterly forecast')])

    def test_docx_extraction_limit_is_reported(self):
        data = BytesIO()
        xml = ('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
               '<w:body><w:p><w:r><w:t>' + ('a' * 2_000_001) + '</w:t></w:r></w:p></w:body></w:document>')
        with zipfile.ZipFile(data, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr('word/document.xml', xml)
        parser, chunks = extract(Path('brief.docx'), data.getvalue())
        self.assertEqual(parser, 'docx-stdlib/truncated')
        self.assertEqual(sum(len(content) for _, content in chunks), 2_000_000)

    def test_pdf_without_optional_dependency_has_clear_install_guidance(self):
        with patch.dict(sys.modules, {'pypdf': None}):
            with self.assertRaisesRegex(ValueError, 'pip install pypdf'):
                _extract_local(Path('brief.pdf'), b'%PDF-1.4')

    def test_archive_parser_timeout_fails_closed(self):
        with patch('documents.subprocess.run', side_effect=subprocess.TimeoutExpired('parser', 20)):
            with self.assertRaisesRegex(ValueError, '20-second limit'):
                extract(Path('brief.docx'), b'PK')

    def test_external_symlink_is_excluded_during_refresh(self):
        with tempfile.TemporaryDirectory() as directory, tempfile.TemporaryDirectory() as outside:
            root, outside_root = Path(directory), Path(outside)
            (outside_root / 'secret.txt').write_text('outside corpus')
            try:
                (root / 'linked.txt').symlink_to(outside_root / 'secret.txt')
            except OSError:
                self.skipTest('Symlink creation is unavailable on this platform.')
            index = DocumentIndex(root, root / 'index.sqlite')
            try:
                self.assertEqual(index.refresh()['sources'], 0)
                self.assertIn('"matches": []', index.collect({'operation': 'search', 'query': 'outside'}))
            finally:
                index.close()


if __name__ == '__main__':
    unittest.main()
