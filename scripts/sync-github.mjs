import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const API_VERSION = '2022-11-28'
const DEFAULT_CONCURRENCY = 4
const RESERVED_OWNERS = new Set([
  'about', 'apps', 'blog', 'business', 'collections', 'contact', 'customer-stories',
  'enterprise', 'events', 'explore', 'features', 'issues', 'marketplace', 'new',
  'notifications', 'orgs', 'pricing', 'pulls', 'search', 'security', 'settings',
  'site', 'sponsors', 'topics', 'trending'
])

export function normalizeGitHubRepository(rawUrl) {
  if (!rawUrl) return null
  try {
    const url = new URL(rawUrl)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    if (host !== 'github.com') return null
    const parts = url.pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part))
    if (parts.length < 2 || RESERVED_OWNERS.has(parts[0].toLowerCase())) return null
    const owner = parts[0]
    const repository = parts[1].replace(/\.git$/i, '')
    if (!owner || !repository || repository.startsWith('.')) return null
    return {
      key: `${owner}/${repository}`.toLowerCase(),
      fullName: `${owner}/${repository}`,
      owner,
      repository,
      url: `https://github.com/${owner}/${repository}`
    }
  } catch {
    return null
  }
}

export function collectRepositoryCandidates(productsPayload, toolsPayload) {
  const repositories = new Map()
  const add = (recordType, record, rawUrl, name) => {
    const repository = normalizeGitHubRepository(rawUrl)
    if (!repository) return
    const current = repositories.get(repository.key) || { ...repository, references: [] }
    current.references.push({ recordType, id: record.id, name, url: rawUrl })
    repositories.set(repository.key, current)
  }

  for (const record of productsPayload.records || []) add('product', record, record.productUrl, record.productName)
  for (const record of toolsPayload.records || []) add('tool', record, record.toolUrl, record.toolName)
  return [...repositories.values()].sort((a, b) => a.key.localeCompare(b.key))
}

export function classifyRepositoryActivity(repository, now = new Date()) {
  if (!repository || repository.status !== 'available') return 'unavailable'
  if (repository.archived) return 'archived'
  const pushedAt = new Date(repository.pushedAt)
  if (Number.isNaN(pushedAt.getTime())) return 'unknown'
  const days = Math.max(0, (now.getTime() - pushedAt.getTime()) / 86_400_000)
  if (days <= 30) return 'active-30'
  if (days <= 90) return 'active-90'
  if (days <= 365) return 'active-year'
  return 'inactive-year'
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return fallback
    throw error
  }
}

function toRepositoryRecord(payload, candidate, response, fetchedAt) {
  return {
    key: candidate.key,
    fullName: payload.full_name || candidate.fullName,
    url: payload.html_url || candidate.url,
    description: payload.description || null,
    stars: payload.stargazers_count || 0,
    forks: payload.forks_count || 0,
    watchers: payload.subscribers_count || 0,
    openIssues: payload.open_issues_count || 0,
    language: payload.language || null,
    license: payload.license?.spdx_id && payload.license.spdx_id !== 'NOASSERTION' ? payload.license.spdx_id : null,
    topics: payload.topics || [],
    archived: Boolean(payload.archived),
    disabled: Boolean(payload.disabled),
    isFork: Boolean(payload.fork),
    createdAt: payload.created_at || null,
    updatedAt: payload.updated_at || null,
    pushedAt: payload.pushed_at || null,
    defaultBranch: payload.default_branch || null,
    visibility: payload.visibility || 'public',
    status: 'available',
    activity: classifyRepositoryActivity({ status: 'available', archived: payload.archived, pushedAt: payload.pushed_at }),
    fetchedAt,
    checkedAt: fetchedAt,
    etag: response.headers.get('etag'),
    references: candidate.references
  }
}

