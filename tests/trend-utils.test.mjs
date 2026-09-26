import test from 'node:test'
import assert from 'node:assert/strict'
import { lifecycleKey, repositoryTrend } from '../src/trend-utils.js'

test('calculates GitHub growth from the latest two snapshots', () => {
  const trend = repositoryTrend([
    { date: '2026-09-07', stars: 100, forks: 10 },
    { date: '2026-09-14', stars: 120, forks: 12 },
    { date: '2026-09-21', stars: 150, forks: 15 }
  ])
  assert.equal(trend.days, 7)
  assert.equal(trend.starDelta, 30)
  assert.equal(trend.forkDelta, 3)
  assert.equal(Math.round(trend.starGrowthPercent), 25)
})

test('classifies repository lifecycle buckets', () => {
  assert.equal(lifecycleKey({ status: 'available', activity: 'active-30' }), 'active-30')
  assert.equal(lifecycleKey({ status: 'available', archived: true }), 'archived')
  assert.equal(lifecycleKey({ status: 'unavailable' }), 'unavailable')
})
