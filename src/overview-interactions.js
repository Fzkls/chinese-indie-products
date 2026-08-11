const $ = (selector, root = document) => root.querySelector(selector)
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)]
const formatNumber = (value) => new Intl.NumberFormat('zh-CN').format(Number(value) || 0)
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
})[char])

const STATUS_LABELS = {
  active: '已上线',
  developing: '开发中',
  closed: '已关闭',
  acquired: '已收购',
  unknown: '状态未知'
}

const dataState = {
  products: [],
  semanticById: new Map(),
  repositories: {},
  ready: null
}

const originalScrollIntoView = Element.prototype.scrollIntoView
Element.prototype.scrollIntoView = function (...args) {
  if (['top', 'project-list', 'tools', 'explore'].includes(this.id)) return
  return originalScrollIntoView.apply(this, args)
}

function normalizeGithubRepository(rawUrl) {
  if (!rawUrl) return null
  try {
    const url = new URL(rawUrl)
    if (url.hostname.toLowerCase().replace(/^www\./, '') !== 'github.com') return null
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null
    return `${parts[0]}/${parts[1].replace(/\.git$/i, '')}`.toLowerCase()
  } catch {
    return null
  }
}

function githubMeta(record) {
  const key = normalizeGithubRepository(record.productUrl)
  return key ? dataState.repositories[key] : null
}

async function ensureData() {
  if (dataState.ready) return dataState.ready
  dataState.ready = Promise.all([
    fetch('data/products.json'),
    fetch('data/product-taxonomy.json'),
    fetch('data/github-repositories.json')
  ]).then(async ([productsResponse, semanticResponse, githubResponse]) => {
    if (!productsResponse.ok || !semanticResponse.ok) throw new Error('overview interaction data unavailable')
    const [products, semantic, github] = await Promise.all([
      productsResponse.json(),
      semanticResponse.json(),
      githubResponse.ok ? githubResponse.json() : Promise.resolve({})
    ])
    dataState.products = products.records || []
    dataState.semanticById = new Map((semantic.records || []).map((item) => [item.productId, item]))
    dataState.repositories = github.repositories || {}
  }).catch((error) => {
    console.error(error)
  })
  return dataState.ready
}

function semanticFor(record) {
  return dataState.semanticById.get(record.id) || {
    primaryCategory: 'other',
    subCategories: [],
    tags: {}
  }
}

function matchesSelection(record, selection) {
  const semantic = semanticFor(record)
  const value = selection.value
  switch (selection.key) {
    case 'primary':
      return semantic.primaryCategory === value
    case 'sub':
      return (semantic.subCategories || []).includes(value)
    case 'audience':
      return (semantic.tags?.audience || []).includes(value)
    case 'form':
      return (semantic.tags?.productForm || []).includes(value)
    case 'characteristic':
      return (semantic.tags?.characteristics || []).includes(value)
    case 'status':
      return (record.status || 'unknown') === value
    case 'year':
      return String(record.year || '') === String(value)
    case 'city':
      return record.city === value
    default:
      return false
  }
}

function previewSort(a, b) {
  const repoA = githubMeta(a)
  const repoB = githubMeta(b)
  const starsA = repoA?.status === 'available' ? Number(repoA.stars) || 0 : 0
  const starsB = repoB?.status === 'available' ? Number(repoB.stars) || 0 : 0
  if (starsA !== starsB) return starsB - starsA
  const activeA = ['active', 'developing'].includes(a.status) ? 1 : 0
  const activeB = ['active', 'developing'].includes(b.status) ? 1 : 0
  if (activeA !== activeB) return activeB - activeA
  return String(a.productName || '').localeCompare(String(b.productName || ''), 'zh-CN')
}

function selectionLabel(node, key, value) {
  const semanticLabel = node.querySelector('.taxonomy-bar-label, .taxonomy-status-label')?.textContent?.trim()
  if (semanticLabel) return semanticLabel
  if (key === 'status') return STATUS_LABELS[value] || value
  if (key === 'year') return `${value} 年`
  const firstText = node.querySelector('span')?.textContent?.trim()
  return firstText || value
}

