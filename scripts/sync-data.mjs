import { mkdir, readFile, writeFile } from 'node:fs/promises'
import {
  parseMarkdown,
  parseProjectTable,
  parseToolDirectory,
  mergeAndDedupe,
  findCrossDatasetOverlaps,
  buildQualityReport
} from './lib/parser.mjs'

const PRODUCT_REMOTE_SOURCES = [
  {
    repository: '1c7/chinese-independent-developer',
    repositoryUrl: 'https://github.com/1c7/chinese-independent-developer',
    ref: 'master', sourceFile: 'README.md', category: 'product', parser: 'markdown',
    url: 'https://raw.githubusercontent.com/1c7/chinese-independent-developer/master/README.md'
  },
  {
    repository: '1c7/chinese-independent-developer',
    repositoryUrl: 'https://github.com/1c7/chinese-independent-developer',
    ref: 'master', sourceFile: '.github/pages/README-Programmer-Edition.md', category: 'developer-tool', parser: 'markdown',
    url: 'https://raw.githubusercontent.com/1c7/chinese-independent-developer/master/.github/pages/README-Programmer-Edition.md'
  },
  {
    repository: '1c7/chinese-independent-developer',
    repositoryUrl: 'https://github.com/1c7/chinese-independent-developer',
    ref: 'master', sourceFile: '.github/pages/README-Game.md', category: 'game', parser: 'markdown',
    url: 'https://raw.githubusercontent.com/1c7/chinese-independent-developer/master/.github/pages/README-Game.md'
  },
  {
    repository: '1c7/chinese-independent-developer',
    repositoryUrl: 'https://github.com/1c7/chinese-independent-developer',
    ref: 'master', sourceFile: '.github/pages/README-Archive.md', category: 'archive', parser: 'markdown', preserveOnMissing: true,
    url: 'https://raw.githubusercontent.com/1c7/chinese-independent-developer/master/.github/pages/README-Archive.md'
  },
  {
    repository: 'XiaomingX/1000-chinese-independent-developer-plus',
    repositoryUrl: 'https://github.com/XiaomingX/1000-chinese-independent-developer-plus',
    ref: 'main', sourceFile: 'README.md', parser: 'project-table',
    url: 'https://raw.githubusercontent.com/XiaomingX/1000-chinese-independent-developer-plus/main/README.md'
  }
]

const TOOL_REMOTE_SOURCES = [
  {
    repository: 'yaolifeng0629/Awesome-independent-tools',
    repositoryUrl: 'https://github.com/yaolifeng0629/Awesome-independent-tools',
    ref: 'main', sourceFile: 'README.md', parser: 'tool-directory',
    url: 'https://raw.githubusercontent.com/yaolifeng0629/Awesome-independent-tools/main/README.md'
  }
]

const PRODUCT_LOCAL_SOURCES = [
  { ...PRODUCT_REMOTE_SOURCES[0], path: 'fixtures/upstream-sample.md' },
  { ...PRODUCT_REMOTE_SOURCES[1], path: 'fixtures/programmer-sample.md' },
  { ...PRODUCT_REMOTE_SOURCES[2], path: 'fixtures/game-sample.md' },
  { ...PRODUCT_REMOTE_SOURCES[3], path: 'fixtures/archive-sample.md' },
  { ...PRODUCT_REMOTE_SOURCES[4], path: 'fixtures/plus-sample.md' }
]

const TOOL_LOCAL_SOURCES = [
  { ...TOOL_REMOTE_SOURCES[0], path: 'fixtures/awesome-tools-sample.md' }
]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchText(url, attempts = 3) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'indiebase-cn/0.4' },
        signal: AbortSignal.timeout(30_000)
      })
      if (response.ok) return response.text()
      const error = new Error('Fetch failed: ' + response.status + ' ' + url)
      error.status = response.status
      if (response.status === 404 || (response.status < 500 && response.status !== 429)) throw error
      lastError = error
    } catch (error) {
      lastError = error
      if (error.status === 404 || (error.status && error.status < 500 && error.status !== 429)) throw error
    }
    if (attempt < attempts) await sleep(500 * 2 ** (attempt - 1))
  }
  throw lastError
}

