const CATEGORY_LABELS = { product: '通用产品', 'developer-tool': '程序员工具', game: '游戏', archive: '历史归档' }
const CATEGORY_COLORS = { product: '#b9f24a', 'developer-tool': '#59dcc4', game: '#ffb35c', archive: '#82978f' }
const STATUS_LABELS = { active: '已上线', developing: '开发中', closed: '已关闭', acquired: '已收购', unknown: '状态未知' }
const PRICING_LABELS = { free: '免费', paid: '付费', 'open-source': '开源', unknown: '价格未知' }
const ACTIVITY_LABELS = {
  'active-30': '30 天内更新',
  'active-90': '31–90 天内更新',
  'active-year': '一年内更新',
  'inactive-year': '超过一年未更新',
  archived: '已归档',
  unknown: '更新时间未知'
}
const PRODUCT_PAGE_SIZE = 18
const TOOL_PAGE_SIZE = 24
const RESERVED_GITHUB_OWNERS = new Set(['about', 'apps', 'blog', 'collections', 'enterprise', 'events', 'explore', 'features', 'issues', 'marketplace', 'orgs', 'pricing', 'pulls', 'search', 'settings', 'sponsors', 'topics', 'trending'])

const productState = { all: [], filtered: [], visibleCount: PRODUCT_PAGE_SIZE, metadata: {}, query: '', category: '', status: '', year: '', city: '' }
const toolState = { all: [], filtered: [], visibleCount: TOOL_PAGE_SIZE, metadata: {}, query: '', category: '' }
const githubState = { repositories: {}, metadata: {}, history: {}, scope: 'all', activity: '' }
const el = (id) => document.getElementById(id)
const formatNumber = (value) => new Intl.NumberFormat('zh-CN').format(Number(value) || 0)
const formatCompact = (value) => new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value) || 0)
const uniqueSorted = (values, compare = (a, b) => String(a).localeCompare(String(b), 'zh-CN')) => [...new Set(values.filter(Boolean))].sort(compare)
const countBy = (records, key) => records.reduce((map, item) => map.set(item[key] || '未知', (map.get(item[key] || '未知') || 0) + 1), new Map())
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char])
const median = (values) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!sorted.length) return null
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2)
}

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

function repositoryForRecord(record) {
  const key = normalizeGitHubRepository(record.productUrl || record.toolUrl)
  return key ? githubState.repositories[key] || null : null
}

function classifyActivity(repository) {
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

function formatDate(value) {
  if (!value) return '未知'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '未知'
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
}

function fillSelect(select, entries, labeler = (value) => value) {
  const fragment = document.createDocumentFragment()
  for (const value of entries) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = labeler(value)
    fragment.append(option)
  }
  select.append(fragment)
}

function buildProductFilters() {
  fillSelect(el('category-filter'), uniqueSorted(productState.all.map((item) => item.category)), (value) => CATEGORY_LABELS[value] || value)
  fillSelect(el('status-filter'), uniqueSorted(productState.all.map((item) => item.status)), (value) => STATUS_LABELS[value] || value)
  fillSelect(el('year-filter'), uniqueSorted(productState.all.map((item) => item.year), (a, b) => b - a))
  fillSelect(el('city-filter'), uniqueSorted(productState.all.map((item) => item.city)))
}

function buildToolFilters() {
  fillSelect(el('tool-category-filter'), uniqueSorted(toolState.all.map((item) => item.category)))
}

function availableRepositories(records) {
  const map = new Map()
  for (const record of records) {
    const repository = repositoryForRecord(record)
    if (repository?.status === 'available') map.set(repository.key || normalizeGitHubRepository(repository.url), repository)
  }
  return [...map.values()]
}

function updateHeadlineMetrics(products, tools) {
  const developers = new Set(products.map((item) => item.developerName).filter(Boolean)).size
  const cities = new Set(products.map((item) => item.city).filter(Boolean)).size
  const active = products.filter((item) => ['active', 'developing'].includes(item.status)).length
  const githubProjects = availableRepositories([...products, ...tools]).length
  const values = {
    'hero-total': products.length,
    'metric-products': products.length,
    'metric-developers': developers,
    'metric-cities': cities,
    'metric-active': active,
    'metric-tools': tools.length,
    'metric-github': githubProjects
  }
  for (const [id, value] of Object.entries(values)) el(id).textContent = formatNumber(value)
}

