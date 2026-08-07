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
    ref: 'master', sourceFile: 'pages/README-Programmer-Edition.md', category: 'developer-tool', parser: 'markdown',
    url: 'https://raw.githubusercontent.com/1c7/chinese-independent-developer/master/pages/README-Programmer-Edition.md'
  },
  {
    repository: '1c7/chinese-independent-developer',
    repositoryUrl: 'https://github.com/1c7/chinese-independent-developer',
    ref: 'master', sourceFile: 'pages/README-Game.md', category: 'game', parser: 'markdown',
    url: 'https://raw.githubusercontent.com/1c7/chinese-independent-developer/master/pages/README-Game.md'
  },
  {
    repository: '1c7/chinese-independent-developer',
    repositoryUrl: 'https://github.com/1c7/chinese-independent-developer',
    ref: 'master', sourceFile: 'pages/README-2018-2020.md', category: 'archive', parser: 'markdown',
    url: 'https://raw.githubusercontent.com/1c7/chinese-independent-developer/master/pages/README-2018-2020.md'
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

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'indiebase-cn/0.2' },
    signal: AbortSignal.timeout(30_000)
  })
  if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${url}`)
  return response.text()
}

async function readSources(remoteSources, localSources, useFixtures) {
  if (useFixtures) {
    return Promise.all(localSources.map(async (source) => ({ ...source, text: await readFile(source.path, 'utf8') })))
  }
  try {
    return await Promise.all(remoteSources.map(async (source) => ({ ...source, text: await fetchText(source.url) })))
  } catch (error) {
    if (process.env.CI) throw error
    console.warn(`Remote sync unavailable (${error.message}); using checked-in fixtures.`)
    return Promise.all(localSources.map(async (source) => ({ ...source, text: await readFile(source.path, 'utf8') })))
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
const [productSources, toolSources] = await Promise.all([
  readSources(PRODUCT_REMOTE_SOURCES, PRODUCT_LOCAL_SOURCES, useFixtures),
  readSources(TOOL_REMOTE_SOURCES, TOOL_LOCAL_SOURCES, useFixtures)
])
const fixtureMode = [...productSources, ...toolSources].some((source) => source.path)

const productParsed = productSources.map(parseSource)
const toolParsed = toolSources.map(parseSource)
const products = mergeAndDedupe(productParsed, { dataset: 'products' })
const tools = mergeAndDedupe(toolParsed, { dataset: 'tools' })
const productMetadata = buildMetadata('products', productSources, fixtureMode)
const toolMetadata = buildMetadata('tools', toolSources, fixtureMode)
const productQuality = buildQualityReport(products.records, products.warnings, productMetadata)
const toolQuality = buildQualityReport(tools.records, tools.warnings, toolMetadata)
const generatedAt = new Date().toISOString()
const crossDatasetOverlaps = findCrossDatasetOverlaps(products.records, tools.records)

await mkdir('data', { recursive: true })
await writeFile('data/products.json', `${JSON.stringify({
  metadata: { ...productMetadata, generatedAt },
  records: products.records
}, null, 2)}\n`)
await writeFile('data/tools.json', `${JSON.stringify({
  metadata: { ...toolMetadata, generatedAt },
  records: tools.records
}, null, 2)}\n`)
await writeFile('data/quality-report.json', `${JSON.stringify({
  generatedAt,
  products: productQuality,
  tools: toolQuality,
  crossDatasetOverlapCount: crossDatasetOverlaps.length,
  crossDatasetOverlaps,
  separationRule: 'Products and tools are separate datasets. Cross-dataset overlaps are reported but never merged.'
}, null, 2)}\n`)

console.log(`Generated ${products.records.length} product records and ${tools.records.length} tool records (${productMetadata.snapshotMode}).`)
console.log(`Warnings: products=${products.warnings.length}, tools=${tools.warnings.length}; cross-dataset overlaps=${crossDatasetOverlaps.length}.`)
