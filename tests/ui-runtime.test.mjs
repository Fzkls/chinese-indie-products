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


test('ecosystem weekly metrics do not inherit the legacy hero overlap', async () => {
  const css = await readFile('src/dataset-tabs.css', 'utf8')
  const block = css.match(/\.dataset-tabs-active \.ecosystem-metrics\{[\s\S]*?\}/)?.[0] || ''
  assert.match(block, /margin-top:0/)
  assert.match(block, /overflow:visible/)
  assert.match(block, /background:transparent/)
  assert.match(block, /box-shadow:none/)
})


test('product GitHub section exposes 7-day and monthly trend controls', async () => {
  const [html, source] = await Promise.all([
    readFile('index.html', 'utf8'),
    readFile('src/separated-insights.js', 'utf8')
  ])
  assert.match(html, /id="product-github-trends"/)
  assert.match(html, /data-github-trend-range="7d"/)
  assert.match(html, /data-github-trend-range="month"/)
  assert.match(source, /loadGithubHistory/)
  assert.match(source, /renderProductTrend/)
})
