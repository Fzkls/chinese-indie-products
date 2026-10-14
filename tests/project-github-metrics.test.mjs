import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'

async function projectDirectoryApi() {
  const source = await readFile('src/dataset-tabs.js', 'utf8')
  assert.match(source, /\ninit\(\)\s*$/)
  return runInNewContext(`${source.replace(/\ninit\(\)\s*$/, '')}
  ({ ui, githubMeta, projectActivity, repositoryPushTime, relativePushTime, projectGithubMetricsHtml, sortProjectRecords })`, { URL, Intl, Date })
}

function product(name, date = '2026-10-01') {
  return { productName: name, productUrl: `https://github.com/demo/${name}`, date }
}

test('project cards show exact star totals and actual code push timestamps', async () => {
  const api = await projectDirectoryApi()
  const repo = { status: 'available', stars: 123456, updatedAt: '2026-10-14T12:00:00Z', pushedAt: '2026-10-11T00:00:00Z' }
  const html = api.projectGithubMetricsHtml(repo)
  assert.match(html, /GitHub Stars/)
  assert.match(html, /123,456/)
  assert.match(html, /最近代码推送/)
  assert.match(html, /<time datetime="2026-10-11T00:00:00.000Z">2026\/10\/11<\/time>/)
  assert.doesNotMatch(html, /2026\/10\/14/)
})

test('missing or failed GitHub data never becomes zero stars or a fabricated date', async () => {
  const api = await projectDirectoryApi()
  assert.equal(api.projectGithubMetricsHtml(null), '')
  assert.doesNotMatch(api.projectGithubMetricsHtml({ status: 'unavailable' }), /★|0 Stars/)
  const html = api.projectGithubMetricsHtml({ status: 'available', stars: 0, pushedAt: null })
  assert.match(html, /★<\/span> 0/)
  assert.match(html, /暂无记录/)
  assert.match(html, /时间未知/)
})

test('last active sort uses the exact push time, not source date or coarse activity bucket', async () => {
  const api = await projectDirectoryApi()
  api.ui.github = {
    'demo/older': { status: 'available', stars: 200, pushedAt: '2026-10-10T00:00:00Z', updatedAt: '2026-10-14T00:00:00Z' },
    'demo/newer': { status: 'available', stars: 10, pushedAt: '2026-10-12T00:00:00Z' }
  }
  api.ui.sort = 'active'
  assert.deepEqual(Array.from(api.sortProjectRecords([product('older', '2026-10-14'), product('newer', '2020-01-01')]), (item) => item.productName), ['newer', 'older'])
  api.ui.sort = 'stars'
  assert.deepEqual(Array.from(api.sortProjectRecords([product('newer'), product('older')]), (item) => item.productName), ['older', 'newer'])
})

test('activity ages are derived from pushedAt rather than stale snapshot bucket', async () => {
  const api = await projectDirectoryApi()
  const date = Date.parse('2026-10-10T00:00:00Z')
  assert.equal(api.relativePushTime(date, Date.parse('2026-10-14T00:00:00Z')), '4 天前')
  assert.equal(api.relativePushTime(0), '时间未知')
  api.ui.github = { 'demo/older': { status: 'available', pushedAt: '2020-01-01T00:00:00Z', activity: 'active-30' } }
  assert.equal(api.projectActivity(product('older')), 'inactive-year')
})