async function readSources(remoteSources, localSources, useFixtures) {
  if (useFixtures) {
    const sources = await Promise.all(localSources.map(async (source) => ({ ...source, text: await readFile(source.path, 'utf8') })))
    return {
      sources,
      health: sources.map((source) => ({
        repository: source.repository, sourceFile: source.sourceFile, url: source.url, status: 'fixture-preview', required: !source.preserveOnMissing
      }))
    }
  }

  const results = await Promise.all(remoteSources.map(async (source) => {
    try {
      return {
        source: { ...source, text: await fetchText(source.url) },
        health: { repository: source.repository, sourceFile: source.sourceFile, url: source.url, status: 'ok', required: !source.preserveOnMissing }
      }
    } catch (error) {
      if (source.preserveOnMissing && error.status === 404) {
        return {
          source: null,
          health: { repository: source.repository, sourceFile: source.sourceFile, url: source.url, status: 'missing-preservable', required: false, error: error.message }
        }
      }
      return {
        source: null,
        error,
        health: { repository: source.repository, sourceFile: source.sourceFile, url: source.url, status: 'failed', required: true, error: error.message }
      }
    }
  }))

  const failures = results.filter((result) => result.error)
  if (failures.length) {
    const message = failures.map((result) => result.health.repository + '/' + result.health.sourceFile + ': ' + result.error.message).join('\n')
    if (process.env.CI) throw new Error('Required upstream source failures:\n' + message)
    console.warn('Remote sync unavailable; using checked-in fixtures.\n' + message)
    const sources = await Promise.all(localSources.map(async (source) => ({ ...source, text: await readFile(source.path, 'utf8') })))
    return {
      sources,
      health: sources.map((source) => ({
        repository: source.repository, sourceFile: source.sourceFile, url: source.url, status: 'fixture-fallback', required: !source.preserveOnMissing
      }))
    }
  }

  return {
    sources: results.map((result) => result.source).filter(Boolean),
    health: results.map((result) => result.health)
  }
}

async function readPreservedArchive(payload) {
  const archiveFiles = new Set(['pages/README-2018-2020.md', '.github/pages/README-Archive.md'])
  const records = (payload.records || []).flatMap((record) => {
    const sources = (record.sources || []).filter((source) =>
      source.repository === '1c7/chinese-independent-developer' && archiveFiles.has(source.sourceFile)
    )
    if (!sources.length) return []
    const source = sources[0]
    return [{
      ...record,
      category: 'archive',
      sources,
      sourceRepository: source.repository,
      sourceFile: source.sourceFile,
      sourceSection: source.sourceSection,
      sourceLine: source.sourceLine,
      rawText: source.rawText,
      sourceRepositories: [...new Set(sources.map((item) => item.repository))],
      sourceCount: sources.length
    }]
  })
  if (!records.length) {
    throw new Error('Archive source disappeared upstream and no preserved archive records exist in data/products.json')
  }
  console.warn('Preserving ' + records.length + ' records from the last successful archive snapshot.')
  return { records, warnings: [] }
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return fallback
    throw error
  }
}

function assertNoUnexpectedShrink(dataset, previousPayload, nextRecords, fixtureMode) {
  if (fixtureMode || process.env.ALLOW_DATASET_SHRINK === '1') return
  const previousCount = previousPayload.records?.length || 0
  if (previousCount < 100) return
  const shrinkRatio = (previousCount - nextRecords.length) / previousCount
  const limit = Number(process.env.MAX_DATASET_SHRINK_RATIO || 0.15)
  if (shrinkRatio > limit) {
    throw new Error(
      dataset + ' shrank unexpectedly from ' + previousCount + ' to ' + nextRecords.length +
      ' (' + (shrinkRatio * 100).toFixed(1) + '%). Set ALLOW_DATASET_SHRINK=1 only after manual review.'
    )
  }
}

