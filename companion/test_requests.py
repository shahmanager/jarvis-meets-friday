import queue
import threading
import sqlite3
import unittest
from unittest.mock import Mock
from companion import Companion

class RequestTests(unittest.TestCase):
    def app(self, kind, value):
        app = object.__new__(Companion)
        app.messages = queue.Queue()
        app.messages.put((kind, value))
        app.current = {'request_id': 'new-request'}
        app.output, app.status, app.db = Mock(), Mock(), Mock()
        app.stop_event = threading.Event()
        app.stop_event.set()
        app.drain()
        return app

    def test_old_model_answer_cannot_replace_new_request(self):
        app = self.app('candidate', ('old-request', 'old private context'))
        app.output.insert.assert_not_called()
        self.assertEqual(app.current['request_id'], 'new-request')

    def test_old_delivery_receipt_cannot_clear_new_request(self):
        app = self.app('sent', 'old-request')
        app.output.delete.assert_not_called()
        self.assertEqual(app.current['request_id'], 'new-request')

    def test_current_model_answer_is_shown_for_review(self):
        app = self.app('candidate', ('new-request', 'minimal answer'))
        app.output.insert.assert_called_once_with('1.0', 'minimal answer')

    def test_duplicate_response_is_not_sent_while_delivery_is_pending(self):
        app = object.__new__(Companion)
        app.current = {'request_id': 'request', 'task_id': 'task'}
        app.known = {'request'}
        app.db = Mock()
        app.respond(False)
        app.db.execute.assert_not_called()

    def test_declining_after_failed_delivery_replaces_the_cached_release(self):
        app = object.__new__(Companion)
        app.current = {'request_id': 'request', 'task_id': 'task'}
        app.known = set()
        app.db = sqlite3.connect(':memory:')
        app.db.execute('CREATE TABLE ledger(request TEXT PRIMARY KEY,task TEXT,result TEXT,approved INTEGER,created REAL,sent INTEGER DEFAULT 0)')
        app.db.execute("INSERT INTO ledger VALUES('request','task','previous approved text',1,0,0)")
        app.send, app.status = Mock(), Mock()
        app.respond(False)
        self.assertEqual(app.db.execute('SELECT result,approved FROM ledger').fetchone(), ('', 0))
        app.send.assert_called_once_with(app.current, '', False)
        app.db.close()

if __name__ == '__main__':
    unittest.main()
