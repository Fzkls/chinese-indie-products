const DATASET_LABELS = { product: '项目', tool: '工具' }
const STATUS_LABELS = { active: '已上线', developing: '开发中', closed: '已关闭', acquired: '已收购', unknown: '未知' }
const PRICING_LABELS = { free: '免费', paid: '付费', 'open-source': '开源', unknown: '价格未知' }
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
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char])

const ui = {
  dataset: 'product',
  mode: 'overview',
  products: [],
  tools: [],
  semanticById: new Map(),
  taxonomy: {},
  github: {},
  filteredProducts: [],
  pageSize: 36,
  visible: 36,
  primaryPreview: '',
  toolPreviewCategory: '',
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

function githubMeta(record) {
  const key = normalizeGithubRepository(record.productUrl || record.toolUrl)
  return key ? ui.github[key] : null
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
    <a class="dataset-method-link" href="#methodology">数据说明</a>`
  links.addEventListener('click', (event) => {
    const button = event.target.closest('[data-dataset]')
    if (!button) return
    setView(button.dataset.dataset, 'overview', true)
  })
}

function installHeroActions() {
  const actions = $('.hero-actions')
  if (!actions) return
  actions.innerHTML = `
    <button class="button primary" type="button" id="browse-current-dataset">浏览全部项目</button>
    <button class="button secondary" type="button" id="download-current-dataset">下载项目 JSON</button>`
  $('#browse-current-dataset')?.addEventListener('click', () => {
    if (ui.dataset === 'product') {
      clearProjectFilters()
      setView('product', 'directory', true)
    } else {
      resetToolDirectory()
      setView('tool', 'directory', true)
    }
  })
  $('#download-current-dataset')?.addEventListener('click', downloadCurrentDataset)
}

async function downloadCurrentDataset() {
  const type = ui.dataset === 'tool' ? 'tools' : 'products'
  try {
    const response = await fetch(`data/${type}.json`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload = await response.json()
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `indiebase-cn-${type}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Download failed:', error)
  }
}

function canonicalHash(dataset = ui.dataset, mode = ui.mode) {
  if (dataset === 'product') return mode === 'directory' ? '#projects-list' : '#projects'
  return mode === 'directory' ? '#toolkit-list' : '#toolkit'
}

function routeFromHash(hash = location.hash) {
  if (['#explore', '#projects-list'].includes(hash)) return ['product', 'directory']
  if (['#semantic-map', '#product-dashboard', '#product-github', '#projects'].includes(hash)) return ['product', 'overview']
  if (['#tools', '#toolkit-list'].includes(hash)) return ['tool', 'directory']
  if (['#tool-dashboard', '#toolkit'].includes(hash)) return ['tool', 'overview']
  return null
}

function setHidden(node, hidden) {
  if (node) node.hidden = hidden
}

function applySectionVisibility() {
  const productOverview = ui.dataset === 'product' && ui.mode === 'overview'
  const productDirectory = ui.dataset === 'product' && ui.mode === 'directory'
  const toolOverview = ui.dataset === 'tool' && ui.mode === 'overview'
  const toolDirectory = ui.dataset === 'tool' && ui.mode === 'directory'

  setHidden($('.metrics'), !productOverview)
  setHidden($('#semantic-map'), !productOverview)
  setHidden($('#product-dashboard'), !productOverview)
  setHidden($('#product-github'), !productOverview)
  setHidden($('#project-list'), !productDirectory)
  setHidden($('#tool-dashboard'), !toolOverview)
  setHidden($('#tools'), !toolDirectory)
  setHidden($('#explore'), true)
}

function syncNavigation() {
  $$('[data-dataset]').forEach((button) => {
    const active = button.dataset.dataset === ui.dataset
    button.classList.toggle('is-active', active)
    button.setAttribute('aria-selected', String(active))
  })
  document.body.dataset.dataset = ui.dataset
  document.body.dataset.datasetMode = ui.mode
}

