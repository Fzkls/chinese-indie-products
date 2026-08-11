import { readFile, writeFile } from 'node:fs/promises'
import { classifyProducts } from './lib/taxonomy.mjs'

const productsPayload = JSON.parse(await readFile('data/products.json', 'utf8'))
const taxonomy = JSON.parse(await readFile('data/taxonomy.json', 'utf8'))
const records = classifyProducts(productsPayload.records || [], taxonomy.version)
const primaryCounts = Object.fromEntries([...records.reduce((map, item) => map.set(item.primaryCategory, (map.get(item.primaryCategory) || 0) + 1), new Map()).entries()].sort((a, b) => b[1] - a[1]))
const classified = records.filter((item) => item.primaryCategory !== 'other').length
const lowConfidence = records.filter((item) => item.confidence < 0.65).length
const averageConfidence = records.length ? records.reduce((sum, item) => sum + item.confidence, 0) / records.length : 0

const payload = {
  metadata: {
    dataset: 'product-taxonomy',
    taxonomyVersion: taxonomy.version,
    classifier: 'deterministic-semantic-rules-v1',
    sourceProductGeneratedAt: productsPayload.metadata?.generatedAt || null,
    generatedAt: new Date().toISOString(),
    totalProducts: records.length,
    classifiedProducts: classified,
    otherProducts: records.length - classified,
    coverage: records.length ? Number((classified / records.length).toFixed(4)) : 0,
    lowConfidenceProducts: lowConfidence,
    averageConfidence: Number(averageConfidence.toFixed(4)),
    primaryCategoryCounts: primaryCounts,
    note: 'Taxonomy is an inferred semantic layer. Source facts remain in products.json.'
  },
  records
}

await writeFile('data/product-taxonomy.json', `${JSON.stringify(payload, null, 2)}\n`)
console.log(`Generated taxonomy for ${records.length} products: ${classified} classified, ${records.length - classified} other, avg confidence ${averageConfidence.toFixed(2)}.`)