function recordFingerprint(record, dataset) {
  const fields = dataset === 'products'
    ? ['productName', 'productUrl', 'description', 'developerName', 'city', 'date', 'status', 'category']
    : ['toolName', 'toolUrl', 'description', 'category', 'pricing']
  return JSON.stringify(Object.fromEntries(fields.map((field) => [field, record[field] ?? null])))
}

function compactChangeRecord(record, dataset) {
  return dataset === 'products'
    ? {
        id: record.id, name: record.productName, url: record.productUrl || null, description: record.description || null,
        developerName: record.developerName || null, category: record.category, status: record.status, date: record.date || null
      }
    : {
        id: record.id, name: record.toolName, url: record.toolUrl || null, description: record.description || null,
        category: record.category, pricing: record.pricing || 'unknown'
      }
}

function buildDatasetChanges(previousPayload, nextRecords, dataset) {
  const previousRecords = previousPayload.records || []
  const previousById = new Map(previousRecords.map((record) => [record.id, record]))
  const nextById = new Map(nextRecords.map((record) => [record.id, record]))
  const added = nextRecords.filter((record) => !previousById.has(record.id))
  const removed = previousRecords.filter((record) => !nextById.has(record.id))
  const changed = nextRecords.filter((record) => {
    const previous = previousById.get(record.id)
    return previous && recordFingerprint(previous, dataset) !== recordFingerprint(record, dataset)
  })
  return {
    previousCount: previousRecords.length,
    currentCount: nextRecords.length,
    addedCount: added.length,
    removedCount: removed.length,
    changedCount: changed.length,
    added: added.slice(0, 100).map((record) => compactChangeRecord(record, dataset)),
    removed: removed.slice(0, 100).map((record) => compactChangeRecord(record, dataset)),
    changed: changed.slice(0, 100).map((record) => compactChangeRecord(record, dataset))
  }
}

function parseSource(source) {
  if (source.parser === 'project-table') return parseProjectTable(source.text, source)
  if (source.parser === 'tool-directory') return parseToolDirectory(source.text, source)
  return parseMarkdown(source.text, source)
}

function buildMetadata(dataset, sources, fixtureMode) {
  return {
    dataset,
    snapshotMode: fixtureMode ? 'fixture-preview' : 'full-upstream',
    sourceRepositories: [...new Set(sources.map((source) => source.repository))],
    sources: sources.map((source) => ({
      repository: source.repository,
      repositoryUrl: source.repositoryUrl,
      ref: source.ref,
      sourceFile: source.sourceFile,
      parser: source.parser
    })),
    dedupeStrategy: dataset === 'products'
      ? 'canonical URL, falling back to normalized product name + developer; merge sources only within products'
      : 'canonical URL, falling back to normalized tool name; merge sources only within tools'
  }
}

const useFixtures = process.argv.includes('--fixtures')
const [previousProducts, previousTools] = await Promise.all([
  readJson('data/products.json', { metadata: {}, records: [] }),
  readJson('data/tools.json', { metadata: {}, records: [] })
])
const [productResult, toolResult] = await Promise.all([
  readSources(PRODUCT_REMOTE_SOURCES, PRODUCT_LOCAL_SOURCES, useFixtures),
  readSources(TOOL_REMOTE_SOURCES, TOOL_LOCAL_SOURCES, useFixtures)
])
const productSources = productResult.sources
const toolSources = toolResult.sources
const fixtureMode = [...productSources, ...toolSources].some((source) => source.path)
const archiveSource = PRODUCT_REMOTE_SOURCES.find((source) => source.preserveOnMissing)
const archiveMissing = !useFixtures && !productSources.some((source) => source.sourceFile === archiveSource.sourceFile)
const preservedArchive = archiveMissing ? await readPreservedArchive(previousProducts) : null

