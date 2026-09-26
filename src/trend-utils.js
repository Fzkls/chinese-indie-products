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

export const LIFECYCLE_LABELS = {
  'active-30': '持续活跃',
  'active-90': '近期活跃',
  'active-year': '一年内维护',
  'inactive-year': '长期未更新',
  archived: '已归档',
  unavailable: '仓库不可用',
  unknown: '更新时间未知'
}
