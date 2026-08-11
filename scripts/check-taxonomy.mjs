import { readFile } from 'node:fs/promises'

const products = JSON.parse(await readFile('data/products.json', 'utf8'))
const taxonomy = JSON.parse(await readFile('data/taxonomy.json', 'utf8'))
const classified = JSON.parse(await readFile('data/product-taxonomy.json', 'utf8'))
const errors = []
const warnings = []
const categoryIds = new Set((taxonomy.primaryCategories || []).map((item) => item.id))
const productIds = new Set((products.records || []).map((item) => item.id))
const classificationIds = new Set()

if (classified.metadata?.taxonomyVersion !== taxonomy.version) errors.push(`taxonomy version mismatch: ${classified.metadata?.taxonomyVersion} != ${taxonomy.version}`)
if ((classified.records || []).length !== productIds.size) errors.push(`classification count mismatch: ${classified.records?.length || 0} != ${productIds.size}`)

for (const item of classified.records || []) {
  if (!productIds.has(item.productId)) errors.push(`classification references unknown productId: ${item.productId}`)
  if (classificationIds.has(item.productId)) errors.push(`duplicate classification: ${item.productId}`)
  classificationIds.add(item.productId)
  if (!categoryIds.has(item.primaryCategory)) errors.push(`unknown primaryCategory ${item.primaryCategory} for ${item.productId}`)
  if (!Array.isArray(item.subCategories)) errors.push(`subCategories must be an array for ${item.productId}`)
  if (!item.tags || typeof item.tags !== 'object') errors.push(`tags missing for ${item.productId}`)
  if (typeof item.confidence !== 'number' || item.confidence < 0 || item.confidence > 1) errors.push(`invalid confidence for ${item.productId}`)
}

for (const productId of productIds) if (!classificationIds.has(productId)) errors.push(`missing classification for ${productId}`)

const coverage = classified.metadata?.coverage ?? 0
const otherCount = classified.metadata?.otherProducts ?? 0
const lowConfidence = classified.metadata?.lowConfidenceProducts ?? 0
if (coverage < 0.6) warnings.push(`semantic coverage is only ${(coverage * 100).toFixed(1)}%; expand taxonomy rules before treating it as comprehensive`)
if (lowConfidence > (classified.records?.length || 0) * 0.4) warnings.push(`low-confidence classifications are high: ${lowConfidence}`)

if (warnings.length) console.warn(warnings.map((item) => `Taxonomy warning: ${item}`).join('\n'))
if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log(`Taxonomy check passed: ${classificationIds.size} products, ${(coverage * 100).toFixed(1)}% classified, ${otherCount} other.`)