function syncHero() {
  const label = DATASET_LABELS[ui.dataset]
  const browse = $('#browse-current-dataset')
  const download = $('#download-current-dataset')
  if (browse) browse.textContent = `浏览全部${label}`
  if (download) download.textContent = `下载${label} JSON`

  const coreLabel = $('.visual-core span')
  const coreSmall = $('.visual-core small')
  if (coreLabel) coreLabel.textContent = ui.dataset === 'product' ? 'PROJECTS' : 'TOOLS'
  if (coreSmall) coreSmall.textContent = ui.dataset === 'product' ? 'DEDUPED RECORDS' : 'CURATED RESOURCES'
  syncHeroTotal()
}

function syncHeroTotal() {
  const target = $('#hero-total')
  const source = ui.dataset === 'product' ? $('#metric-products') : $('#metric-tools')
  if (target && source && source.textContent.trim() && source.textContent.trim() !== '—') target.textContent = source.textContent
}

function activeSection() {
  if (ui.dataset === 'product') return ui.mode === 'directory' ? $('#project-list') : $('#top')
  return ui.mode === 'directory' ? $('#tools') : $('#top')
}

function setView(dataset, mode = 'overview', updateHash = false, scroll = true) {
  ui.dataset = dataset === 'tool' ? 'tool' : 'product'
  ui.mode = mode === 'directory' ? 'directory' : 'overview'
  syncNavigation()
  syncHero()
  applySectionVisibility()
  if (updateHash) history.replaceState(null, '', canonicalHash())
  if (scroll) {
    const target = activeSection()
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function insertProjectList() {
  if ($('#project-list')) return
  const legacy = $('#explore')
  if (!legacy) return
  const section = document.createElement('section')
  section.className = 'project-list-v2 directory-section'
  section.id = 'project-list'
  section.hidden = true
  section.innerHTML = `
    <div class="wrap">
      <div class="directory-back-row"><button class="directory-back" type="button" data-back-overview="product">← 返回项目概览</button></div>
      <div class="section-heading project-list-heading">
        <div><p class="eyebrow">PROJECT DIRECTORY</p><h2>项目目录</h2></div>
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

function installToolBackControl() {
  const section = $('#tools .wrap')
  if (!section || $('.directory-back-row', section)) return
  const row = document.createElement('div')
  row.className = 'directory-back-row'
  row.innerHTML = '<button class="directory-back" type="button" data-back-overview="tool">← 返回工具概览</button>'
  section.prepend(row)
}

function optionValues(values, labeler = (value) => value) {
  return values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(labeler(value))}</option>`).join('')
}

function buildProjectFilters() {
  const primary = $('#project-v2-primary')
  if (!primary || primary.dataset.ready) return
  $('#project-v2-primary').insertAdjacentHTML('beforeend', optionValues((ui.taxonomy.primaryCategories || []).filter((item) => item.id !== 'other').map((item) => item.id), primaryLabel))
  $('#project-v2-audience').insertAdjacentHTML('beforeend', optionValues(ui.taxonomy.tags?.audience || [], (value) => AUDIENCE_LABELS[value] || value))
  $('#project-v2-form').insertAdjacentHTML('beforeend', optionValues(ui.taxonomy.tags?.productForm || [], (value) => FORM_LABELS[value] || value))
  $('#project-v2-characteristic').insertAdjacentHTML('beforeend', optionValues(ui.taxonomy.tags?.characteristics || [], (value) => CHARACTERISTIC_LABELS[value] || value))
  $('#project-v2-status').insertAdjacentHTML('beforeend', optionValues(['active', 'developing', 'closed', 'acquired', 'unknown'], (value) => STATUS_LABELS[value]))
  const years = [...new Set(ui.products.map((item) => item.year).filter(Boolean))].sort((a, b) => Number(b) - Number(a))
  const cities = [...new Set(ui.products.map((item) => item.city).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'zh-CN'))
  $('#project-v2-year').insertAdjacentHTML('beforeend', optionValues(years))
  $('#project-v2-city').insertAdjacentHTML('beforeend', optionValues(cities))
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
}

function renderProjectCards() {
  const grid = $('#project-v2-grid')
  const summary = $('#project-list-summary')
  const more = $('#project-v2-more')
  if (!grid || !summary || !more) return
  const visible = ui.filteredProducts.slice(0, ui.visible)
  summary.textContent = `找到 ${formatNumber(ui.filteredProducts.length)} 个项目 · 当前显示 ${formatNumber(visible.length)} 个`
  more.hidden = visible.length >= ui.filteredProducts.length
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
  ui.filteredProducts = ui.products.filter(matchesProject)
  ui.visible = ui.pageSize
  renderProjectActiveFilters()
  renderProjectCards()
}

function syncProjectControls() {
  const ids = { search: 'project-v2-search', primary: 'project-v2-primary', sub: 'project-v2-sub', audience: 'project-v2-audience', form: 'project-v2-form', characteristic: 'project-v2-characteristic', status: 'project-v2-status', year: 'project-v2-year', city: 'project-v2-city' }
  rebuildSubOptions()
  for (const [key, id] of Object.entries(ids)) {
    const node = $(`#${id}`)
    if (node) node.value = ui.filters[key] || ''
  }
}

function clearProjectFilters() {
  for (const key of Object.keys(ui.filters)) ui.filters[key] = ''
  syncProjectControls()
  applyProjectFilters()
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
  $('#project-v2-reset')?.addEventListener('click', clearProjectFilters)
  $('#project-v2-more')?.addEventListener('click', () => { ui.visible += ui.pageSize; renderProjectCards() })
  $('#project-v2-active')?.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-clear-project]')
    if (!chip) return
    ui.filters[chip.dataset.clearProject] = ''
    syncProjectControls()
    applyProjectFilters()
  })
}

