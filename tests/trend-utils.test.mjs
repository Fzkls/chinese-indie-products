import test from 'node:test'
import assert from 'node:assert/strict'
import { aggregateSnapshotIntervals, lifecycleKey, repositoryTrend, snapshotWindowTrend } from '../src/trend-utils.js'

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


test('calculates range growth from the nearest baseline snapshot', () => {
  const trend = snapshotWindowTrend([
    { date: '2026-09-30', stars: 100, forks: 10 },
    { date: '2026-10-02', stars: 104, forks: 11 },
    { date: '2026-10-04', stars: 109, forks: 12 }
  ], '2026-10-01', '2026-10-04')
  assert.equal(trend.baseline.date, '2026-09-30')
  assert.equal(trend.latest.date, '2026-10-04')
  assert.equal(trend.starDelta, 9)
  assert.equal(trend.forkDelta, 2)
})

test('keeps sparse snapshot intervals explicit instead of interpolating missing days', () => {
  const series = aggregateSnapshotIntervals([[
    { date: '2026-09-30', stars: 100, forks: 10 },
    { date: '2026-10-04', stars: 108, forks: 11 }
  ]], '2026-10-01', '2026-10-04')
  assert.equal(series.length, 1)
  assert.equal(series[0].date, '2026-10-04')
  assert.equal(series[0].starDelta, 8)
  assert.equal(series[0].intervalDays, 4)
})
