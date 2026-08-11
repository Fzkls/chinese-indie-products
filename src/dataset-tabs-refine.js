const $ = (selector, root = document) => root.querySelector(selector)
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)]

const state = { lastDataset: null, lastView: null }

function originalDatasetButton(dataset) {
  return $(`.dataset-primary-tabs [data-dataset="${dataset}"]`)
}

function originalViewButton(view) {
  return $(`.dataset-secondary-tabs [data-view="${view}"]`)
}

function installViewSwitcher() {
  if ($('#dataset-view-switcher')) return
  const main = $('main')
  if (!main) return
  const switcher = document.createElement('div')
  switcher.id = 'dataset-view-switcher'
  switcher.className = 'dataset-view-switcher'
  switcher.innerHTML = `
    <div class="wrap dataset-view-switcher-inner">
      <div>
        <span class="dataset-view-kicker">当前视图</span>
        <strong id="dataset-view-title">项目</strong>
      </div>
      <div class="dataset-view-tabs" role="tablist" aria-label="数据视图">
        <button type="button" role="tab" data-refined-view="overview">概览</button>
        <button type="button" role="tab" data-refined-view="list">项目列表</button>
      </div>
    </div>`
  main.prepend(switcher)
  switcher.addEventListener('click', (event) => {
    const button = event.target.closest('[data-refined-view]')
    if (!button) return
    originalViewButton(button.dataset.refinedView)?.click()
  })
}

function installOverviewDetails() {
  const section = $('#project-list')
  const wrap = section?.querySelector(':scope > .wrap')
  if (!section || !wrap || $('#overview-project-details')) return
  const heading = $('.project-list-heading', wrap)
  if (!heading) return

  const details = document.createElement('details')
  details.id = 'overview-project-details'
  details.className = 'overview-project-details'
  const summary = document.createElement('summary')
  summary.innerHTML = `
    <span class="overview-project-summary-main"><strong id="overview-project-summary-title">查看项目</strong><small id="overview-project-context">默认收起，需要时展开查看具体项目</small></span>
    <span class="overview-project-summary-count" id="overview-project-summary-count">—</span>`
  const body = document.createElement('div')
  body.className = 'overview-project-details-body'

  const movable = [...wrap.children].filter((node) => node !== heading)
  movable.forEach((node) => body.append(node))
  details.append(summary, body)
  wrap.append(details)
}

function syncHeroActions() {
  const dataset = document.body.dataset.dataset || 'product'
  const product = $('.hero-actions a[href="#explore"], .hero-actions a[data-dataset-action="product"]')
  const tool = $('.hero-actions a[href="#tools"], .hero-actions a[data-dataset-action="tool"]')
  if (product) {
    product.dataset.datasetAction = 'product'
    product.href = '#projects'
    product.classList.toggle('primary', dataset === 'product')
    product.classList.toggle('secondary', dataset !== 'product')
    product.setAttribute('aria-current', dataset === 'product' ? 'page' : 'false')
  }
  if (tool) {
    tool.dataset.datasetAction = 'tool'
    tool.href = '#toolkit'
    tool.classList.toggle('primary', dataset === 'tool')
    tool.classList.toggle('secondary', dataset !== 'tool')
    tool.setAttribute('aria-current', dataset === 'tool' ? 'page' : 'false')
  }
}

function syncViewSwitcher() {
  const dataset = document.body.dataset.dataset || 'product'
  const view = document.body.dataset.datasetView || 'overview'
  const datasetLabel = dataset === 'tool' ? '工具' : '项目'
  const title = $('#dataset-view-title')
  if (title) title.textContent = datasetLabel
  $$('[data-refined-view]').forEach((button) => {
    const active = button.dataset.refinedView === view
    button.classList.toggle('is-active', active)
    button.setAttribute('aria-selected', String(active))
    button.textContent = button.dataset.refinedView === 'overview' ? '概览' : `${datasetLabel}列表`
  })
}

