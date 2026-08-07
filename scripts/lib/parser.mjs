import { createHash } from 'node:crypto'

const LOCATION_ALIASES = new Map([
  ['北京市', '北京'], ['上海市', '上海'], ['深圳市', '深圳'], ['杭州市', '杭州'],
  ['成都市', '成都'], ['武汉市', '武汉'], ['南京市', '南京'], ['广州市', '广州'],
  ['佛山市', '佛山'], ['沈阳市', '沈阳'], ['济南市', '济南'], ['重庆市', '重庆'],
  ['乌鲁木齐市', '乌鲁木齐'], ['长沙市', '长沙'], ['Wuhan', '武汉']
])

const KNOWN_LOCATIONS = new Set([
  '北京', '上海', '深圳', '杭州', '成都', '武汉', '南京', '广州', '重庆', '长沙',
  '济南', '沈阳', '佛山', '佛山市', '乌鲁木齐', '厦门', '福州', '温州', '大连',
  '昆明', '苏州', '徐州', '泉州', '吉林', '云南', '浙江', '大理', '台州', '合肥',
  '天津', '青岛', '西安', '郑州', '宁波', '无锡', '香港', '澳门', '台湾', '海外',
  'Wuhan'
])

const STATUS_PRIORITY = new Map([
  ['active', 5], ['developing', 4], ['acquired', 3], ['closed', 2], ['unknown', 1]
])

function normalizeSpaces(value = '') {
  return value.replace(/\s+/g, ' ').trim()
}