function tooltipSummary(label, records) {
  const developers = new Set(records.map((item) => item.developerName).filter(Boolean)).size
  const active = records.filter((item) => ['active', 'developing'].includes(item.status)).length
  const repositories = availableRepositories(records)
  const starMedian = median(repositories.map((repository) => Number(repository.stars) || 0))
  const top = repositories.sort((a, b) => (b.stars || 0) - (a.stars || 0)).slice(0, 3)
  return `
    <div class="tooltip-title">${escapeHtml(label)}</div>
    <div class="tooltip-grid">
      <span>记录</span><strong>${formatNumber(records.length)}</strong>
      <span>开发者</span><strong>${formatNumber(developers)}</strong>
      <span>仍在运行</span><strong>${records.length ? Math.round(active / records.length * 100) : 0}%</strong>
      <span>GitHub 仓库</span><strong>${formatNumber(repositories.length)}</strong>
      <span>Star 中位数</span><strong>${starMedian === null ? '—' : formatNumber(starMedian)}</strong>
    </div>
    ${top.length ? `<div class="tooltip-top"><span>热门仓库</span>${top.map((repository) => `<div>${escapeHtml(repository.fullName)} <strong>★ ${formatCompact(repository.stars)}</strong></div>`).join('')}</div>` : ''}
  `
}

function positionTooltip(event, target) {
  const tooltip = el('chart-tooltip')
  const rect = target?.getBoundingClientRect()
  const x = event?.clientX ?? (rect ? rect.left + rect.width / 2 : window.innerWidth / 2)
  const y = event?.clientY ?? (rect ? rect.top : window.innerHeight / 2)
  const margin = 14
  tooltip.style.left = `${Math.min(window.innerWidth - tooltip.offsetWidth - margin, Math.max(margin, x + 16))}px`
  tooltip.style.top = `${Math.min(window.innerHeight - tooltip.offsetHeight - margin, Math.max(margin, y + 16))}px`
}

function bindTooltip(target, htmlFactory) {
  const show = (event) => {
    const tooltip = el('chart-tooltip')
    tooltip.innerHTML = htmlFactory()
    tooltip.hidden = false
    tooltip.setAttribute('aria-hidden', 'false')
    positionTooltip(event, target)
  }
  target.addEventListener('pointerenter', show)
  target.addEventListener('pointermove', (event) => positionTooltip(event, target))
  target.addEventListener('pointerleave', hideTooltip)
  target.addEventListener('focus', show)
  target.addEventListener('blur', hideTooltip)
}

function hideTooltip() {
  const tooltip = el('chart-tooltip')
  tooltip.hidden = true
  tooltip.setAttribute('aria-hidden', 'true')
}

function setProductFilter(key, value) {
  productState[key] = productState[key] === String(value) ? '' : String(value)
  const elementByKey = { category: 'category-filter', status: 'status-filter', year: 'year-filter', city: 'city-filter' }
  if (elementByKey[key]) el(elementByKey[key]).value = productState[key]
  applyProductFilters()
  el('explore').scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function bindDashboardItem(target, key, value, records, label) {
  target.addEventListener('click', () => setProductFilter(key, value))
  target.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setProductFilter(key, value)
    }
  })
  bindTooltip(target, () => tooltipSummary(label, records))
}

