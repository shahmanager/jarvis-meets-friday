"""Run on the dedicated VM. Synthetic data only; print no credentials or screenshots."""
import base64
import json
import os
import uuid
from urllib.request import Request, urlopen
from urllib.error import HTTPError

task = str(uuid.uuid4())
def call(operation, args=None, domains=None):
    body = json.dumps({'task_id': task, 'operation': operation, 'args': args or {}, 'domains': domains or []}).encode()
    request = Request('http://127.0.0.1:8788/execute', data=body, headers={'Authorization': 'Bearer ' + os.environ['EXECUTOR_SECRET'], 'Content-Type': 'application/json'})
    with urlopen(request, timeout=100) as response:
        return json.load(response)

def denied(operation, args):
    try:
        call(operation, args)
    except HTTPError as error:
        assert error.code == 400
        return
    raise AssertionError('Unsafe or cancelled operation was accepted')

call('workspace_write', {'path': 'check.txt', 'content': 'Synthetic sandbox check'})
assert call('workspace_read', {'path': 'check.txt'})['content'] == 'Synthetic sandbox check'
assert 'check.txt' in call('workspace_list')['files']
denied('workspace_read', {'path': '../../etc/passwd'})
result = call('python_run', {'code': "import os,socket\nassert os.getuid()==1000\nassert os.statvfs('/').f_flag & os.ST_RDONLY\nassert 'EXECUTOR_SECRET' not in os.environ\nassert 'AWS_ACCESS_KEY_ID' not in os.environ\nassert not os.path.exists('/var/run/docker.sock')\ns=socket.socket();s.settimeout(2);assert s.connect_ex(('169.254.169.254',80))!=0;s.close()\nopen('/workspace/python-result.txt','w').write(str(2+2))\nprint('isolated Python passed')"})
assert result['exitCode'] == 0, result
assert 'isolated Python passed' in result['stdout']
assert call('workspace_read', {'path': 'python-result.txt'})['content'] == '4'
for content in ('Private synthetic artifact', ''):
    identifier = str(uuid.uuid4())
    assert call('artifact_write', {'id': identifier, 'name': 'verification.txt', 'content': content})['stored']
    assert base64.b64decode(call('artifact_read', {'id': identifier})['content_base64']).decode() == content
call('browser', {'action': 'navigate', 'url': 'https://example.com'}, ['example.com'])
page = call('browser', {'action': 'read'}, ['example.com'])
assert page['title'] == 'Example Domain'
assert len(page['untrusted_content']) > 20
image = base64.b64decode(call('browser', {'action': 'screenshot'}, ['example.com'])['image_base64'])
assert image.startswith(b'\xff\xd8')
denied('browser', {'action': 'navigate', 'url': 'http://169.254.169.254/latest/meta-data/'})
assert call('cancel')['stopped']
denied('workspace_read', {'path': 'check.txt'})
print('PASS: real VM Docker file I/O, non-root read-only Python, blocked metadata/network access, credential separation, private S3 round-trip including empty files, Chromium navigation/read/screenshot, domain denial and cancellation.')
