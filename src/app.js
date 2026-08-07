const CATEGORY_LABELS = { product: '通用产品', 'developer-tool': '程序员工具', game: '游戏', archive: '历史归档' }
const CATEGORY_COLORS = { product: '#b9f24a', 'developer-tool': '#59dcc4', game: '#ffb35c', archive: '#82978f' }
const STATUS_LABELS = { active: '已上线', developing: '开发中', closed: '已关闭', acquired: '已收购', unknown: '状态未知' }
const PRICING_LABELS = { free: '免费', paid: '付费', 'open-source': '开源', unknown: '价格未知' }
const PRODUCT_PAGE_SIZE = 18
const TOOL_PAGE_SIZE = 24

const productState = { all: [], filtered: [], visibleCount: PRODUCT_PAGE_SIZE, metadata: {}, query: '', category: '', status: '', year: '', city: '' }
const toolState = { all: [], filtered: [], visibleCount: TOOL_PAGE_SIZE, metadata: {}, query: '', category: '' }
const el = (id) => document.getElementById(id)
const formatNumber = (value) => new Intl.NumberFormat('zh-CN').format(value)
const uniqueSorted = (values, compare = (a, b) => String(a).localeCompare(String(b), 'zh-CN')) => [...new Set(values.filter(Boolean))].sort(compare)
const countBy = (records, key) => records.reduce((map, item) => map.set(item[key] || '未知', (map.get(item[key] || '未知') || 0) + 1), new Map())
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char])

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

function updateHeadlineMetrics(products, tools) {
  const developers = new Set(products.map((item) => item.developerName)).size
  const cities = new Set(products.map((item) => item.city).filter(Boolean)).size
  const active = products.filter((item) => ['active', 'developing'].includes(item.status)).length
  const values = {
    'hero-total': products.length,
    'metric-products': products.length,
    'metric-developers': developers,
    'metric-cities': cities,
    'metric-active': active,
    'metric-tools': tools.length
  }
  for (const [id, value] of Object.entries(values)) el(id).textContent = formatNumber(value)
}

function renderYearChart(records) {
  const counts = [...countBy(records.filter((item) => item.year), 'year').entries()].sort((a, b) => Number(a[0]) - Number(b[0]))
  el('trend-total').textContent = `${formatNumber(records.length)} 条`
  if (!counts.length) {
    el('year-chart').innerHTML = '<p class="empty-state">暂无年份数据</p>'
    return
  }
  const width = 980
  const height = 270
  const padding = { top: 24, right: 18, bottom: 36, left: 42 }
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom
  const max = Math.max(...counts.map(([, count]) => count), 1)
  const gap = Math.max(7, innerWidth / counts.length * 0.18)
  const barWidth = Math.max(10, innerWidth / counts.length - gap)
  const tickCount = 4
  const grid = Array.from({ length: tickCount + 1 }, (_, index) => {
    const value = Math.round(max * (tickCount - index) / tickCount)
    const y = padding.top + innerHeight * index / tickCount
    return `<line class="chart-grid-line" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}"/><text class="chart-axis-label" x="${padding.left - 8}" y="${y + 4}" text-anchor="end">${value}</text>`
  }).join('')
  const bars = counts.map(([year, count], index) => {
    const x = padding.left + index * (innerWidth / counts.length) + gap / 2
    const barHeight = innerHeight * count / max
    const y = padding.top + innerHeight - barHeight
    return `<g><rect class="chart-bar" x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="5"><title>${year}: ${count} 条</title></rect><text class="chart-value" x="${x + barWidth / 2}" y="${Math.max(13, y - 7)}" text-anchor="middle">${count}</text><text class="chart-axis-label" x="${x + barWidth / 2}" y="${height - 11}" text-anchor="middle">${year}</text></g>`
  }).join('')
  el('year-chart').innerHTML = `<svg class="year-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="按年份统计产品收录数量">${grid}${bars}</svg>`
}

function renderCategoryChart(records) {
  const counts = [...countBy(records, 'category').entries()].sort((a, b) => b[1] - a[1])
  if (!counts.length) {
    el('category-donut').style.background = 'rgba(255,255,255,.04)'
    el('donut-total').textContent = '0'
    el('category-legend').innerHTML = ''
    return
  }
  const total = records.length
  let cursor = 0
  const stops = counts.map(([category, count]) => {
    const start = cursor
    cursor += count / total * 100
    return `${CATEGORY_COLORS[category] || '#7e918a'} ${start}% ${cursor}%`
  })
  el('category-donut').style.background = `conic-gradient(${stops.join(',')})`
  el('donut-total').textContent = formatNumber(records.length)
  el('category-legend').innerHTML = counts.map(([category, count]) => `<div class="legend-item"><span class="legend-dot" style="background:${CATEGORY_COLORS[category] || '#7e918a'}"></span><span>${escapeHtml(CATEGORY_LABELS[category] || category)}</span><strong>${count}</strong></div>`).join('')
}

