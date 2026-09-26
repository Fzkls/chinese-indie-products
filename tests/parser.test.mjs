import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseMarkdown,
  parseProjectTable,
  parseToolDirectory,
  mergeAndDedupe,
  findCrossDatasetOverlaps,
  canonicalizeUrl
} from '../scripts/lib/parser.mjs'

test('parses independent product markdown and keeps exact source metadata', () => {
  const text = `### 2026 年 1 月 1 号添加\n#### Dev（上海）\n* :white_check_mark: [Demo](https://example.com)：A product`
  const { records, warnings } = parseMarkdown(text, {
    repository: 'owner/source', repositoryUrl: 'https://github.com/owner/source',
    ref: 'main', sourceFile: 'README.md', category: 'product'
  })
  assert.equal(warnings.length, 0)
  assert.equal(records.length, 1)
  assert.equal(records[0].city, '上海')
  assert.equal(records[0].status, 'active')
  assert.equal(records[0].sources[0].repository, 'owner/source')
  assert.equal(records[0].sources[0].sourceLine, 3)
  assert.match(records[0].sources[0].sourceUrl, /README\.md#L3$/)
})

test('parses Plus project tables as products', () => {
  const text = `## 精品项目清单\n| 类别 | 开发者 | 项目名称 | 链接 | 简介 |\n| --- | --- | --- | --- | --- |\n| 基础设施 | Alice | Demo | [访问](https://example.com/) | 项目介绍 |`
  const parsed = parseProjectTable(text, {
    repository: 'owner/plus', repositoryUrl: 'https://github.com/owner/plus',
    ref: 'main', sourceFile: 'README.md'
  })
  assert.equal(parsed.records.length, 1)
  assert.equal(parsed.records[0].recordType, 'product')
  assert.equal(parsed.records[0].sourceCategory, '基础设施')
  assert.equal(parsed.records[0].developerName, 'Alice')
})

test('parses tool directory separately from products', () => {
  const text = `## 工具列表\n### 前端开发\n- [Vite](https://vite.dev/) - (免费) 前端构建工具`
  const parsed = parseToolDirectory(text, {
    repository: 'owner/tools', repositoryUrl: 'https://github.com/owner/tools',
    ref: 'main', sourceFile: 'README.md'
  })
  assert.equal(parsed.records.length, 1)
  assert.equal(parsed.records[0].recordType, 'tool')
  assert.equal(parsed.records[0].category, '前端开发')
  assert.equal(parsed.records[0].pricing, 'free')
})

test('deduplicates only inside one dataset and merges all sources', () => {
  const first = parseMarkdown(`### 2026 年 1 月 1 号添加\n#### Dev\n* :white_check_mark: [Demo](https://www.example.com/)：A`, {
    repository: 'owner/a', repositoryUrl: 'https://github.com/owner/a', sourceFile: 'README.md', category: 'product'
  })
  const second = parseProjectTable(`| 类别 | 开发者 | 项目名称 | 链接 | 简介 |\n| --- | --- | --- | --- | --- |\n| 工具 | Dev | Demo | [访问](https://example.com?utm_source=test) | Longer product description |`, {
    repository: 'owner/b', repositoryUrl: 'https://github.com/owner/b', sourceFile: 'README.md'
  })
  const merged = mergeAndDedupe([first, second], { dataset: 'products' })
  assert.equal(merged.records.length, 1)
  assert.equal(merged.records[0].sources.length, 2)
  assert.deepEqual(merged.records[0].sourceRepositories, ['owner/a', 'owner/b'])
  assert.equal(merged.warnings[0].code, 'duplicate-record')
})

test('reports but does not merge product/tool URL overlaps', () => {
  const products = [{ id: 'p1', productName: 'Demo', productUrl: 'https://example.com/' }]
  const tools = [{ id: 't1', toolName: 'Demo tool', toolUrl: 'https://www.example.com' }]
  const overlaps = findCrossDatasetOverlaps(products, tools)
  assert.equal(overlaps.length, 1)
  assert.equal(overlaps[0].productId, 'p1')
  assert.equal(canonicalizeUrl('https://www.example.com/?utm_source=x'), 'example.com/')
})


test('ignores internal markdown navigation links in source repositories', () => {
  const input = `### 2026 年 9 月 1 日添加
#### 维护者 - [Github](https://github.com/1c7)
* [2018 2024 年项目列表](https://github.com/1c7/chinese-independent-developer/blob/master/pages/README-2018-2020.md)：因 GitHub 渲染限制单独存档
* :white_check_mark: [真实产品](https://example.com)：真实产品描述
`
  const parsed = parseMarkdown(input, {
    repository: '1c7/chinese-independent-developer',
    repositoryUrl: 'https://github.com/1c7/chinese-independent-developer',
    sourceFile: 'README.md',
    ref: 'master'
  })
  assert.equal(parsed.records.length, 1)
  assert.equal(parsed.records[0].productName, '真实产品')
  assert.ok(parsed.warnings.some((warning) => warning.code === 'internal-source-document'))
})