function stripMarkdown(value = '') {
  return normalizeSpaces(value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/[`*_~]/g, ''))
}

function normalizeUrl(value) {
  if (!value) return null
  const trimmed = value.trim().replace(/^<|>$/g, '')
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return null
}

export function canonicalizeUrl(value) {
  const normalized = normalizeUrl(value)
  if (!normalized) return null
  try {
    const url = new URL(normalized)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    const removable = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'source']
    for (const key of removable) url.searchParams.delete(key)
    url.hash = ''
    let pathname = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/'
    if (host === 'github.com') pathname = pathname.toLowerCase()
    const params = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b))
    const search = params.length ? `?${new URLSearchParams(params).toString()}` : ''
    return `${host}${pathname}${search}`
  } catch {
    return normalized.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '')
  }
}

function parseDate(line) {
  const match = line.match(/^###\s+(\d{4})\s*年\s*(\d{1,2})\s*月(?:\s*(\d{1,2})\s*(?:日|号))?\s*添加?/)
  if (!match) return null
  const [, year, month, day = '1'] = match
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return { iso, year: Number(year), month: Number(month), day: Number(day) }
}

function extractLinks(value) {
  return [...value.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].map(([, label, url]) => ({
    label: stripMarkdown(label),
    url: normalizeUrl(url)
  })).filter((item) => item.url)
}

function splitDeveloperAndMeta(heading) {
  const links = extractLinks(heading)
  const firstLinkIndex = heading.search(/\[[^\]]+\]\([^)]+\)/)
  let identity = firstLinkIndex >= 0 ? heading.slice(0, firstLinkIndex) : heading
  identity = identity.replace(/\s*[-—–,，]+\s*$/, '').trim()

  let developerName = stripMarkdown(identity)
  let city = null
  const locationMatch = developerName.match(/\s*[（(]\s*([^()（）]{1,12})\s*[)）]\s*$/)
  if (locationMatch) {
    const candidate = normalizeSpaces(locationMatch[1])
    if (KNOWN_LOCATIONS.has(candidate) || LOCATION_ALIASES.has(candidate) || /^[\u4e00-\u9fff]{2,8}$/.test(candidate)) {
      city = LOCATION_ALIASES.get(candidate) || candidate.replace(/市$/, '')
      developerName = developerName.slice(0, locationMatch.index).trim()
    }
  }

  const linkFor = (...labels) => links.find((item) => labels.some((label) => item.label.toLowerCase().includes(label)))?.url || null
  return {
    developerName: developerName || '未知开发者',
    city,
    developerUrl: linkFor('个人', '主页', '官网', '网站'),
    githubUrl: linkFor('github'),
    blogUrl: linkFor('博客', 'blog'),
    profileLinks: links
  }
}

function parseStatus(line) {
  if (line.includes(':white_check_mark:')) return 'active'
  if (line.includes(':clock8:')) return 'developing'
  if (line.includes(':x:')) return 'closed'
  if (/已收购|被收购/.test(line)) return 'acquired'
  return 'unknown'
}

function buildSource(options, sourceSection, sourceLine, rawText) {
  const repository = options.repository || 'unknown'
  const repositoryUrl = options.repositoryUrl || (repository !== 'unknown' ? `https://github.com/${repository}` : null)
  const sourceFile = options.sourceFile || 'README.md'
  const ref = options.ref || 'main'
  return {
    repository,
    repositoryUrl,
    sourceFile,
    sourceSection: sourceSection || '',
    sourceLine,
    sourceUrl: repositoryUrl ? `${repositoryUrl}/blob/${ref}/${sourceFile}#L${sourceLine}` : null,
    rawText
  }
}

function sourceIdentity(source) {
  return [source.repository, source.sourceFile, source.sourceLine].join('|')
}

function recordIdentity(record, dataset) {
  const url = canonicalizeUrl(record.productUrl || record.toolUrl)
  if (url) return `${dataset}|url|${url}`
  const name = normalizeSpaces(record.productName || record.toolName).toLowerCase()
  const developer = normalizeSpaces(record.developerName || '').toLowerCase()
  return `${dataset}|name|${name}|${developer}`
}

function createId(record, dataset) {
  return createHash('sha1').update(recordIdentity(record, dataset)).digest('hex').slice(0, 14)
}

function attachSourceFields(record) {
  const source = record.sources[0]
  return {
    ...record,
    sourceRepository: source.repository,
    sourceFile: source.sourceFile,
    sourceSection: source.sourceSection,
    sourceLine: source.sourceLine,
    rawText: source.rawText,
    sourceRepositories: [...new Set(record.sources.map((item) => item.repository))],
    sourceCount: record.sources.length
  }
}

export function parseMarkdown(text, options = {}) {
  const sourceFile = options.sourceFile || 'README.md'
  const category = options.category || 'product'
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const records = []
  const warnings = []
  let currentDate = null
  let currentDeveloper = null
  let currentSection = ''

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index]
    const line = rawLine.trim()
    if (!line) continue

    const parsedDate = parseDate(line)
    if (parsedDate) {
      currentDate = parsedDate
      currentSection = stripMarkdown(line.replace(/^###\s*/, ''))
      currentDeveloper = null
      continue
    }

    const developerMatch = line.match(/^####\s+(.+)/)
    if (developerMatch) {
      currentDeveloper = splitDeveloperAndMeta(developerMatch[1])
      continue
    }

    const productMatch = line.match(/^[-*]\s+(?:(:[a-z0-9_+-]+:)\s*)?\[([^\]]+)\]\(([^)]+)\)\s*[：:]\s*(.+)$/i)
    if (!productMatch) continue

    if (!currentDeveloper) {
      warnings.push({ code: 'missing-developer', repository: options.repository, sourceFile, sourceLine: index + 1, rawText: rawLine })
      currentDeveloper = { developerName: '未知开发者', city: null, developerUrl: null, githubUrl: null, blogUrl: null, profileLinks: [] }
    }

    const [, , productNameRaw, productUrlRaw, descriptionRaw] = productMatch
    const productName = stripMarkdown(productNameRaw)
    const productUrl = normalizeUrl(productUrlRaw)
    const description = stripMarkdown(descriptionRaw.replace(/\s*[-—–]\s*\[(更多介绍|源码|查看仓库|下载|Release)[^\]]*\]\([^)]+\)\s*$/i, ''))
    const source = buildSource(options, currentSection, index + 1, rawLine)
    const record = attachSourceFields({
      id: '', recordType: 'product', date: currentDate?.iso || null,
      year: currentDate?.year || null, month: currentDate?.month || null, day: currentDate?.day || null,
      city: currentDeveloper.city, developerName: currentDeveloper.developerName,
      developerUrl: currentDeveloper.developerUrl, githubUrl: currentDeveloper.githubUrl,
      blogUrl: currentDeveloper.blogUrl, profileLinks: currentDeveloper.profileLinks,
      productName, productUrl, status: parseStatus(line), category, sourceCategory: null,
      description, sources: [source]
    })
    record.id = createId(record, 'products')
    records.push(record)
  }

  return { records, warnings }
}

