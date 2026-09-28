import { LIFECYCLE_LABELS, lifecycleKey, repositoryTrend } from './trend-utils.js'

const formatNumber = (value) => new Intl.NumberFormat('zh-CN').format(Number(value) || 0)
const formatCompact = (value) => new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value) || 0)
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char])

function setText(id, value) {
  const node = document.getElementById(id)
  if (node) node.textContent = value
}

function openProjectDirectory(detail = {}) {
  window.dispatchEvent(new CustomEvent('indiebase:open-project-directory', { detail }))
}

function navigateToProduct(name) {
  openProjectDirectory({ search: name })
}

function renderNewProducts(changes) {
  const items = changes?.products?.added || []
  const main = document.getElementById('weekly-new-products')
  if (main) {
    main.innerHTML = items.length
      ? items.slice(0, 5).map((item) => `<button class="pulse-row" type="button" data-product-name="${escapeHtml(item.name)}">
          <span class="pulse-row-main"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.developerName || item.description || '新收录项目')}</small></span>
          <span class="pulse-row-meta">新收录</span>
        </button>`).join('')
      : '<div class="pulse-empty">与上一份成功快照相比，本期暂无新收录项目。</div>'
    for (const button of main.querySelectorAll('[data-product-name]')) {
      button.addEventListener('click', () => navigateToProduct(button.dataset.productName))
    }
  }

  setText('directory-weekly-count', formatNumber(items.length))
  for (const sidebar of document.querySelectorAll('[data-weekly-new-sidebar]')) {
    sidebar.innerHTML = items.length
      ? items.slice(0, 6).map((item) => `<button class="directory-weekly-row" type="button" data-product-name="${escapeHtml(item.name)}">
          <strong>${escapeHtml(item.name)}</strong>
          <span>${escapeHtml(item.developerName || '新收录项目')}</span>
        </button>`).join('')
      : '<div class="directory-weekly-empty">本周暂无新收录项目</div>'
    for (const button of sidebar.querySelectorAll('[data-product-name]')) {
      button.addEventListener('click', () => navigateToProduct(button.dataset.productName))
    }
  }
}
function renderChangedProducts(changes) {
  const container = document.getElementById('weekly-changed-products')
  const items = changes?.products?.changed || []
  if (!container) return
  container.innerHTML = items.length
    ? items.slice(0, 4).map((item) => `<button class="pulse-row" type="button" data-product-name="${escapeHtml(item.name)}">
        <span class="pulse-row-main"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description || item.developerName || '产品信息发生变化')}</small></span>
        <span class="pulse-row-meta">变化</span>
      </button>`).join('')
    : '<div class="pulse-empty compact">本期暂无已有产品的信息变化。</div>'
  for (const button of container.querySelectorAll('[data-product-name]')) {
    button.addEventListener('click', () => navigateToProduct(button.dataset.productName))
  }
}

function productRepositoryEntries(repositories) {
  return Object.values(repositories || {}).filter((repository) =>
    repository?.status === 'available' && (repository.references || []).some((reference) => reference.recordType === 'product')
  )
}

function renderGrowth(repositories, history) {
  const container = document.getElementById('weekly-github-growth')
  if (!container) return
  const rows = productRepositoryEntries(repositories)
    .map((repository) => {
      const trend = repositoryTrend(history?.[repository.key] || [])
      const reference = (repository.references || []).find((item) => item.recordType === 'product')
      return trend ? { repository, trend, reference } : null
    })
    .filter(Boolean)
    .filter((item) => item.trend.starDelta > 0 || item.trend.forkDelta > 0)
    .sort((a, b) => b.trend.starDelta - a.trend.starDelta || b.trend.forkDelta - a.trend.forkDelta)
    .slice(0, 10)

  container.innerHTML = rows.length
    ? rows.map(({ repository, trend, reference }) => `<button class="pulse-row" type="button" data-product-name="${escapeHtml(reference?.name || repository.fullName)}">
        <span class="pulse-row-main"><strong>${escapeHtml(reference?.name || repository.fullName)}</strong><small>${escapeHtml(repository.fullName)} · ${trend.days} 天窗口</small></span>
        <span class="pulse-row-meta positive">+${formatCompact(trend.starDelta)} ★</span>
      </button>`).join('')
    : '<div class="pulse-empty">现有快照暂未形成可展示的正向 Star 增长。</div>'

  for (const button of container.querySelectorAll('[data-product-name]')) {
    button.addEventListener('click', () => navigateToProduct(button.dataset.productName))
  }
}

function renderLifecycle(repositories) {
  const container = document.getElementById('weekly-lifecycle')
  if (!container) return
  const items = productRepositoryEntries(repositories)
  const counts = new Map()
  for (const repository of items) {
    const key = lifecycleKey(repository)
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  const order = ['active-30', 'active-90', 'active-year', 'inactive-year', 'archived', 'unavailable', 'unknown']
  container.innerHTML = order
    .filter((key) => counts.get(key))
    .map((key) => {
      const count = counts.get(key)
      const percent = items.length ? Math.round(count / items.length * 100) : 0
      return `<button class="pulse-lifecycle-item" type="button" data-activity="${escapeHtml(key)}"><span>${escapeHtml(LIFECYCLE_LABELS[key] || key)}</span><strong>${formatNumber(count)}</strong><small>${percent}%</small></button>`
    }).join('') || '<div class="pulse-empty">暂无产品仓库生命周期数据。</div>'
  for (const button of container.querySelectorAll('[data-activity]')) {
    button.addEventListener('click', () => openProjectDirectory({ activity: button.dataset.activity }))
  }
}

async function initPulse() {
  const section = document.getElementById('weekly-pulse')
  if (!section) return
  try {
    const [changesResponse, repositoriesResponse, historyResponse] = await Promise.all([
      fetch('data/weekly-changes.json'),
      fetch('data/github-repositories.json'),
      fetch('data/github-history.json')
    ])
    if (!changesResponse.ok || !repositoriesResponse.ok || !historyResponse.ok) throw new Error('趋势数据文件加载失败')
    const [changes, repositoriesPayload, historyPayload] = await Promise.all([
      changesResponse.json(),
      repositoriesResponse.json(),
      historyResponse.json()
    ])

    const productChanges = changes.products || {}
    setText('weekly-added-count', formatNumber(productChanges.addedCount))
    setText('weekly-removed-count', formatNumber(productChanges.removedCount))
    setText('weekly-changed-count', formatNumber(productChanges.changedCount))
    setText('weekly-baseline', changes.baselineGeneratedAt
      ? '相对 ' + new Date(changes.baselineGeneratedAt).toLocaleString('zh-CN') + ' 的成功快照'
      : '当前为初始快照，后续每周会显示真实变化')

    renderNewProducts(changes)
    renderChangedProducts(changes)
    renderGrowth(repositoriesPayload.repositories || {}, historyPayload.repositories || {})
    renderLifecycle(repositoriesPayload.repositories || {})
  } catch (error) {
    console.error('Weekly pulse failed:', error)
    section.querySelector('.pulse-grid')?.insertAdjacentHTML('beforeend', '<div class="pulse-empty">趋势数据加载失败：' + escapeHtml(error.message) + '</div>')
  }
}

initPulse()
