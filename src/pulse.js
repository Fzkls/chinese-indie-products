import { LIFECYCLE_LABELS, lifecycleKey, repositoryTrend } from './trend-utils.js'

const formatNumber = (value) => new Intl.NumberFormat('zh-CN').format(Number(value) || 0)
const formatCompact = (value) => new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value) || 0)
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char])

function setText(id, value) {
  const node = document.getElementById(id)
  if (node) node.textContent = value
}

function navigateToProduct(name) {
  document.querySelector('[data-dataset-tab="product"]')?.click()
  const input = document.getElementById('search')
  if (input) {
    input.value = name
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }
  document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function renderNewProducts(changes) {
  const container = document.getElementById('weekly-new-products')
  const items = changes?.products?.added || []
  if (!container) return
  container.innerHTML = items.length
    ? items.slice(0, 8).map((item) => `<button class="pulse-row" type="button" data-product-name="${escapeHtml(item.name)}">
        <span class="pulse-row-main"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.developerName || item.description || '新增产品')}</small></span>
        <span class="pulse-row-meta">新增</span>
      </button>`).join('')
    : '<div class="pulse-empty">与上一份成功快照相比，本期暂无新增产品。</div>'
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
      return `<div class="pulse-lifecycle-item"><span>${escapeHtml(LIFECYCLE_LABELS[key] || key)}</span><strong>${formatNumber(count)}</strong><small>${percent}%</small></div>`
    }).join('') || '<div class="pulse-empty">暂无产品仓库生命周期数据。</div>'
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
    renderGrowth(repositoriesPayload.repositories || {}, historyPayload.repositories || {})
    renderLifecycle(repositoriesPayload.repositories || {})
  } catch (error) {
    console.error('Weekly pulse failed:', error)
    section.querySelector('.pulse-grid')?.insertAdjacentHTML('beforeend', '<div class="pulse-empty">趋势数据加载失败：' + escapeHtml(error.message) + '</div>')
  }
}

initPulse()
