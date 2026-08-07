<div align="center">

# IndieBase CN

### 中国独立开发者产品可视化数据库

将多个社区维护的 Markdown 清单转换为**可搜索、可筛选、可视化、可追溯**的结构化数据集。

[在线访问](https://fzkls.github.io/chinese-indie-products/) · [数据质量报告](data/quality-report.json) · [提交问题](https://github.com/Fzkls/chinese-indie-products/issues)

[![Pages](https://img.shields.io/badge/GitHub%20Pages-在线访问-2ea44f?logo=github)](https://fzkls.github.io/chinese-indie-products/)
[![Verify and publish site](https://github.com/Fzkls/chinese-indie-products/actions/workflows/site.yml/badge.svg)](https://github.com/Fzkls/chinese-indie-products/actions/workflows/site.yml)
[![Weekly Sync](https://img.shields.io/badge/Data%20Sync-每周一-blue)](.github/workflows/site.yml)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

</div>

---

## 项目定位

IndieBase CN 不是简单复制一份项目名单，而是把分散在不同仓库、不同格式中的独立开发数据整理成统一、可验证的数据产品。

当前站点包含两套**严格分离**的数据集：

| 数据集 | 内容 | 输出文件 | 是否参与产品图表 |
| --- | --- | --- | --- |
| 独立产品 | 中国独立开发者及其产品、游戏、程序员工具和精选项目 | `data/products.json` | 是 |
| 工具资源 | 独立开发、AI 出海和产品建设相关工具目录 | `data/tools.json` | 否 |

产品与工具不会混在同一个列表中，也不会跨数据集互相去重。即使两边出现相同 URL，也只会在质量报告中标记为重叠，不会合并记录。

## 数据来源

### 独立产品

1. [`1c7/chinese-independent-developer`](https://github.com/1c7/chinese-independent-developer)
   - `README.md`
   - `pages/README-Programmer-Edition.md`
   - `pages/README-Game.md`
   - `pages/README-2018-2020.md`
2. [`XiaomingX/1000-chinese-independent-developer-plus`](https://github.com/XiaomingX/1000-chinese-independent-developer-plus)
   - `README.md` 中的精品项目表格

### 工具资源

1. [`yaolifeng0629/Awesome-independent-tools`](https://github.com/yaolifeng0629/Awesome-independent-tools)
   - `README.md` 中的分类工具目录

> 本项目只负责结构化、去重、可视化和来源追溯。原始内容的维护权与署名归对应上游仓库及贡献者所有。

## 来源追溯

每条记录都包含 `sources[]`。来源不会在去重时被覆盖或丢失。

```json
{
  "sources": [
    {
      "repository": "1c7/chinese-independent-developer",
      "repositoryUrl": "https://github.com/1c7/chinese-independent-developer",
      "sourceFile": "README.md",
      "sourceSection": "2026 年 8 月添加",
      "sourceLine": 123,
      "sourceUrl": "https://github.com/1c7/chinese-independent-developer/blob/master/README.md#L123",
      "rawText": "原始 Markdown 行"
    }
  ]
}
```

同一产品被两个仓库同时收录时，结果会保留两条来源：

```text
sources[0] -> 1c7/chinese-independent-developer
sources[1] -> XiaomingX/1000-chinese-independent-developer-plus
```

网站卡片中可以直接展开来源，并跳转到对应仓库、文件和行号。

## 去重规则

### 产品数据集

优先使用规范化 URL 去重：

- 忽略 `http` / `https` 差异
- 忽略 `www.`
- 移除尾部 `/`
- 移除 URL hash
- 移除常见 `utm_*`、`ref` 和 `source` 跟踪参数
- GitHub 路径按不区分大小写处理

没有有效 URL 时，使用：

```text
规范化产品名称 + 规范化开发者名称
```

重复记录合并时会保留全部 `sources[]`，并优先选择更完整的描述和字段。状态优先级为：已上线、开发中、已收购、已关闭、未知。

### 工具数据集

优先使用规范化工具 URL；没有 URL 时使用规范化工具名称。同一工具在不同分类中重复出现时，会合并来源并保留分类集合。工具不会与产品数据集合并。

## 在线能力

### 独立产品区

- 搜索产品、开发者、描述、城市和来源仓库
- 按产品类型、运行状态、年份和城市组合筛选
- 展示年度趋势、产品类型、城市分布和运行状态
- 展开查看每条记录的准确来源
- 下载独立产品 JSON

### 工具资源区

- 与独立产品分开展示
- 搜索工具名称、分类、描述和来源
- 按工具分类筛选
- 展开查看来源文件和行号
- 下载工具资源 JSON

## 数据处理流程

```text
上游仓库
   │
   ├── 独立开发者 Markdown 清单 ── parseMarkdown()
   ├── Plus 精品项目表格 ───────── parseProjectTable()
   └── Awesome 工具目录 ────────── parseToolDirectory()
                                      │
                                      ▼
                         字段规范化与 URL 标准化
                                      │
                     ┌────────────────┴────────────────┐
                     ▼                                 ▼
                products 数据集                    tools 数据集
                     │                                 │
              产品内部去重                       工具内部去重
                     │                                 │
                     └────────── 保留 sources[] ───────┘
                                      │
                                      ▼
                       校验、质量报告、静态站构建
                                      │
                                      ▼
                             GitHub Pages 发布
```

## 自动同步与发布

工作流位于 [`.github/workflows/site.yml`](.github/workflows/site.yml)。

触发方式：

- 向 `main` 推送代码
- Pull Request
- 手动运行 `workflow_dispatch`
- **每周一 10:17（北京时间）自动同步**

每周任务会下载全部上游数据源，分别解析产品和工具，在各自数据集内部去重，生成数据文件和质量报告，运行测试与校验，将新数据快照提交到 `main`，然后发布到 `gh-pages`。

## 本地运行

要求 Node.js 20 或更高版本。

```bash
# 使用仓库内示例数据，适合离线开发
npm run sync:data -- --fixtures

# 同步全部真实上游数据
npm run sync:data

# 测试、数据校验和构建
npm run verify

# 本地预览构建产物
python3 -m http.server 4173 -d dist
```

打开 `http://localhost:4173`。

## npm 命令

| 命令 | 作用 |
| --- | --- |
| `npm run sync:data` | 同步三个上游仓库并生成两套数据集 |
| `npm run sync:data -- --fixtures` | 使用本地 fixture 生成离线预览数据 |
| `npm test` | 运行解析、去重、数据分离和来源保留测试 |
| `npm run check:data` | 检查字段、ID、URL、来源和数据集边界 |
| `npm run build` | 构建纯静态站点到 `dist/` |
| `npm run verify` | 依次执行测试、数据检查和构建 |

## 输出文件

### `data/products.json`

```ts
interface ProductRecord {
  id: string
  recordType: 'product'
  productName: string
  productUrl: string | null
  developerName: string
  category: 'product' | 'developer-tool' | 'game' | 'archive'
  sourceCategory: string | null
  status: 'active' | 'developing' | 'closed' | 'acquired' | 'unknown'
  date: string | null
  city: string | null
  description: string
  sourceRepositories: string[]
  sourceCount: number
  sources: SourceReference[]
}
```

### `data/tools.json`

```ts
interface ToolRecord {
  id: string
  recordType: 'tool'
  toolName: string
  toolUrl: string
  category: string
  categories?: string[]
  pricing: 'free' | 'paid' | 'open-source' | 'unknown'
  description: string
  sourceRepositories: string[]
  sourceCount: number
  sources: SourceReference[]
}
```

### `data/quality-report.json`

包含产品和工具的记录数量、分类与状态统计、缺失字段、解析警告、数据集内部重复记录、产品与工具之间的 URL 重叠，以及数据集分离规则。

## 项目结构

```text
.
├── .github/workflows/site.yml
├── data/
│   ├── products.json
│   ├── tools.json
│   └── quality-report.json
├── fixtures/
├── scripts/
│   ├── lib/parser.mjs
│   ├── sync-data.mjs
│   ├── check-data.mjs
│   └── build.mjs
├── src/
│   ├── app.js
│   └── styles.css
├── tests/
├── index.html
└── package.json
```

## 数据边界

这些数据来自社区主动提交和人工维护的公开清单，不代表中国独立开发者总体规模。项目状态、链接和开发者信息可能随时间变化；Plus 仓库中的商业分析属于其维护者的编辑内容；工具目录中可能包含海外产品、开源项目、付费服务和通用开发资源。

使用数据进行分析时，应同时展示快照时间和来源信息。

## 贡献

欢迎提交 Issue 或 Pull Request，尤其包括新数据源解析器、去重规则改进、错误合并修复、遗漏来源修复、质量规则、可视化和测试样例。

新增数据源必须明确仓库、文件、解析方式、授权边界和来源字段，不能只导入内容而不保留出处。

## 授权与署名

本仓库目前未声明独立的软件许可证。上游内容的再发布、衍生使用和商业使用，应分别遵守对应上游仓库的许可证、贡献约定和署名要求。

数据来源：

- `1c7/chinese-independent-developer`
- `XiaomingX/1000-chinese-independent-developer-plus`
- `yaolifeng0629/Awesome-independent-tools`
