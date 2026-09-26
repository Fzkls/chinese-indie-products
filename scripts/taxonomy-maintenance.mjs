import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

export function analyzeTaxonomyOverrides(productsPayload, overridesPayload) {
  const productIds = new Set((productsPayload.records || []).map((record) => record.id))
  const staleByCategory = {}
  let reviewedCount = 0
  let staleCount = 0

  for (const [category, ids] of Object.entries(overridesPayload.categories || {})) {
    const list = Array.isArray(ids) ? ids : []
    reviewedCount += list.length
    const stale = list.filter((id) => !productIds.has(id))
    if (stale.length) staleByCategory[category] = stale
    staleCount += stale.length
  }

  return {
    reviewedCount,
    activeReviewedCount: reviewedCount - staleCount,
    staleCount,
    staleByCategory
  }
}

export function pruneTaxonomyOverrides(productsPayload, overridesPayload, reviewedAt = new Date().toISOString().slice(0, 10)) {
  const productIds = new Set((productsPayload.records || []).map((record) => record.id))
  const categories = Object.fromEntries(
    Object.entries(overridesPayload.categories || {}).map(([category, ids]) => [
      category,
      (Array.isArray(ids) ? ids : []).filter((id) => productIds.has(id))
    ])
  )
  const reviewedCount = Object.values(categories).reduce((sum, ids) => sum + ids.length, 0)
  return {
    ...overridesPayload,
    metadata: {
      ...overridesPayload.metadata,
      reviewedAt,
      sourceProductGeneratedAt: productsPayload.metadata?.generatedAt || null,
      reviewedCount
    },
    categories
  }
}

export async function maintainTaxonomyOverrides({
  productsPath = 'data/products.json',
  overridesPath = 'data/taxonomy-overrides.json',
  prune = false
} = {}) {
  const [productsPayload, overridesPayload] = await Promise.all([
    readJson(productsPath),
    readJson(overridesPath)
  ])
  const analysis = analyzeTaxonomyOverrides(productsPayload, overridesPayload)
  console.log('Taxonomy overrides: ' + analysis.activeReviewedCount + ' active, ' + analysis.staleCount + ' stale.')

  if (!prune || analysis.staleCount === 0) return analysis

  const next = pruneTaxonomyOverrides(productsPayload, overridesPayload)
  await writeFile(overridesPath, JSON.stringify(next, null, 2) + '\n')
  console.log('Pruned ' + analysis.staleCount + ' stale taxonomy overrides.')
  return analysis
}

const isEntrypoint = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isEntrypoint) {
  await maintainTaxonomyOverrides({ prune: process.argv.includes('--prune') })
}
