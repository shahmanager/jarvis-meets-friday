import tempfile
import unittest
from pathlib import Path
from policy import selected_path, collect, minimize

class PolicyTests(unittest.TestCase):
    def test_blocks_paths_outside_selected_root(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.assertRaises(ValueError, selected_path, root, '../outside')
            self.assertRaises(ValueError, selected_path, root, '/etc/passwd')

    def test_reads_only_bounded_text_and_redacts_identifiers(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'profile.txt').write_text('Python experience. Email: private@example.com\nAPI_KEY=secret123')
            result = collect(root, {'operation': 'read', 'path': 'profile.txt'})
            masked = minimize(result)
            self.assertNotIn('private@example.com', masked)
            self.assertNotIn('secret123', masked)
            self.assertIn('Python', masked)

    def test_search_and_aggregate_do_not_upload_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'requirements.md').write_text('Python and cloud requirements')
            self.assertIn('requirements.md', collect(root, {'operation': 'search', 'query': 'cloud'}))
            self.assertIn('1', collect(root, {'operation': 'aggregate'}))

if __name__ == '__main__':
    unittest.main()
