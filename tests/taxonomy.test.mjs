import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyProduct } from '../scripts/lib/taxonomy.mjs'

const record = (id, productName, description, category = 'product', productUrl = 'https://example.test') => ({
  id, productName, description, category, productUrl, profileLinks: []
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
