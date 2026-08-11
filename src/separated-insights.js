import './taxonomy-insights.js'

const RESERVED_GITHUB_OWNERS = new Set(['about', 'apps', 'blog', 'collections', 'enterprise', 'events', 'explore', 'features', 'issues', 'marketplace', 'orgs', 'pricing', 'pulls', 'search', 'settings', 'sponsors', 'topics', 'trending'])
const ACTIVITY_LABELS = {
  'active-30': '30 天内更新',
  'active-90': '31–90 天内更新',
  'active-year': '一年内更新',
  'inactive-year': '超过一年未更新',
  archived: '已归档',
  unknown: '更新时间未知'
}
const formatNumber = (value) => new Intl.NumberFormat('zh-CN').format(Number(value) || 0)
const formatCompact = (value) => new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value) || 0)
const escapeHtml = (value = '') => String(value).replace(/[&<>'\"]/g, (char) => {
  const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;' }
  return char === '\"' ? '&quot;' : entities[char]
})

const nativeScrollIntoView = Element.prototype.scrollIntoView
let suppressChartAutoScroll = false
const insightState = { products: [], tools: [], repositories: {}, githubMetadata: {} }
const PRODUCT_HASHES = new Set(['#semantic-map', '#product-dashboard', '#product-github', '#explore'])
const TOOL_HASHES = new Set(['#tool-dashboard', '#tools'])

function viewForHash(hash) {
  if (TOOL_HASHES.has(hash)) return 'tool'
  if (PRODUCT_HASHES.has(hash)) return 'product'
  return null
}

function setDatasetView(view, { syncHash = false } = {}) {
  const nextView = view === 'tool' ? 'tool' : 'product'
  document.body.dataset.datasetView = nextView
  for (const button of document.querySelectorAll('[data-dataset-tab]')) {
    const active = button.dataset.datasetTab === nextView
    button.classList.toggle('is-active', active)
    button.setAttribute('aria-selected', String(active))
    button.tabIndex = active ? 0 : -1
  }
  if (syncHash) {
    const hash = nextView === 'tool' ? '#tool-dashboard' : '#product-dashboard'
    history.replaceState(null, '', hash)
  }
}

function installDatasetTabs() {
  const links = document.querySelector('.top-links')
  if (!links || links.querySelector('.dataset-tabs')) return
  links.innerHTML = `
    <div class="dataset-tabs" role="tablist" aria-label="数据集切换">
      <button class="dataset-tab" type="button" role="tab" data-dataset-tab="product" aria-selected="false">项目</button>
      <button class="dataset-tab" type="button" role="tab" data-dataset-tab="tool" aria-selected="false">工具</button>
    </div>
    <a class="dataset-methodology-link" href="#methodology">数据说明</a>`

  for (const button of links.querySelectorAll('[data-dataset-tab]')) {
    button.addEventListener('click', () => setDatasetView(button.dataset.datasetTab, { syncHash: true }))
  }

  document.addEventListener('click', (event) => {
    const anchor = event.target.closest('a[href^="#"]')
    const view = anchor ? viewForHash(anchor.hash) : null
    if (view) setDatasetView(view)
  }, true)

  window.addEventListener('hashchange', () => {
    const view = viewForHash(window.location.hash)
    if (view) setDatasetView(view)
  })

  setDatasetView(viewForHash(window.location.hash) || 'product')
}

function markChartInteraction(event) {
  if (!event.target.closest('#product-dashboard, #product-github, #tool-dashboard')) return
  suppressChartAutoScroll = true
  queueMicrotask(() => { suppressChartAutoScroll = false })
}

Element.prototype.scrollIntoView = function (...args) {
  if (suppressChartAutoScroll && (this.id === 'explore' || this.id === 'tools')) return
  return nativeScrollIntoView.apply(this, args)
}

document.addEventListener('click', markChartInteraction, true)
document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') markChartInteraction(event)
}, true)

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
}

function scheduleProductInsightsRender() {
  queueMicrotask(renderProductInsights)
}

function bindProductInsightFilters() {
  for (const id of ['search', 'category-filter', 'status-filter', 'year-filter', 'city-filter']) {
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
    const [productsResponse, toolsResponse, githubResponse] = await Promise.all([
      fetch('data/products.json'),
      fetch('data/tools.json'),
      fetch('data/github-repositories.json')
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
    insightState.githubMetadata = githubPayload.metadata || {}

    const tools = insightState.tools
    const toolRepositories = repositoryItems(tools, insightState.repositories, 'tool')

    installResetControl('product-dashboard', 'product')
    installResetControl('product-github', 'product')
    installResetControl('tool-dashboard', 'tool')

    bindProductInsightFilters()
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

installDatasetTabs()
initSeparatedInsights()
