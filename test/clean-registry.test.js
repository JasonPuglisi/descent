import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { findUnused } from '../scripts/clean-registry.js';

let now = Date.parse('2026-11-21T12:00:00Z');
let old = '2026-11-01T00:00:00Z';

function file(digest, { owner, createTime = old } = {}) {
  return { name: `files/sha256:${digest}`, hashes: [{ type: 'SHA256', value: digest }], owner, createTime };
}

describe('findUnused', () => {
  it('picks old layers no image refers to', () => {
    let files = [file('aaa'), file('bbb')];

    assert.deepEqual(findUnused(files, new Set(['sha256:aaa']), now).map(f => f.name), ['files/sha256:bbb']);
  });

  it('leaves manifests, which belong to image versions', () => {
    assert.deepEqual(findUnused([file('ccc', { owner: 'versions/sha256:ccc' })], new Set(), now), []);
  });

  it('leaves anything from the last day, which a build may still be uploading', () => {
    assert.deepEqual(findUnused([file('ddd', { createTime: '2026-11-21T00:00:01Z' })], new Set(), now), []);
  });

  it('leaves files it can\'t identify', () => {
    assert.deepEqual(findUnused([{ name: 'files/odd', createTime: old }], new Set(), now), []);
  });
});
