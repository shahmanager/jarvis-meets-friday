import base64
import json
import sys
from pathlib import Path

root=Path('/workspace').resolve()
payload=json.loads(base64.urlsafe_b64decode(sys.argv[1]+'='*(-len(sys.argv[1])%4)))
operation,args=payload['operation'],payload['args']
if operation=='workspace_list':
    print(json.dumps({'files':[str(p.relative_to(root)) for p in root.rglob('*') if p.is_file() and not p.is_symlink()][:200]}))
else:
    path=(root/args['path']).resolve()
    if not path.is_relative_to(root):
        raise ValueError('Path escaped workspace.')
    if operation=='workspace_read':
        if path.stat().st_size>100000:
            raise ValueError('File too large.')
        print(json.dumps({'path':args['path'],'content':path.read_text()[:60000]}))
    elif operation=='workspace_write':
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_text(args['content'])
        print(json.dumps({'written':args['path'],'bytes':path.stat().st_size}))
    else:
        raise ValueError('Unknown file operation.')
