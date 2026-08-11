import { readFile, writeFile } from 'node:fs/promises'
import { classifyProducts } from './lib/taxonomy-v1.mjs'

const productsPayload = JSON.parse(await readFile('data/products.json', 'utf8'))
const taxonomy = JSON.parse(await readFile('data/taxonomy.json', 'utf8'))
const reviewedOverrides = JSON.parse(await readFile('data/taxonomy-overrides.json', 'utf8'))
const products = productsPayload.records || []
const productIds = new Set(products.map((item) => item.id))
const categoryIds = new Set((taxonomy.primaryCategories || []).map((item) => item.id))

if (reviewedOverrides.metadata?.taxonomyVersion !== taxonomy.version) {
  throw new Error(`review override taxonomy version mismatch: ${reviewedOverrides.metadata?.taxonomyVersion} != ${taxonomy.version}`)
}

const overrideMap = new Map()
let staleOverrides = 0
for (const [primaryCategory, ids] of Object.entries(reviewedOverrides.categories || {})) {
  if (!categoryIds.has(primaryCategory)) throw new Error(`review override uses unknown category: ${primaryCategory}`)
  for (const productId of ids || []) {
    if (overrideMap.has(productId)) throw new Error(`duplicate review override: ${productId}`)
    if (!productIds.has(productId)) {
      staleOverrides += 1
      continue
    }
    overrideMap.set(productId, primaryCategory)
  }
}

const baseRecords = classifyProducts(products, taxonomy.version)
const records = baseRecords.map((item) => {
  const reviewedCategory = overrideMap.get(item.productId)
  if (!reviewedCategory) return item
  const changed = reviewedCategory !== item.primaryCategory
  return {
    ...item,
    primaryCategory: reviewedCategory,
    subCategories: changed ? [] : item.subCategories,
    confidence: 0.95,
    classificationMethod: 'manual-review',
    reviewStatus: 'reviewed',
    reviewReason: 'Reviewed against the product name and description; primary category is intentionally fixed by taxonomy-overrides.json.',
    reviewPreviousPrimaryCategory: item.primaryCategory,
    reviewPreviousMethod: item.classificationMethod,
    signals: [`review:manual`, `review:primary:${reviewedCategory}`, ...(item.signals || [])].slice(0, 10)
  }
})

const primaryCounts = Object.fromEntries([...records.reduce((map, item) => map.set(item.primaryCategory, (map.get(item.primaryCategory) || 0) + 1), new Map()).entries()].sort((a, b) => b[1] - a[1]))
const methodCounts = Object.fromEntries([...records.reduce((map, item) => map.set(item.classificationMethod || 'unknown', (map.get(item.classificationMethod || 'unknown') || 0) + 1), new Map()).entries()].sort((a, b) => b[1] - a[1]))
const classified = records.filter((item) => item.primaryCategory !== 'other').length
const lowConfidence = records.filter((item) => item.confidence < 0.65).length
const averageConfidence = records.length ? records.reduce((sum, item) => sum + item.confidence, 0) / records.length : 0
const reviewedProducts = records.filter((item) => item.classificationMethod === 'manual-review').length
const reviewChangedProducts = records.filter((item) => item.classificationMethod === 'manual-review' && item.reviewPreviousPrimaryCategory !== item.primaryCategory).length
const baseOtherProducts = baseRecords.filter((item) => item.primaryCategory === 'other').length

const payload = {
  metadata: {
    dataset: 'product-taxonomy',
    taxonomyVersion: taxonomy.version,
    classifier: 'deterministic-semantic-rules-v1.1+manual-review',
    reviewOverrideVersion: reviewedOverrides.metadata?.version || null,
    sourceProductGeneratedAt: productsPayload.metadata?.generatedAt || null,
    generatedAt: new Date().toISOString(),
    totalProducts: records.length,
    classifiedProducts: classified,
    otherProducts: records.length - classified,
    coverage: records.length ? Number((classified / records.length).toFixed(4)) : 0,
    lowConfidenceProducts: lowConfidence,
    averageConfidence: Number(averageConfidence.toFixed(4)),
    reviewedProducts,
    reviewChangedProducts,
    baseOtherProducts,
    activeReviewOverrides: overrideMap.size,
    staleReviewOverrides: staleOverrides,
    primaryCategoryCounts: primaryCounts,
    classificationMethodCounts: methodCounts,
    note: 'Source facts remain in products.json. Deterministic rules classify clear records; high-risk long-tail records are explicitly reviewed. Other is valid only after explicit manual review.'
  },
  records
}

await writeFile('data/product-taxonomy.json', `${JSON.stringify(payload, null, 2)}\n`)
console.log(`Generated taxonomy for ${records.length} products: ${classified} classified, ${records.length - classified} other, avg confidence ${averageConfidence.toFixed(2)}.`)
console.log(`Manual review: ${reviewedProducts} active overrides, ${reviewChangedProducts} changed primary category, ${staleOverrides} stale overrides.`)
console.log(`Primary categories: ${JSON.stringify(primaryCounts)}`)
console.log(`Classification methods: ${JSON.stringify(methodCounts)}`)
