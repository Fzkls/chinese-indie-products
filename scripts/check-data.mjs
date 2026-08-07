import { readFile } from 'node:fs/promises'
import { canonicalizeUrl } from './lib/parser.mjs'

const productsPayload = JSON.parse(await readFile('data/products.json', 'utf8'))
const toolsPayload = JSON.parse(await readFile('data/tools.json', 'utf8'))
const quality = JSON.parse(await readFile('data/quality-report.json', 'utf8'))
const errors = []

function validateSources(record, label) {
  if (!Array.isArray(record.sources) || record.sources.length === 0) {
    errors.push(`${label}: sources must be a non-empty array`)
    return
  }
  for (const [index, source] of record.sources.entries()) {
    for (const field of ['repository', 'sourceFile', 'sourceLine', 'rawText']) {
      if (source[field] === null || source[field] === undefined || source[field] === '') {
        errors.push(`${label}: source ${index} missing ${field}`)
      }
    }
  }
}

function validateDataset({ records, metadata }, config) {
  const ids = new Set()
  const dedupeKeys = new Set()
  if (!Array.isArray(records) || records.length === 0) errors.push(`${config.name}: records must be a non-empty array`)
  if (metadata?.dataset !== config.name) errors.push(`${config.name}: invalid metadata.dataset`)
  if (!Array.isArray(metadata?.sourceRepositories) || metadata.sourceRepositories.length === 0) errors.push(`${config.name}: missing sourceRepositories`)

  for (const [index, record] of records.entries()) {
    const label = `${config.name} record ${index}`
    for (const field of config.required) {
      if (record[field] === null || record[field] === undefined || record[field] === '') errors.push(`${label}: missing ${field}`)
    }
    if (record.recordType !== config.recordType) errors.push(`${label}: invalid recordType ${record.recordType}`)
    if (ids.has(record.id)) errors.push(`${label}: duplicate id ${record.id}`)
    ids.add(record.id)
    validateSources(record, label)
    const key = canonicalizeUrl(record[config.urlField]) || `${record[config.nameField].toLowerCase()}|${record.developerName || ''}`
    if (dedupeKeys.has(key)) errors.push(`${label}: duplicate canonical key ${key}`)
    dedupeKeys.add(key)
  }
  return ids.size
}

const productCount = validateDataset(productsPayload, {
  name: 'products', recordType: 'product', nameField: 'productName', urlField: 'productUrl',
  required: ['id', 'developerName', 'productName', 'status', 'category', 'sourceRepository', 'sourceFile', 'sourceLine']
})
const toolCount = validateDataset(toolsPayload, {
  name: 'tools', recordType: 'tool', nameField: 'toolName', urlField: 'toolUrl',
  required: ['id', 'toolName', 'toolUrl', 'category', 'sourceRepository', 'sourceFile', 'sourceLine']
})

if (quality.products?.recordCount !== productsPayload.records.length) errors.push('quality products recordCount mismatch')
if (quality.tools?.recordCount !== toolsPayload.records.length) errors.push('quality tools recordCount mismatch')
if (quality.separationRule !== 'Products and tools are separate datasets. Cross-dataset overlaps are reported but never merged.') errors.push('missing dataset separation rule')

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log(`Data check passed: ${productCount} products and ${toolCount} tools with explicit sources.`)
