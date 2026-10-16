import tempfile
import time
import unittest
from pathlib import Path
import sqlite3
from unittest.mock import Mock, patch

from companion import Companion
from documents import DocumentIndex


class BoolValue:
    def __init__(self):
        self.value = False

    def set(self, value):
        self.value = value

    def get(self):
        return self.value


class ReleaseGrantTests(unittest.TestCase):
    def app(self, root):
        app = object.__new__(Companion)
        app.root = root
        app.current = None
        app.documents = DocumentIndex(root, root / 'documents.sqlite')
        app.release_grant = None
        app.release_for_task = BoolValue()
        return app

    @staticmethod
    def request(**values):
        return {'task_id': 'task-1', 'request_id': 'request-1', 'operation': 'search', 'query': 'forecast',
                'recipient': {'role': 'steward', 'provider': 'openai', 'model': 'small'}, **values}

    def test_grant_is_task_and_recipient_bound_and_expires(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            app = self.app(root)
            try:
                request = self.request()
                self.assertTrue(app.activate_release_grant(request))
                self.assertTrue(app.grant_matches(request))
                self.assertFalse(app.grant_matches(self.request(task_id='other-task')))
                self.assertIsNotNone(app.release_grant)
                self.assertFalse(app.grant_matches(self.request(recipient={'role': 'steward', 'provider': 'openai', 'model': 'large'})))
                self.assertIsNone(app.release_grant)
                self.assertTrue(app.activate_release_grant(request))
                app.release_grant['expires'] = time.monotonic() - 1
                self.assertFalse(app.grant_matches(request))
                self.assertIsNone(app.release_grant)
            finally:
                app.documents.close()

    def test_source_change_revokes_before_auto_release(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'brief.txt'
            source.write_text('old forecast')
            app = self.app(root)
            try:
                app.documents.refresh()
                request = self.request()
                self.assertTrue(app.activate_release_grant(request))
                source.write_text('new forecast')
                self.assertIsNone(app.prepare_granted_result(request))
                self.assertIsNone(app.release_grant)
            finally:
                app.documents.close()

    def test_unchanged_source_prepares_result_within_same_grant(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'brief.txt').write_text('forecast remains stable')
            app = self.app(root)
            try:
                app.documents.refresh()
                request = self.request()
                app.activate_release_grant(request)
                follow_up = self.request(request_id='request-2')
                result = app.prepare_granted_result(follow_up)
                self.assertIn('forecast remains stable', result)
                self.assertIsNotNone(app.release_grant)
                self.assertLessEqual(len(result), 12000)
            finally:
                app.documents.close()

    def test_cloud_harness_endpoint_is_bound_to_the_local_grant(self):
        first = self.request(recipient={'role': 'steward', 'provider': 'codex', 'model': 'configured', 'harnessUrl': 'https://first.example'})
        changed = self.request(recipient={'role': 'steward', 'provider': 'codex', 'model': 'configured', 'harnessUrl': 'https://second.example'})
        self.assertNotEqual(Companion.recipient_hash(first), Companion.recipient_hash(changed))
        self.assertIsNone(Companion.recipient_hash(self.request(recipient={'role': 'steward', 'provider': 'codex', 'model': 'configured'})))

    def test_recipient_hash_requires_provider_model_and_role(self):
        self.assertIsNone(Companion.recipient_hash({'recipient': {'role': 'steward', 'provider': 'openai'}}))
        self.assertIsNotNone(Companion.recipient_hash(self.request()))

    def test_initial_release_stays_one_time_unless_checkbox_is_selected(self):
        for selected in (False, True):
            with self.subTest(selected=selected), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                app = object.__new__(Companion)
                app.root = root
                app.current = self.request()
                app.known = set()
                app.release_grant = None
                app.release_for_task = BoolValue()
                app.release_for_task.set(selected)
                app.documents = DocumentIndex(root, root / 'documents.sqlite')
                app.db = sqlite3.connect(':memory:')
                app.db.execute('CREATE TABLE ledger(request TEXT PRIMARY KEY,task TEXT,result TEXT,approved INTEGER,created REAL,sent INTEGER DEFAULT 0)')
                app.output, app.send, app.status = Mock(), Mock(), Mock()
                app.window = Mock()
                app.output.get.return_value = '{"matches": []}'
                try:
                    with patch('companion.messagebox.askyesno', return_value=True):
                        app.respond(True)
                    self.assertEqual(app.release_grant is not None, selected)
                    self.assertEqual(app.db.execute('SELECT approved,result FROM ledger').fetchone(), (1, '{"matches": []}'))
                finally:
                    app.documents.close()
                    app.db.close()


if __name__ == '__main__':
    unittest.main()
