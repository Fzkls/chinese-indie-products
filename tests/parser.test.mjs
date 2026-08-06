import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parseMarkdown, mergeAndDedupe } from '../scripts/lib/parser.mjs'

test('parses dates, developers, cities, states and products', async () => {
  const text = await readFile('fixtures/upstream-sample.md', 'utf8')
  const { records, warnings } = parseMarkdown(text, { sourceFile: 'README.md', category: 'product' })
  assert.ok(records.length >= 15)
  assert.equal(warnings.length, 0)
  const gesture = records.find((item) => item.productName === 'Gesture Synth')
  assert.equal(gesture.city, '上海')
  assert.equal(gesture.status, 'active')
  assert.equal(gesture.year, 2026)
  const budget = records.find((item) => item.productName === '预算笔记')
  assert.equal(budget.status, 'closed')
})

test('deduplicates repeated products and emits a warning', () => {
  const source = `### 2026 年 1 月 1 号添加\n#### Dev\n* :white_check_mark: [Demo](https://example.com)：A\n* :white_check_mark: [Demo](https://example.com)：A`
  const parsed = parseMarkdown(source, { sourceFile: 'README.md', category: 'product' })
  const merged = mergeAndDedupe([parsed])
  assert.equal(merged.records.length, 1)
  assert.equal(merged.warnings[0].code, 'duplicate-record')
})