function resolveSelection(target) {
  const semantic = target.closest('#semantic-map [data-taxonomy-filter], #semantic-map [data-status-category]')
  if (semantic) {
    if (semantic.dataset.statusCategory) {
      return {
        key: 'primary',
        value: semantic.dataset.statusCategory,
        label: selectionLabel(semantic, 'primary', semantic.dataset.statusCategory),
        node: semantic,
        panel: semantic.closest('.chart-panel')
      }
    }
    const key = semantic.dataset.taxonomyFilter
    if (!['sub', 'audience', 'form', 'characteristic'].includes(key)) return null
    return {
      key,
      value: semantic.dataset.taxonomyValue,
      label: selectionLabel(semantic, key, semantic.dataset.taxonomyValue),
      node: semantic,
      panel: semantic.closest('.chart-panel')
    }
  }

  const year = target.closest('#product-dashboard [data-year]')
  if (year) return {
    key: 'year',
    value: year.dataset.year,
    label: selectionLabel(year, 'year', year.dataset.year),
    node: year,
    panel: year.closest('.chart-panel')
  }

  const city = target.closest('#product-dashboard [data-city]')
  if (city) return {
    key: 'city',
    value: city.dataset.city,
    label: selectionLabel(city, 'city', city.dataset.city),
    node: city,
    panel: city.closest('.chart-panel')
  }

  const status = target.closest('#product-dashboard [data-status]')
  if (status) return {
    key: 'status',
    value: status.dataset.status,
    label: selectionLabel(status, 'status', status.dataset.status),
    node: status,
    panel: status.closest('.chart-panel')
  }

  return null
}

function markActive(selection) {
  $$('.overview-link-active').forEach((node) => node.classList.remove('overview-link-active'))
  selection.node.classList.add('overview-link-active')
}

function clearActive() {
  $$('.overview-link-active').forEach((node) => node.classList.remove('overview-link-active'))
}

function ensureInlinePreview() {
  let panel = $('#overview-linked-projects')
  if (panel) return panel
  panel = document.createElement('article')
  panel.id = 'overview-linked-projects'
  panel.className = 'chart-panel overview-linked-projects'
  panel.hidden = true
  panel.addEventListener('click', (event) => {
    if (event.target.closest('[data-close-overview-preview]')) {
      panel.hidden = true
      clearActive()
      return
    }
    const viewAll = event.target.closest('[data-overview-view-all]')
    if (viewAll) {
      const selection = {
        key: viewAll.dataset.overviewFilter,
        value: viewAll.dataset.overviewValue
      }
      openDirectory(selection)
    }
  })
  return panel
}

function previewCard(record) {
  const repository = githubMeta(record)
  const status = STATUS_LABELS[record.status || 'unknown'] || STATUS_LABELS.unknown
  return `<a class="overview-preview-card" href="${escapeHtml(record.productUrl || '#')}" ${record.productUrl ? 'target="_blank" rel="noreferrer"' : 'aria-disabled="true"'}>
    <span class="overview-preview-card-top">
      <strong>${escapeHtml(record.productName || '未命名项目')}</strong>
      <small>${escapeHtml(status)}</small>
    </span>
    <span class="overview-preview-description">${escapeHtml(record.description || '暂无产品介绍')}</span>
    <span class="overview-preview-meta">${escapeHtml(record.developerName || '未知开发者')}${record.city ? ` · ${escapeHtml(record.city)}` : ''}${repository?.status === 'available' ? ` · ★ ${formatNumber(repository.stars)}` : ''}</span>
  </a>`
}

async function showInlinePreview(selection) {
  await ensureData()
  if (!selection.panel || !dataState.products.length) return

  const records = dataState.products.filter((record) => matchesSelection(record, selection)).sort(previewSort)
  const visible = records.slice(0, 8)
  const panel = ensureInlinePreview()
  markActive(selection)

  panel.innerHTML = `
    <div class="overview-preview-heading">
      <div>
        <span>RELATED PROJECTS · 原地联动</span>
        <h4>${escapeHtml(selection.label)}</h4>
        <p>当前维度命中 ${formatNumber(records.length)} 个项目。结果就在点击位置附近更新，不自动滚动页面。</p>
      </div>
      <button type="button" class="overview-preview-close" data-close-overview-preview aria-label="关闭相关项目">×</button>
    </div>
    <div class="overview-preview-grid">
      ${visible.map(previewCard).join('') || '<div class="overview-preview-empty">当前维度没有可展示项目</div>'}
    </div>
    <div class="overview-preview-footer">
      <span>预览 ${formatNumber(Math.min(visible.length, records.length))} / ${formatNumber(records.length)}</span>
      ${records.length ? `<button type="button" class="direction-view-all" data-overview-view-all data-overview-filter="${escapeHtml(selection.key)}" data-overview-value="${escapeHtml(selection.value)}">查看全部 ${formatNumber(records.length)} 个项目 →</button>` : ''}
    </div>`

  selection.panel.insertAdjacentElement('afterend', panel)
  panel.hidden = false
}

function controlIdFor(key) {
  return {
    primary: 'project-v2-primary',
    sub: 'project-v2-sub',
    audience: 'project-v2-audience',
    form: 'project-v2-form',
    characteristic: 'project-v2-characteristic',
    status: 'project-v2-status',
    year: 'project-v2-year',
    city: 'project-v2-city'
  }[key]
}

