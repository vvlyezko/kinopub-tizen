"""Мини-клиент Chrome DevTools Protocol без зависимостей — для отладки приложения на TV.

Подготовка (приложение запускается на TV в режиме отладки):
    sdb -s <tv>:26101 shell 0 debug KinoPubTV1.KinoPub      -> "... port: NNNNN"
    sdb -s <tv>:26101 forward tcp:9333 tcp:NNNNN

Использование:
    python tools/cdp.py eval "navigator.userAgent"
    python tools/cdp.py keys Down Down Right Enter            # нажатия пульта
    python tools/cdp.py file script.js                        # выполнить JS из файла
"""
import base64
import json
import os
import socket
import struct
import sys
import urllib.request

PORT = int(os.environ.get('CDP_PORT', '9333'))


class WS:
    def __init__(self, url):
        rest = url.split('://', 1)[1]
        hostport, path = rest.split('/', 1)
        host, port = hostport.split(':')
        self.s = socket.create_connection((host, int(port)), timeout=60)
        key = base64.b64encode(os.urandom(16)).decode()
        req = (f'GET /{path} HTTP/1.1\r\nHost: {hostport}\r\nUpgrade: websocket\r\n'
               f'Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n')
        self.s.sendall(req.encode())
        buf = b''
        while b'\r\n\r\n' not in buf:
            buf += self.s.recv(4096)
        if b' 101 ' not in buf.split(b'\r\n')[0]:
            raise RuntimeError(buf.decode(errors='ignore'))
        self.buf = buf.split(b'\r\n\r\n', 1)[1]
        self.next_id = 0

    def _read(self, n):
        while len(self.buf) < n:
            chunk = self.s.recv(65536)
            if not chunk:
                raise ConnectionError('closed')
            self.buf += chunk
        data, self.buf = self.buf[:n], self.buf[n:]
        return data

    def send(self, text):
        data = text.encode()
        mask = os.urandom(4)
        n = len(data)
        head = bytes([0x81])
        if n < 126:
            head += bytes([0x80 | n])
        elif n < 65536:
            head += bytes([0x80 | 126]) + struct.pack('>H', n)
        else:
            head += bytes([0x80 | 127]) + struct.pack('>Q', n)
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
        self.s.sendall(head + mask + masked)

    def recv(self):
        message = b''
        while True:
            b1, b2 = self._read(2)
            n = b2 & 0x7f
            if n == 126:
                n = struct.unpack('>H', self._read(2))[0]
            elif n == 127:
                n = struct.unpack('>Q', self._read(8))[0]
            payload = self._read(n)
            message += payload
            if b1 & 0x80:
                return message.decode(errors='ignore')

    def call(self, method, params=None):
        self.next_id += 1
        my = self.next_id
        self.send(json.dumps({'id': my, 'method': method, 'params': params or {}}))
        while True:
            msg = json.loads(self.recv())
            if msg.get('id') == my:
                return msg


def connect():
    targets = json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/json'))
    page = [t for t in targets if t.get('type') == 'page'][0]
    return WS(page['webSocketDebuggerUrl'])


def evaluate(ws, expr):
    r = ws.call('Runtime.evaluate', {'expression': expr, 'awaitPromise': True, 'returnByValue': True})
    res = r.get('result', {})
    if 'exceptionDetails' in res:
        return 'EXCEPTION: ' + json.dumps(res['exceptionDetails'], ensure_ascii=False)[:2000]
    return res.get('result', {}).get('value', res.get('result'))


KEYS = {'Left': 37, 'Up': 38, 'Right': 39, 'Down': 40, 'Enter': 13, 'Back': 10009}


def press(ws, name):
    code = KEYS[name]
    for t in ('rawKeyDown', 'keyUp'):
        ws.call('Input.dispatchKeyEvent', {'type': t, 'windowsVirtualKeyCode': code, 'nativeVirtualKeyCode': code, 'key': name})


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    ws = connect()
    mode = sys.argv[1]
    if mode == 'eval':
        out = evaluate(ws, sys.argv[2])
    elif mode == 'file':
        out = evaluate(ws, open(sys.argv[2], encoding='utf-8').read())
    elif mode == 'trace':
        # trace <script.js>: записать трассировку, пока выполняется скрипт, и свести по типам событий
        ws.call('Tracing.start', {'categories': 'devtools.timeline,disabled-by-default-devtools.timeline,blink,cc,gpu,v8', 'transferMode': 'ReportEvents'})
        evaluate(ws, open(sys.argv[2], encoding='utf-8').read())
        ws.next_id += 1
        ws.send(json.dumps({'id': ws.next_id, 'method': 'Tracing.end'}))
        events = []
        while True:
            msg = json.loads(ws.recv())
            if msg.get('method') == 'Tracing.dataCollected':
                events += msg['params']['value']
            elif msg.get('method') == 'Tracing.tracingComplete':
                break
        threads = {}
        for e in events:
            if e.get('ph') == 'M' and e.get('name') == 'thread_name':
                threads[(e['pid'], e['tid'])] = e['args']['name']
        agg = {}
        for e in events:
            if e.get('ph') == 'X' and 'dur' in e:
                key = (threads.get((e['pid'], e['tid']), '?'), e['name'])
                a = agg.setdefault(key, [0, 0, 0])
                a[0] += e['dur'] / 1000; a[1] += 1; a[2] = max(a[2], e['dur'] / 1000)
        rows = sorted(agg.items(), key=lambda kv: -kv[1][0])[:30]
        out = '\n'.join(f'{v[0]:9.0f}ms  x{v[1]:<5} max {v[2]:6.0f}ms  [{k[0]}] {k[1]}' for k, v in rows)
    elif mode == 'shot':
        # shot <file.png>: снимок веб-слоя (видео AVPlay в него не попадает)
        r = ws.call('Page.captureScreenshot', {'format': 'png'})
        with open(sys.argv[2], 'wb') as f:
            f.write(base64.b64decode(r['result']['data']))
        out = sys.argv[2]
    elif mode == 'click':
        # click <css-селектор>: настоящий клик мышью (даёт «жест пользователя» для getDisplayMedia)
        rect = evaluate(ws, "(function(){var r=document.querySelector(%s).getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()" % json.dumps(sys.argv[2]))
        x, y = rect
        for t in ('mousePressed', 'mouseReleased'):
            ws.call('Input.dispatchMouseEvent', {'type': t, 'x': x, 'y': y, 'button': 'left', 'clickCount': 1})
        out = 'clicked at %d,%d' % (x, y)
    elif mode == 'keys':
        for k in sys.argv[2:]:
            press(ws, k)
        out = 'ok'
    else:
        raise SystemExit('unknown mode')
    print(out if isinstance(out, str) else json.dumps(out, ensure_ascii=False, indent=1))
