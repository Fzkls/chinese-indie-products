# IndieBase CN — 中国独立开发者产品数据库

将 [`1c7/chinese-independent-developer`](https://github.com/1c7/chinese-independent-developer) 的 Markdown 清单转换为可查询、可筛选、可视化的结构化产品数据库。

## 在线展示

GitHub Pages：<https://fzkls.github.io/chinese-indie-products/>

仓库已配置为使用 GitHub Actions 自动验证、构建并发布网站。

## 当前能力

- 同步主产品、程序员工具、游戏和 2018–2020 历史归档
- 解析日期、开发者、城市、个人链接、产品、状态和描述
- 去重并保留源文件、源章节、源行号和原始文本
- 输出 `data/products.json` 与 `data/quality-report.json`
- 搜索产品、开发者、描述和城市
- 按类型、状态、年份和城市组合筛选
- 展示年度趋势、类型占比、城市 Top 8 和状态分布
- 无第三方运行时依赖，可作为纯静态站部署

## 本地运行

```bash
# 生成示例快照（离线可运行）
npm run sync:data -- --fixtures

# 尝试同步完整上游数据；本地网络不可用时自动回退到示例快照
npm run sync:data

# 数据检查、测试与构建
npm run verify

# 本地预览
python3 -m http.server 4173 -d dist
```

打开 `http://localhost:4173`。

## 数据文件

### `data/products.json`

```json
{
  "metadata": {
    "upstreamRepository": "1c7/chinese-independent-developer",
    "snapshotMode": "full-upstream",
    "generatedAt": "2026-08-06T00:00:00.000Z"
  },
  "records": []
}
```

单条记录包括：

```ts
interface ProductRecord {
  id: string
  date: string | null
  year: number | null
  month: number | null
  day: number | null
  city: string | null
  developerName: string
  developerUrl: string | null
  githubUrl: string | null
  blogUrl: string | null
  productName: string
  productUrl: string | null
  status: 'active' | 'developing' | 'closed' | 'acquired' | 'unknown'
  category: 'product' | 'developer-tool' | 'game' | 'archive'
  description: string
  sourceFile: string
  sourceSection: string
  sourceLine: number
  rawText: string
}
```

### `data/quality-report.json`

包含字段缺失、状态与类型统计、解析警告和重复记录信息。解析失败不能静默丢弃，应进入 warnings 供人工复核。

## 数据同步策略

完整同步读取以下文件：

- `README.md`
- `pages/README-Programmer-Edition.md`
- `pages/README-Game.md`
- `pages/README-2018-2020.md`

GitHub Actions 每周同步一次，同时支持手动触发。PR 只执行测试、数据检查和构建，不自动部署。

## 数据边界

该数据库是主动提交和社区维护形成的样本，不代表中国独立开发者总体规模。城市字段并非必填，项目状态、网址与开发者信息也可能已经变化。任何趋势分析都应标明数据来源、生成时间和样本限制。

## 授权

本仓库当前未声明独立的软件许可证。上游内容的再发布和商业使用应遵循上游仓库许可与贡献者署名要求；在授权边界未明确前，不应将上游数据包装成闭源商业数据库。
