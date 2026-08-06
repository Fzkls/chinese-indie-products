import { readFile } from 'node:fs/promises'

const { metadata, records } = JSON.parse(await readFile('data/products.json', 'utf8'))
const quality = JSON.parse(await readFile('data/quality-report.json', 'utf8'))
const required = ['id', 'developerName', 'productName', 'status', 'category', 'sourceFile', 'sourceLine']
const allowedStatuses = new Set(['active', 'developing', 'closed', 'acquired', 'unknown'])
const allowedCategories = new Set(['product', 'developer-tool', 'game', 'archive'])
const errors = []
const ids = new Set()

if (!Array.isArray(records) || records.length === 0) errors.push('records must be a non-empty array')
for (const [index, record] of records.entries()) {
  for (const field of required) {
    if (record[field] === null || record[field] === undefined || record[field] === '') errors.push(`record ${index}: missing ${field}`)
  }
  if (ids.has(record.id)) errors.push(`record ${index}: duplicate id ${record.id}`)
  ids.add(record.id)
  if (!allowedStatuses.has(record.status)) errors.push(`record ${index}: invalid status ${record.status}`)
  if (!allowedCategories.has(record.category)) errors.push(`record ${index}: invalid category ${record.category}`)
  if (record.productUrl && !/^https?:\/\//.test(record.productUrl)) errors.push(`record ${index}: invalid productUrl`)
}
if (quality.recordCount !== records.length) errors.push('quality-report recordCount mismatch')
if (!metadata?.upstreamRepository) errors.push('missing upstream metadata')

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log(`Data check passed: ${records.length} records, ${ids.size} unique IDs.`)
