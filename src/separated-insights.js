import './taxonomy-insights.js'
import { aggregateSnapshotIntervals, loadGithubHistory, snapshotWindowTrend } from './trend-utils.js'

const RESERVED_GITHUB_OWNERS = new Set(['about', 'apps', 'blog', 'collections', 'enterprise', 'events', 'explore', 'features', 'issues', 'marketplace', 'orgs', 'pricing', 'pulls', 'search', 'settings', 'sponsors', 'topics', 'trending'])
const ACTIVITY_LABELS = {
  'active-30': '30 天内更新',
  'active-90': '31–90 天内更新',
  'active-year': '一年内更新',
  'inactive-year': '超过一年未更新',
  archived: '已归档',
  unavailable: '无可用仓库',
  unknown: '更新时间未知'
}
const insightState = { products: [], tools: [], repositories: {}, githubHistory: {}, githubMetadata: {}, trendRange: '7d' }
const formatNumber = (value) => new Intl.NumberFormat('zh-CN').format(Number(value) || 0)
const formatCompact = (value) => new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value) || 0)
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => {
  const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;' }
  return char === '"' ? '&quot;' : entities[char]
})

function normalizeGitHubRepository(rawUrl) {
  if (!rawUrl) return null
  try {
    const url = new URL(rawUrl)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    if (host !== 'github.com') return null
    const parts = url.pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part))
    if (parts.length < 2 || RESERVED_GITHUB_OWNERS.has(parts[0].toLowerCase())) return null
    const repository = parts[1].replace(/\.git$/i, '')
    if (!repository) return null
    return `${parts[0]}/${repository}`.toLowerCase()
  } catch {
    return null
  }
}