function openProjectDirectory({ primary = '', search = '' } = {}) {
  for (const key of Object.keys(ui.filters)) ui.filters[key] = ''
  ui.filters.primary = primary
  ui.filters.search = search
  syncProjectControls()
  applyProjectFilters()
  setView('product', 'directory', true)
}

function resetToolDirectory() {
  $('#reset-tool-filters')?.click()
}

function openToolDirectory({ category = '', search = '' } = {}) {
  resetToolDirectory()
  const categorySelect = $('#tool-category-filter')
  const searchInput = $('#tool-search')
  if (categorySelect && category) {
    categorySelect.value = category
    categorySelect.dispatchEvent(new Event('change', { bubbles: true }))
  }
  if (searchInput && search) {
    searchInput.value = search
    searchInput.dispatchEvent(new Event('input', { bubbles: true }))
  }
  setView('tool', 'directory', true)
}

function productDirectionRecords(primary) {
  return ui.products.filter((record) => semanticFor(record).primaryCategory === primary)
}

function productPreviewSort(a, b) {
  const repoA = githubMeta(a)
  const repoB = githubMeta(b)
  const starsA = repoA?.status === 'available' ? Number(repoA.stars) || 0 : 0
  const starsB = repoB?.status === 'available' ? Number(repoB.stars) || 0 : 0
  if (starsA !== starsB) return starsB - starsA
  const activeA = ['active', 'developing'].includes(a.status) ? 1 : 0
  const activeB = ['active', 'developing'].includes(b.status) ? 1 : 0
  if (activeA !== activeB) return activeB - activeA
  return String(a.productName).localeCompare(String(b.productName), 'zh-CN')
}

function ensureProductDirectionExplorer() {
  const section = $('#semantic-map')
  const grid = $('.taxonomy-grid', section || document)
  if (!section || !grid) return
  section.classList.add('semantic-overview-only')
  for (const selector of ['.taxonomy-filter-panel', '.taxonomy-active-filters', '.taxonomy-results-heading', '.taxonomy-product-grid', ':scope > .load-more-wrap']) {
    const node = $(selector, section)
    if (node) node.hidden = true
  }
  const legacyPrimary = $('#taxonomy-primary-chart')?.closest('.taxonomy-panel')
  if (legacyPrimary) legacyPrimary.hidden = true
  if ($('#product-direction-explorer')) return

  const explorer = document.createElement('article')
  explorer.id = 'product-direction-explorer'
  explorer.className = 'chart-panel direction-explorer'
  explorer.innerHTML = `
    <div class="panel-heading direction-heading">
      <div><h3>产品方向</h3><p>选择一个方向，右侧直接查看具体项目；只有需要完整检索时才进入项目目录</p></div>
    </div>
    <div class="direction-master-detail">
      <div class="direction-master" id="product-direction-list"></div>
      <aside class="direction-detail" id="product-direction-preview"></aside>
    </div>`
  grid.insertAdjacentElement('beforebegin', explorer)
  explorer.addEventListener('click', (event) => {
    const direction = event.target.closest('[data-product-direction]')
    const viewAll = event.target.closest('[data-view-all-direction]')
    if (direction) {
      ui.primaryPreview = direction.dataset.productDirection
      renderProductDirectionExplorer()
    }
    if (viewAll) openProjectDirectory({ primary: viewAll.dataset.viewAllDirection })
  })
  renderProductDirectionExplorer()
}