function openDirectory(selection) {
  $('#project-v2-reset')?.click()
  const id = controlIdFor(selection.key)
  const control = id ? document.getElementById(id) : null
  if (control) {
    control.value = selection.value
    control.dispatchEvent(new Event('change', { bubbles: true }))
  }

  const nextHash = '#projects-list'
  if (location.hash === nextHash) {
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    location.hash = nextHash
  }
}

function bindOverviewLinking() {
  document.addEventListener('click', (event) => {
    const direction = event.target.closest('[data-product-direction]')
    if (direction) {
      const panel = $('#overview-linked-projects')
      if (panel) panel.hidden = true
      clearActive()
      return
    }

    const selection = resolveSelection(event.target)
    if (!selection) return
    event.preventDefault()
    event.stopImmediatePropagation()
    void showInlinePreview(selection)
  }, true)

  document.addEventListener('keydown', (event) => {
    if (!['Enter', ' '].includes(event.key)) return
    const selection = resolveSelection(event.target)
    if (!selection) return
    event.preventDefault()
    event.stopImmediatePropagation()
    void showInlinePreview(selection)
  }, true)

  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-dataset]')) return
    const panel = $('#overview-linked-projects')
    if (panel) panel.hidden = true
    clearActive()
  }, true)
}

function updateInteractionCopy() {
  const copies = [
    ['#taxonomy-sub-chart', '点击子方向，原地查看相关项目'],
    ['#taxonomy-form-chart', '点击产品形态，原地查看相关项目'],
    ['#taxonomy-audience-chart', '点击用户群体，原地查看相关项目'],
    ['#taxonomy-status-matrix', '点击主分类，原地查看对应项目'],
    ['#year-chart', '悬停查看详情；点击年份，原地查看相关项目'],
    ['#city-chart', '点击城市，原地查看相关项目'],
    ['#status-chart', '点击状态，原地查看相关项目']
  ]
  for (const [selector, copy] of copies) {
    const chart = $(selector)
    const text = chart?.closest('.chart-panel')?.querySelector('.panel-heading p')
    if (text && text.textContent !== copy) text.textContent = copy
  }
}

function markLinkableNodes() {
  const selectors = [
    '#taxonomy-sub-chart [data-taxonomy-filter]',
    '#taxonomy-form-chart [data-taxonomy-filter]',
    '#taxonomy-audience-chart [data-taxonomy-filter]',
    '#taxonomy-status-matrix [data-status-category]',
    '#year-chart [data-year]',
    '#city-chart [data-city]',
    '#status-chart [data-status]'
  ]
  $$(selectors.join(',')).forEach((node) => node.classList.add('overview-linkable'))
}

function enhanceDirectionPreview() {
  const preview = $('#product-direction-preview')
  const active = $('#product-direction-list [data-product-direction].is-active')
  const list = $('.direction-preview-list', preview || document)
  if (!preview || !active || !list || list.dataset.expanded === active.dataset.productDirection) return
  if (!dataState.products.length) return

  const primary = active.dataset.productDirection
  const existingUrls = new Set($$('.direction-preview-card', list).map((node) => node.getAttribute('href')))
  const extra = dataState.products
    .filter((record) => semanticFor(record).primaryCategory === primary)
    .sort(previewSort)
    .filter((record) => !existingUrls.has(record.productUrl))
    .slice(0, Math.max(0, 8 - list.children.length))

  for (const record of extra) {
    const repository = githubMeta(record)
    const anchor = document.createElement('a')
    anchor.className = 'direction-preview-card'
    anchor.href = record.productUrl || '#'
    if (record.productUrl) {
      anchor.target = '_blank'
      anchor.rel = 'noreferrer'
    } else {
      anchor.setAttribute('aria-disabled', 'true')
    }
    anchor.innerHTML = `
      <span class="direction-preview-main"><strong>${escapeHtml(record.productName)}</strong><small>${escapeHtml(record.description || '暂无产品介绍')}</small></span>
      <span class="direction-preview-meta">${escapeHtml(record.developerName || '未知开发者')}${repository?.status === 'available' ? ` · ★ ${formatNumber(repository.stars)}` : ''}</span>`
    list.append(anchor)
  }
  list.dataset.expanded = primary
}

function observeDynamicCharts() {
  let scheduled = false
  const observer = new MutationObserver(() => {
    if (scheduled) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      updateInteractionCopy()
      markLinkableNodes()
      enhanceDirectionPreview()
    })
  })
  observer.observe(document.body, { childList: true, subtree: true })
  updateInteractionCopy()
  markLinkableNodes()
  void ensureData().then(enhanceDirectionPreview)
}

function init() {
  bindOverviewLinking()
  observeDynamicCharts()
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true })
else init()
