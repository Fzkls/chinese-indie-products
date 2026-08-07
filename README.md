<div align="center">

# IndieBase CN

### 中国独立开发者产品可视化数据库

将社区维护的 Markdown 产品清单转换为**可搜索、可筛选、可视化、可追溯**的结构化数据产品。

[在线访问](https://fzkls.github.io/chinese-indie-products/) · [数据来源](https://github.com/1c7/chinese-independent-developer) · [提交问题](https://github.com/Fzkls/chinese-indie-products/issues)

[![Pages](https://img.shields.io/badge/GitHub%20Pages-在线访问-2ea44f?logo=github)](https://fzkls.github.io/chinese-indie-products/)
[![Verify and publish site](https://github.com/Fzkls/chinese-indie-products/actions/workflows/site.yml/badge.svg)](https://github.com/Fzkls/chinese-indie-products/actions/workflows/site.yml)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Static Site](https://img.shields.io/badge/Runtime-零第三方依赖-blue)](#技术实现)

</div>

---

## 项目简介

[`1c7/chinese-independent-developer`](https://github.com/1c7/chinese-independent-developer) 收录了大量中国独立开发者及其产品，但原始内容以 Markdown 清单为主，不便于组合查询、统计分析和长期追踪。

**IndieBase CN** 在保留原始来源的前提下，将这些非结构化内容转换为统一的数据记录，并通过纯静态网站提供：

- 产品、开发者、描述和城市的全文搜索
- 类型、状态、年份和城市的组合筛选
- 年度趋势、产品类型、城市分布和运行状态可视化
- 产品链接、开发者链接与原始数据来源追溯
- 可供二次分析使用的 JSON 数据快照
- 缺失字段、重复项和解析异常的数据质量报告

> 这个项目不是简单复制一份名单，而是尝试把社区清单整理成一个可持续更新、可验证、可分析的数据集。

## 在线体验

访问：**[https://fzkls.github.io/chinese-indie-products/](https://fzkls.github.io/chinese-indie-products/)**

站点主要包含四部分：

1. **生态概览**：查看产品记录、独立开发者、城市覆盖和运行状态等核心指标。
2. **趋势可视化**：查看年度收录趋势、产品类型占比、城市 Top 8 和状态分布。
3. **产品探索器**：通过关键词和多个维度组合筛选产品。
4. **数据说明**：了解数据同步、结构化解析、校验去重和发布过程。

所有图表会跟随当前筛选条件联动，便于从不同维度探索数据。

## 核心能力

### 数据同步

读取上游仓库中的主产品清单、程序员工具、游戏和历史归档：

```text
README.md
pages/README-Programmer-Edition.md
pages/README-Game.md
pages/README-2018-2020.md
```

### 结构化解析

从 Markdown 文本中提取并规范化：

- 日期与年份
- 开发者名称
- 城市
- 个人主页、GitHub 和博客链接
- 产品名称与产品地址
- 产品状态
- 产品类型
- 产品描述
- 原始文件、章节、行号和文本

### 数据质量控制

解析过程中不会静默丢弃异常内容。系统会：

- 对记录进行稳定 ID 生成和去重
- 检查关键字段缺失情况
- 汇总产品状态和类型分布
- 保留无法确定的信息为 `unknown` 或 `null`
- 将解析警告写入质量报告，供人工复核
- 通过自动化测试验证解析器和构建结果

### 可视化探索

前端支持：

- 搜索产品、开发者、描述和城市
- 按产品类型筛选
- 按运行状态筛选
- 按收录年份筛选
- 按城市筛选
- 多条件组合过滤
- 图表与产品列表联动
- 下载当前完整 JSON 快照

## 数据处理流程

```text
上游 Markdown 清单
        │
        ▼
同步原始文件
        │
        ▼
解析日期、开发者、产品、链接、城市与状态
        │
        ▼
字段规范化、稳定 ID、去重与质量检查
        │
        ├── data/products.json
        └── data/quality-report.json
                    │
                    ▼
              构建静态站点
                    │
                    ▼
            发布到 gh-pages 分支
                    │
                    ▼
               GitHub Pages
```

## 快速开始

### 环境要求

- Node.js 20 或更高版本
- npm
- Python 3，仅用于本地静态文件预览，也可以换成任意静态服务器

### 本地运行

```bash
# 克隆仓库
git clone https://github.com/Fzkls/chinese-indie-products.git
cd chinese-indie-products

# 使用示例数据生成离线快照
npm run sync:data -- --fixtures

# 运行测试、数据检查并构建站点
npm run verify

# 启动本地静态服务器
python3 -m http.server 4173 -d dist
```

浏览器打开：<http://localhost:4173>

### 同步完整上游数据

```bash
npm run sync:data
npm run verify
```

同步脚本会尝试读取完整上游数据。本地网络不可用时，可使用 `--fixtures` 明确切换到仓库内置的示例快照。

## npm 命令

| 命令 | 用途 |
| --- | --- |
| `npm run sync:data` | 同步并解析完整上游数据 |
| `npm run sync:data -- --fixtures` | 使用本地示例数据生成快照 |
| `npm run test` | 运行 Node.js 原生测试 |
| `npm run check:data` | 检查数据结构和质量约束 |
| `npm run build` | 生成可部署的 `dist/` 静态站点 |
| `npm run verify` | 依次执行测试、数据检查和构建 |

## 数据格式

### `data/products.json`

文件由元数据和产品记录组成：

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

单条记录的主要结构：

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
  description: string
  status: 'active' | 'developing' | 'closed' | 'acquired' | 'unknown'
  category: 'product' | 'developer-tool' | 'game' | 'archive'

  sourceFile: string
  sourceSection: string
  sourceLine: number
  rawText: string
}
```

### `data/quality-report.json`

质量报告包含：

- 记录总量
- 字段缺失统计
- 产品类型统计
- 产品状态统计
- 重复记录信息
- 解析警告
- 当前数据快照模式

## 项目结构

```text
.
├── .github/workflows/     # 数据验证与发布工作流
├── fixtures/              # 离线测试和开发用示例数据
├── scripts/
│   ├── sync-data.mjs      # 同步与结构化解析
│   ├── check-data.mjs     # 数据质量检查
│   └── build.mjs          # 静态站点构建
├── src/
│   ├── app.js             # 搜索、筛选、图表和产品列表
│   └── styles.css         # 响应式页面样式
├── tests/                 # 解析与数据行为测试
├── index.html             # 网站页面结构
├── package.json
└── README.md
```

构建后会生成：

```text
dist/
├── index.html
├── src/
└── data/
    ├── products.json
    └── quality-report.json
```

## 技术实现

项目刻意保持轻量：

- **数据处理**：Node.js ES Modules
- **测试**：Node.js 内置 `node:test`
- **前端**：原生 HTML、CSS 和 JavaScript
- **图表**：原生 DOM、CSS 和 SVG/渐变能力
- **运行时依赖**：无
- **部署方式**：GitHub Actions + `gh-pages` + GitHub Pages

没有引入前端框架和图表库，构建产物可以直接由任何静态文件服务器托管。

## 自动化与部署

工作流定义在 [`.github/workflows/site.yml`](.github/workflows/site.yml)。

在以下情况执行：

- 向 `main` 分支推送代码
- 创建或更新 Pull Request
- 手动触发 `workflow_dispatch`

工作流会依次：

1. 检出仓库代码
2. 配置 Node.js
3. 同步完整上游数据
4. 运行测试、数据校验和构建
5. 上传 `dist/` 作为构建产物
6. 非 Pull Request 场景下，将网站发布到 `gh-pages` 分支

GitHub Pages 从 `gh-pages` 分支根目录提供静态站点。

## 数据边界

使用本项目数据时，需要注意：

- 数据来自社区主动提交和维护的清单，不代表中国独立开发者总体规模。
- 城市、项目状态和个人信息不是必填字段。
- 产品地址、运行状态和开发者信息可能已经发生变化。
- “年份趋势”主要反映清单中的收录时间或可解析日期，不应直接解释为市场新增产品数量。
- 自动解析无法完全消除原始文本格式差异带来的误差。
- 任何研究或趋势结论都应保留数据来源、快照时间和样本限制说明。

## 参与贡献

欢迎通过 Issue 或 Pull Request 改进：

- 解析规则
- 数据质量检查
- 搜索与筛选体验
- 可视化方式
- 无障碍与移动端体验
- 文档和测试

新增解析规则时，请同时补充对应测试，避免修复一种格式时破坏已有数据。

数据内容本身的新增或修正，优先提交到上游仓库：

- [`1c7/chinese-independent-developer`](https://github.com/1c7/chinese-independent-developer)

## 授权与署名

本仓库当前未声明独立的软件许可证。

上游内容的再发布、修改和商业使用，应遵循上游仓库的授权条件和贡献者署名要求。在授权边界没有进一步明确之前，不应将上游数据直接包装为闭源商业数据库。

本项目的数据来源应注明：

```text
Data source: 1c7/chinese-independent-developer
Visualization and structured dataset: IndieBase CN
```

---

<div align="center">

**看见中国独立开发者正在创造什么。**

[访问可视化站点](https://fzkls.github.io/chinese-indie-products/)

</div>
