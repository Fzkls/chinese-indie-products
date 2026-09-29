import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('GitHub insights owns a declared runtime state', async () => {
  const source = await readFile('src/separated-insights.js', 'utf8')
  assert.match(source, /const\s+insightState\s*=\s*\{/)
  assert.match(source, /insightState\.products/)
})

test('overview interactions do not monkey-patch native scrolling', async () => {
  const source = await readFile('src/overview-interactions.js', 'utf8')
  assert.doesNotMatch(source, /Element\.prototype\.scrollIntoView\s*=/)
})

test('directory quick filters stay generic instead of hard-coding one city', async () => {
  const source = await readFile('src/dataset-tabs.js', 'utf8')
  assert.doesNotMatch(source, /data-project-preset="shenzhen"/)
  assert.doesNotMatch(source, /preset\s*===\s*['"]shenzhen['"]/)
})

test('ecosystem dashboard keeps data-quality context visible', async () => {
  const html = await readFile('index.html', 'utf8')
  assert.match(html, /id="city-coverage-note"/)
  assert.match(html, /项目年份分布/)
  assert.match(html, /不代表产品当前实时可访问性/)
})
