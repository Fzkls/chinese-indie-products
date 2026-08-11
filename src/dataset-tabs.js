const DATASET_LABELS = { product: '项目', tool: '工具' }
const VIEW_LABELS = { overview: '概览', list: '列表' }
const STATUS_LABELS = { active: '已上线', developing: '开发中', closed: '已关闭', acquired: '已收购', unknown: '未知' }
const AUDIENCE_LABELS = {
  developer: '开发者', creator: '创作者', designer: '设计师', marketer: '营销人员', student: '学生',
  team: '团队', enterprise: '企业', consumer: '普通用户', merchant: '商家', sysadmin: '系统管理员'
}
const FORM_LABELS = {
  saas: 'SaaS', 'desktop-app': '桌面应用', 'mobile-app': '移动应用', 'browser-extension': '浏览器扩展',
  cli: '命令行工具', api: 'API 服务', sdk: 'SDK', plugin: '插件', 'self-hosted': '自托管应用', bot: '机器人', 'web-app': 'Web 应用'
}
const CHARACTERISTIC_LABELS = {
  'open-source': '开源', 'self-hosted': '支持自托管', 'local-first': '本地优先', 'privacy-focused': '隐私优先',
  offline: '支持离线', 'no-code': '无代码', 'ai-native': 'AI 原生'
}
const CAPABILITY_LABELS = {
  ai: 'AI', agent: '智能体', automation: '自动化', collaboration: '协作', analytics: '数据分析', search: '搜索', workflow: '工作流',
  ssh: 'SSH', sftp: 'SFTP', docker: 'Docker', kubernetes: 'Kubernetes', translation: '翻译', ocr: 'OCR', writing: '写作',
  'image-generation': '图像生成', video: '视频', 'note-taking': '笔记', monitoring: '监控', database: '数据库', api: 'API', testing: '测试',
  deployment: '部署', music: '音乐', audio: '音频', podcast: '播客', sharing: '分享', 'media-server': '媒体服务', crm: 'CRM', seo: 'SEO',
  feedback: '反馈', payments: '支付', finance: '财务', education: '教育', security: '安全', vpn: 'VPN', proxy: '代理', backup: '备份',
  sync: '同步', markdown: 'Markdown', rss: 'RSS', bookmark: '书签', email: '邮件', calendar: '日历', 'task-management': '任务管理',
  'prompt-management': 'Prompt 管理', 'chat-management': '对话管理', 'code-generation': '代码生成'
}
const RESERVED_GITHUB_OWNERS = new Set(['about', 'apps', 'blog', 'collections', 'enterprise', 'events', 'explore', 'features', 'issues', 'marketplace', 'orgs', 'pricing', 'pulls', 'search', 'settings', 'sponsors', 'topics', 'trending'])
const $ = (selector, root = document) => root.querySelector(selector)
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)]
const formatNumber = (value) => new Intl.NumberFormat('zh-CN').format(Number(value) || 0)
const escapeHtml = (value = '') => String(value).replace(/[&<>'\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '\"': '&quot;' })[char])

const ui = {
  dataset: 'product',
  view: 'overview',
  products: [],
  semanticById: new Map(),
  taxonomy: {},
  github: {},
  filtered: [],
  pageSize: 36,
  visible: 36,
  filters: { search: '', primary: '', sub: '', audience: '', form: '', characteristic: '', status: '', year: '', city: '' }
}

function primaryLabel(id) {
  return ui.taxonomy.primaryCategories?.find((item) => item.id === id)?.label || id
}

function tagLabel(value) {
  return AUDIENCE_LABELS[value] || FORM_LABELS[value] || CHARACTERISTIC_LABELS[value] || CAPABILITY_LABELS[value] || value
}

function normalizeGithubRepository(rawUrl) {
  if (!rawUrl) return null
  try {
    const url = new URL(rawUrl)
    if (url.hostname.toLowerCase().replace(/^www\./, '') !== 'github.com') return null
    const parts = url.pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part))
    if (parts.length < 2 || RESERVED_GITHUB_OWNERS.has(parts[0].toLowerCase())) return null
    return `${parts[0]}/${parts[1].replace(/\.git$/i, '')}`.toLowerCase()
  } catch { return null }
}

