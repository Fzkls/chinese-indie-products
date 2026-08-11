import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyProduct } from '../scripts/lib/taxonomy-v1.mjs'

const record = (id, productName, description, category = 'product', productUrl = 'https://example.test', profileLinks = []) => ({
  id, productName, description, category, productUrl, profileLinks
})

test('classifies Nexus Shell as developer tools with SSH/DevOps tags', () => {
  const result = classifyProduct(record('nexus', 'Nexus Shell', '原生 macOS SSH 客户端，管理终端、SFTP、Docker 与服务器监控，并通过 MCP 让 Claude Code、Codex 执行授权操作', 'developer-tool'))
  assert.equal(result.primaryCategory, 'developer-tools')
  assert.ok(result.subCategories.includes('终端与 SSH'))
  assert.ok(result.tags.platform.includes('macos'))
  assert.ok(result.tags.capabilities.includes('ssh'))
  assert.ok(result.tags.capabilities.includes('docker'))
})

test('semantic evidence can override a misleading developer-tool source category', () => {
  const result = classifyProduct(record('cicada', '知了', '支持自托管的多人音乐服务，类似私有版 Spotify，可在自己的服务器上管理、播放和分享音乐', 'developer-tool', 'https://github.com/mebtte/cicada'))
  assert.equal(result.primaryCategory, 'media-entertainment')
  assert.ok(result.subCategories.includes('音乐'))
  assert.ok(result.tags.productForm.includes('self-hosted'))
  assert.ok(result.tags.characteristics.includes('open-source'))
})

test('classifies AI coding workbench as developer tools rather than generic AI productivity', () => {
  const result = classifyProduct(record('c3', 'c3(code creative center)', 'AI 开发工作台，多智能体协作，SDD 规范驱动开发，支持 Claude Code、Codex、Cursor 与自动化任务', 'developer-tool', 'https://github.com/sequencestream/c3'))
  assert.equal(result.primaryCategory, 'developer-tools')
  assert.ok(result.subCategories.includes('AI 编程'))
  assert.ok(result.tags.capabilities.includes('agent'))
})

test('classifies browser AI assistant and captures browser-extension form', () => {
  const result = classifyProduct(record('doubao', '豆包超级助手', '对话文件夹、提示词模板、多步队列和本机读写文件的豆包对话增强 Chrome 插件'))
  assert.equal(result.primaryCategory, 'ai-productivity')
  assert.ok(result.subCategories.includes('AI 助手'))
  assert.ok(result.tags.productForm.includes('browser-extension'))
  assert.ok(result.tags.platform.includes('browser'))
})

test('developer GitHub profile does not turn an unrelated product into a developer tool', () => {
  const result = classifyProduct(record(
    'timer',
    'ClassroomTimers',
    '面向教师和课堂场景的免费在线计时工具，主打大屏投影、全屏显示、无需注册',
    'product',
    'https://classroomtimers.app/',
    [{ label: 'GitHub', url: 'https://github.com/example-developer' }]
  ))
  assert.notEqual(result.primaryCategory, 'developer-tools')
  assert.equal(result.primaryCategory, 'utilities')
})

test('a public GitHub product URL alone does not imply developer-tool category', () => {
  const result = classifyProduct(record(
    'pet',
    'desktop-pet',
    '桌面宠物应用，在屏幕上陪伴用户并支持简单互动',
    'product',
    'https://github.com/example/desktop-pet'
  ))
  assert.notEqual(result.primaryCategory, 'developer-tools')
  assert.equal(result.primaryCategory, 'lifestyle-health')
})

test('generic consumer tests are not treated as software testing tools', () => {
  const result = classifyProduct(record('cps', 'CPS Test', '鼠标点击速度测试网站，集成专注力训练和反应速度测试等玩法'))
  assert.notEqual(result.primaryCategory, 'developer-tools')
  assert.equal(result.primaryCategory, 'education')
})

test('window docking picture-in-picture helper is a utility rather than other', () => {
  const result = classifyProduct(record(
    'dock',
    '摸鱼助手',
    '可快速调整浏览器和桌面窗口的位置、尺寸、置顶与透明度，并自动识别浏览器画中画窗口停靠到屏幕指定位置',
    'product',
    'https://github.com/example/window-dock'
  ))
  assert.equal(result.primaryCategory, 'utilities')
  assert.ok(result.subCategories.includes('系统工具'))
})

test('capability fallback recovers clear AI products instead of other', () => {
  const result = classifyProduct(record('ai', '模型对话台', '接入大模型进行智能体对话与提示词管理'))
  assert.equal(result.primaryCategory, 'ai-productivity')
  assert.notEqual(result.classificationMethod, 'other')
})

test('programmer-list source is used only as a final low-confidence fallback', () => {
  const result = classifyProduct(record('source-fallback', 'Tiny Helper', '一个轻量的小组件', 'developer-tool'))
  assert.equal(result.primaryCategory, 'developer-tools')
  assert.equal(result.classificationMethod, 'source-fallback')
  assert.ok(result.confidence < 0.65)
})