function renderYearChart(records) {
  const groups = [...countBy(records.filter((item) => item.year), 'year').entries()].sort((a, b) => Number(a[0]) - Number(b[0]))
  el('trend-total').textContent = `${formatNumber(records.length)} 条`
  if (!groups.length) {
    el('year-chart').innerHTML = '<p class="empty-state">暂无年份数据</p>'
    return
  }
  const width = 980
  const height = 270
  const padding = { top: 24, right: 18, bottom: 36, left: 42 }
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom
  const max = Math.max(...groups.map(([, count]) => count), 1)
  const gap = Math.max(7, innerWidth / groups.length * 0.18)
  const barWidth = Math.max(10, innerWidth / groups.length - gap)
  const tickCount = 4
  const grid = Array.from({ length: tickCount + 1 }, (_, index) => {
    const value = Math.round(max * (tickCount - index) / tickCount)
    const y = padding.top + innerHeight * index / tickCount
    return `<line class="chart-grid-line" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}"/><text class="chart-axis-label" x="${padding.left - 8}" y="${y + 4}" text-anchor="end">${value}</text>`
  }).join('')
  const bars = groups.map(([year, count], index) => {
    const x = padding.left + index * (innerWidth / groups.length) + gap / 2
    const barHeight = innerHeight * count / max
    const y = padding.top + innerHeight - barHeight
    const active = productState.year === String(year) ? ' is-active' : ''
    return `<g class="chart-hit${active}" data-year="${year}" tabindex="0" role="button" aria-label="筛选 ${year} 年，共 ${count} 条"><rect class="chart-bar" x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="5"></rect><text class="chart-value" x="${x + barWidth / 2}" y="${Math.max(13, y - 7)}" text-anchor="middle">${count}</text><text class="chart-axis-label" x="${x + barWidth / 2}" y="${height - 11}" text-anchor="middle">${year}</text></g>`
  }).join('')
  el('year-chart').innerHTML = `<svg class="year-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="按年份统计产品收录数量">${grid}${bars}</svg>`
  for (const node of el('year-chart').querySelectorAll('[data-year]')) {
    const year = node.dataset.year
    bindDashboardItem(node, 'year', year, records.filter((item) => String(item.year) === year), `${year} 年`)
  }
}

function renderCategoryChart(records) {
  const groups = [...countBy(records, 'category').entries()].sort((a, b) => b[1] - a[1])
  if (!groups.length) {
    el('category-donut').style.background = 'rgba(255,255,255,.04)'
    el('donut-total').textContent = '0'
    el('category-legend').innerHTML = ''
    return
  }
  const total = records.length
  let cursor = 0
  const stops = groups.map(([category, count]) => {
    const start = cursor
    cursor += count / total * 100
    return `${CATEGORY_COLORS[category] || '#7e918a'} ${start}% ${cursor}%`
  })
  el('category-donut').style.background = `conic-gradient(${stops.join(',')})`
  el('donut-total').textContent = formatNumber(records.length)
  el('category-legend').innerHTML = groups.map(([category, count]) => `<button type="button" class="legend-item${productState.category === category ? ' is-active' : ''}" data-category="${escapeHtml(category)}"><span class="legend-dot" style="background:${CATEGORY_COLORS[category] || '#7e918a'}"></span><span>${escapeHtml(CATEGORY_LABELS[category] || category)}</span><strong>${count}</strong></button>`).join('')
  bindTooltip(el('category-donut'), () => tooltipSummary('全部产品类型', records))
  for (const node of el('category-legend').querySelectorAll('[data-category]')) {
    const category = node.dataset.category
    bindDashboardItem(node, 'category', category, records.filter((item) => item.category === category), CATEGORY_LABELS[category] || category)
  }
}