function renderCityChart(records) {
  const counts = [...countBy(records.filter((item) => item.city), 'city').entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  const max = Math.max(...counts.map(([, count]) => count), 1)
  el('city-chart').innerHTML = counts.length
    ? counts.map(([city, count]) => `<div class="bar-row"><span>${escapeHtml(city)}</span><div class="bar-track"><div class="bar-fill" style="width:${count / max * 100}%"></div></div><strong>${count}</strong></div>`).join('')
    : '<p class="empty-state">当前筛选没有城市数据</p>'
}

function renderStatusChart(records) {
  const counts = countBy(records, 'status')
  el('status-chart').innerHTML = ['active', 'developing', 'closed', 'acquired', 'unknown']
    .filter((status) => counts.has(status))
    .map((status) => `<div class="status-item"><span>${STATUS_LABELS[status]}</span><strong>${formatNumber(counts.get(status))}</strong></div>`).join('')
}

function renderDashboard(records) {
  renderYearChart(records)
  renderCategoryChart(records)
  renderCityChart(records)
  renderStatusChart(records)
}

function productMatches(record) {
  const sourceText = (record.sources || []).map((source) => `${source.repository} ${source.sourceFile}`).join(' ')
  const haystack = [record.productName, record.description, record.developerName, record.city, record.sourceCategory, sourceText].filter(Boolean).join(' ').toLowerCase()
  return (!productState.query || haystack.includes(productState.query.toLowerCase()))
    && (!productState.category || record.category === productState.category)
    && (!productState.status || record.status === productState.status)
    && (!productState.year || String(record.year) === productState.year)
    && (!productState.city || record.city === productState.city)
}

function toolMatches(record) {
  const sourceText = (record.sources || []).map((source) => `${source.repository} ${source.sourceFile}`).join(' ')
  const haystack = [record.toolName, record.description, record.category, sourceText].filter(Boolean).join(' ').toLowerCase()
  return (!toolState.query || haystack.includes(toolState.query.toLowerCase()))
    && (!toolState.category || record.category === toolState.category)
}

function sourceDetailsHtml(record) {
  const sources = record.sources || []
  if (!sources.length) return '<span class="source-empty">来源未记录</span>'
  const items = sources.map((source) => {
    const label = `${source.repository} · ${source.sourceFile}:${source.sourceLine}`
    return source.sourceUrl
      ? `<li><a href="${escapeHtml(source.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(label)} ↗</a></li>`
      : `<li>${escapeHtml(label)}</li>`
  }).join('')
  return `<details class="source-details"><summary>来源 ${sources.length} 处</summary><ul>${items}</ul></details>`
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

function createProductCard(record) {
  const fragment = el('product-template').content.cloneNode(true)
  fragment.querySelector('.category-badge').textContent = CATEGORY_LABELS[record.category] || record.category
  const status = fragment.querySelector('.status-badge')
  status.textContent = STATUS_LABELS[record.status] || record.status
  status.classList.add(record.status)
  fragment.querySelector('.product-name').textContent = record.productName
  fragment.querySelector('.product-description').textContent = record.description || '暂无产品介绍'
  fragment.querySelector('.product-meta').innerHTML = [record.developerName, record.city, record.year, record.sourceCategory].filter(Boolean).map((value) => `<span class="meta-pill">${escapeHtml(value)}</span>`).join('')
  fragment.querySelector('.record-sources').innerHTML = sourceDetailsHtml(record)
  fragment.querySelector('.source-date').textContent = record.date || '日期未知'
  const link = fragment.querySelector('.visit-link')
  if (record.productUrl) link.href = record.productUrl
  else {
    link.textContent = '链接不可用'
    link.setAttribute('aria-disabled', 'true')
  }
  return fragment
}

function createToolCard(record) {
  const fragment = el('tool-template').content.cloneNode(true)
  fragment.querySelector('.tool-category').textContent = record.category
  fragment.querySelector('.tool-pricing').textContent = PRICING_LABELS[record.pricing] || PRICING_LABELS.unknown
  fragment.querySelector('.tool-name').textContent = record.toolName
  fragment.querySelector('.tool-description').textContent = record.description || '暂无工具介绍'
  fragment.querySelector('.record-sources').innerHTML = sourceDetailsHtml(record)
  const link = fragment.querySelector('.visit-link')
  link.href = record.toolUrl
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

  el('download-products').addEventListener('click', () => downloadJson('indiebase-cn-products.json', { metadata: productState.metadata, records: productState.all }))
  el('download-tools').addEventListener('click', () => downloadJson('indiebase-cn-tools.json', { metadata: toolState.metadata, records: toolState.all }))
}

async function init() {
  try {
    const [productsResponse, toolsResponse] = await Promise.all([
      fetch('data/products.json'),
      fetch('data/tools.json')
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

    buildProductFilters()
    buildToolFilters()
    bindEvents()
    updateHeadlineMetrics(productState.all, toolState.all)
    renderDashboard(productState.all)
    renderProducts()
    renderTools()

    const mode = productState.metadata.snapshotMode === 'full-upstream' ? '完整上游快照' : '示例快照'
    el('snapshot-note').textContent = `${mode} · ${formatNumber(productState.all.length)} 条产品 · ${formatNumber(toolState.all.length)} 个工具 · 每条记录保留来源`
    el('generated-at').textContent = `数据生成时间：${new Date(productState.metadata.generatedAt).toLocaleString('zh-CN')}`
  } catch (error) {
    console.error(error)
    el('result-summary').textContent = '数据加载失败'
    el('tool-result-summary').textContent = '数据加载失败'
    el('snapshot-note').textContent = '无法读取数据文件，请先运行 npm run sync:data。'
    el('product-grid').innerHTML = `<div class="empty-state"><strong>数据加载失败</strong><p>${escapeHtml(error.message)}</p></div>`
  }
}

init()
