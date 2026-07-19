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

    # Mirror Firebase Hosting's cleanUrls + the / -> /home redirect, so links
    # like /matches work the same on localhost as on the live site.
    def do_GET(self):
        if self.path.split('?')[0] in ('/', '/index.html', '/index'):
            self.send_response(302)
            self.send_header('Location', '/home')
            self.end_headers()
            return
        super().do_GET()

    def translate_path(self, path):
        full = super().translate_path(path)
        base, ext = os.path.splitext(full)
        if not ext and not os.path.isdir(full) and os.path.exists(full + '.html'):
            return full + '.html'
        return full

handler = functools.partial(NoCacheHandler, directory=SITE)
print('Serving', SITE, 'at http://localhost:8000/')
ThreadingHTTPServer(('127.0.0.1', 8000), handler).serve_forever()