function renderCityChart(records) {
  const groups = [...countBy(records.filter((item) => item.city), 'city').entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  const max = Math.max(...groups.map(([, count]) => count), 1)
  el('city-chart').innerHTML = groups.length
    ? groups.map(([city, count]) => `<button type="button" class="bar-row${productState.city === city ? ' is-active' : ''}" data-city="${escapeHtml(city)}"><span>${escapeHtml(city)}</span><span class="bar-track"><span class="bar-fill" style="width:${count / max * 100}%"></span></span><strong>${count}</strong></button>`).join('')
    : '<p class="empty-state">当前筛选没有城市数据</p>'
  for (const node of el('city-chart').querySelectorAll('[data-city]')) {
    const city = node.dataset.city
    bindDashboardItem(node, 'city', city, records.filter((item) => item.city === city), city)
  }
}

function renderStatusChart(records) {
  const counts = countBy(records, 'status')
  el('status-chart').innerHTML = ['active', 'developing', 'closed', 'acquired', 'unknown']
    .filter((status) => counts.has(status))
    .map((status) => `<button type="button" class="status-item${productState.status === status ? ' is-active' : ''}" data-status="${status}"><span>${STATUS_LABELS[status]}</span><strong>${formatNumber(counts.get(status))}</strong></button>`).join('')
  for (const node of el('status-chart').querySelectorAll('[data-status]')) {
    const status = node.dataset.status
    bindDashboardItem(node, 'status', status, records.filter((item) => item.status === status), STATUS_LABELS[status])
  }
}

function renderDashboard(records) {
  renderYearChart(records)
  renderCategoryChart(records)
  renderCityChart(records)
  renderStatusChart(records)
}

function productMatches(record) {
  const sourceText = (record.sources || []).map((source) => `${source.repository} ${source.sourceFile}`).join(' ')
  const repository = repositoryForRecord(record)
  const githubText = repository ? `${repository.fullName} ${repository.language || ''} ${repository.license || ''}` : ''
  const haystack = [record.productName, record.description, record.developerName, record.city, record.sourceCategory, sourceText, githubText].filter(Boolean).join(' ').toLowerCase()
  return (!productState.query || haystack.includes(productState.query.toLowerCase()))
    && (!productState.category || record.category === productState.category)
    && (!productState.status || record.status === productState.status)
    && (!productState.year || String(record.year) === productState.year)
    && (!productState.city || record.city === productState.city)
}

function toolMatches(record) {
  const sourceText = (record.sources || []).map((source) => `${source.repository} ${source.sourceFile}`).join(' ')
  const repository = repositoryForRecord(record)
  const githubText = repository ? `${repository.fullName} ${repository.language || ''} ${repository.license || ''}` : ''
  const haystack = [record.toolName, record.description, record.category, sourceText, githubText].filter(Boolean).join(' ').toLowerCase()
  return (!toolState.query || haystack.includes(toolState.query.toLowerCase()))
    && (!toolState.category || record.category === toolState.category)
}

function sourceDetailsHtml(record, open = false) {
  const sources = record.sources || []
  if (!sources.length) return '<span class="source-empty">来源未记录</span>'
  const items = sources.map((source) => {
    const label = `${source.repository} · ${source.sourceFile}:${source.sourceLine}`
    return source.sourceUrl
      ? `<li><a href="${escapeHtml(source.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(label)} ↗</a></li>`
      : `<li>${escapeHtml(label)}</li>`
  }).join('')
  return `<details class="source-details"${open ? ' open' : ''}><summary>来源 ${sources.length} 处</summary><ul>${items}</ul></details>`
}

function githubBadgesHtml(record) {
  const repository = repositoryForRecord(record)
  if (!repository || repository.status !== 'available') return ''
  const activity = classifyActivity(repository)
  return `<div class="github-meta" aria-label="GitHub 仓库信息">
    <span class="github-chip">★ ${formatCompact(repository.stars)}</span>
    ${repository.language ? `<span class="github-chip">${escapeHtml(repository.language)}</span>` : ''}
    <span class="github-chip activity-${activity}">${escapeHtml(ACTIVITY_LABELS[activity] || '状态未知')}</span>
  </div>`
}

function renderActiveProductFilters() {
  const entries = [
    ['关键词', productState.query],
    ['类型', productState.category ? CATEGORY_LABELS[productState.category] : ''],
    ['状态', productState.status ? STATUS_LABELS[productState.status] : ''],
    ['年份', productState.year],
    ['城市', productState.city]
  ].filter(([, value]) => value)
  el('active-filters').innerHTML = entries.map(([label, value]) => `<span class="filter-chip">${label}：${escapeHtml(value)}</span>`).join('')
}

function makeCardInteractive(card, record, recordType) {
  card.tabIndex = 0
  card.setAttribute('role', 'button')
  card.setAttribute('aria-label', `查看${recordType === 'product' ? '产品' : '工具'}详情：${record.productName || record.toolName}`)
  const open = (event) => {
    if (event.target.closest('a, button, details, summary')) return
    openDetailDrawer(record, recordType)
  }
  card.addEventListener('click', open)
  card.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('a, button, details, summary')) {
      event.preventDefault()
      openDetailDrawer(record, recordType)
    }
  })
}