function installNavigation() {
  const links = $('.top-links')
  if (!links) return
  links.classList.add('dataset-navigation')
  links.innerHTML = `
    <div class="dataset-primary-tabs" role="tablist" aria-label="数据集">
      <button type="button" role="tab" data-dataset="product">项目</button>
      <button type="button" role="tab" data-dataset="tool">工具</button>
    </div>
    <span class="dataset-nav-divider" aria-hidden="true"></span>
    <div class="dataset-secondary-tabs" role="tablist" aria-label="当前数据集视图">
      <button type="button" role="tab" data-view="overview">概览</button>
      <button type="button" role="tab" data-view="list">项目列表</button>
    </div>
    <a class="dataset-method-link" href="#methodology">数据说明</a>`
  links.addEventListener('click', (event) => {
    const datasetButton = event.target.closest('[data-dataset]')
    const viewButton = event.target.closest('[data-view]')
    if (datasetButton) setView(datasetButton.dataset.dataset, ui.view, true)
    if (viewButton) setView(ui.dataset, viewButton.dataset.view, true)
  })
}

function canonicalHash(dataset = ui.dataset, view = ui.view) {
  if (dataset === 'product') return view === 'overview' ? '#projects' : '#projects-list'
  return view === 'overview' ? '#toolkit' : '#toolkit-list'
}

function routeFromHash(hash = location.hash) {
  if (['#tools', '#toolkit-list'].includes(hash)) return ['tool', 'list']
  if (['#tool-dashboard', '#toolkit'].includes(hash)) return ['tool', 'overview']
  if (['#explore', '#projects-list'].includes(hash)) return ['product', 'list']
  if (['#semantic-map', '#product-dashboard', '#product-github', '#projects'].includes(hash)) return ['product', 'overview']
  return null
}

function setHidden(node, hidden) {
  if (node) node.hidden = hidden
}

function applySectionVisibility() {
  const isProductOverview = ui.dataset === 'product' && ui.view === 'overview'
  const isProductList = ui.dataset === 'product' && ui.view === 'list'
  const isToolOverview = ui.dataset === 'tool' && ui.view === 'overview'
  const isToolList = ui.dataset === 'tool' && ui.view === 'list'
  setHidden($('.metrics'), !isProductOverview)
  setHidden($('#semantic-map'), !isProductOverview)
  setHidden($('#product-dashboard'), !isProductOverview)
  setHidden($('#product-github'), !isProductOverview)
  setHidden($('#project-list'), !isProductList)
  setHidden($('#tool-dashboard'), !isToolOverview)
  setHidden($('#tools'), !isToolList)
  setHidden($('#explore'), true)
}

function syncNavigation() {
  $$('[data-dataset]').forEach((button) => {
    const active = button.dataset.dataset === ui.dataset
    button.classList.toggle('is-active', active)
    button.setAttribute('aria-selected', String(active))
  })
  $$('[data-view]').forEach((button) => {
    const active = button.dataset.view === ui.view
    button.classList.toggle('is-active', active)
    button.setAttribute('aria-selected', String(active))
    button.textContent = button.dataset.view === 'overview' ? '概览' : `${DATASET_LABELS[ui.dataset]}列表`
  })
  document.body.dataset.dataset = ui.dataset
  document.body.dataset.datasetView = ui.view
  const coreLabel = $('.visual-core span')
  const coreSmall = $('.visual-core small')
  if (coreLabel) coreLabel.textContent = ui.dataset === 'product' ? 'PROJECTS' : 'TOOLS'
  if (coreSmall) coreSmall.textContent = ui.dataset === 'product' ? 'DEDUPED RECORDS' : 'CURATED RESOURCES'
  syncHeroTotal()
}

function syncHeroTotal() {
  const target = $('#hero-total')
  const source = ui.dataset === 'product' ? $('#metric-products') : $('#metric-tools')
  if (target && source && source.textContent.trim() && source.textContent.trim() !== '—' && target.textContent !== source.textContent) target.textContent = source.textContent
}

