const formatNumber = (value) => new Intl.NumberFormat('zh-CN').format(Number(value) || 0)
const escapeHtml = (value = '') => String(value).replace(/[&<>'\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '\"': '&quot;' })[char])
const countValues = (records, getter) => {
  const counts = new Map()
  for (const record of records) {
    const values = getter(record)
    for (const value of Array.isArray(values) ? values : [values]) if (value) counts.set(value, (counts.get(value) || 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

const state = { all: [], filtered: [], taxonomy: {}, pageSize: 24, visibleCount: 24, filters: { primary: '', sub: '', audience: '', form: '', characteristic: '' } }
const byId = (id) => document.getElementById(id)

function labelFor(id) {
  return state.taxonomy.primaryCategories?.find((item) => item.id === id)?.label || id
}

function ensureStylesheet() {
  if (document.querySelector('link[data-taxonomy-insights]')) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'src/taxonomy-insights.css'
  link.dataset.taxonomyInsights = 'true'
  document.head.append(link)
}

function insertNavigation() {
  const links = document.querySelector('.top-links')
  if (!links || links.querySelector('a[href="#semantic-map"]')) return
  const anchor = document.createElement('a')
  anchor.href = '#semantic-map'
  anchor.textContent = '语义地图'
  links.prepend(anchor)
}

function semanticMarkup() {
  return `
  <section class="wrap taxonomy-section" id="semantic-map" aria-labelledby="taxonomy-title">
    <div class="section-heading taxonomy-heading">
      <div><p class="eyebrow">PRODUCT SEMANTIC MAP</p><h2 id="taxonomy-title">产品语义地图</h2></div>
      <p>不再按来源文件粗分产品，而是从产品名称与描述推断“做什么、给谁用、以什么形态提供”。该层属于分析推断，不改写原始来源事实。</p>
    </div>
    <div class="taxonomy-kpis">
      <article><span>语义覆盖</span><strong id="taxonomy-coverage">—</strong><small>排除“其他”后的覆盖率</small></article>
      <article><span>主分类</span><strong id="taxonomy-category-count">—</strong><small>taxonomy v1</small></article>
      <article><span>平均置信度</span><strong id="taxonomy-confidence">—</strong><small>规则分类置信度</small></article>
      <article><span>待继续细分</span><strong id="taxonomy-other">—</strong><small>当前归入“其他”</small></article>
    </div>
    <div class="taxonomy-filter-panel" aria-label="产品语义筛选">
      <label><span>主分类</span><select id="taxonomy-primary"><option value="">全部主分类</option></select></label>
      <label><span>子方向</span><select id="taxonomy-sub"><option value="">全部子方向</option></select></label>
      <label><span>用户群体</span><select id="taxonomy-audience"><option value="">全部用户群体</option></select></label>
      <label><span>产品形态</span><select id="taxonomy-form"><option value="">全部产品形态</option></select></label>
      <label><span>产品特征</span><select id="taxonomy-characteristic"><option value="">全部产品特征</option></select></label>
      <button type="button" class="reset-button" id="taxonomy-reset">清空语义筛选</button>
    </div>
    <div class="taxonomy-active-filters" id="taxonomy-active-filters"></div>
    <div class="taxonomy-grid">
      <article class="chart-panel taxonomy-panel wide"><div class="panel-heading"><div><h3>产品方向分布</h3><p>按 Primary Category 统计；点击条形图可筛选</p></div></div><div class="taxonomy-bars" id="taxonomy-primary-chart"></div></article>
      <article class="chart-panel taxonomy-panel"><div class="panel-heading"><div><h3>子方向 Top 12</h3><p>从当前筛选结果计算</p></div></div><div class="taxonomy-bars compact" id="taxonomy-sub-chart"></div></article>
      <article class="chart-panel taxonomy-panel"><div class="panel-heading"><div><h3>产品形态</h3><p>SaaS、桌面、移动端、插件、自托管等</p></div></div><div class="taxonomy-bars compact" id="taxonomy-form-chart"></div></article>
      <article class="chart-panel taxonomy-panel"><div class="panel-heading"><div><h3>用户群体</h3><p>开发者、创作者、团队、消费者等</p></div></div><div class="taxonomy-bars compact" id="taxonomy-audience-chart"></div></article>
      <article class="chart-panel taxonomy-panel wide"><div class="panel-heading"><div><h3>能力标签 Top 20</h3><p>描述产品具体能力，而不是重复主分类</p></div></div><div class="taxonomy-tag-cloud" id="taxonomy-capability-cloud"></div></article>
    </div>
    <div class="taxonomy-results-heading"><div><h3>匹配产品</h3><p id="taxonomy-result-summary">—</p></div><span id="taxonomy-generated-at"></span></div>
    <div class="taxonomy-product-grid" id="taxonomy-product-grid"></div>
    <div class="load-more-wrap"><button class="button secondary" type="button" id="taxonomy-load-more">加载更多语义结果</button></div>
  </section>`
}

function insertSection() {
  if (byId('semantic-map')) return
  const dashboard = byId('product-dashboard')
  if (!dashboard) return
  dashboard.insertAdjacentHTML('beforebegin', semanticMarkup())
}

function fillSelect(id, values, labeler = (value) => value) {
  const select = byId(id)
  if (!select) return
  for (const value of values) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = labeler(value)
    select.append(option)
  }
}

function buildFilters() {
  fillSelect('taxonomy-primary', (state.taxonomy.primaryCategories || []).map((item) => item.id).filter((id) => id !== 'other'), labelFor)
  const subValues = [...new Set(Object.values(state.taxonomy.subCategories || {}).flat())].filter((value) => value !== '其他').sort((a, b) => a.localeCompare(b, 'zh-CN'))
  fillSelect('taxonomy-sub', subValues)
  fillSelect('taxonomy-audience', state.taxonomy.tags?.audience || [])
  fillSelect('taxonomy-form', state.taxonomy.tags?.productForm || [])
  fillSelect('taxonomy-characteristic', state.taxonomy.tags?.characteristics || [])
}

function filterRecord(record) {
  const f = state.filters
  return (!f.primary || record.semantic.primaryCategory === f.primary)
    && (!f.sub || record.semantic.subCategories.includes(f.sub))
    && (!f.audience || record.semantic.tags.audience.includes(f.audience))
    && (!f.form || record.semantic.tags.productForm.includes(f.form))
    && (!f.characteristic || record.semantic.tags.characteristics.includes(f.characteristic))
}

function setFilter(key, value) {
  state.filters[key] = state.filters[key] === value ? '' : value
  const ids = { primary: 'taxonomy-primary', sub: 'taxonomy-sub', audience: 'taxonomy-audience', form: 'taxonomy-form', characteristic: 'taxonomy-characteristic' }
  if (ids[key] && byId(ids[key])) byId(ids[key]).value = state.filters[key]
  applyFilters()
}

function renderBars(id, entries, total, filterKey, labeler = (value) => value, limit = 15) {
  const target = byId(id)
  const rows = entries.slice(0, limit)
  const max = Math.max(...rows.map(([, count]) => count), 1)
  target.innerHTML = rows.length ? rows.map(([value, count]) => `<button class="taxonomy-bar-row${filterKey && state.filters[filterKey] === value ? ' is-active' : ''}" type="button" ${filterKey ? `data-taxonomy-filter="${filterKey}" data-taxonomy-value="${escapeHtml(value)}"` : ''}><span class="taxonomy-bar-label">${escapeHtml(labeler(value))}</span><span class="taxonomy-bar-track"><span class="taxonomy-bar-fill" style="width:${count / max * 100}%"></span></span><strong>${formatNumber(count)} <small>${total ? Math.round(count / total * 100) : 0}%</small></strong></button>`).join('') : '<p class="empty-state">当前筛选没有数据</p>'
  if (filterKey) for (const button of target.querySelectorAll('[data-taxonomy-filter]')) button.addEventListener('click', () => setFilter(button.dataset.taxonomyFilter, button.dataset.taxonomyValue))
}

function renderCharts() {
  renderBars('taxonomy-primary-chart', countValues(state.filtered, (item) => item.semantic.primaryCategory), state.filtered.length, 'primary', labelFor, 15)
  renderBars('taxonomy-sub-chart', countValues(state.filtered, (item) => item.semantic.subCategories), state.filtered.length, 'sub', (value) => value, 12)
  renderBars('taxonomy-form-chart', countValues(state.filtered, (item) => item.semantic.tags.productForm), state.filtered.length, 'form', (value) => value, 10)
  renderBars('taxonomy-audience-chart', countValues(state.filtered, (item) => item.semantic.tags.audience), state.filtered.length, 'audience', (value) => value, 10)
  const capabilities = countValues(state.filtered, (item) => item.semantic.tags.capabilities).slice(0, 20)
  byId('taxonomy-capability-cloud').innerHTML = capabilities.map(([tag, count]) => `<span class="taxonomy-capability"><strong>${escapeHtml(tag)}</strong><small>${formatNumber(count)}</small></span>`).join('') || '<p class="empty-state">当前筛选没有能力标签</p>'
}

function renderActiveFilters() {
  const labels = { primary: '主分类', sub: '子方向', audience: '用户', form: '形态', characteristic: '特征' }
  byId('taxonomy-active-filters').innerHTML = Object.entries(state.filters).filter(([, value]) => value).map(([key, value]) => `<button type="button" data-clear-taxonomy="${key}">${labels[key]}：${escapeHtml(key === 'primary' ? labelFor(value) : value)} ×</button>`).join('')
  for (const button of byId('taxonomy-active-filters').querySelectorAll('[data-clear-taxonomy]')) button.addEventListener('click', () => setFilter(button.dataset.clearTaxonomy, state.filters[button.dataset.clearTaxonomy]))
}

function renderProducts() {
  const visible = state.filtered.slice(0, state.visibleCount)
  byId('taxonomy-result-summary').textContent = `找到 ${formatNumber(state.filtered.length)} 条，当前显示 ${formatNumber(visible.length)} 条`
  byId('taxonomy-load-more').hidden = visible.length >= state.filtered.length
  byId('taxonomy-product-grid').innerHTML = visible.map((record) => {
    const semantic = record.semantic
    const tags = [
      ...semantic.subCategories.slice(0, 2),
      ...semantic.tags.productForm.slice(0, 1),
      ...semantic.tags.characteristics.slice(0, 1),
      ...semantic.tags.capabilities.slice(0, 3)
    ]
    return `<article class="taxonomy-product-card">
      <div class="taxonomy-product-top"><span class="taxonomy-category-pill">${escapeHtml(labelFor(semantic.primaryCategory))}</span><span class="taxonomy-confidence${semantic.confidence < .65 ? ' low' : ''}">${Math.round(semantic.confidence * 100)}%</span></div>
      <h4><a href="${escapeHtml(record.productUrl || '#')}" ${record.productUrl ? 'target="_blank" rel="noreferrer"' : ''}>${escapeHtml(record.productName)}</a></h4>
      <p>${escapeHtml(record.description || '暂无产品介绍')}</p>
      <div class="taxonomy-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
      <div class="taxonomy-product-meta"><span>${escapeHtml(record.developerName || '未知开发者')}</span><span>${record.year || '日期未知'}</span>${semantic.confidence < .65 ? '<strong>待复核</strong>' : ''}</div>
    </article>`
  }).join('') || '<div class="empty-state"><strong>没有匹配的语义产品</strong><p>减少筛选条件后重试。</p></div>'
}

function applyFilters() {
  state.filtered = state.all.filter(filterRecord)
  state.visibleCount = state.pageSize
  renderActiveFilters()
  renderCharts()
  renderProducts()
}

function bindEvents() {
  const bindings = { 'taxonomy-primary': 'primary', 'taxonomy-sub': 'sub', 'taxonomy-audience': 'audience', 'taxonomy-form': 'form', 'taxonomy-characteristic': 'characteristic' }
  for (const [id, key] of Object.entries(bindings)) byId(id).addEventListener('change', (event) => { state.filters[key] = event.target.value; applyFilters() })
  byId('taxonomy-reset').addEventListener('click', () => {
    for (const key of Object.keys(state.filters)) state.filters[key] = ''
    for (const id of Object.keys(bindings)) byId(id).value = ''
    applyFilters()
  })
  byId('taxonomy-load-more').addEventListener('click', () => { state.visibleCount += state.pageSize; renderProducts() })
}

async function initTaxonomy() {
  ensureStylesheet()
  insertNavigation()
  insertSection()
  const [productsResponse, taxonomyResponse, classificationsResponse] = await Promise.all([
    fetch('data/products.json'), fetch('data/taxonomy.json'), fetch('data/product-taxonomy.json')
  ])
  if (!productsResponse.ok || !taxonomyResponse.ok || !classificationsResponse.ok) throw new Error('taxonomy datasets unavailable')
  const [products, taxonomy, classifications] = await Promise.all([productsResponse.json(), taxonomyResponse.json(), classificationsResponse.json()])
  state.taxonomy = taxonomy
  const semanticById = new Map((classifications.records || []).map((item) => [item.productId, item]))
  state.all = (products.records || []).map((record) => ({ ...record, semantic: semanticById.get(record.id) })).filter((record) => record.semantic)
  state.filtered = state.all
  byId('taxonomy-coverage').textContent = `${Math.round((classifications.metadata?.coverage || 0) * 100)}%`
  byId('taxonomy-category-count').textContent = formatNumber((taxonomy.primaryCategories || []).filter((item) => item.id !== 'other').length)
  byId('taxonomy-confidence').textContent = `${Math.round((classifications.metadata?.averageConfidence || 0) * 100)}%`
  byId('taxonomy-other').textContent = formatNumber(classifications.metadata?.otherProducts || 0)
  byId('taxonomy-generated-at').textContent = `taxonomy v${taxonomy.version} · ${classifications.metadata?.generatedAt ? new Date(classifications.metadata.generatedAt).toLocaleString('zh-CN') : '未记录生成时间'}`
  buildFilters()
  bindEvents()
  applyFilters()
}

initTaxonomy().catch((error) => {
  console.error(error)
  const section = byId('semantic-map')
  if (section) section.innerHTML = '<div class="taxonomy-error"><strong>产品语义数据暂不可用</strong><p>请先运行 npm run sync:taxonomy。</p></div>'
})