function createProductCard(record) {
  const fragment = el('product-template').content.cloneNode(true)
  const card = fragment.querySelector('.product-card')
  fragment.querySelector('.category-badge').textContent = CATEGORY_LABELS[record.category] || record.category
  const status = fragment.querySelector('.status-badge')
  status.textContent = STATUS_LABELS[record.status] || record.status
  status.classList.add(record.status)
  fragment.querySelector('.product-name').textContent = record.productName
  fragment.querySelector('.product-description').textContent = record.description || '暂无产品介绍'
  fragment.querySelector('.product-meta').innerHTML = [record.developerName, record.city, record.year, record.sourceCategory].filter(Boolean).map((value) => `<span class="meta-pill">${escapeHtml(value)}</span>`).join('')
  fragment.querySelector('.github-slot').innerHTML = githubBadgesHtml(record)
  fragment.querySelector('.record-sources').innerHTML = sourceDetailsHtml(record)
  fragment.querySelector('.source-date').textContent = record.date || '日期未知'
  const link = fragment.querySelector('.visit-link')
  if (record.productUrl) link.href = record.productUrl
  else {
    link.textContent = '链接不可用'
    link.setAttribute('aria-disabled', 'true')
  }
  makeCardInteractive(card, record, 'product')
  return fragment
}

function createToolCard(record) {
  const fragment = el('tool-template').content.cloneNode(true)
  const card = fragment.querySelector('.tool-card')
  fragment.querySelector('.tool-category').textContent = record.category
  fragment.querySelector('.tool-pricing').textContent = PRICING_LABELS[record.pricing] || PRICING_LABELS.unknown
  fragment.querySelector('.tool-name').textContent = record.toolName
  fragment.querySelector('.tool-description').textContent = record.description || '暂无工具介绍'
  fragment.querySelector('.github-slot').innerHTML = githubBadgesHtml(record)
  fragment.querySelector('.record-sources').innerHTML = sourceDetailsHtml(record)
  const link = fragment.querySelector('.visit-link')
  link.href = record.toolUrl
  makeCardInteractive(card, record, 'tool')
  return fragment
}

function renderProducts() {
  const grid = el('product-grid')
  grid.innerHTML = ''
  const visible = productState.filtered.slice(0, productState.visibleCount)
  const fragment = document.createDocumentFragment()
  visible.forEach((record) => fragment.append(createProductCard(record)))
  grid.append(fragment)
  el('result-summary').textContent = `找到 ${formatNumber(productState.filtered.length)} 条，当前显示 ${formatNumber(visible.length)} 条`
  el('empty-state').hidden = productState.filtered.length > 0
  el('load-more').hidden = visible.length >= productState.filtered.length
}

function renderTools() {
  const grid = el('tool-grid')
  grid.innerHTML = ''
  const visible = toolState.filtered.slice(0, toolState.visibleCount)
  const fragment = document.createDocumentFragment()
  visible.forEach((record) => fragment.append(createToolCard(record)))
  grid.append(fragment)
  el('tool-result-summary').textContent = `找到 ${formatNumber(toolState.filtered.length)} 个工具，当前显示 ${formatNumber(visible.length)} 个`
  el('tool-empty-state').hidden = toolState.filtered.length > 0
  el('load-more-tools').hidden = visible.length >= toolState.filtered.length
}

function applyProductFilters() {
  productState.filtered = productState.all.filter(productMatches)
  productState.visibleCount = PRODUCT_PAGE_SIZE
  renderActiveProductFilters()
  renderDashboard(productState.filtered)
  renderProducts()
}

function applyToolFilters() {
  toolState.filtered = toolState.all.filter(toolMatches)
  toolState.visibleCount = TOOL_PAGE_SIZE
  renderTools()
}

function allRepositoryItems() {
  const items = new Map()
  const add = (record, recordType) => {
    const repository = repositoryForRecord(record)
    if (!repository || repository.status !== 'available') return
    const key = repository.key || normalizeGitHubRepository(repository.url)
    const current = items.get(key)
    if (!current || (repository.stars || 0) > (current.repository.stars || 0)) items.set(key, { key, repository, record, recordType })
  }
  productState.all.forEach((record) => add(record, 'product'))
  toolState.all.forEach((record) => add(record, 'tool'))
  return [...items.values()]
}

function githubItemMatches(item) {
  return (githubState.scope === 'all' || item.recordType === githubState.scope)
    && (!githubState.activity || classifyActivity(item.repository) === githubState.activity)
}