export function parseProjectTable(text, options = {}) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const records = []
  const warnings = []
  let currentSection = ''

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index]
    const line = rawLine.trim()
    const heading = line.match(/^#{2,3}\s+(.+)/)
    if (heading) currentSection = stripMarkdown(heading[1])
    if (!line.startsWith('|') || !line.endsWith('|')) continue

    const cells = line.slice(1, -1).split('|').map((cell) => cell.trim())
    if (cells.length < 5 || cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue
    if (/类别|开发者/.test(cells[0]) && /项目名称/.test(cells[2])) continue

    const [sourceCategoryRaw, developerRaw, productNameRaw, linkCell, ...descriptionCells] = cells
    const link = extractLinks(linkCell)[0]
    const productName = stripMarkdown(productNameRaw)
    const developerName = stripMarkdown(developerRaw) || '未知开发者'
    if (!productName || !link?.url) {
      warnings.push({ code: 'invalid-project-table-row', repository: options.repository, sourceFile: options.sourceFile, sourceLine: index + 1, rawText: rawLine })
      continue
    }

    const source = buildSource(options, currentSection, index + 1, rawLine)
    const record = attachSourceFields({
      id: '', recordType: 'product', date: null, year: null, month: null, day: null,
      city: null, developerName, developerUrl: null, githubUrl: null, blogUrl: null, profileLinks: [],
      productName, productUrl: link.url, status: 'unknown', category: 'product',
      sourceCategory: stripMarkdown(sourceCategoryRaw) || null,
      description: stripMarkdown(descriptionCells.join(' | ')), sources: [source]
    })
    record.id = createId(record, 'products')
    records.push(record)
  }

  return { records, warnings }
}

function detectPricing(description) {
  if (/开源/i.test(description)) return 'open-source'
  if (/免费/i.test(description)) return 'free'
  if (/付费|收费/i.test(description)) return 'paid'
  return 'unknown'
}

export function parseToolDirectory(text, options = {}) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const records = []
  const warnings = []
  let currentSection = ''
  let inToolList = false

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index]
    const line = rawLine.trim()
    if (/^##\s+工具列表/.test(line)) {
      inToolList = true
      continue
    }
    if (!inToolList) continue

    const heading = line.match(/^###\s+(.+)/)
    if (heading) {
      currentSection = stripMarkdown(heading[1])
      continue
    }

    const item = line.match(/^[-*]\s+\[([^\]]+)\]\(([^)]+)\)(?:\s*[-—–:：]\s*(.*))?$/)
    if (!item) continue
    const [, toolNameRaw, toolUrlRaw, descriptionRaw = ''] = item
    const toolName = stripMarkdown(toolNameRaw)
    const toolUrl = normalizeUrl(toolUrlRaw)
    if (!toolName || !toolUrl || !currentSection) {
      warnings.push({ code: 'invalid-tool-row', repository: options.repository, sourceFile: options.sourceFile, sourceLine: index + 1, rawText: rawLine })
      continue
    }

    const description = stripMarkdown(descriptionRaw)
    const source = buildSource(options, currentSection, index + 1, rawLine)
    const record = attachSourceFields({
      id: '', recordType: 'tool', toolName, toolUrl, category: currentSection,
      pricing: detectPricing(description), description, sources: [source]
    })
    record.id = createId(record, 'tools')
    records.push(record)
  }

  return { records, warnings }
}

function mergeSources(left = [], right = []) {
  const merged = new Map()
  for (const source of [...left, ...right]) merged.set(sourceIdentity(source), source)
  return [...merged.values()]
}