function renderProductDirectionExplorer() {
  const list = $('#product-direction-list')
  const preview = $('#product-direction-preview')
  if (!list || !preview || !ui.products.length || !ui.taxonomy.primaryCategories) return

  const groups = (ui.taxonomy.primaryCategories || [])
    .filter((item) => item.id !== 'other')
    .map((item) => [item.id, productDirectionRecords(item.id).length])
    .filter(([, count]) => count)
    .sort((a, b) => b[1] - a[1])

  if (!groups.length) return
  if (!groups.some(([id]) => id === ui.primaryPreview)) ui.primaryPreview = groups[0][0]
  const max = Math.max(...groups.map(([, count]) => count), 1)

  list.innerHTML = groups.map(([id, count]) => `
    <button type="button" class="direction-row${id === ui.primaryPreview ? ' is-active' : ''}" data-product-direction="${escapeHtml(id)}" aria-pressed="${id === ui.primaryPreview}">
      <span class="direction-row-label">${escapeHtml(primaryLabel(id))}</span>
      <span class="direction-row-track"><span style="width:${count / max * 100}%"></span></span>
      <strong>${formatNumber(count)}</strong>
    </button>`).join('')

  const records = productDirectionRecords(ui.primaryPreview).sort(productPreviewSort)
  const visible = records.slice(0, 6)
  preview.innerHTML = `
    <div class="direction-detail-head">
      <div><span>当前方向</span><h4>${escapeHtml(primaryLabel(ui.primaryPreview))}</h4></div>
      <strong>${formatNumber(records.length)} 个项目</strong>
    </div>
    <div class="direction-preview-list">
      ${visible.map((record) => {
        const repository = githubMeta(record)
        return `<a class="direction-preview-card" href="${escapeHtml(record.productUrl || '#')}" ${record.productUrl ? 'target="_blank" rel="noreferrer"' : 'aria-disabled="true"'}>
          <span class="direction-preview-main"><strong>${escapeHtml(record.productName)}</strong><small>${escapeHtml(record.description || '暂无产品介绍')}</small></span>
          <span class="direction-preview-meta">${escapeHtml(record.developerName || '未知开发者')}${repository?.status === 'available' ? ` · ★ ${formatNumber(repository.stars)}` : ''}</span>
        </a>`
      }).join('')}
    </div>
    <button class="direction-view-all" type="button" data-view-all-direction="${escapeHtml(ui.primaryPreview)}">查看全部 ${formatNumber(records.length)} 个项目 →</button>`
}

function toolCategoryRecords(category) {
  return ui.tools.filter((tool) => (tool.category || '未分类') === category)
}

function ensureToolCategoryExplorer() {
  const chart = $('#tool-category-chart')
  const legacyPanel = chart?.closest('.chart-panel')
  if (!chart || !legacyPanel || $('#tool-category-explorer')) return
  legacyPanel.hidden = true
  const explorer = document.createElement('article')
  explorer.id = 'tool-category-explorer'
  explorer.className = 'chart-panel direction-explorer tool-direction-explorer'
  explorer.innerHTML = `
    <div class="panel-heading direction-heading">
      <div><h3>工具分类</h3><p>选择分类，直接查看对应工具；完整筛选放到工具目录</p></div>
    </div>
    <div class="direction-master-detail">
      <div class="direction-master" id="tool-direction-list"></div>
      <aside class="direction-detail" id="tool-direction-preview"></aside>
    </div>`
  legacyPanel.insertAdjacentElement('beforebegin', explorer)
  explorer.addEventListener('click', (event) => {
    const direction = event.target.closest('[data-tool-direction]')
    const viewAll = event.target.closest('[data-view-all-tool-category]')
    if (direction) {
      ui.toolPreviewCategory = direction.dataset.toolDirection
      renderToolCategoryExplorer()
    }
    if (viewAll) openToolDirectory({ category: viewAll.dataset.viewAllToolCategory })
  })
  renderToolCategoryExplorer()
}