function renderGithubInsights() {
  const allItems = allRepositoryItems()
  const filteredItems = allItems.filter(githubItemMatches)
  const topItems = filteredItems.sort((a, b) => (b.repository.stars || 0) - (a.repository.stars || 0)).slice(0, 20)
  const maxStars = Math.max(...topItems.map((item) => item.repository.stars || 0), 1)

  for (const button of document.querySelectorAll('[data-github-scope]')) {
    button.classList.toggle('is-active', button.dataset.githubScope === githubState.scope)
  }

  el('github-top-list').innerHTML = topItems.length
    ? topItems.map((item, index) => {
      const name = item.record.productName || item.record.toolName || item.repository.fullName
      return `<button class="github-rank-row" type="button" data-repo-key="${escapeHtml(item.key)}">
        <span class="rank-number">${String(index + 1).padStart(2, '0')}</span>
        <span class="rank-main"><span class="rank-title">${escapeHtml(name)}</span><span class="rank-repo">${escapeHtml(item.repository.fullName)}</span><span class="rank-track"><span class="rank-fill" style="width:${(item.repository.stars || 0) / maxStars * 100}%"></span></span></span>
        <strong>★ ${formatCompact(item.repository.stars)}</strong>
      </button>`
    }).join('')
    : '<div class="empty-state"><strong>没有匹配的 GitHub 仓库</strong><p>切换项目范围或取消活跃度筛选。</p></div>'

  const itemMap = new Map(allItems.map((item) => [item.key, item]))
  for (const node of el('github-top-list').querySelectorAll('[data-repo-key]')) {
    const item = itemMap.get(node.dataset.repoKey)
    if (!item) continue
    node.addEventListener('click', () => openDetailDrawer(item.record, item.recordType))
    bindTooltip(node, () => repositoryTooltip(item.repository, item.record))
  }

  const buckets = ['active-30', 'active-90', 'active-year', 'inactive-year', 'archived']
  const counts = new Map(buckets.map((bucket) => [bucket, allItems.filter((item) => classifyActivity(item.repository) === bucket).length]))
  el('github-activity-grid').innerHTML = buckets.map((bucket) => `<button type="button" class="activity-item${githubState.activity === bucket ? ' is-active' : ''}" data-activity="${bucket}"><span>${ACTIVITY_LABELS[bucket]}</span><strong>${formatNumber(counts.get(bucket))}</strong></button>`).join('')
  for (const node of el('github-activity-grid').querySelectorAll('[data-activity]')) {
    const bucket = node.dataset.activity
    node.addEventListener('click', () => {
      githubState.activity = githubState.activity === bucket ? '' : bucket
      renderGithubInsights()
    })
    bindTooltip(node, () => `<div class="tooltip-title">${escapeHtml(ACTIVITY_LABELS[bucket])}</div><p>唯一公开仓库：<strong>${formatNumber(counts.get(bucket))}</strong></p><p class="tooltip-note">点击后仅筛选右侧 GitHub 热门项目列表。</p>`)
  }

  const coverage = githubState.metadata.repositoryCandidates || allItems.length
  const available = githubState.metadata.availableRepositories || allItems.length
  const filterLabel = githubState.activity ? ` · ${ACTIVITY_LABELS[githubState.activity]}` : ''
  el('github-insight-note').textContent = `可识别仓库 ${formatNumber(coverage)} 个 · 可访问 ${formatNumber(available)} 个${filterLabel}`
  el('github-generated-at').textContent = githubState.metadata.generatedAt ? `GitHub 数据更新于 ${new Date(githubState.metadata.generatedAt).toLocaleString('zh-CN')}` : 'GitHub 数据等待首次同步'
}

function repositoryTooltip(repository, record) {
  const activity = classifyActivity(repository)
  return `<div class="tooltip-title">${escapeHtml(record.productName || record.toolName || repository.fullName)}</div>
    <div class="tooltip-repo">${escapeHtml(repository.fullName)}</div>
    <div class="tooltip-grid">
      <span>Stars</span><strong>${formatNumber(repository.stars)}</strong>
      <span>Forks</span><strong>${formatNumber(repository.forks)}</strong>
      <span>语言</span><strong>${escapeHtml(repository.language || '未知')}</strong>
      <span>许可证</span><strong>${escapeHtml(repository.license || '未知')}</strong>
      <span>最后提交</span><strong>${formatDate(repository.pushedAt)}</strong>
      <span>活跃度</span><strong>${escapeHtml(ACTIVITY_LABELS[activity] || '未知')}</strong>
    </div>`
}

