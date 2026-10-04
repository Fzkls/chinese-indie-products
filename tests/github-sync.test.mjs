import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { classifyRepositoryActivity, collectRepositoryCandidates, normalizeGitHubRepository } from '../scripts/sync-github.mjs'

test('normalizes direct GitHub repository URLs and rejects profiles', () => {
  assert.deepEqual(normalizeGitHubRepository('https://github.com/Tiny-Craft/Tiny-RDM/releases/tag/v1'), {
    key: 'tiny-craft/tiny-rdm',
    fullName: 'Tiny-Craft/Tiny-RDM',
    owner: 'Tiny-Craft',
    repository: 'Tiny-RDM',
    url: 'https://github.com/Tiny-Craft/Tiny-RDM'
  })
  assert.equal(normalizeGitHubRepository('https://github.com/tiny-craft'), null)
  assert.equal(normalizeGitHubRepository('https://example.com/tiny-craft/tiny-rdm'), null)
})

test('deduplicates repository candidates while retaining record references', () => {
  const products = { records: [
    { id: 'p1', productName: 'A', productUrl: 'https://github.com/acme/app' },
    { id: 'p2', productName: 'B', productUrl: 'https://github.com/ACME/app/issues' }
  ] }
  const tools = { records: [{ id: 't1', toolName: 'C', toolUrl: 'https://github.com/acme/cli' }] }
  const candidates = collectRepositoryCandidates(products, tools)
  assert.equal(candidates.length, 2)
  assert.equal(candidates.find((item) => item.key === 'acme/app').references.length, 2)
})

test('classifies repository activity without treating archives as active', () => {
  const now = new Date('2026-08-07T00:00:00Z')
  assert.equal(classifyRepositoryActivity({ status: 'available', archived: false, pushedAt: '2026-08-01T00:00:00Z' }, now), 'active-30')
  assert.equal(classifyRepositoryActivity({ status: 'available', archived: true, pushedAt: '2026-08-01T00:00:00Z' }, now), 'archived')
  assert.equal(classifyRepositoryActivity({ status: 'unavailable' }, now), 'unavailable')
})


test('GitHub history is stored in permanent yearly shards', async () => {
  const index = JSON.parse(await readFile('data/github-history/index.json', 'utf8'))
  assert.equal(index.metadata.sharding, 'year')
  assert.equal(index.metadata.retention, 'permanent')
  assert.ok(index.years.includes(2026))

  for (const year of index.years) {
    const shard = JSON.parse(await readFile(`data/github-history/${year}.json`, 'utf8'))
    assert.equal(shard.metadata.year, year)
    for (const snapshots of Object.values(shard.repositories || {})) {
      assert.ok(snapshots.every((snapshot) => String(snapshot.date).startsWith(String(year))))
    }
  }
})
