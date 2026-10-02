'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/styleguide/photos.js'), 'utf8');

function loader({ protocol = 'https:', failed = [], brokenDecode = [], embeddedFails = false } = {}) {
  const requests = [];
  const scripts = [];
  const sandbox = {
    console,
    location: { protocol },
    PM: { url: (file) => `/${file}` },
    PM_BRAND_CONTENT: { photos: [{ id: 'team', file: 'team.jpg' }, { id: 'laptop', file: 'laptop.jpg' }] },
    Image: class {
      set src(value) {
        this.source = value;
        requests.push(value);
        queueMicrotask(() => {
          this.naturalWidth = failed.includes(value) ? 0 : 1200;
          if (this.naturalWidth) this.onload();
          else this.onerror(new Error('Photo unavailable'));
        });
      }
      decode() {
        return brokenDecode.includes(this.source) ? Promise.reject(new Error('Invalid image')) : Promise.resolve();
      }
    },
    document: {
      createElement: () => ({}),
      head: {
        appendChild(script) {
          scripts.push(script.src);
          queueMicrotask(() => {
            if (embeddedFails) return script.onerror();
            sandbox.PM_STYLEGUIDE_PHOTOS = { team: 'data:team', laptop: 'data:laptop' };
            script.onload();
          });
        },
      },
    },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(source, sandbox);
  return { photos: sandbox.PMStyleguidePhotos, requests, scripts };
}

test('foto’s via HTTP: gewone bestanden laden één keer, zonder extra ingebedde data', async () => {
  const { photos, requests, scripts } = loader();
  const first = photos.load();
  assert.equal(photos.load(), first, 'preview en export delen dezelfde laadbelofte');
  const images = await first;
  assert.deepEqual(Object.keys(images), ['team', 'laptop']);
  assert.deepEqual(requests, ['/team.jpg', '/laptop.jpg']);
  assert.deepEqual(scripts, []);
});

test('een ontbrekende of onleesbare foto gebruikt de ingebedde kopie, vóór load klaar is', async () => {
  for (const options of [{ failed: ['/team.jpg'] }, { brokenDecode: ['/team.jpg'] }]) {
    const { photos, requests, scripts } = loader(options);
    const images = await photos.load();
    assert.equal(images.team.source, 'data:team');
    assert.equal(images.laptop.source, '/laptop.jpg');
    assert.deepEqual(requests, ['/team.jpg', '/laptop.jpg', 'data:team']);
    assert.deepEqual(scripts, ['/js/styleguide/photo-data.js']);
  }
});

test('vanaf schijf komen foto’s alleen uit data-URL’s, zodat het exportcanvas leesbaar blijft', async () => {
  const { photos, requests, scripts } = loader({ protocol: 'file:' });
  assert.deepEqual(Object.keys(await photos.load()), ['team', 'laptop']);
  assert.deepEqual(requests, ['data:team', 'data:laptop']);
  assert.equal(scripts.length, 1);
});

test('als ook de terugval mislukt blijven de geslaagde foto’s beschikbaar voor de export', async () => {
  for (const options of [
    { failed: ['/team.jpg'], embeddedFails: true },
    { failed: ['/team.jpg', 'data:team'] },
  ]) {
    const { photos } = loader(options);
    assert.deepEqual(Object.keys(await photos.load()), ['laptop']);
  }
});