function githubDetailHtml(repository) {
  if (!repository || repository.status !== 'available') return '<p class="drawer-muted">该记录没有可识别的公开 GitHub 仓库。</p>'
  const activity = classifyActivity(repository)
  return `<div class="drawer-stat-grid">
      <div><span>Stars</span><strong>${formatNumber(repository.stars)}</strong></div>
      <div><span>Forks</span><strong>${formatNumber(repository.forks)}</strong></div>
      <div><span>主语言</span><strong>${escapeHtml(repository.language || '未知')}</strong></div>
      <div><span>许可证</span><strong>${escapeHtml(repository.license || '未知')}</strong></div>
    </div>
    <dl class="drawer-details">
      <div><dt>仓库</dt><dd><a href="${escapeHtml(repository.url)}" target="_blank" rel="noreferrer">${escapeHtml(repository.fullName)} ↗</a></dd></div>
      <div><dt>活跃度</dt><dd>${escapeHtml(ACTIVITY_LABELS[activity] || '未知')}</dd></div>
      <div><dt>最后提交</dt><dd>${formatDate(repository.pushedAt)}</dd></div>
      <div><dt>归档状态</dt><dd>${repository.archived ? '已归档' : '未归档'}</dd></div>
    </dl>`
}

function openDetailDrawer(record, recordType) {
  const repository = repositoryForRecord(record)
  const isProduct = recordType === 'product'
  const name = isProduct ? record.productName : record.toolName
  const targetUrl = isProduct ? record.productUrl : record.toolUrl
  const metadata = isProduct
    ? [record.developerName, record.city, record.year, CATEGORY_LABELS[record.category], STATUS_LABELS[record.status]]
    : [record.category, PRICING_LABELS[record.pricing] || PRICING_LABELS.unknown]
  el('detail-content').innerHTML = `
    <p class="eyebrow">${isProduct ? 'PRODUCT DETAIL' : 'TOOL DETAIL'}</p>
    <h2>${escapeHtml(name)}</h2>
    <p class="drawer-description">${escapeHtml(record.description || '暂无介绍')}</p>
    <div class="product-meta drawer-meta">${metadata.filter(Boolean).map((value) => `<span class="meta-pill">${escapeHtml(value)}</span>`).join('')}</div>
    ${targetUrl ? `<a class="button primary drawer-primary-link" href="${escapeHtml(targetUrl)}" target="_blank" rel="noreferrer">访问${isProduct ? '产品' : '工具'} ↗</a>` : ''}
    <section class="drawer-section"><div class="drawer-section-heading"><h3>GitHub</h3><span>独立增强数据</span></div>${githubDetailHtml(repository)}</section>
    <section class="drawer-section"><div class="drawer-section-heading"><h3>数据来源</h3><span>${(record.sources || []).length} 处</span></div>${sourceDetailsHtml(record, true)}</section>
  `
  el('detail-backdrop').hidden = false
  el('detail-drawer').classList.add('is-open')
  el('detail-drawer').setAttribute('aria-hidden', 'false')
  document.body.classList.add('drawer-open')
  el('detail-close').focus()
}