async function fetchRepository(candidate, previous, token) {
  const fetchedAt = new Date().toISOString()
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': API_VERSION,
    'User-Agent': 'indiebase-cn-github-enrichment'
  }
  if (token) headers.Authorization = `Bearer ${token}`
  if (previous?.etag) headers['If-None-Match'] = previous.etag

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  try {
    const response = await fetch(`https://api.github.com/repos/${candidate.owner}/${candidate.repository}`, {
      headers,
      signal: controller.signal
    })

    if (response.status === 304 && previous) {
      return { ...previous, references: candidate.references, checkedAt: fetchedAt, status: previous.status || 'available' }
    }

    if (response.ok) {
      const payload = await response.json()
      return toRepositoryRecord(payload, candidate, response, fetchedAt)
    }

    if (response.status === 404 || response.status === 451) {
      return {
        key: candidate.key,
        fullName: candidate.fullName,
        url: candidate.url,
        status: 'unavailable',
        reason: response.status === 404 ? 'not-found-or-private' : 'unavailable-for-legal-reasons',
        fetchedAt,
        checkedAt: fetchedAt,
        references: candidate.references
      }
    }

    const message = `${response.status} ${response.statusText}`.trim()
    if (previous) return { ...previous, references: candidate.references, checkedAt: fetchedAt, stale: true, lastError: message }
    return { key: candidate.key, fullName: candidate.fullName, url: candidate.url, status: 'error', lastError: message, checkedAt: fetchedAt, references: candidate.references }
  } catch (error) {
    const message = error.name === 'AbortError' ? 'request-timeout' : error.message
    if (previous) return { ...previous, references: candidate.references, checkedAt: fetchedAt, stale: true, lastError: message }
    return { key: candidate.key, fullName: candidate.fullName, url: candidate.url, status: 'error', lastError: message, checkedAt: fetchedAt, references: candidate.references }
  } finally {
    clearTimeout(timer)
  }
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await mapper(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, worker))
  return results
}

function updateHistory(previousHistory, repositories, date) {
  const history = { ...(previousHistory.repositories || {}) }
  for (const repository of repositories) {
    if (repository.status !== 'available') continue
    const snapshots = [...(history[repository.key] || [])]
    const snapshot = { date, stars: repository.stars, forks: repository.forks }
    const sameDateIndex = snapshots.findIndex((item) => item.date === date)
    if (sameDateIndex >= 0) snapshots[sameDateIndex] = snapshot
    else snapshots.push(snapshot)
    history[repository.key] = snapshots
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-104)
  }
  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      cadence: 'weekly',
      retentionWeeks: 104,
      note: 'Snapshots begin when IndieBase CN starts observing a repository; historical GitHub Star data is not backfilled.'
    },
    repositories: history
  }
}

export async function syncGitHubRepositories({
  productsPath = 'data/products.json',
  toolsPath = 'data/tools.json',
  outputPath = 'data/github-repositories.json',
  historyPath = 'data/github-history.json',
  token = process.env.GITHUB_TOKEN,
  concurrency = Number(process.env.GITHUB_SYNC_CONCURRENCY || DEFAULT_CONCURRENCY)
} = {}) {
  const [productsPayload, toolsPayload, previousPayload, previousHistory] = await Promise.all([
    readJson(productsPath, { records: [] }),
    readJson(toolsPath, { records: [] }),
    readJson(outputPath, { repositories: {} }),
    readJson(historyPath, { repositories: {} })
  ])

  const candidates = collectRepositoryCandidates(productsPayload, toolsPayload)
  const previousRepositories = previousPayload.repositories || {}

  if (!token && candidates.length > 60) {
    throw new Error(`GITHUB_TOKEN is required to sync ${candidates.length} repositories without exceeding the unauthenticated API limit.`)
  }

  const synchronized = await mapWithConcurrency(candidates, Math.max(1, Math.min(concurrency, 6)), (candidate) =>
    fetchRepository(candidate, previousRepositories[candidate.key], token)
  )

  const repositoryMap = Object.fromEntries(synchronized.map((repository) => [repository.key, repository]))
  const availableCount = synchronized.filter((repository) => repository.status === 'available').length
  const unavailableCount = synchronized.filter((repository) => repository.status === 'unavailable').length
  const errorCount = synchronized.filter((repository) => repository.status === 'error').length
  const generatedAt = new Date().toISOString()
  const output = {
    metadata: {
      generatedAt,
      provider: 'GitHub REST API',
      endpoint: '/repos/{owner}/{repo}',
      repositoryCandidates: candidates.length,
      availableRepositories: availableCount,
      unavailableRepositories: unavailableCount,
      errorRepositories: errorCount,
      extractionRule: 'Only direct productUrl/toolUrl links that resolve to github.com/{owner}/{repository} are enriched.',
      missingMeaning: 'A product without a repository entry is not treated as a zero-star project.'
    },
    repositories: repositoryMap
  }

  const date = generatedAt.slice(0, 10)
  const history = updateHistory(previousHistory, synchronized, date)
  await Promise.all([
    writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`),
    writeFile(historyPath, `${JSON.stringify(history, null, 2)}\n`)
  ])

  console.log(`GitHub enrichment: ${availableCount}/${candidates.length} available, ${unavailableCount} unavailable, ${errorCount} errors.`)
  return output
}

const isEntrypoint = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isEntrypoint) {
  await syncGitHubRepositories()
}
