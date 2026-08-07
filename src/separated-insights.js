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
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => {
  const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;' }
  return char === '"' ? '&quot;' : entities[char]
})

const nativeScrollIntoView = Element.prototype.scrollIntoView
let suppressChartAutoScroll = false

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
    : '<div class="empty-state"><strong>暂无可统计的 GitHub 仓库</strong></div>'
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
  const container = document.getElementById(id)
  container.innerHTML = order
    .filter((key) => counts.get(key))
    .map((key) => `<div class="activity-row" title="${ACTIVITY_LABELS[key]}：${formatNumber(counts.get(key))} 个仓库">
      <span>${ACTIVITY_LABELS[key]}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${counts.get(key) / max * 100}%"></span></span>
      <strong>${formatNumber(counts.get(key))}</strong>
    </div>`).join('')
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
    const products = productsPayload.records || []
    const tools = toolsPayload.records || []
    const repositories = githubPayload.repositories || {}
    const productRepositories = repositoryItems(products, repositories, 'product')
    const toolRepositories = repositoryItems(tools, repositories, 'tool')

    installResetControl('product-dashboard', 'product')
    installResetControl('product-github', 'product')
    installResetControl('tool-dashboard', 'tool')

    setText('metric-github', productRepositories.length)
    setText('product-github-count', `${formatNumber(productRepositories.length)} 个公开仓库`)
    setText('tool-github-count', toolRepositories.length)
    setText('tool-category-count', new Set(tools.map((item) => item.category).filter(Boolean)).size)
    setText('tool-open-source-count', tools.filter((item) => item.pricing === 'open-source').length)
    setText('product-github-note', `独立产品中可明确关联 ${formatNumber(productRepositories.length)} 个公开 GitHub 仓库。只统计产品数据，不包含工具资源。`)
    setText('tool-github-note', `工具资源中可明确关联 ${formatNumber(toolRepositories.length)} 个公开 GitHub 仓库。只统计工具数据，不包含独立产品。`)

    renderRankList('product-github-top', productRepositories, 'product')
    renderActivity('product-github-activity', productRepositories)
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