function setView(dataset, view, updateHash = false) {
  ui.dataset = dataset === 'tool' ? 'tool' : 'product'
  ui.view = view === 'list' ? 'list' : 'overview'
  syncNavigation()
  applySectionVisibility()
  if (updateHash) history.replaceState(null, '', canonicalHash())
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function removeLegacySemanticNav() {
  const link = $('.top-links a[href="#semantic-map"]')
  if (link) link.remove()
}

function prepareSemanticOverview() {
  const section = $('#semantic-map')
  if (!section) return
  section.classList.add('semantic-overview-only')
  for (const selector of ['.taxonomy-filter-panel', '.taxonomy-active-filters', '.taxonomy-results-heading', '.taxonomy-product-grid', '.load-more-wrap']) {
    const node = $(selector, section)
    if (node) node.hidden = true
  }
  const direction = $('#taxonomy-primary-chart')
  if (direction) direction.closest('.taxonomy-panel')?.classList.add('taxonomy-click-through')
  removeLegacySemanticNav()
  applySectionVisibility()
}

function relabelSourceCategoryChart() {
  const donut = $('#category-donut')
  const panel = donut?.closest('.chart-panel')
  const heading = panel?.querySelector('.panel-heading')
  const title = heading?.querySelector('h3')
  const desc = heading?.querySelector('p')
  if (title && title.textContent !== '来源类型') title.textContent = '来源类型'
  const copy = '上游清单的来源类别，仅用于来源分析；产品语义分类见上方'
  if (desc && desc.textContent !== copy) desc.textContent = copy
}

function optionValues(values, labeler = (value) => value) {
  return values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(labeler(value))}</option>`).join('')
}

function insertProjectList() {
  if ($('#project-list')) return
  const legacy = $('#explore')
  if (!legacy) return
  const section = document.createElement('section')
  section.className = 'project-list-v2'
  section.id = 'project-list'
  section.hidden = true
  section.innerHTML = `
    <div class="wrap">
      <div class="section-heading project-list-heading">
        <div><p class="eyebrow">PROJECT DIRECTORY</p><h2>项目列表</h2></div>
        <p id="project-list-summary">正在读取产品数据…</p>
      </div>
      <div class="project-list-note"><strong>统一筛选口径</strong><span>主分类、子方向、用户群体、产品形态与产品特征来自语义 taxonomy；状态、年份、城市来自原始来源数据。</span></div>
      <div class="project-list-filters">
        <label class="project-search"><span>搜索项目</span><input id="project-v2-search" type="search" placeholder="产品、开发者、描述、城市…" autocomplete="off"></label>
        <label><span>主分类</span><select id="project-v2-primary"><option value="">全部主分类</option></select></label>
        <label><span>子方向</span><select id="project-v2-sub"><option value="">全部子方向</option></select></label>
        <label><span>用户群体</span><select id="project-v2-audience"><option value="">全部用户群体</option></select></label>
        <label><span>产品形态</span><select id="project-v2-form"><option value="">全部产品形态</option></select></label>
        <label><span>产品特征</span><select id="project-v2-characteristic"><option value="">全部产品特征</option></select></label>
        <label><span>状态</span><select id="project-v2-status"><option value="">全部状态</option></select></label>
        <label><span>年份</span><select id="project-v2-year"><option value="">全部年份</option></select></label>
        <label><span>城市</span><select id="project-v2-city"><option value="">全部城市</option></select></label>
        <button type="button" class="reset-button project-list-reset" id="project-v2-reset">清空筛选</button>
      </div>
      <div class="project-list-active" id="project-v2-active"></div>
      <div class="project-list-grid" id="project-v2-grid"></div>
      <div class="load-more-wrap"><button class="button secondary" type="button" id="project-v2-more">加载更多项目</button></div>
    </div>`
  legacy.insertAdjacentElement('beforebegin', section)
}

function buildProjectFilters() {
  const primary = $('#project-v2-primary')
  const audience = $('#project-v2-audience')
  const form = $('#project-v2-form')
  const characteristic = $('#project-v2-characteristic')
  const status = $('#project-v2-status')
  const year = $('#project-v2-year')
  const city = $('#project-v2-city')
  if (!primary || primary.dataset.ready) return

  primary.insertAdjacentHTML('beforeend', optionValues((ui.taxonomy.primaryCategories || []).filter((item) => item.id !== 'other').map((item) => item.id), primaryLabel))
  audience.insertAdjacentHTML('beforeend', optionValues(ui.taxonomy.tags?.audience || [], (value) => AUDIENCE_LABELS[value] || value))
  form.insertAdjacentHTML('beforeend', optionValues(ui.taxonomy.tags?.productForm || [], (value) => FORM_LABELS[value] || value))
  characteristic.insertAdjacentHTML('beforeend', optionValues(ui.taxonomy.tags?.characteristics || [], (value) => CHARACTERISTIC_LABELS[value] || value))
  status.insertAdjacentHTML('beforeend', optionValues(['active', 'developing', 'closed', 'acquired', 'unknown'], (value) => STATUS_LABELS[value]))
  const years = [...new Set(ui.products.map((item) => item.year).filter(Boolean))].sort((a, b) => Number(b) - Number(a))
  const cities = [...new Set(ui.products.map((item) => item.city).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'zh-CN'))
  year.insertAdjacentHTML('beforeend', optionValues(years))
  city.insertAdjacentHTML('beforeend', optionValues(cities))
  primary.dataset.ready = 'true'
  rebuildSubOptions()
}

function rebuildSubOptions() {
  const select = $('#project-v2-sub')
  if (!select) return
  const current = ui.filters.sub
  const values = ui.filters.primary
    ? (ui.taxonomy.subCategories?.[ui.filters.primary] || []).filter((value) => value !== '其他')
    : [...new Set(Object.values(ui.taxonomy.subCategories || {}).flat())].filter((value) => value !== '其他').sort((a, b) => a.localeCompare(b, 'zh-CN'))
  select.innerHTML = `<option value="">全部子方向</option>${optionValues(values)}`
  if (values.includes(current)) select.value = current
  else if (current) ui.filters.sub = ''
}

function semanticFor(record) {
  return ui.semanticById.get(record.id) || { primaryCategory: 'other', subCategories: [], tags: {}, confidence: 0 }
}

function matchesProject(record) {
  const semantic = semanticFor(record)
  const f = ui.filters
  const haystack = [record.productName, record.developerName, record.description, record.city, record.sourceCategory].filter(Boolean).join(' ').toLowerCase()
  const query = f.search.trim().toLowerCase()
  return (!query || haystack.includes(query))
    && (!f.primary || semantic.primaryCategory === f.primary)
    && (!f.sub || (semantic.subCategories || []).includes(f.sub))
    && (!f.audience || (semantic.tags?.audience || []).includes(f.audience))
    && (!f.form || (semantic.tags?.productForm || []).includes(f.form))
    && (!f.characteristic || (semantic.tags?.characteristics || []).includes(f.characteristic))
    && (!f.status || (record.status || 'unknown') === f.status)
    && (!f.year || String(record.year || '') === f.year)
    && (!f.city || record.city === f.city)
}

function renderProjectActiveFilters() {
  const labels = { search: '搜索', primary: '主分类', sub: '子方向', audience: '用户群体', form: '产品形态', characteristic: '产品特征', status: '状态', year: '年份', city: '城市' }
  const display = (key, value) => key === 'primary' ? primaryLabel(value) : key === 'status' ? STATUS_LABELS[value] : tagLabel(value)
  const target = $('#project-v2-active')
  if (!target) return
  target.innerHTML = Object.entries(ui.filters).filter(([, value]) => value).map(([key, value]) => `<button type="button" data-clear-project="${key}"><span>${labels[key]}</span>${escapeHtml(display(key, value))}<b>×</b></button>`).join('')
  $$('[data-clear-project]', target).forEach((button) => button.addEventListener('click', () => {
    const key = button.dataset.clearProject
    ui.filters[key] = ''
    const control = $(`#project-v2-${key === 'search' ? 'search' : key}`)
    if (control) control.value = ''
    if (key === 'primary') rebuildSubOptions()
    applyProjectFilters()
  }))
}

