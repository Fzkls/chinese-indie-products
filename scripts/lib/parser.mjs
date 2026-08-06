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
  const trimmed = value.trim()
  if (/^(https?:\/\/|mailto:)/i.test(trimmed)) return trimmed
  return null
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

function createId(record) {
  const raw = [record.sourceFile, record.developerName, record.productName, record.productUrl || '', record.date || ''].join('|')
  return createHash('sha1').update(raw).digest('hex').slice(0, 14)
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
      warnings.push({
        code: 'missing-developer',
        sourceFile,
        sourceLine: index + 1,
        rawText: rawLine
      })
      currentDeveloper = {
        developerName: '未知开发者', city: null, developerUrl: null,
        githubUrl: null, blogUrl: null, profileLinks: []
      }
    }

    const [, , productNameRaw, productUrlRaw, descriptionRaw] = productMatch
    const productName = stripMarkdown(productNameRaw)
    const productUrl = normalizeUrl(productUrlRaw)
    const description = stripMarkdown(descriptionRaw.replace(/\s*[-—–]\s*\[(更多介绍|源码|查看仓库|下载|Release)[^\]]*\]\([^)]+\)\s*$/i, ''))
    const record = {
      id: '',
      date: currentDate?.iso || null,
      year: currentDate?.year || null,
      month: currentDate?.month || null,
      day: currentDate?.day || null,
      city: currentDeveloper.city,
      developerName: currentDeveloper.developerName,
      developerUrl: currentDeveloper.developerUrl,
      githubUrl: currentDeveloper.githubUrl,
      blogUrl: currentDeveloper.blogUrl,
      profileLinks: currentDeveloper.profileLinks,
      productName,
      productUrl,
      status: parseStatus(line),
      category,
      description,
      sourceFile,
      sourceSection: currentSection,
      sourceLine: index + 1,
      rawText: rawLine
    }
    record.id = createId(record)
    records.push(record)
  }

  return { records, warnings }
}

export function mergeAndDedupe(parsedSources) {
  const seen = new Map()
  const warnings = []

  for (const source of parsedSources) {
    warnings.push(...source.warnings)
    for (const record of source.records) {
      const key = `${record.productUrl || ''}|${record.productName.toLowerCase()}|${record.developerName.toLowerCase()}`
      if (!seen.has(key)) {
        seen.set(key, record)
      } else {
        warnings.push({
          code: 'duplicate-record',
          keptId: seen.get(key).id,
          duplicateId: record.id,
          sourceFile: record.sourceFile,
          sourceLine: record.sourceLine
        })
      }
    }
  }

  return {
    records: [...seen.values()].sort((a, b) => {
      const dateCompare = (b.date || '').localeCompare(a.date || '')
      return dateCompare || a.productName.localeCompare(b.productName, 'zh-CN')
    }),
    warnings
  }
}

export function buildQualityReport(records, warnings, metadata = {}) {
  const missing = {
    date: records.filter((item) => !item.date).length,
    city: records.filter((item) => !item.city).length,
    productUrl: records.filter((item) => !item.productUrl).length,
    githubUrl: records.filter((item) => !item.githubUrl).length,
    description: records.filter((item) => !item.description).length
  }
  const byStatus = Object.groupBy(records, (item) => item.status)
  const byCategory = Object.groupBy(records, (item) => item.category)

  return {
    generatedAt: new Date().toISOString(),
    recordCount: records.length,
    developerCount: new Set(records.map((item) => item.developerName)).size,
    cityCount: new Set(records.map((item) => item.city).filter(Boolean)).size,
    missing,
    statusCounts: Object.fromEntries(Object.entries(byStatus).map(([key, value]) => [key, value.length])),
    categoryCounts: Object.fromEntries(Object.entries(byCategory).map(([key, value]) => [key, value.length])),
    warningCount: warnings.length,
    warnings,
    ...metadata
  }
}
