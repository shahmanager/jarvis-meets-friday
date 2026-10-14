"""Native companion. Python standard library only; outbound TLS and explicit release review."""
import argparse
import base64
import ctypes
import json
import os
import queue
import sqlite3
import threading
import time
import tkinter as tk
from pathlib import Path
from tkinter import messagebox, simpledialog, ttk
from urllib.error import HTTPError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from policy import collect, minimize

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
        self.db.execute('CREATE TABLE IF NOT EXISTS ledger(request TEXT PRIMARY KEY,task TEXT,result TEXT,approved INTEGER,created REAL,sent INTEGER DEFAULT 0)')
        self.db.commit()
        self.messages = queue.Queue()
        self.stop_event = threading.Event()
        self.current = None
        self.known = set()
        self.status = tk.StringVar(value='Connecting…')
        self.request_label = tk.StringVar(value='No pending requests. Your files remain local.')
        self.build_ui()
        threading.Thread(target=self.poll, daemon=True).start()
        self.window.after(200, self.drain)

    def build_ui(self):
        frame = ttk.Frame(self.window, padding=24)
        frame.pack(fill='both', expand=True)
        ttk.Label(frame, text='Relay local companion', font=('Segoe UI', 20, 'bold')).pack(anchor='w')
        ttk.Label(frame, text=str(self.root), wraplength=700).pack(anchor='w', pady=(8, 4))
        ttk.Label(frame, textvariable=self.status).pack(anchor='w')
        ttk.Separator(frame).pack(fill='x', pady=18)
        ttk.Label(frame, textvariable=self.request_label, wraplength=700).pack(anchor='w')
        ttk.Label(frame, text='Review and edit the exact information to release. Nothing below is sent automatically.', wraplength=700).pack(anchor='w', pady=10)
        self.output = tk.Text(frame, height=18, wrap='word', font=('Consolas', 10))
        self.output.pack(fill='both', expand=True)
        buttons = ttk.Frame(frame)
        buttons.pack(fill='x', pady=14)
        ttk.Button(buttons, text='Release reviewed information', command=lambda: self.respond(True)).pack(side='left')
        ttk.Button(buttons, text='Decline request', command=lambda: self.respond(False)).pack(side='left', padx=10)
        ttk.Button(buttons, text='Ask small model', command=self.steward).pack(side='right')
        ttk.Label(frame, text='Small-model API: requires a separate confirmation before sending this excerpt to the provider. Regex masking is not a privacy guarantee.', wraplength=700).pack(anchor='w')

    def poll(self):
        while not self.stop_event.is_set():
            try:
                requests = self.api.call('poll')['requests']
                self.messages.put(('requests', requests))
            except Exception as error:
                self.messages.put(('status', str(error)))
            self.stop_event.wait(4)

    def drain(self):
        try:
            while True:
                kind, value = self.messages.get_nowait()
                if kind == 'status':
                    self.status.set(value)
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
                    self.request_label.set('Response delivered. Waiting for another request.')
                    self.output.delete('1.0', 'end')
                elif kind == 'requests':
                    self.status.set('Connected · read-only selected-folder access')
                    active = {request['request_id'] for request in value}
                    if self.current and self.current['request_id'] not in active:
                        self.current = None
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
                        self.current = request
                        self.request_label.set(f"{request['operation']} · {request.get('purpose', '')}")
                        try:
                            candidate = minimize(collect(self.root, request))
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
        if approved and not messagebox.askyesno('Approve disclosure', 'Send exactly the reviewed text to your cloud agent and its model provider?', parent=self.window):
            return
        self.db.execute('INSERT INTO ledger(request,task,result,approved,created) VALUES(?,?,?,?,?) ON CONFLICT(request) DO UPDATE SET result=excluded.result,approved=excluded.approved,created=excluded.created,sent=0', (request['request_id'], request['task_id'], result, int(approved), time.time()))
        self.db.commit()
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