function syncEmbeddedProjectList() {
  const dataset = document.body.dataset.dataset || 'product'
  const view = document.body.dataset.datasetView || 'overview'
  const section = $('#project-list')
  const details = $('#overview-project-details')
  const headingTitle = $('.project-list-heading h2')
  if (!section || !details) return

  if (dataset !== 'product') {
    section.hidden = true
    return
  }

  section.hidden = false
  section.classList.toggle('is-overview-embed', view === 'overview')
  section.classList.toggle('is-full-list', view === 'list')
  if (headingTitle) headingTitle.textContent = view === 'overview' ? '相关项目' : '项目列表'

  const enteringOverview = view === 'overview' && (state.lastDataset !== dataset || state.lastView !== view)
  if (enteringOverview) details.open = false
  if (view === 'list') details.open = true
}

function syncProjectCount() {
  const source = $('#project-list-summary')?.textContent?.trim()
  const target = $('#overview-project-summary-count')
  if (!source || !target) return
  const match = source.match(/找到\s*([\d,]+)\s*个项目/)
  target.textContent = match ? `${match[1]} 个项目` : source
}

function setOverviewContext(label) {
  const context = $('#overview-project-context')
  const title = $('#overview-project-summary-title')
  if (context) context.textContent = label ? `来自概览筛选：${label}` : '默认收起，需要时展开查看具体项目'
  if (title) title.textContent = label ? '查看相关项目' : '查看项目'
}

function filterLabel(row) {
  return row.querySelector('.taxonomy-bar-label, .taxonomy-status-label')?.textContent?.trim() || row.dataset.taxonomyValue || row.dataset.statusCategory || ''
}

function projectControlFor(key) {
  const ids = {
    primary: '#project-v2-primary', sub: '#project-v2-sub', audience: '#project-v2-audience',
    form: '#project-v2-form', characteristic: '#project-v2-characteristic'
  }
  return $(ids[key] || '')
}

function applyOverviewDrilldown(row) {
  const rawKey = row.dataset.statusCategory ? 'primary' : row.dataset.taxonomyFilter
  const key = ['primary', 'sub', 'audience', 'form', 'characteristic'].includes(rawKey) ? rawKey : null
  const value = row.dataset.statusCategory || row.dataset.taxonomyValue
  if (!key || !value) return

  const control = projectControlFor(key)
  if (!control) return
  control.value = value
  control.dispatchEvent(new Event('change', { bubbles: true }))

  row.closest('.taxonomy-bars, .taxonomy-status-matrix')?.querySelectorAll('.is-active').forEach((node) => node.classList.remove('is-active'))
  row.classList.add('is-active')
  setOverviewContext(filterLabel(row))
  const details = $('#overview-project-details')
  if (details) details.open = true
  syncEmbeddedProjectList()
  syncProjectCount()
}

function bindCaptureDrilldown() {
  document.addEventListener('click', (event) => {
    const row = event.target.closest('#semantic-map [data-taxonomy-filter], #semantic-map [data-status-category]')
    if (!row) return
    event.stopPropagation()
    applyOverviewDrilldown(row)
  }, true)
}

function bindDatasetDefaults() {
  document.addEventListener('click', (event) => {
    const datasetButton = event.target.closest('.dataset-primary-tabs [data-dataset]')
    if (!datasetButton) return
    if ((document.body.dataset.datasetView || 'overview') !== 'overview') originalViewButton('overview')?.click()
  }, true)

  document.addEventListener('click', (event) => {
    const action = event.target.closest('.hero-actions [data-dataset-action]')
    if (!action) return
    event.preventDefault()
    const dataset = action.dataset.datasetAction
    if ((document.body.dataset.datasetView || 'overview') !== 'overview') originalViewButton('overview')?.click()
    originalDatasetButton(dataset)?.click()
  }, true)
}

function syncAll() {
  installViewSwitcher()
  installOverviewDetails()
  const dataset = document.body.dataset.dataset || 'product'
  const view = document.body.dataset.datasetView || 'overview'
  syncHeroActions()
  syncViewSwitcher()
  syncEmbeddedProjectList()
  syncProjectCount()
  state.lastDataset = dataset
  state.lastView = view
}

function observeUi() {
  const observer = new MutationObserver(() => queueMicrotask(syncAll))
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-dataset', 'data-dataset-view', 'hidden'] })
  const summary = $('#project-list-summary')
  if (summary) new MutationObserver(syncProjectCount).observe(summary, { childList: true, characterData: true, subtree: true })
}

function initRefinement() {
  syncAll()
  bindCaptureDrilldown()
  bindDatasetDefaults()
  observeUi()
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initRefinement, { once: true })
else initRefinement()