const productParsed = [...productSources.map(parseSource), ...(preservedArchive ? [preservedArchive] : [])]
const toolParsed = toolSources.map(parseSource)
const products = mergeAndDedupe(productParsed, { dataset: 'products' })
const tools = mergeAndDedupe(toolParsed, { dataset: 'tools' })

assertNoUnexpectedShrink('products', previousProducts, products.records, fixtureMode)
assertNoUnexpectedShrink('tools', previousTools, tools.records, fixtureMode)

const productMetadataSources = preservedArchive
  ? [...productSources, { ...archiveSource, parser: 'preserved-json-snapshot', preserved: true }]
  : productSources
const productMetadata = buildMetadata('products', productMetadataSources, fixtureMode)
if (preservedArchive) {
  productMetadata.snapshotMode = 'full-upstream-with-preserved-archive'
  productMetadata.preservedArchiveRecords = preservedArchive.records.length
}
const toolMetadata = buildMetadata('tools', toolSources, fixtureMode)
const productQuality = buildQualityReport(products.records, products.warnings, productMetadata)
const toolQuality = buildQualityReport(tools.records, tools.warnings, toolMetadata)
const generatedAt = new Date().toISOString()
const crossDatasetOverlaps = findCrossDatasetOverlaps(products.records, tools.records)
const sourceHealth = [...productResult.health, ...toolResult.health].map((item) => {
  if (preservedArchive && item.sourceFile === archiveSource.sourceFile && item.status === 'missing-preservable') {
    return { ...item, status: 'preserved-snapshot' }
  }
  return item
})
const weeklyChanges = {
  generatedAt,
  baselineGeneratedAt: previousProducts.metadata?.generatedAt || null,
  mode: previousProducts.records?.length ? 'since-previous-snapshot' : 'initial-snapshot',
  products: buildDatasetChanges(previousProducts, products.records, 'products'),
  tools: buildDatasetChanges(previousTools, tools.records, 'tools')
}

await mkdir('data', { recursive: true })
await writeFile('data/products.json', JSON.stringify({
  metadata: { ...productMetadata, generatedAt },
  records: products.records
}, null, 2) + '\n')
await writeFile('data/tools.json', JSON.stringify({
  metadata: { ...toolMetadata, generatedAt },
  records: tools.records
}, null, 2) + '\n')
await writeFile('data/weekly-changes.json', JSON.stringify(weeklyChanges, null, 2) + '\n')
await writeFile('data/quality-report.json', JSON.stringify({
  generatedAt,
  products: productQuality,
  tools: toolQuality,
  sourceHealth,
  safety: {
    maxDatasetShrinkRatio: Number(process.env.MAX_DATASET_SHRINK_RATIO || 0.15),
    overrideEnv: 'ALLOW_DATASET_SHRINK=1'
  },
  crossDatasetOverlapCount: crossDatasetOverlaps.length,
  crossDatasetOverlaps,
  separationRule: 'Products and tools are separate datasets. Cross-dataset overlaps are reported but never merged.'
}, null, 2) + '\n')

console.log('Generated ' + products.records.length + ' product records and ' + tools.records.length + ' tool records (' + productMetadata.snapshotMode + ').')
console.log('Weekly changes: products +' + weeklyChanges.products.addedCount + '/-' + weeklyChanges.products.removedCount + ', tools +' + weeklyChanges.tools.addedCount + '/-' + weeklyChanges.tools.removedCount + '.')
console.log('Source health: ' + sourceHealth.map((item) => item.sourceFile + '=' + item.status).join(', '))
console.log('Warnings: products=' + products.warnings.length + ', tools=' + tools.warnings.length + '; cross-dataset overlaps=' + crossDatasetOverlaps.length + '.')
