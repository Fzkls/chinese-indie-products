

function mergeHistoryRepositories(target, repositories = {}) {
  for (const [key, snapshots] of Object.entries(repositories)) {
    const merged = [...(target[key] || []), ...(snapshots || [])]
    const byDate = new Map(merged.filter((item) => item?.date).map((item) => [item.date, item]))
    target[key] = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
  }
  return target
}

export async function loadGithubHistory({ maxYears = 2 } = {}) {
  try {
    const indexResponse = await fetch('data/github-history/index.json')
    if (!indexResponse.ok) return { metadata: {}, repositories: {}, years: [] }
    const index = await indexResponse.json()
    const availableYears = [...new Set((index.years || []).map(Number).filter(Number.isFinite))].sort((a, b) => b - a)
    const years = availableYears.slice(0, Math.max(1, maxYears)).sort((a, b) => a - b)
    const shardResponses = await Promise.all(years.map((year) => fetch(`data/github-history/${year}.json`)))
    const shards = await Promise.all(shardResponses.map(async (response) => response.ok ? response.json() : { repositories: {} }))
    const repositories = {}
    for (const shard of shards) mergeHistoryRepositories(repositories, shard.repositories || {})
    return { metadata: index.metadata || {}, repositories, years }
  } catch {
    return { metadata: {}, repositories: {}, years: [] }
  }
}

export function repositoryTrend(snapshots = []) {
  const ordered = [...snapshots]
    .filter((item) => item?.date)
    .sort((a, b) => a.date.localeCompare(b.date))
  if (ordered.length < 2) return null

  const latest = ordered.at(-1)
  const previous = ordered.at(-2)
  const latestDate = new Date(latest.date + 'T00:00:00Z')
  const previousDate = new Date(previous.date + 'T00:00:00Z')
  const days = Math.max(1, Math.round((latestDate - previousDate) / 86_400_000))
  const previousStars = Number(previous.stars) || 0
  const latestStars = Number(latest.stars) || 0
  const starDelta = latestStars - previousStars
  const forkDelta = (Number(latest.forks) || 0) - (Number(previous.forks) || 0)

  return {
    latest,
    previous,
    days,
    starDelta,
    forkDelta,
    starGrowthPercent: previousStars > 0 ? starDelta / previousStars * 100 : null
  }
}

export function lifecycleKey(repository) {
  if (!repository || repository.status !== 'available') return 'unavailable'
  if (repository.archived) return 'archived'
  if (repository.activity) return repository.activity
  const pushedAt = new Date(repository.pushedAt)
  if (Number.isNaN(pushedAt.getTime())) return 'unknown'
  const days = Math.max(0, (Date.now() - pushedAt.getTime()) / 86_400_000)
  if (days <= 30) return 'active-30'
  if (days <= 90) return 'active-90'
  if (days <= 365) return 'active-year'
  return 'inactive-year'
}


function orderedSnapshots(snapshots = []) {
  return [...snapshots]
    .filter((item) => item?.date)
    .sort((a, b) => a.date.localeCompare(b.date))
}

function dateDistanceDays(from, to) {
  const start = new Date(from + 'T00:00:00Z')
  const end = new Date(to + 'T00:00:00Z')
  return Math.max(1, Math.round((end - start) / 86_400_000))
}

export function snapshotWindowTrend(snapshots = [], startDate, endDate) {
  const ordered = orderedSnapshots(snapshots).filter((item) => !endDate || item.date <= endDate)
  if (!ordered.length || !startDate) return null

  const latest = [...ordered].reverse().find((item) => item.date >= startDate)
  if (!latest) return null

  const baseline = [...ordered].reverse().find((item) => item.date <= startDate)
    || ordered.find((item) => item.date >= startDate)
  if (!baseline || baseline.date === latest.date) return null

  const baselineStars = Number(baseline.stars) || 0
  const latestStars = Number(latest.stars) || 0
  const starDelta = latestStars - baselineStars
  const forkDelta = (Number(latest.forks) || 0) - (Number(baseline.forks) || 0)

  return {
    baseline,
    latest,
    days: dateDistanceDays(baseline.date, latest.date),
    starDelta,
    forkDelta,
    starGrowthPercent: baselineStars > 0 ? starDelta / baselineStars * 100 : null,
    partialBaseline: baseline.date > startDate
  }
}

export function aggregateSnapshotIntervals(snapshotGroups = [], startDate, endDate) {
  const buckets = new Map()
  for (const snapshots of snapshotGroups) {
    const ordered = orderedSnapshots(snapshots)
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1]
      const current = ordered[index]
      if (startDate && current.date < startDate) continue
      if (endDate && current.date > endDate) continue
      const bucket = buckets.get(current.date) || {
        date: current.date,
        starDelta: 0,
        forkDelta: 0,
        intervalDays: 1,
        repositories: 0
      }
      bucket.starDelta += (Number(current.stars) || 0) - (Number(previous.stars) || 0)
      bucket.forkDelta += (Number(current.forks) || 0) - (Number(previous.forks) || 0)
      bucket.intervalDays = Math.max(bucket.intervalDays, dateDistanceDays(previous.date, current.date))
      bucket.repositories += 1
      buckets.set(current.date, bucket)
    }
  }
  return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export const LIFECYCLE_LABELS = {
  'active-30': '持续活跃',
  'active-90': '近期活跃',
  'active-year': '一年内维护',
  'inactive-year': '长期未更新',
  archived: '已归档',
  unavailable: '仓库不可用',
  unknown: '更新时间未知'
}