function githubMeta(record) {
  const key = normalizeGithubRepository(record.productUrl)
  return key ? ui.github[key] : null
}

function renderProjectCards() {
  const grid = $('#project-v2-grid')
  const summary = $('#project-list-summary')
  const more = $('#project-v2-more')
  if (!grid || !summary || !more) return
  const visible = ui.filtered.slice(0, ui.visible)
  summary.textContent = `找到 ${formatNumber(ui.filtered.length)} 个项目 · 当前显示 ${formatNumber(visible.length)} 个`
  more.hidden = visible.length >= ui.filtered.length
  grid.innerHTML = visible.map((record) => {
    const semantic = semanticFor(record)
    const tags = [
      ...(semantic.subCategories || []).slice(0, 2),
      ...(semantic.tags?.productForm || []).slice(0, 1),
      ...(semantic.tags?.characteristics || []).slice(0, 1),
      ...(semantic.tags?.capabilities || []).slice(0, 2)
    ].map(tagLabel)
    const repository = githubMeta(record)
    const status = STATUS_LABELS[record.status || 'unknown'] || '未知'
    const location = [record.city, record.year].filter(Boolean).join(' · ') || '地区 / 时间未标注'
    return `<article class="project-v2-card">
      <div class="project-v2-card-top"><span class="project-category">${escapeHtml(primaryLabel(semantic.primaryCategory))}</span><span class="project-status status-${escapeHtml(record.status || 'unknown')}">${escapeHtml(status)}</span></div>
      <h3><a href="${escapeHtml(record.productUrl || '#')}" ${record.productUrl ? 'target="_blank" rel="noreferrer"' : 'aria-disabled="true"'}>${escapeHtml(record.productName)}</a></h3>
      <p>${escapeHtml(record.description || '暂无产品介绍')}</p>
      <div class="project-v2-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
      <div class="project-v2-meta"><span>${escapeHtml(record.developerName || '未知开发者')}</span><span>${escapeHtml(location)}</span>${repository?.status === 'available' ? `<span>★ ${formatNumber(repository.stars)}</span>` : ''}</div>
    </article>`
  }).join('') || '<div class="project-list-empty"><strong>没有匹配项目</strong><p>减少筛选条件或换一个关键词。</p></div>'
}

