// An HTTPS front for the smoke tests. The page marks its cookies Secure, and
// WebKit on Linux won't keep Secure cookies from plain HTTP, even on localhost,
// so the tests talk to the server the way production does, over TLS. The
// certificate is self-signed, made fresh each run, and the tests ignore it.
//
//   node test/browser/https.js <listen port> <server port>

import { execFileSync } from 'node:child_process';
import { request } from 'node:http';
import { createServer } from 'node:https';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let [listenPort, serverPort] = process.argv.slice(2).map(Number);
let dir = mkdtempSync(join(tmpdir(), 'descent-smoke-'));
let key = join(dir, 'key.pem');
let cert = join(dir, 'cert.pem');

execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
  '-subj', '/CN=localhost', '-keyout', key, '-out', cert], { stdio: 'ignore' });

createServer({ key: readFileSync(key), cert: readFileSync(cert) }, (req, res) => {
  let upstream = request({
    host: '127.0.0.1', port: serverPort, method: req.method, path: req.url,
    headers: { ...req.headers, 'x-forwarded-proto': 'https' }
  }, response => {
    res.writeHead(response.statusCode, response.headers);
    response.pipe(res);
  });

  upstream.on('error', () => {
    res.writeHead(502);
    res.end();
  });

  // A page that goes away mid-hold closes this side, and the server should
  // see that too
  res.on('close', () => upstream.destroy());
  req.pipe(upstream);
}).listen(listenPort, '127.0.0.1');
