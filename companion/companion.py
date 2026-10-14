"""Native companion. Python standard library only; outbound TLS and explicit release review."""
import argparse
import base64
import ctypes
import hashlib
import json
import os
import queue
import sqlite3
import threading
import time
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, simpledialog, ttk
from urllib.error import HTTPError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from policy import collect, minimize
from documents import DocumentIndex

class API:
    def __init__(self, url, token=''):
        self.url, self.token = url.rstrip('/'), token
        parsed = urlparse(self.url)
        if parsed.scheme != 'https' and not (parsed.scheme == 'http' and parsed.hostname in {'localhost', '127.0.0.1'}):
            raise ValueError('Use HTTPS, or localhost for development.')

    def call(self, path, data=None):
        headers = {'Authorization': 'Bearer ' + self.token}
        if data is not None:
            headers['Content-Type'] = 'application/json'
        request = Request(self.url + '/api/device/' + path, data=json.dumps(data).encode() if data is not None else None, headers=headers)
        try:
            with urlopen(request, timeout=100) as response:
                payload = response.read(1_000_001)
                if len(payload) > 1_000_000:
                    raise ValueError('Server response too large.')
                return json.loads(payload)
        except HTTPError as error:
            try:
                detail = json.loads(error.read(10000)).get('error', 'Server rejected the request.')
            except Exception:
                detail = 'Server rejected the request.'
            raise RuntimeError(detail) from None

def protect(data, decrypt=False):
    if os.name != 'nt':
        return data
    class Blob(ctypes.Structure):
        _fields_ = [('size', ctypes.c_ulong), ('data', ctypes.POINTER(ctypes.c_ubyte))]
    buffer = ctypes.create_string_buffer(data)
    incoming = Blob(len(data), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_ubyte)))
    outgoing = Blob()
    operation = ctypes.windll.crypt32.CryptUnprotectData if decrypt else ctypes.windll.crypt32.CryptProtectData
    if not operation(ctypes.byref(incoming), None, None, None, None, 0, ctypes.byref(outgoing)):
        raise RuntimeError('Windows credential protection failed.')
    try:
        return ctypes.string_at(outgoing.data, outgoing.size)
    finally:
        ctypes.windll.kernel32.LocalFree(outgoing.data)