function renderToolCategoryExplorer() {
  const list = $('#tool-direction-list')
  const preview = $('#tool-direction-preview')
  if (!list || !preview || !ui.tools.length) return
  const counts = new Map()
  for (const tool of ui.tools) counts.set(tool.category || '未分类', (counts.get(tool.category || '未分类') || 0) + 1)
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1])
  if (!groups.length) return
  if (!groups.some(([category]) => category === ui.toolPreviewCategory)) ui.toolPreviewCategory = groups[0][0]
  const max = Math.max(...groups.map(([, count]) => count), 1)
  list.innerHTML = groups.map(([category, count]) => `
    <button type="button" class="direction-row${category === ui.toolPreviewCategory ? ' is-active' : ''}" data-tool-direction="${escapeHtml(category)}" aria-pressed="${category === ui.toolPreviewCategory}">
      <span class="direction-row-label">${escapeHtml(category)}</span>
      <span class="direction-row-track"><span style="width:${count / max * 100}%"></span></span>
      <strong>${formatNumber(count)}</strong>
    </button>`).join('')

  const records = toolCategoryRecords(ui.toolPreviewCategory)
  const visible = records.slice(0, 6)
  preview.innerHTML = `
    <div class="direction-detail-head">
      <div><span>当前分类</span><h4>${escapeHtml(ui.toolPreviewCategory)}</h4></div>
      <strong>${formatNumber(records.length)} 个工具</strong>
    </div>
    <div class="direction-preview-list">
      ${visible.map((tool) => `<a class="direction-preview-card" href="${escapeHtml(tool.toolUrl || '#')}" ${tool.toolUrl ? 'target="_blank" rel="noreferrer"' : 'aria-disabled="true"'}>
        <span class="direction-preview-main"><strong>${escapeHtml(tool.toolName)}</strong><small>${escapeHtml(tool.description || '暂无工具介绍')}</small></span>
        <span class="direction-preview-meta">${escapeHtml(PRICING_LABELS[tool.pricing] || PRICING_LABELS.unknown)}</span>
      </a>`).join('')}
    </div>
    <button class="direction-view-all" type="button" data-view-all-tool-category="${escapeHtml(ui.toolPreviewCategory)}">查看全部 ${formatNumber(records.length)} 个工具 →</button>`
}

function translateLegacySemanticLabels() {
  const section = $('#semantic-map')
  if (!section) return
  const selectMaps = { 'taxonomy-audience': AUDIENCE_LABELS, 'taxonomy-form': FORM_LABELS, 'taxonomy-characteristic': CHARACTERISTIC_LABELS }
  for (const [id, map] of Object.entries(selectMaps)) {
    $$(`#${id} option`).forEach((option) => {
      if (option.value && map[option.value]) option.textContent = map[option.value]
    })
  }
  $$('.taxonomy-bar-row[data-taxonomy-filter]', section).forEach((row) => {
    const key = row.dataset.taxonomyFilter
    const value = row.dataset.taxonomyValue
    if (!value || !['audience', 'form', 'characteristic'].includes(key)) return
    const label = $('.taxonomy-bar-label', row)
    if (label) label.textContent = tagLabel(value)
  })
  $$('.taxonomy-capability strong, .taxonomy-tags span', section).forEach((node) => {
    node.textContent = tagLabel(node.textContent.trim())
  })
}

function makeOverviewChartsReadOnly() {
  const yearCopy = $('#year-chart')?.closest('.chart-panel')?.querySelector('.panel-heading p')
  if (yearCopy) yearCopy.textContent = '悬停查看不同年份的收录详情'
  const sourcePanel = $('#category-donut')?.closest('.chart-panel')
  const sourceTitle = sourcePanel?.querySelector('h3')
  const sourceCopy = sourcePanel?.querySelector('.panel-heading p')
  if (sourceTitle) sourceTitle.textContent = '来源类型'
  if (sourceCopy) sourceCopy.textContent = '上游清单的来源类别，仅用于来源结构参考'
}

