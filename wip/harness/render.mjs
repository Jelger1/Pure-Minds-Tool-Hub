// Headless-Chrome render harness for the Pure Minds Presentation Maker (scratch tool, not in the repo).
// Usage:
//   node render.mjs --root <repo-or-copy> --out <dir> [--query "type=positionering"] [--state state.json]
//                   [--slides] [--shot name.png] [--eval "js expression"] [--wait 1500] [--keep-storage]
//   --slides      click every slide in the strip and save #slideCanvas as out/slide-NN.png (1920x1080)
//   --shot        full-window screenshot (1600x1000) after load (and after --eval)
//   --eval        JS evaluated in the page after load (awaited); its JSON result is printed
//   --state       JSON written to localStorage 'pm-presentation-v1' before the page loads
//   --page        page relative to root (default tools/presentation.html)
// Console errors / exceptions from the page are printed at the end (ERRORS: ...).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i < 0 ? def : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const root = path.resolve(opt('root', process.cwd()));
const out = path.resolve(opt('out', './out'));
const page = opt('page', 'tools/presentation.html');
const query = opt('query', '');
const stateFile = opt('state', '');
const evalJs = opt('eval', '');
const shot = opt('shot', '');
const wait = Number(opt('wait', 1500));
const doSlides = args.includes('--slides');
fs.mkdirSync(out, { recursive: true });

// Chrome of Chromium: zet CHROME in de omgeving (Linux: bijv. /usr/bin/chromium); op Windows het standaardpad
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pmrender-'));
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--allow-file-access-from-files', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
  '--force-device-scale-factor=1', '--window-size=1600,1000',
  ...(process.env.CHROME_NO_SANDBOX ? ['--no-sandbox'] : []), 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });

const wsUrl = await new Promise((res, rej) => {
  let buf = '';
  const t = setTimeout(() => rej(new Error('Chrome did not start')), 20000);
  chrome.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\S+)/); if (m) { clearTimeout(t); res(m[1]); } });
});

const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map(); const listeners = [];
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) { const { res, rej } = pending.get(msg.id); pending.delete(msg.id); msg.error ? rej(new Error(msg.error.message)) : res(msg.result); }
  else listeners.forEach((fn) => fn(msg));
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);
const errors = [];
listeners.push((msg) => {
  if (msg.sessionId !== sessionId) return;
  if (msg.method === 'Runtime.exceptionThrown') errors.push('EXCEPTION ' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
  if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) errors.push(msg.params.type.toUpperCase() + ' ' + msg.params.args.map((a) => a.value ?? a.description).join(' '));
  if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') errors.push('LOG ' + msg.params.entry.text + ' ' + (msg.params.entry.url || ''));
});
await S('Runtime.enable'); await S('Page.enable'); await S('Log.enable');
await S('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });

const url = pathToFileURL(path.join(root, page)).href + (query ? '?' + query : '');
const evaluate = async (expr) => {
  const r = await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};
const loaded = () => new Promise((r) => { const fn = (m) => { if (m.sessionId === sessionId && m.method === 'Page.loadEventFired') { listeners.splice(listeners.indexOf(fn), 1); r(); } }; listeners.push(fn); });

// Prime localStorage on the file:// origin: tour off, optional state
let l = loaded(); await S('Page.navigate', { url: pathToFileURL(path.join(root, page)).href }); await l;
await evaluate(`localStorage.clear(); localStorage.setItem('pm-tour-presentation-v1', JSON.stringify({status:'skipped', step:0})); localStorage.setItem('pm-tour-insta-v1', JSON.stringify({status:'skipped', step:0})); localStorage.setItem('pm-tour-document-v1', JSON.stringify({status:'skipped', step:0})); ['voorstel','positionering'].forEach(k => localStorage.setItem('pm-tour-'+k+'-v1', JSON.stringify({status:'skipped', step:0}))); ['voorstel','positionering'].forEach(k => localStorage.setItem('pm-tour-'+k+'-v1', JSON.stringify({status:'skipped', step:0}))); true`);
if (stateFile) await evaluate(`localStorage.setItem('pm-presentation-v1', ${JSON.stringify(fs.readFileSync(stateFile, 'utf8'))}); true`);
errors.length = 0;
l = loaded(); await S('Page.navigate', { url }); await l;
await evaluate(`document.fonts.ready.then(() => new Promise(r => setTimeout(r, ${wait})))`);

if (evalJs) console.log('EVAL:', JSON.stringify(await evaluate(`(async () => (${evalJs}))()`), null, 1));
if (shot) {
  const { data } = await S('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(out, shot), Buffer.from(data, 'base64'));
  console.log('shot', path.join(out, shot));
}
if (doSlides) {
  const n = await evaluate(`document.querySelectorAll('#slideStrip .strip__item').length`);
  for (let i = 0; i < n; i++) {
    const dataUrl = await evaluate(`(async () => { const it = document.querySelectorAll('#slideStrip .strip__item')[${i}]; it.click(); await new Promise(r => setTimeout(r, 350)); return document.querySelector('#slideCanvas').toDataURL('image/png'); })()`);
    const f = path.join(out, `slide-${String(i + 1).padStart(2, '0')}.png`);
    fs.writeFileSync(f, Buffer.from(dataUrl.split(',')[1], 'base64'));
  }
  console.log('slides', n, '->', out);
}
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ERRORS: none');
ws.close(); chrome.kill();
setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} process.exit(0); }, 500);
