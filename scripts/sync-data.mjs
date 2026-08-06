import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { parseMarkdown, mergeAndDedupe, buildQualityReport } from './lib/parser.mjs'

const REMOTE_SOURCES = [
  { sourceFile: 'README.md', category: 'product', url: 'https://raw.githubusercontent.com/1c7/chinese-independent-developer/master/README.md' },
  { sourceFile: 'pages/README-Programmer-Edition.md', category: 'developer-tool', url: 'https://raw.githubusercontent.com/1c7/chinese-independent-developer/master/pages/README-Programmer-Edition.md' },
  { sourceFile: 'pages/README-Game.md', category: 'game', url: 'https://raw.githubusercontent.com/1c7/chinese-independent-developer/master/pages/README-Game.md' },
  { sourceFile: 'pages/README-2018-2020.md', category: 'archive', url: 'https://raw.githubusercontent.com/1c7/chinese-independent-developer/master/pages/README-2018-2020.md' }
]

const LOCAL_SOURCES = [
  { sourceFile: 'README.md', category: 'product', path: 'fixtures/upstream-sample.md' },
  { sourceFile: 'pages/README-Programmer-Edition.md', category: 'developer-tool', path: 'fixtures/programmer-sample.md' },
  { sourceFile: 'pages/README-Game.md', category: 'game', path: 'fixtures/game-sample.md' },
  { sourceFile: 'pages/README-2018-2020.md', category: 'archive', path: 'fixtures/archive-sample.md' }
]

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'chinese-indie-developer-database/0.1' },
    signal: AbortSignal.timeout(30_000)
  })
  if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${url}`)
  return response.text()
}

async function loadSources() {
  const useFixtures = process.argv.includes('--fixtures')
  if (useFixtures) {
    return Promise.all(LOCAL_SOURCES.map(async (source) => ({ ...source, text: await readFile(source.path, 'utf8') })))
  }

  try {
    return await Promise.all(REMOTE_SOURCES.map(async (source) => ({ ...source, text: await fetchText(source.url) })))
  } catch (error) {
    if (process.env.CI) throw error
    console.warn(`Remote sync unavailable (${error.message}); using checked-in fixtures.`)
    return Promise.all(LOCAL_SOURCES.map(async (source) => ({ ...source, text: await readFile(source.path, 'utf8') })))
  }
}

const sources = await loadSources()
const parsed = sources.map((source) => parseMarkdown(source.text, source))
const { records, warnings } = mergeAndDedupe(parsed)
const isFixtureSnapshot = sources.some((source) => source.path)
const metadata = {
  upstreamRepository: '1c7/chinese-independent-developer',
  snapshotMode: isFixtureSnapshot ? 'fixture-preview' : 'full-upstream',
  sourceFiles: sources.map((source) => source.sourceFile)
}
const quality = buildQualityReport(records, warnings, metadata)

await mkdir('data', { recursive: true })
await writeFile('data/products.json', `${JSON.stringify({ metadata: { ...metadata, generatedAt: quality.generatedAt }, records }, null, 2)}\n`)
await writeFile('data/quality-report.json', `${JSON.stringify(quality, null, 2)}\n`)
console.log(`Generated ${records.length} product records (${metadata.snapshotMode}); warnings: ${warnings.length}`)