function closeDetailDrawer() {
  el('detail-backdrop').hidden = true
  el('detail-drawer').classList.remove('is-open')
  el('detail-drawer').setAttribute('aria-hidden', 'true')
  document.body.classList.remove('drawer-open')
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function bindEvents() {
  const productBindings = {
    search: ['query', 'input'],
    'category-filter': ['category', 'change'],
    'status-filter': ['status', 'change'],
    'year-filter': ['year', 'change'],
    'city-filter': ['city', 'change']
  }
  for (const [id, [stateKey, event]] of Object.entries(productBindings)) {
    el(id).addEventListener(event, (eventObject) => {
      productState[stateKey] = eventObject.target.value.trim()
      applyProductFilters()
    })
  }
  el('reset-filters').addEventListener('click', () => {
    productState.query = productState.category = productState.status = productState.year = productState.city = ''
    for (const id of ['search', 'category-filter', 'status-filter', 'year-filter', 'city-filter']) el(id).value = ''
    applyProductFilters()
  })
  el('load-more').addEventListener('click', () => {
    productState.visibleCount += PRODUCT_PAGE_SIZE
    renderProducts()
  })

  el('tool-search').addEventListener('input', (eventObject) => {
    toolState.query = eventObject.target.value.trim()
    applyToolFilters()
  })
  el('tool-category-filter').addEventListener('change', (eventObject) => {
    toolState.category = eventObject.target.value
    applyToolFilters()
  })
  el('reset-tool-filters').addEventListener('click', () => {
    toolState.query = toolState.category = ''
    el('tool-search').value = ''
    el('tool-category-filter').value = ''
    applyToolFilters()
  })
  el('load-more-tools').addEventListener('click', () => {
    toolState.visibleCount += TOOL_PAGE_SIZE
    renderTools()
  })

  for (const button of document.querySelectorAll('[data-github-scope]')) {
    button.addEventListener('click', () => {
      githubState.scope = button.dataset.githubScope
      renderGithubInsights()
    })
  }

  el('detail-close').addEventListener('click', closeDetailDrawer)
  el('detail-backdrop').addEventListener('click', closeDetailDrawer)
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hideTooltip()
      closeDetailDrawer()
    }
  })
  window.addEventListener('scroll', hideTooltip, { passive: true })
  window.addEventListener('resize', hideTooltip)

  el('download-products').addEventListener('click', () => downloadJson('indiebase-cn-products.json', { metadata: productState.metadata, records: productState.all }))
  el('download-tools').addEventListener('click', () => downloadJson('indiebase-cn-tools.json', { metadata: toolState.metadata, records: toolState.all }))
}

async function optionalJson(path, fallback) {
  try {
    const response = await fetch(path)
    if (!response.ok) return fallback
    return await response.json()
  } catch {
    return fallback
  }
}

async function init() {
  try {
    const [productsResponse, toolsResponse, githubPayload, githubHistory] = await Promise.all([
      fetch('data/products.json'),
      fetch('data/tools.json'),
      optionalJson('data/github-repositories.json', { repositories: {}, metadata: {} }),
      optionalJson('data/github-history.json', { repositories: {}, metadata: {} })
    ])
    if (!productsResponse.ok) throw new Error(`products.json HTTP ${productsResponse.status}`)
    if (!toolsResponse.ok) throw new Error(`tools.json HTTP ${toolsResponse.status}`)
    const [productsPayload, toolsPayload] = await Promise.all([productsResponse.json(), toolsResponse.json()])
    productState.all = productsPayload.records || []
    productState.filtered = productState.all
    productState.metadata = productsPayload.metadata || {}
    toolState.all = toolsPayload.records || []
    toolState.filtered = toolState.all
    toolState.metadata = toolsPayload.metadata || {}
    githubState.repositories = githubPayload.repositories || {}
    githubState.metadata = githubPayload.metadata || {}
    githubState.history = githubHistory.repositories || {}

    buildProductFilters()
    buildToolFilters()
    bindEvents()
    updateHeadlineMetrics(productState.all, toolState.all)
    renderDashboard(productState.all)
    renderProducts()
    renderTools()
    renderGithubInsights()

    const mode = productState.metadata.snapshotMode === 'full-upstream' ? '完整上游快照' : '示例快照'
    const githubCount = githubState.metadata.availableRepositories || availableRepositories([...productState.all, ...toolState.all]).length
    el('snapshot-note').textContent = `${mode} · ${formatNumber(productState.all.length)} 条产品 · ${formatNumber(toolState.all.length)} 个工具 · ${formatNumber(githubCount)} 个 GitHub 仓库`
    el('generated-at').textContent = `产品数据生成时间：${new Date(productState.metadata.generatedAt).toLocaleString('zh-CN')}`
  } catch (error) {
    console.error(error)
    el('result-summary').textContent = '数据加载失败'
    el('tool-result-summary').textContent = '数据加载失败'
    el('snapshot-note').textContent = '无法读取数据文件，请先运行 npm run sync:data。'
    el('product-grid').innerHTML = `<div class="empty-state"><strong>数据加载失败</strong><p>${escapeHtml(error.message)}</p></div>`
  }
}

init()