function mergeDuplicate(existing, duplicate, dataset) {
  const sources = mergeSources(existing.sources, duplicate.sources)
  if (dataset === 'tools') {
    return attachSourceFields({
      ...existing,
      description: existing.description.length >= duplicate.description.length ? existing.description : duplicate.description,
      pricing: existing.pricing !== 'unknown' ? existing.pricing : duplicate.pricing,
      categories: [...new Set([...(existing.categories || [existing.category]), ...(duplicate.categories || [duplicate.category])])],
      sources
    })
  }

  const existingPriority = STATUS_PRIORITY.get(existing.status) || 0
  const duplicatePriority = STATUS_PRIORITY.get(duplicate.status) || 0
  return attachSourceFields({
    ...existing,
    date: existing.date || duplicate.date,
    year: existing.year || duplicate.year,
    month: existing.month || duplicate.month,
    day: existing.day || duplicate.day,
    city: existing.city || duplicate.city,
    developerName: existing.developerName !== '未知开发者' ? existing.developerName : duplicate.developerName,
    developerUrl: existing.developerUrl || duplicate.developerUrl,
    githubUrl: existing.githubUrl || duplicate.githubUrl,
    blogUrl: existing.blogUrl || duplicate.blogUrl,
    profileLinks: existing.profileLinks?.length ? existing.profileLinks : duplicate.profileLinks,
    status: duplicatePriority > existingPriority ? duplicate.status : existing.status,
    description: existing.description.length >= duplicate.description.length ? existing.description : duplicate.description,
    sourceCategories: [...new Set([existing.sourceCategory, duplicate.sourceCategory, ...(existing.sourceCategories || [])].filter(Boolean))],
    sources
  })
}

export function mergeAndDedupe(parsedSources, options = {}) {
  const dataset = options.dataset || 'products'
  const seen = new Map()
  const warnings = []

  for (const source of parsedSources) {
    warnings.push(...source.warnings)
    for (const record of source.records) {
      const key = recordIdentity(record, dataset)
      if (!seen.has(key)) {
        seen.set(key, record)
      } else {
        const kept = seen.get(key)
        const merged = mergeDuplicate(kept, record, dataset)
        merged.id = createId(merged, dataset)
        seen.set(key, merged)
        warnings.push({
          code: 'duplicate-record', dataset, keptId: kept.id, duplicateId: record.id,
          duplicateRepository: record.sourceRepository,
          sourceFile: record.sourceFile, sourceLine: record.sourceLine
        })
      }
    }
  }

  const nameField = dataset === 'tools' ? 'toolName' : 'productName'
  return {
    records: [...seen.values()].sort((a, b) => {
      if (dataset === 'products') {
        const dateCompare = (b.date || '').localeCompare(a.date || '')
        if (dateCompare) return dateCompare
      }
      return a[nameField].localeCompare(b[nameField], 'zh-CN')
    }),
    warnings
  }
}

export function findCrossDatasetOverlaps(products, tools) {
  const productUrls = new Map(products.map((item) => [canonicalizeUrl(item.productUrl), item]).filter(([url]) => url))
  return tools.flatMap((tool) => {
    const key = canonicalizeUrl(tool.toolUrl)
    const product = key ? productUrls.get(key) : null
    return product ? [{
      canonicalUrl: key,
      productId: product.id,
      productName: product.productName,
      toolId: tool.id,
      toolName: tool.toolName
    }] : []
  })
}

export function buildQualityReport(records, warnings, metadata = {}) {
  const dataset = metadata.dataset || 'products'
  const nameField = dataset === 'tools' ? 'toolName' : 'productName'
  const urlField = dataset === 'tools' ? 'toolUrl' : 'productUrl'
  const missing = {
    name: records.filter((item) => !item[nameField]).length,
    url: records.filter((item) => !item[urlField]).length,
    description: records.filter((item) => !item.description).length,
    sources: records.filter((item) => !Array.isArray(item.sources) || item.sources.length === 0).length
  }
  if (dataset === 'products') {
    missing.date = records.filter((item) => !item.date).length
    missing.city = records.filter((item) => !item.city).length
    missing.githubUrl = records.filter((item) => !item.githubUrl).length
  }

  const byCategory = Object.groupBy(records, (item) => item.category)
  const report = {
    generatedAt: new Date().toISOString(),
    dataset,
    recordCount: records.length,
    sourceRepositoryCount: new Set(records.flatMap((item) => item.sourceRepositories || [])).size,
    missing,
    categoryCounts: Object.fromEntries(Object.entries(byCategory).map(([key, value]) => [key, value.length])),
    warningCount: warnings.length,
    warnings,
    ...metadata
  }
  if (dataset === 'products') {
    const byStatus = Object.groupBy(records, (item) => item.status)
    report.developerCount = new Set(records.map((item) => item.developerName)).size
    report.cityCount = new Set(records.map((item) => item.city).filter(Boolean)).size
    report.statusCounts = Object.fromEntries(Object.entries(byStatus).map(([key, value]) => [key, value.length]))
  }
  return report
}