function classifyActivity(repository) {
  if (!repository || repository.status !== 'available') return 'unknown'
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

function repositoryItems(records, repositories, type) {
  const map = new Map()
  for (const record of records) {
    const key = normalizeGitHubRepository(type === 'product' ? record.productUrl : record.toolUrl)
    const repository = key ? repositories[key] : null
    if (!repository || repository.status !== 'available') continue
    const current = map.get(key)
    const item = { key, repository, record, type }
    if (!current || (repository.stars || 0) > (current.repository.stars || 0)) map.set(key, item)
  }
  return [...map.values()]
}

function setText(id, value) {
  const node = document.getElementById(id)
  if (node) node.textContent = value
}

function installResetControl(sectionId, type) {
  const section = document.getElementById(sectionId)
  const heading = section?.querySelector('.section-heading')
  const resetTarget = document.getElementById(type === 'product' ? 'reset-filters' : 'reset-tool-filters')
  if (!heading || !resetTarget || heading.querySelector(`[data-visual-reset="${type}"]`)) return

  const trailing = [...heading.children].slice(1)
  const actions = document.createElement('div')
  actions.className = 'visual-heading-actions'
  trailing.forEach((node) => actions.append(node))

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'visual-reset'
  button.dataset.visualReset = type
  button.textContent = type === 'product' ? '清空产品筛选' : '清空工具筛选'
  button.addEventListener('click', () => resetTarget.click())
  actions.append(button)
  heading.append(actions)
}

function bindRecordNavigation(container, type) {
  for (const row of container.querySelectorAll('[data-record-name]')) {
    row.addEventListener('click', () => {
      const input = document.getElementById(type === 'product' ? 'search' : 'tool-search')
      input.value = row.dataset.recordName
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }
}

function renderRankList(id, items, type) {
  const container = document.getElementById(id)
  const top = [...items].sort((a, b) => (b.repository.stars || 0) - (a.repository.stars || 0)).slice(0, 20)
  const maxStars = Math.max(...top.map((item) => item.repository.stars || 0), 1)
  container.innerHTML = top.length
    ? top.map((item, index) => {
        const name = type === 'product' ? item.record.productName : item.record.toolName
        const activity = ACTIVITY_LABELS[classifyActivity(item.repository)] || '未知'
        return `<button class="github-rank-row" type="button" data-record-name="${escapeHtml(name)}" title="${escapeHtml(item.repository.fullName)} · ★ ${formatNumber(item.repository.stars)} · ${escapeHtml(activity)}">
          <span class="rank-number">${String(index + 1).padStart(2, '0')}</span>
          <span class="rank-main"><span class="rank-title">${escapeHtml(name)}</span><span class="rank-repo">${escapeHtml(item.repository.fullName)}</span><span class="rank-track"><span class="rank-fill" style="width:${(item.repository.stars || 0) / maxStars * 100}%"></span></span></span>
          <strong>★ ${formatCompact(item.repository.stars)}</strong>
        </button>`
      }).join('')
    : '<div class="empty-state"><strong>当前筛选暂无可统计的 GitHub 仓库</strong></div>'
  bindRecordNavigation(container, type)
}

function renderActivity(id, items) {
  const order = ['active-30', 'active-90', 'active-year', 'inactive-year', 'archived', 'unknown']
  const counts = new Map(order.map((key) => [key, 0]))
  for (const item of items) {
    const activity = classifyActivity(item.repository)
    counts.set(activity, (counts.get(activity) || 0) + 1)
  }
  const max = Math.max(...counts.values(), 1)
  const total = items.length
  const container = document.getElementById(id)
  container.innerHTML = order
    .filter((key) => counts.get(key))
    .map((key) => `<div class="activity-row" title="${ACTIVITY_LABELS[key]}：${formatNumber(counts.get(key))} / ${formatNumber(total)}（${total ? Math.round(counts.get(key) / total * 100) : 0}%）">
      <span>${ACTIVITY_LABELS[key]}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${counts.get(key) / max * 100}%"></span></span>
      <strong>${formatNumber(counts.get(key))} <small>${total ? Math.round(counts.get(key) / total * 100) : 0}%</small></strong>
    </div>`).join('') || '<div class="empty-state"><strong>当前筛选暂无仓库活跃度数据</strong></div>'
}

function chinaDateLabel(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function shiftDateLabel(dateLabel, days) {
  const date = new Date(dateLabel + 'T00:00:00Z')
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function trendRangeBounds(range) {
  const endDate = chinaDateLabel()
  return {
    startDate: range === 'month' ? endDate.slice(0, 8) + '01' : shiftDateLabel(endDate, -6),
    endDate
  }
}

function shortDate(dateLabel) {
  const [, month, day] = dateLabel.split('-')
  return `${Number(month)}/${Number(day)}`
}

function formatSigned(value) {
  const number = Number(value) || 0
  return `${number > 0 ? '+' : ''}${formatCompact(number)}`
}

function productTrendRows(items, startDate, endDate) {
  return items
    .map((item) => {
      const trend = snapshotWindowTrend(insightState.githubHistory[item.key] || [], startDate, endDate)
      if (!trend) return null
      return { ...item, trend }
    })
    .filter(Boolean)
}

function renderTrendChart(series) {
  const container = document.getElementById('product-github-trend-chart')
  if (!container) return
  if (!series.length) {
    container.innerHTML = '<div class="github-trend-empty">当前时间范围内还没有足够的连续快照形成趋势。</div>'
    return
  }

  const width = 760
  const height = 250
  const pad = { top: 22, right: 22, bottom: 42, left: 46 }
  const plotWidth = width - pad.left - pad.right
  const plotHeight = height - pad.top - pad.bottom
  const values = series.map((item) => item.starDelta)
  let min = Math.min(0, ...values)
  let max = Math.max(0, ...values)
  if (min === max) max = min + 1
  const span = max - min
  const x = (index) => pad.left + (series.length === 1 ? plotWidth / 2 : index / (series.length - 1) * plotWidth)
  const y = (value) => pad.top + (max - value) / span * plotHeight
  const zeroY = y(0)
  const points = series.map((item, index) => `${x(index)},${y(item.starDelta)}`).join(' ')
  const areaPoints = series.length > 1
    ? `${pad.left},${zeroY} ${points} ${pad.left + plotWidth},${zeroY}`
    : ''
  const labelEvery = Math.max(1, Math.ceil(series.length / 7))

  const horizontalGuides = [0, .25, .5, .75, 1].map((ratio) => {
    const guideY = pad.top + ratio * plotHeight
    const guideValue = max - ratio * span
    return `<line class="trend-grid-line" x1="${pad.left}" y1="${guideY}" x2="${pad.left + plotWidth}" y2="${guideY}"></line>
      <text class="trend-value-label" x="${pad.left - 8}" y="${guideY + 3}" text-anchor="end">${escapeHtml(formatCompact(Math.round(guideValue)))}</text>`
  }).join('')

  const dateLabels = series.map((item, index) => {
    if (index % labelEvery !== 0 && index !== series.length - 1) return ''
    return `<text class="trend-axis-label" x="${x(index)}" y="${height - 13}" text-anchor="middle">${escapeHtml(shortDate(item.date))}</text>`
  }).join('')

  const circles = series.map((item, index) => `<circle class="trend-point" cx="${x(index)}" cy="${y(item.starDelta)}" r="4">
      <title>${escapeHtml(item.date)} · Star ${escapeHtml(formatSigned(item.starDelta))}${item.intervalDays > 1 ? ` · ${item.intervalDays} 天区间累计` : ''}</title>
    </circle>`).join('')

  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="GitHub Star 增量趋势">
    ${horizontalGuides}
    <line class="trend-zero-line" x1="${pad.left}" y1="${zeroY}" x2="${pad.left + plotWidth}" y2="${zeroY}"></line>
    ${areaPoints ? `<polygon class="trend-area" points="${areaPoints}"></polygon>` : ''}
    ${series.length > 1 ? `<polyline class="trend-line" points="${points}"></polyline>` : ''}
    ${circles}
    ${dateLabels}
  </svg>`
}

function renderGrowthRanking(rows) {
  const container = document.getElementById('product-github-growth-ranking')
  if (!container) return
  const ranked = [...rows]
    .filter((item) => item.trend.starDelta > 0 || item.trend.forkDelta > 0)
    .sort((a, b) => b.trend.starDelta - a.trend.starDelta || b.trend.forkDelta - a.trend.forkDelta)
    .slice(0, 10)

  container.innerHTML = ranked.length
    ? ranked.map((item, index) => {
        const name = item.record.productName
        return `<button class="github-growth-row" type="button" data-record-name="${escapeHtml(name)}" title="${escapeHtml(item.repository.fullName)}">
          <span class="github-growth-rank">${String(index + 1).padStart(2, '0')}</span>
          <span class="github-growth-main"><strong class="github-growth-name">${escapeHtml(name)}</strong><small class="github-growth-repo">${escapeHtml(item.repository.fullName)}</small></span>
          <span class="github-growth-value"><strong>${escapeHtml(formatSigned(item.trend.starDelta))} ★</strong><small>${escapeHtml(formatSigned(item.trend.forkDelta))} Fork</small></span>
        </button>`
      }).join('')
    : '<div class="github-trend-empty">当前时间范围内暂无正向 GitHub 增长。</div>'
  bindRecordNavigation(container, 'product')
}

function renderProductTrend(items) {
  const { startDate, endDate } = trendRangeBounds(insightState.trendRange)
  const rows = productTrendRows(items, startDate, endDate)
  const starDelta = rows.reduce((sum, item) => sum + item.trend.starDelta, 0)
  const forkDelta = rows.reduce((sum, item) => sum + item.trend.forkDelta, 0)
  const growing = rows.filter((item) => item.trend.starDelta > 0).length
  const updated = items.filter((item) => {
    const pushedDate = item.repository.pushedAt?.slice(0, 10)
    return pushedDate && pushedDate >= startDate && pushedDate <= endDate
  }).length
  const series = aggregateSnapshotIntervals(
    items.map((item) => insightState.githubHistory[item.key] || []),
    startDate,
    endDate
  )

  setText('product-trend-stars', formatSigned(starDelta))
  setText('product-trend-forks', formatSigned(forkDelta))
  setText('product-trend-growing', formatNumber(growing))
  setText('product-trend-updated', formatNumber(updated))
  setText('product-trend-range-label', `${shortDate(startDate)} – ${shortDate(endDate)}`)
  setText('product-trend-chart-note', `可比较 ${formatNumber(rows.length)} 个仓库 · ${formatNumber(series.length)} 个快照增量点`)

  const longestGap = Math.max(1, ...series.map((item) => item.intervalDays || 1))
  setText('product-github-trend-footnote', longestGap > 1
    ? `历史数据存在最长 ${longestGap} 天的采样间隔，该点按区间累计展示，不会拆分或插值；每日任务上线后将形成连续快照。`
    : '历史缺失日期不会插值；当前快照已按日连续采集。')

  renderTrendChart(series)
  renderGrowthRanking(rows)
}

function bindProductTrendTabs() {
  for (const button of document.querySelectorAll('[data-github-trend-range]')) {
    button.addEventListener('click', () => {
      insightState.trendRange = button.dataset.githubTrendRange
      for (const item of document.querySelectorAll('[data-github-trend-range]')) {
        const active = item.dataset.githubTrendRange === insightState.trendRange
        item.classList.toggle('active', active)
        item.setAttribute('aria-selected', String(active))
      }
      renderProductInsights()
    })
  }
}

function renderToolCategories(tools) {
  const counts = new Map()
  for (const tool of tools) counts.set(tool.category || '未分类', (counts.get(tool.category || '未分类') || 0) + 1)
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const max = Math.max(...groups.map(([, count]) => count), 1)
  const container = document.getElementById('tool-category-chart')
  container.innerHTML = groups.map(([category, count]) => `<button class="bar-row" type="button" data-tool-category="${escapeHtml(category)}" title="${escapeHtml(category)}：${formatNumber(count)} 个工具">
    <span>${escapeHtml(category)}</span><span class="bar-track"><span class="bar-fill" style="width:${count / max * 100}%"></span></span><strong>${formatNumber(count)}</strong>
  </button>`).join('')
  for (const button of container.querySelectorAll('[data-tool-category]')) {
    button.addEventListener('click', () => {
      const select = document.getElementById('tool-category-filter')
      select.value = button.dataset.toolCategory
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }
}

function currentProductFilters() {
  return {
    query: document.getElementById('search')?.value.trim().toLowerCase() || '',
    category: document.getElementById('category-filter')?.value || '',
    status: document.getElementById('status-filter')?.value || '',
    activity: document.getElementById('activity-filter')?.value || '',
    year: document.getElementById('year-filter')?.value || '',
    city: document.getElementById('city-filter')?.value || ''
  }
}

function productMatchesCurrentFilters(record, filters) {
  const sourceText = (record.sources || []).map((source) => `${source.repository || ''} ${source.sourceFile || ''}`).join(' ')
  const key = normalizeGitHubRepository(record.productUrl)
  const repository = key ? insightState.repositories[key] : null
  const githubText = repository ? `${repository.fullName || ''} ${repository.language || ''} ${repository.license || ''}` : ''
  const haystack = [record.productName, record.description, record.developerName, record.city, record.sourceCategory, sourceText, githubText].filter(Boolean).join(' ').toLowerCase()
  return (!filters.query || haystack.includes(filters.query))
    && (!filters.category || record.category === filters.category)
    && (!filters.status || record.status === filters.status)
    && (!filters.activity || classifyActivity(repository) === filters.activity)
    && (!filters.year || String(record.year) === filters.year)
    && (!filters.city || record.city === filters.city)
}

function renderProductInsights() {
  const filters = currentProductFilters()
  const products = insightState.products.filter((record) => productMatchesCurrentFilters(record, filters))
  const repositories = repositoryItems(products, insightState.repositories, 'product')
  const allRepositories = repositoryItems(insightState.products, insightState.repositories, 'product')
  const hasFilter = Object.values(filters).some(Boolean)

  setText('metric-github', allRepositories.length)
  setText('product-github-count', `${formatNumber(repositories.length)} 个公开仓库`)
  setText('product-github-note', hasFilter
    ? `当前产品筛选命中 ${formatNumber(products.length)} 条，其中可明确关联 ${formatNumber(repositories.length)} 个公开 GitHub 仓库；本区域会随产品筛选联动。`
    : `全部 ${formatNumber(insightState.products.length)} 条产品中，可明确关联 ${formatNumber(repositories.length)} 个公开 GitHub 仓库；本区域会随产品筛选联动。`)
  renderRankList('product-github-top', repositories, 'product')
  renderActivity('product-github-activity', repositories)
  renderProductTrend(repositories)
}

function scheduleProductInsightsRender() {
  queueMicrotask(renderProductInsights)
}

function bindProductInsightFilters() {
  for (const id of ['search', 'category-filter', 'status-filter', 'activity-filter', 'year-filter', 'city-filter']) {
    const node = document.getElementById(id)
    if (!node) continue
    node.addEventListener(id === 'search' ? 'input' : 'change', scheduleProductInsightsRender)
  }
  document.getElementById('reset-filters')?.addEventListener('click', scheduleProductInsightsRender)
  document.getElementById('product-dashboard')?.addEventListener('click', scheduleProductInsightsRender)
  document.getElementById('product-dashboard')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') scheduleProductInsightsRender()
  })
}

async function initSeparatedInsights() {
  try {
    const [productsResponse, toolsResponse, githubResponse, historyPayload] = await Promise.all([
      fetch('data/products.json'),
      fetch('data/tools.json'),
      fetch('data/github-repositories.json'),
      loadGithubHistory()
    ])
    if (!productsResponse.ok || !toolsResponse.ok || !githubResponse.ok) throw new Error('数据文件加载失败')
    const [productsPayload, toolsPayload, githubPayload] = await Promise.all([
      productsResponse.json(),
      toolsResponse.json(),
      githubResponse.json()
    ])
    insightState.products = productsPayload.records || []
    insightState.tools = toolsPayload.records || []
    insightState.repositories = githubPayload.repositories || {}
    insightState.githubHistory = historyPayload.repositories || {}
    insightState.githubMetadata = githubPayload.metadata || {}

    const tools = insightState.tools
    const toolRepositories = repositoryItems(tools, insightState.repositories, 'tool')

    bindProductInsightFilters()
    bindProductTrendTabs()
    renderProductInsights()
    setText('tool-github-count', toolRepositories.length)
    setText('tool-category-count', new Set(tools.map((item) => item.category).filter(Boolean)).size)
    setText('tool-open-source-count', tools.filter((item) => item.pricing === 'open-source').length)
    setText('tool-github-note', `工具资源中可明确关联 ${formatNumber(toolRepositories.length)} 个公开 GitHub 仓库。只统计工具数据，不包含独立产品。`)

    renderToolCategories(tools)
    renderRankList('tool-github-top', toolRepositories, 'tool')
    renderActivity('tool-github-activity', toolRepositories)
  } catch (error) {
    console.error('Separated insights failed:', error)
    for (const id of ['product-github-top', 'tool-github-top', 'tool-category-chart']) {
      const node = document.getElementById(id)
      if (node) node.innerHTML = `<div class="empty-state"><strong>数据加载失败</strong><p>${escapeHtml(error.message)}</p></div>`
    }
  }
}

initSeparatedInsights()
