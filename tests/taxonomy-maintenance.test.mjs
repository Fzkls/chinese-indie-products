import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeTaxonomyOverrides, pruneTaxonomyOverrides } from '../scripts/taxonomy-maintenance.mjs'

test('detects and prunes stale taxonomy overrides', () => {
  const products = { metadata: { generatedAt: '2026-09-26T00:00:00Z' }, records: [{ id: 'a' }, { id: 'b' }] }
  const overrides = {
    metadata: { reviewedCount: 3 },
    categories: { utilities: ['a', 'missing'], games: ['b'] }
  }
  const analysis = analyzeTaxonomyOverrides(products, overrides)
  assert.equal(analysis.staleCount, 1)
  assert.deepEqual(analysis.staleByCategory, { utilities: ['missing'] })

  const next = pruneTaxonomyOverrides(products, overrides, '2026-09-26')
  assert.deepEqual(next.categories, { utilities: ['a'], games: ['b'] })
  assert.equal(next.metadata.reviewedCount, 2)
  assert.equal(next.metadata.sourceProductGeneratedAt, '2026-09-26T00:00:00Z')
})