function bindInteractionGuards() {
  const isLegacyOverviewFilter = (target) => target.closest('#product-dashboard [data-year], #product-dashboard [data-category], #product-dashboard [data-city], #product-dashboard [data-status], #semantic-map [data-taxonomy-filter], #semantic-map [data-status-category]')
  document.addEventListener('click', (event) => {
    if (!isLegacyOverviewFilter(event.target)) return
    event.stopImmediatePropagation()
    event.preventDefault()
  }, true)
  document.addEventListener('keydown', (event) => {
    if (!['Enter', ' '].includes(event.key) || !isLegacyOverviewFilter(event.target)) return
    event.stopImmediatePropagation()
    event.preventDefault()
  }, true)

  document.addEventListener('click', (event) => {
    const productRank = event.target.closest('#product-github-top [data-record-name]')
    const toolRank = event.target.closest('#tool-github-top [data-record-name]')
    if (!productRank && !toolRank) return
    event.stopImmediatePropagation()
    event.preventDefault()
    if (productRank) openProjectDirectory({ search: productRank.dataset.recordName })
    if (toolRank) openToolDirectory({ search: toolRank.dataset.recordName })
  }, true)
}

function bindGlobalControls() {
  document.addEventListener('click', (event) => {
    const back = event.target.closest('[data-back-overview]')
    if (back) setView(back.dataset.backOverview, 'overview', true)
  })
  window.addEventListener('hashchange', () => {
    if (['#methodology', '#top'].includes(location.hash)) return
    const route = routeFromHash()
    if (route) setView(route[0], route[1], false)
  })
}

async function loadData() {
  const [productsResponse, toolsResponse, taxonomyResponse, semanticResponse, githubResponse] = await Promise.all([
    fetch('data/products.json'), fetch('data/tools.json'), fetch('data/taxonomy.json'), fetch('data/product-taxonomy.json'), fetch('data/github-repositories.json')
  ])
  if (!productsResponse.ok || !toolsResponse.ok || !taxonomyResponse.ok || !semanticResponse.ok) throw new Error('交互数据加载失败')
  const [products, tools, taxonomy, semantic, github] = await Promise.all([
    productsResponse.json(), toolsResponse.json(), taxonomyResponse.json(), semanticResponse.json(), githubResponse.ok ? githubResponse.json() : Promise.resolve({})
  ])
  ui.products = products.records || []
  ui.tools = tools.records || []
  ui.taxonomy = taxonomy
  ui.semanticById = new Map((semantic.records || []).map((item) => [item.productId, item]))
  ui.github = github.repositories || {}
  ui.filteredProducts = ui.products
  buildProjectFilters()
  bindProjectFilters()
  applyProjectFilters()
  ensureProductDirectionExplorer()
  ensureToolCategoryExplorer()
}

function observeDynamicUi() {
  let scheduled = false
  const observer = new MutationObserver(() => {
    if (scheduled) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      installToolBackControl()
      ensureProductDirectionExplorer()
      ensureToolCategoryExplorer()
      translateLegacySemanticLabels()
      makeOverviewChartsReadOnly()
      syncHero()
      applySectionVisibility()
    })
  })
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })
}

async function init() {
  document.body.classList.add('dataset-tabs-active')
  installNavigation()
  installHeroActions()
  insertProjectList()
  installToolBackControl()
  bindInteractionGuards()
  bindGlobalControls()

  const route = routeFromHash()
  if (route) [ui.dataset, ui.mode] = route
  syncNavigation()
  syncHero()
  applySectionVisibility()

  try {
    await loadData()
  } catch (error) {
    console.error(error)
    const grid = $('#project-v2-grid')
    if (grid) grid.innerHTML = `<div class="project-list-empty"><strong>项目目录加载失败</strong><p>${escapeHtml(error.message)}</p></div>`
  }

  ensureProductDirectionExplorer()
  ensureToolCategoryExplorer()
  translateLegacySemanticLabels()
  makeOverviewChartsReadOnly()
  observeDynamicUi()
  applySectionVisibility()

  if (ui.mode === 'directory') {
    requestAnimationFrame(() => activeSection()?.scrollIntoView({ behavior: 'auto', block: 'start' }))
  }
}

init()