function applyProjectFilters() {
  ui.filtered = ui.products.filter(matchesProject)
  ui.visible = ui.pageSize
  renderProjectActiveFilters()
  renderProjectCards()
}

function bindProjectFilters() {
  const bindings = {
    'project-v2-search': 'search', 'project-v2-primary': 'primary', 'project-v2-sub': 'sub', 'project-v2-audience': 'audience',
    'project-v2-form': 'form', 'project-v2-characteristic': 'characteristic', 'project-v2-status': 'status', 'project-v2-year': 'year', 'project-v2-city': 'city'
  }
  for (const [id, key] of Object.entries(bindings)) {
    const node = $(`#${id}`)
    if (!node || node.dataset.bound) continue
    const eventName = node.tagName === 'INPUT' ? 'input' : 'change'
    node.addEventListener(eventName, (event) => {
      ui.filters[key] = event.target.value
      if (key === 'primary') rebuildSubOptions()
      applyProjectFilters()
    })
    node.dataset.bound = 'true'
  }
  $('#project-v2-reset')?.addEventListener('click', () => {
    for (const key of Object.keys(ui.filters)) ui.filters[key] = ''
    for (const id of Object.keys(bindings)) { const node = $(`#${id}`); if (node) node.value = '' }
    rebuildSubOptions()
    applyProjectFilters()
  })
  $('#project-v2-more')?.addEventListener('click', () => { ui.visible += ui.pageSize; renderProjectCards() })
}