class Companion:
    def __init__(self, args):
        self.root = Path(args.root).resolve(strict=True)
        if not self.root.is_dir():
            raise ValueError('Select a folder.')
        self.window = tk.Tk()
        self.window.title('Relay · Local companion')
        self.window.geometry('760x640')
        self.window.protocol('WM_DELETE_WINDOW', self.close)
        self.state = Path(args.state).resolve()
        self.state.mkdir(parents=True, exist_ok=True)
        if os.name != 'nt':
            self.state.chmod(0o700)
        self.api = API(args.url)
        credential = self.state / 'device.json'
        if credential.exists():
            saved = json.loads(credential.read_text())
            if saved['url'] == self.api.url:
                self.api.token = protect(base64.b64decode(saved['credential']), decrypt=True).decode()
        if not self.api.token:
            code = args.pair_code or simpledialog.askstring('Pair device', 'Enter the pairing code from Relay → Local companion:', parent=self.window)
            if not code:
                raise ValueError('Pairing cancelled.')
            response = self.api.call('pair', {'code': code.strip(), 'name': args.name})
            self.api.token = response['token']
            credential.write_text(json.dumps({'url': self.api.url, 'credential': base64.b64encode(protect(self.api.token.encode())).decode()}))
            if os.name != 'nt':
                credential.chmod(0o600)
        self.db = sqlite3.connect(self.state / 'ledger.sqlite')
        if os.name != 'nt':
            (self.state / 'ledger.sqlite').chmod(0o600)
        self.db.execute('CREATE TABLE IF NOT EXISTS ledger(request TEXT PRIMARY KEY,task TEXT,result TEXT,approved INTEGER,created REAL,sent INTEGER DEFAULT 0)')
        self.db.commit()
        self.documents = DocumentIndex(self.root, self.state / 'documents.sqlite')
        self.index_status = self.documents.refresh()
        self.messages = queue.Queue()
        self.stop_event = threading.Event()
        self.current = None
        self.known = set()
        self.release_grant = None
        self.status = tk.StringVar(value='Connecting…')
        self.request_label = tk.StringVar(value='No pending requests. Your files remain local.')
        self.release_for_task = tk.BooleanVar(value=False)
        self.build_ui()
        threading.Thread(target=self.poll, daemon=True).start()
        self.window.after(200, self.drain)

    def build_ui(self):
        frame = ttk.Frame(self.window, padding=24)
        frame.pack(fill='both', expand=True)
        ttk.Label(frame, text='Relay local companion', font=('Segoe UI', 20, 'bold')).pack(anchor='w')
        self.root_label = ttk.Label(frame, text=str(self.root), wraplength=700)
        self.root_label.pack(anchor='w', pady=(8, 4))
        ttk.Label(frame, textvariable=self.status).pack(anchor='w')
        index_controls = ttk.Frame(frame)
        index_controls.pack(fill='x', pady=(12, 4))
        ttk.Button(index_controls, text='Choose folder', command=self.choose_folder).pack(side='left')
        ttk.Button(index_controls, text='Refresh local index', command=self.refresh_index).pack(side='left', padx=8)
        ttk.Button(index_controls, text='Clear local index', command=self.clear_index).pack(side='left')
        ttk.Label(frame, text='Local document index · stored on this device').pack(anchor='w')
        self.sources = tk.Listbox(frame, height=4, exportselection=False)
        self.sources.pack(fill='x', pady=(3, 8))
        self.update_sources()
        ttk.Separator(frame).pack(fill='x', pady=18)
        ttk.Label(frame, textvariable=self.request_label, wraplength=700).pack(anchor='w')
        ttk.Label(frame, text='Review and edit the exact information to release. Nothing below is sent automatically. Only reviewed excerpts leave this device.', wraplength=700).pack(anchor='w', pady=10)
        self.output = tk.Text(frame, height=18, wrap='word', font=('Consolas', 10))
        self.output.pack(fill='both', expand=True)
        buttons = ttk.Frame(frame)
        buttons.pack(fill='x', pady=14)
        ttk.Button(buttons, text='Release reviewed information', command=lambda: self.respond(True)).pack(side='left')
        ttk.Button(buttons, text='Decline request', command=lambda: self.respond(False)).pack(side='left', padx=10)
        ttk.Button(buttons, text='Ask small model', command=self.steward).pack(side='right')
        self.grant_toggle = ttk.Checkbutton(frame, text='Allow prepared excerpts for THIS TASK for the next 10 minutes',
                                            variable=self.release_for_task, command=self.release_grant_changed)
        self.grant_toggle.pack(anchor='w')
        self.update_grant_control()
        ttk.Label(frame, text='Small-model API: requires a separate confirmation before sending this excerpt to the provider. Regex masking is not a privacy guarantee.', wraplength=700).pack(anchor='w')

    @staticmethod
    def recipient_hash(request):
        recipient = request.get('recipient')
        if not isinstance(recipient, dict):
            return None
        snapshot = {key: recipient.get(key) for key in ('role', 'provider', 'model')}
        if any(not isinstance(value, str) or not value or len(value) > 300 for value in snapshot.values()):
            return None
        return hashlib.sha256(json.dumps(snapshot, sort_keys=True, separators=(',', ':')).encode()).hexdigest()

    def source_manifest(self):
        return tuple((row[0], row[1]) for row in self.documents.sources())

    def revoke_release_grant(self):
        self.release_grant = None
        if hasattr(self, 'release_for_task'):
            self.release_for_task.set(False)
        self.update_grant_control()

    def update_grant_control(self):
        if hasattr(self, 'grant_toggle'):
            self.grant_toggle.configure(state='normal' if self.current or getattr(self, 'release_grant', None) else 'disabled')

    def release_grant_changed(self):
        if not self.release_for_task.get() and self.release_grant:
            self.revoke_release_grant()
            self.status.set('Task-scoped release grant revoked.')
        elif self.release_for_task.get():
            self.status.set('The grant will start only after you release this reviewed result.')

    def grant_matches(self, request):
        grant = self.release_grant
        if not grant:
            return False
        if time.monotonic() >= grant['expires'] or grant['root'] != str(self.documents.root):
            self.revoke_release_grant()
            return False
        if request.get('task_id') != grant['task_id']:
            return False
        recipient = self.recipient_hash(request)
        if recipient != grant['recipient_hash']:
            self.revoke_release_grant()
            return False
        return request.get('operation') in {'search', 'read', 'aggregate'}

    def activate_release_grant(self, request):
        recipient = self.recipient_hash(request)
        if not recipient or request.get('operation') not in {'search', 'read', 'aggregate'}:
            self.revoke_release_grant()
            return False
        self.release_grant = {'task_id': request['task_id'], 'recipient_hash': recipient,
                              'root': str(self.documents.root), 'manifest': self.source_manifest(),
                              'expires': time.monotonic() + 600}
        self.release_for_task.set(True)
        self.update_grant_control()
        return True

    def prepare_granted_result(self, request):
        if not self.grant_matches(request):
            return None
        try:
            candidate = minimize(collect(self.root, request, self.documents))[:12000]
        except Exception:
            self.revoke_release_grant()
            return None
        try:
            unchanged = self.grant_matches(request) and self.source_manifest() == self.release_grant['manifest']
        except Exception:
            unchanged = False
        if not unchanged:
            self.revoke_release_grant()
            return None
        return candidate

    def update_sources(self):
        self.sources.delete(0, 'end')
        for path, *_ in self.documents.sources():
            self.sources.insert('end', path)

    def refresh_index(self):
        try:
            self.documents.enabled = True
            with self.documents.db:
                self.documents.db.execute("UPDATE index_meta SET value='1' WHERE key='enabled'")
            self.index_status = self.documents.refresh()
            self.update_sources()
            state = self.index_status
            self.status.set(f"Local index ready · {state['sources']} sources · {state['chunks']} paragraphs" +
                            (f" · {len(state['errors'])} skipped" if state['errors'] else '') +
                            (' · scan limit reached' if state['truncated'] else ''))
        except Exception as error:
            self.status.set('Local index refresh failed: ' + str(error))

    def choose_folder(self):
        selected = filedialog.askdirectory(parent=self.window, initialdir=str(self.root), title='Choose the folder Friday may search')
        if selected:
            try:
                if Path(selected).resolve() != self.documents.root:
                    self.revoke_release_grant()
                self.documents.set_root(selected)
                self.root = self.documents.root
                self.root_label.configure(text=str(self.root))
                self.refresh_index()
            except Exception as error:
                messagebox.showerror('Local folder', str(error), parent=self.window)

    def clear_index(self):
        if not messagebox.askyesno('Clear local index', 'Remove all indexed text and source metadata from this device? Source files will stay untouched.', parent=self.window):
            return
        self.documents.clear()
        self.revoke_release_grant()
        self.update_sources()
        self.status.set('Local index cleared. Source files are unchanged.')

    def poll(self):
        while not self.stop_event.is_set():
            try:
                requests = self.api.call('poll')['requests']
                self.messages.put(('requests', requests))
            except Exception as error:
                self.messages.put(('connection_closed', str(error)))
            self.stop_event.wait(4)

    def drain(self):
        grant = getattr(self, 'release_grant', None)
        if grant and time.monotonic() >= grant['expires']:
            self.revoke_release_grant()
            self.status.set('Task-scoped release grant expired.')
        try:
            while True:
                kind, value = self.messages.get_nowait()
                if kind == 'status':
                    self.status.set(value)
                elif kind == 'connection_closed':
                    self.revoke_release_grant()
                    self.status.set('Connection unavailable · task-scoped release grant cleared · ' + value)
                elif kind == 'candidate':
                    request_id, candidate = value
                    if not self.current or self.current['request_id'] != request_id:
                        continue
                    self.output.delete('1.0', 'end')
                    self.output.insert('1.0', candidate)
                    self.status.set('Small-model answer received. Review before release.')
                elif kind == 'sent':
                    self.db.execute('UPDATE ledger SET sent=1 WHERE request=?', (value,))
                    self.db.commit()
                    if not self.current or self.current['request_id'] != value:
                        continue
                    self.current = None
                    self.update_grant_control()
                    self.request_label.set('Response delivered. Waiting for another request.')
                    self.output.delete('1.0', 'end')
                elif kind == 'requests':
                    self.status.set('Connected · read-only selected-folder access')
                    active = {request['request_id'] for request in value}
                    if self.current and self.current['request_id'] not in active:
                        self.current = None
                        self.update_grant_control()
                        self.request_label.set('Request expired or was cancelled. No information released.')
                        self.output.delete('1.0', 'end')
                    if self.current:
                        continue
                    for request in value:
                        receipt = self.db.execute('SELECT result,approved,sent FROM ledger WHERE request=?', (request['request_id'],)).fetchone()
                        if receipt:
                            if not receipt[2] and request['request_id'] not in self.known:
                                self.known.add(request['request_id'])
                                self.send(request, receipt[0], bool(receipt[1]))
                            continue
                        if self.release_grant and request.get('task_id') != self.release_grant['task_id']:
                            self.revoke_release_grant()
                        grant_for_task = self.release_grant and self.release_grant['task_id'] == request.get('task_id')
                        candidate = self.prepare_granted_result(request)
                        if candidate is not None:
                            self.db.execute('INSERT INTO ledger(request,task,result,approved,created) VALUES(?,?,?,?,?) ON CONFLICT(request) DO UPDATE SET result=excluded.result,approved=excluded.approved,created=excluded.created,sent=0',
                                            (request['request_id'], request['task_id'], candidate, 1, time.time()))
                            self.db.commit()
                            self.known.add(request['request_id'])
                            self.send(request, candidate, True)
                            self.status.set('Prepared excerpt released under the active task-scoped grant.')
                            continue
                        if grant_for_task and self.release_grant is None:
                            self.status.set('Grant unavailable or source versions changed. Review this request before release.')
                        self.current = request
                        self.release_for_task.set(False)
                        self.update_grant_control()
                        recipient = request.get('recipient') or {}
                        target = f"{recipient.get('provider', 'unknown')} / {recipient.get('model', 'unknown')}" if isinstance(recipient, dict) else 'unknown'
                        self.request_label.set(f"{request['operation']} · {request.get('purpose', '')} · recipient {target}")
                        if candidate is None:
                            try:
                                candidate = minimize(collect(self.root, request, self.documents))
                            except Exception as error:
                                candidate = 'Local retrieval unavailable: ' + str(error)
                        self.output.delete('1.0', 'end')
                        self.output.insert('1.0', candidate)
                        break
        except queue.Empty:
            pass
        if not self.stop_event.is_set():
            self.window.after(200, self.drain)

    def send(self, request, result, approved):
        def deliver():
            try:
                self.api.call('result', {'task_id': request['task_id'], 'request_id': request['request_id'], 'approved': approved, 'result': result})
                self.messages.put(('sent', request['request_id']))
            except Exception as error:
                self.known.discard(request['request_id'])
                self.messages.put(('status', str(error)))
        threading.Thread(target=deliver, daemon=True).start()

    def respond(self, approved):
        if not self.current:
            return
        request = dict(self.current)
        if request['request_id'] in self.known:
            return
        result = self.output.get('1.0', 'end-1c')[:12000] if approved else ''
        release_for_task = getattr(self, 'release_for_task', None)
        wants_grant = approved and release_for_task is not None and release_for_task.get()
        recipient = request.get('recipient') or {}
        target = f"{recipient.get('provider', 'unknown')} / {recipient.get('model', 'unknown')}" if isinstance(recipient, dict) else 'unknown'
        confirmation = f'Send exactly the reviewed text to {target} for this task?'
        if wants_grant:
            confirmation += '\n\nThe checked task grant will also release later prepared results for 10 minutes to the same recipient.'
        if approved and not messagebox.askyesno('Approve disclosure', confirmation, parent=self.window):
            return
        self.db.execute('INSERT INTO ledger(request,task,result,approved,created) VALUES(?,?,?,?,?) ON CONFLICT(request) DO UPDATE SET result=excluded.result,approved=excluded.approved,created=excluded.created,sent=0', (request['request_id'], request['task_id'], result, int(approved), time.time()))
        self.db.commit()
        if wants_grant:
            if self.activate_release_grant(request):
                self.status.set('Task-scoped release grant active for 10 minutes.')
            else:
                self.release_for_task.set(False)
                self.status.set('Initial result released. Grant unavailable because the recipient snapshot is missing or invalid.')
        elif not approved and release_for_task is not None:
            release_for_task.set(False)
        self.known.add(request['request_id'])
        self.send(request, result, approved)
        self.status.set('Delivering reviewed response…')

    def steward(self):
        if not self.current:
            return
        if not messagebox.askyesno('External small-model API', 'Send this reviewed excerpt to the configured small-model API provider for a proposed answer? It leaves your laptop. You will review the result before releasing it to the main agent.', parent=self.window):
            return
        request, excerpt = dict(self.current), self.output.get('1.0', 'end-1c')[:8000]
        def run():
            try:
                result = self.api.call('steward', {'task_id': request['task_id'], 'request_id': request['request_id'], 'excerpt': excerpt})
                self.messages.put(('candidate', (request['request_id'], result['candidate'])))
            except Exception as error:
                self.messages.put(('status', str(error)))
        threading.Thread(target=run, daemon=True).start()

    def close(self):
        self.stop_event.set()
        self.release_grant = None
        self.documents.close()
        self.db.close()
        self.window.destroy()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', required=True)
    parser.add_argument('--root', required=True)
    parser.add_argument('--pair-code')
    parser.add_argument('--name', default='My laptop')
    parser.add_argument('--state', default=str(Path(os.environ.get('LOCALAPPDATA', str(Path.home() / '.local/share'))) / 'RelayCompanion'))
    args = parser.parse_args()
    try:
        app = Companion(args)
        app.window.mainloop()
    except Exception as error:
        messagebox.showerror('Relay companion', str(error))
        raise SystemExit(1)

if __name__ == '__main__':
    main()
