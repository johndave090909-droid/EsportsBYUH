# Local dev server for the site with caching disabled, so edits always show
# on refresh. Run:  python serve-local.py   then open http://localhost:8000/
import functools
import os
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'firebase-site')

class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

handler = functools.partial(NoCacheHandler, directory=SITE)
print('Serving', SITE, 'at http://localhost:8000/')
ThreadingHTTPServer(('127.0.0.1', 8000), handler).serve_forever()