function translateLegacySemanticLabels() {
  const section = $('#semantic-map')
  if (!section) return
  const selectMaps = {
    'taxonomy-audience': AUDIENCE_LABELS,
    'taxonomy-form': FORM_LABELS,
    'taxonomy-characteristic': CHARACTERISTIC_LABELS
  }
  for (const [id, map] of Object.entries(selectMaps)) {
    $$(`#${id} option`).forEach((option) => {
      if (option.value && map[option.value] && option.textContent !== map[option.value]) option.textContent = map[option.value]
    })
  }
  $$('.taxonomy-bar-row[data-taxonomy-filter]', section).forEach((row) => {
    const key = row.dataset.taxonomyFilter
    const value = row.dataset.taxonomyValue
    if (!value || !['audience', 'form', 'characteristic'].includes(key)) return
    const label = $('.taxonomy-bar-label', row)
    const mapped = tagLabel(value)
    if (label && label.textContent !== mapped) label.textContent = mapped
  })
  $$('.taxonomy-capability strong, .taxonomy-tags span', section).forEach((node) => {
    const mapped = tagLabel(node.textContent.trim())
    if (mapped !== node.textContent.trim()) node.textContent = mapped
  })
}

function handleOverviewClick(event) {
  const row = event.target.closest('#semantic-map [data-taxonomy-filter], #semantic-map [data-status-category]')
  if (!row) return
  const filter = row.dataset.taxonomyFilter
  const value = row.dataset.taxonomyValue || row.dataset.statusCategory
  if (!value) return
  const keyMap = { primary: 'primary', sub: 'sub', audience: 'audience', form: 'form', characteristic: 'characteristic' }
  const key = row.dataset.statusCategory ? 'primary' : keyMap[filter]
  if (!key) return
  ui.filters[key] = value
  if (key === 'primary') rebuildSubOptions()
  const control = $(`#project-v2-${key}`)
  if (control) control.value = value
  applyProjectFilters()
  setView('product', 'list', true)
}

async function loadProjectData() {
  const [productsResponse, taxonomyResponse, semanticResponse, githubResponse] = await Promise.all([
    fetch('data/products.json'), fetch('data/taxonomy.json'), fetch('data/product-taxonomy.json'), fetch('data/github-repositories.json')
  ])
  if (!productsResponse.ok || !taxonomyResponse.ok || !semanticResponse.ok) throw new Error('项目列表数据加载失败')
  const [products, taxonomy, semantic, github] = await Promise.all([
    productsResponse.json(), taxonomyResponse.json(), semanticResponse.json(), githubResponse.ok ? githubResponse.json() : Promise.resolve({})
  ])
  ui.products = products.records || []
  ui.taxonomy = taxonomy
  ui.semanticById = new Map((semantic.records || []).map((item) => [item.productId, item]))
  ui.github = github.repositories || {}
  buildProjectFilters()
  bindProjectFilters()
  applyProjectFilters()
}

function observeDynamicUi() {
  let scheduled = false
  const observer = new MutationObserver(() => {
    if (scheduled) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      prepareSemanticOverview()
      translateLegacySemanticLabels()
      relabelSourceCategoryChart()
      syncHeroTotal()
    })
  })
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })
}

function bindHashRouting() {
  window.addEventListener('hashchange', () => {
    if (location.hash === '#methodology' || location.hash === '#top') return
    const route = routeFromHash()
    if (route) setView(route[0], route[1], false)
  })
}

async function init() {
  document.body.classList.add('dataset-tabs-active')
  installNavigation()
  insertProjectList()
  prepareSemanticOverview()
  relabelSourceCategoryChart()
  observeDynamicUi()
  bindHashRouting()
  document.addEventListener('click', handleOverviewClick)
  const route = routeFromHash()
  if (route) [ui.dataset, ui.view] = route
  syncNavigation()
  applySectionVisibility()
  try { await loadProjectData() } catch (error) {
    console.error(error)
    const grid = $('#project-v2-grid')
    if (grid) grid.innerHTML = `<div class="project-list-empty"><strong>项目列表加载失败</strong><p>${escapeHtml(error.message)}</p></div>`
  }
  prepareSemanticOverview()
  translateLegacySemanticLabels()
  applySectionVisibility()
}

init()
