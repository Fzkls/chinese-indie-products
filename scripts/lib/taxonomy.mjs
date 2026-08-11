const text = (record) => [
  record.productName,
  record.description,
  record.sourceCategory,
  record.category,
  record.productUrl,
  ...(record.profileLinks || []).flatMap((item) => [item.label, item.url])
].filter(Boolean).join(' ').toLowerCase()

const rx = (pattern) => pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i')
const matches = (value, pattern) => rx(pattern).test(value)

const CATEGORY_RULES = [
  ['developer-tools', [
    [/(程序员|开发者|编程|代码|coding|developer|devtool|dev tool|ide\b|editor\b|代码编辑|源码|git\b|github)/i, 4, '开发/代码'],
    [/(api\b|sdk\b|cli\b|terminal|终端|ssh\b|sftp\b|docker|kubernetes|k8s|devops|部署|deploy|数据库|database|sql\b|debug|调试|测试|testing|mock\b|webhook|mcp\b)/i, 5, '工程工具'],
    [/(claude code|codex|cursor|copilot|ai 编程|代码生成|code generation|agent.*开发|开发.*agent)/i, 6, 'AI 编程']
  ]],
  ['ai-productivity', [
    [/(人工智能|\bai\b|chatgpt|gpt[- ]?\d?|llm|claude|gemini|deepseek|豆包|智能助手|ai助手|agent)/i, 3, 'AI'],
    [/(prompt|提示词|写作|writing|翻译|translation|总结|summary|会议|meeting|搜索|search|效率|productivity|自动化|automation|workflow)/i, 3, '效率场景'],
    [/(对话|chat|assistant|助手)/i, 2, '助手']
  ]],
  ['business-marketing', [
    [/(crm|营销|marketing|seo\b|销售|sales|客户|customer|客服|support|工单|ticket|反馈|feedback|投票|vote|项目管理|project management|团队协作|collaboration|招聘|recruit|hr\b|人力|办公|office)/i, 5, '商业运营'],
    [/(表单|form builder|newsletter|邮件营销|email marketing|增长|growth)/i, 3, '营销工具']
  ]],
  ['design-creative', [
    [/(设计|design|figma|原型|prototype|ui\b|ux\b|配色|color palette|字体|font|图标|icon)/i, 5, '设计'],
    [/(绘图|画图|image generation|图片生成|海报|poster|素材|asset|摄影|photo|修图|photo edit|视频剪辑|video editor|剪辑)/i, 4, '创意内容']
  ]],
  ['content-knowledge', [
    [/(笔记|note[- ]?taking|notes?\b|知识库|knowledge|wiki\b|markdown|文档|docs?\b|博客|blog|阅读|reader|稍后读|read later|rss\b|书签|bookmark|收藏|写作|writer|内容创作)/i, 5, '知识内容'],
    [/(脑图|mind map|大纲|outline|pdf\b|epub|电子书|ebook)/i, 3, '阅读整理']
  ]],
  ['data-analytics', [
    [/(数据分析|analytics|analyt|bi\b|business intelligence|dashboard|仪表盘|数据可视化|visualization|统计|metrics?|指标|埋点|tracking|采集|爬虫|crawler|etl\b|数据处理|data pipeline)/i, 5, '数据分析'],
    [/(报表|reporting|chart|图表)/i, 3, '报表可视化']
  ]],
  ['education', [
    [/(学习|教育|education|课程|course|题库|考试|exam|背单词|单词|vocabulary|语言学习|language learning|flashcard|记忆|study|学生|student|儿童教育)/i, 5, '教育学习']
  ]],
  ['finance', [
    [/(记账|账单|预算|budget|财务|finance|financial|发票|invoice|投资|invest|股票|stock|证券|基金|交易|trading|加密货币|crypto|bitcoin|支付|payment|收款)/i, 5, '金融财务']
  ]],
  ['ecommerce', [
    [/(电商|e-?commerce|在线商店|online store|商城|shop\b|购物|商品|product catalog|订单|order management|商家|merchant|二手|闲置交易|交易平台|marketplace)/i, 5, '电商交易']
  ]],
  ['social-community', [
    [/(社交|social|社区|community|论坛|forum|聊天|chat room|群聊|即时通讯|messaging|交友|dating|好友|friends|用户互动)/i, 5, '社交社区']
  ]],
  ['lifestyle-health', [
    [/(健康|health|健身|fitness|运动|workout|冥想|meditation|习惯|habit|睡眠|sleep|旅行|travel|行程|trip|天气|weather|菜谱|recipe|饮食|food|家庭|home|宠物|pet|日历|calendar|todo|待办)/i, 4, '生活健康']
  ]],
  ['media-entertainment', [
    [/(音乐|music|歌曲|song|音频|audio|播客|podcast|视频|video|影视|movie|电影|播放器|player|媒体服务|media server|spotify|字幕|subtitle)/i, 6, '媒体娱乐']
  ]],
  ['infrastructure-security', [
    [/(服务器|server|云服务|cloud|infra|基础设施|监控|monitoring|uptime|日志|logging|网络|network|dns\b|cdn\b|域名|domain|安全|security|密码|password|认证|auth|权限|permission|vpn\b|proxy|代理|防火墙|firewall|备份|backup|对象存储|storage)/i, 5, '基础设施/安全']
  ]],
  ['games', [
    [/(游戏|game\b|games\b|手游|独立游戏|steam\b|roguelike|rpg\b|棋牌|益智游戏)/i, 8, '游戏']
  ]]
]

const SUBCATEGORY_RULES = {
  'developer-tools': [
    ['AI 编程', /(ai 编程|claude code|codex|cursor|copilot|代码生成|code generation|mcp\b|agent.*开发|开发.*agent)/i],
    ['DevOps', /(devops|docker|kubernetes|k8s|ci\/cd|容器|运维)/i],
    ['API 工具', /(api\b|postman|webhook|http client|接口调试)/i],
    ['数据库工具', /(数据库|database|sql\b|redis|mysql|postgres|sqlite|mongodb)/i],
    ['测试与调试', /(测试|testing|debug|调试|mock\b|抓包)/i],
    ['IDE 与编辑器', /(ide\b|editor|编辑器|vscode|代码编辑)/i],
    ['终端与 SSH', /(terminal|终端|ssh\b|sftp\b)/i],
    ['部署', /(deploy|部署|hosting|托管)/i],
    ['代码与版本管理', /(git\b|github|代码仓库|version control)/i],
    ['开发者效率', /(开发效率|developer productivity|脚手架|模板|boilerplate|代码片段|snippet)/i]
  ],
  'ai-productivity': [
    ['AI 助手', /(assistant|助手|chatgpt|claude|gemini|deepseek|豆包|对话)/i],
    ['写作', /(写作|writing|writer|润色|改写)/i],
    ['翻译', /(翻译|translation|translator)/i],
    ['搜索', /(搜索|search|检索)/i],
    ['会议', /(会议|meeting|minutes|录音转写)/i],
    ['自动化', /(自动化|automation|workflow|agent)/i],
    ['Prompt 工具', /(prompt|提示词)/i],
    ['个人效率', /(效率|productivity|todo|任务|task|日程)/i]
  ],
  'business-marketing': [
    ['CRM', /crm|客户关系/i], ['营销', /营销|marketing|newsletter|增长/i], ['SEO', /seo/i], ['销售', /销售|sales/i],
    ['客户支持', /客服|support|工单|ticket/i], ['反馈', /反馈|feedback|投票/i], ['项目协作', /项目管理|project|协作|collaboration/i],
    ['办公效率', /办公|office|表单|form/i], ['招聘', /招聘|recruit|hr\b|人力/i]
  ],
  'design-creative': [
    ['图像创作', /图像|图片|绘图|image|海报|poster/i], ['视频创作', /视频|video|剪辑/i], ['设计工具', /设计|design|figma|ui\b|ux\b/i],
    ['原型', /原型|prototype/i], ['素材管理', /素材|asset|icon|图标|字体|font/i], ['摄影', /摄影|photo/i]
  ],
  'content-knowledge': [
    ['笔记', /笔记|notes?\b|note-taking/i], ['知识库', /知识库|knowledge|wiki/i], ['阅读', /阅读|reader|read later|epub|ebook/i],
    ['博客', /博客|blog/i], ['文档', /文档|docs?\b|markdown|pdf\b/i], ['书签', /书签|bookmark|收藏/i], ['RSS', /rss/i], ['内容创作', /内容创作|写作|writer/i]
  ],
  'data-analytics': [
    ['数据分析', /数据分析|analytics/i], ['BI 与仪表盘', /\bbi\b|dashboard|仪表盘/i], ['数据可视化', /visualization|可视化|chart|图表/i],
    ['数据采集', /采集|爬虫|crawler|tracking|埋点/i], ['ETL 与处理', /etl|pipeline|数据处理/i], ['监控指标', /metrics?|指标|统计/i]
  ],
  'education': [['语言学习', /语言|单词|vocabulary/i], ['考试题库', /考试|题库|exam/i], ['课程', /课程|course/i], ['记忆训练', /flashcard|记忆/i], ['儿童教育', /儿童|少儿/i], ['技能学习', /学习|study|技能/i]],
  'finance': [['记账与预算', /记账|预算|budget/i], ['投资', /投资|invest|基金|股票|stock/i], ['交易', /交易|trading/i], ['支付', /支付|payment|收款/i], ['发票与财务', /发票|invoice|财务/i], ['加密资产', /crypto|bitcoin|加密/i]],
  'ecommerce': [['在线商店', /商店|store|shop|商城/i], ['商品与订单', /商品|订单|order/i], ['商家工具', /商家|merchant/i], ['二手交易', /二手|闲置/i], ['支付结算', /支付|结算|payment/i]],
  'social-community': [['社区', /社区|community/i], ['聊天', /聊天|chat|messaging/i], ['论坛', /论坛|forum/i], ['社交网络', /社交|social/i], ['约会', /交友|dating/i], ['用户互动', /互动|评论|comment/i]],
  'lifestyle-health': [['健康', /健康|health/i], ['健身', /健身|fitness|运动|workout/i], ['习惯', /习惯|habit/i], ['旅行', /旅行|travel|trip|行程/i], ['饮食', /菜谱|recipe|饮食|food/i], ['家庭', /家庭|home|宠物|pet/i], ['天气', /天气|weather/i], ['日程生活', /日历|calendar|todo|待办/i]],
  'media-entertainment': [['音乐', /音乐|music|spotify/i], ['播客', /播客|podcast/i], ['视频', /视频|video/i], ['影视', /影视|movie|电影/i], ['播放器', /player|播放器/i], ['媒体服务', /media server|媒体服务|自托管.*音乐|音乐.*自托管/i]],
  'infrastructure-security': [['云与服务器', /server|服务器|cloud|云服务/i], ['网络', /network|网络|dns|cdn|域名/i], ['安全', /security|安全|防火墙|firewall/i], ['认证与权限', /auth|认证|权限|password|密码/i], ['监控', /monitoring|监控|uptime|日志/i], ['代理与 VPN', /proxy|代理|vpn/i], ['存储与备份', /storage|存储|backup|备份/i]],
  'games': [['游戏', /./]],
  'other': [['其他', /./]]
}

const TAG_RULES = {
  audience: [
    ['developer', /(开发者|程序员|developer|coding|api\b|sdk\b|cli\b|代码|devops|数据库|database|ssh\b)/i],
    ['creator', /(创作者|creator|写作|设计|视频|图像|内容创作|blog)/i],
    ['designer', /(designer|设计师|figma|ui\b|ux\b)/i], ['marketer', /(marketing|营销|seo|增长)/i],
    ['student', /(学生|student|学习|study|考试|课程)/i], ['team', /(团队|team|collaboration|协作|多人)/i],
    ['enterprise', /(企业|enterprise|组织|organization|b2b)/i], ['merchant', /(商家|merchant|电商|shop|store)/i],
    ['sysadmin', /(运维|sysadmin|server|服务器|ssh|docker|kubernetes)/i], ['consumer', /(个人|用户|consumer|生活|音乐|健康|旅行|社交)/i]
  ],
  platform: [
    ['ios', /(\bios\b|iphone|ipad|app store|苹果手机)/i], ['android', /(android|安卓|google play)/i], ['macos', /(macos|mac os|\bmac\b)/i],
    ['windows', /(windows|win11|win10)/i], ['linux', /(linux|ubuntu|debian)/i], ['browser', /(chrome|firefox|edge|浏览器|browser extension|浏览器插件)/i],
    ['wechat', /(微信|wechat|小程序)/i], ['vscode', /(vscode|visual studio code)/i], ['web', /(web|网页|网站|在线|saas|http)/i]
  ],
  productForm: [
    ['browser-extension', /(chrome(?:\s+\w+){0,2}\s+插件|chrome extension|浏览器插件|浏览器扩展|extension)/i], ['desktop-app', /(桌面应用|desktop|macos|windows app|客户端)/i],
    ['mobile-app', /(ios|android|iphone|安卓|app store|google play|移动应用|手机 app)/i], ['cli', /(\bcli\b|命令行|command line)/i],
    ['api', /(\bapi\b|接口服务)/i], ['sdk', /(\bsdk\b)/i], ['plugin', /(plugin|插件|vscode extension|figma plugin)/i],
    ['self-hosted', /(self[- ]?hosted|自托管|私有部署|本地部署)/i], ['bot', /(bot\b|机器人)/i], ['saas', /(saas|订阅制|在线服务)/i],
    ['web-app', /(web app|网页应用|在线工具|网站)/i]
  ],
  characteristics: [
    ['open-source', /(开源|open[- ]?source|github\.com\/[^/]+\/[^/]+)/i], ['self-hosted', /(self[- ]?hosted|自托管|私有部署)/i],
    ['local-first', /(local[- ]?first|本地优先|本地数据|本机)/i], ['privacy-focused', /(隐私|privacy|私有|密码和私钥不会|端侧)/i],
    ['offline', /(离线|offline)/i], ['no-code', /(no[- ]?code|零代码|无代码)/i], ['ai-native', /(ai-native|ai 原生|人工智能|\bai\b|llm|chatgpt|claude|agent)/i]
  ],
  capabilities: [
    ['ai', /(人工智能|\bai\b|llm|chatgpt|claude|gemini|deepseek|豆包)/i], ['agent', /(agent|智能体)/i], ['automation', /(自动化|automation)/i],
    ['collaboration', /(协作|collaboration|多人|team)/i], ['analytics', /(analytics|分析|统计|指标|dashboard)/i], ['search', /(搜索|search|检索)/i],
    ['workflow', /(workflow|工作流|流程)/i], ['ssh', /\bssh\b/i], ['sftp', /\bsftp\b/i], ['docker', /docker/i], ['kubernetes', /(kubernetes|k8s)/i],
    ['translation', /(翻译|translation)/i], ['ocr', /\bocr\b|文字识别/i], ['writing', /(写作|writing|润色|改写)/i], ['image-generation', /(图片生成|图像生成|image generation)/i],
    ['video', /(视频|video)/i], ['note-taking', /(笔记|note-taking|notes?\b)/i], ['monitoring', /(监控|monitoring|uptime)/i], ['database', /(数据库|database|sql\b)/i],
    ['api', /\bapi\b/i], ['testing', /(测试|testing|debug|调试)/i], ['deployment', /(部署|deploy)/i], ['music', /(音乐|music)/i], ['audio', /(音频|audio)/i],
    ['podcast', /(播客|podcast)/i], ['sharing', /(分享|sharing)/i], ['media-server', /(media server|媒体服务|自托管.*音乐|音乐.*自托管)/i], ['crm', /crm/i], ['seo', /seo/i],
    ['feedback', /(反馈|feedback)/i], ['payments', /(支付|payment|收款)/i], ['finance', /(财务|finance|投资|股票|预算|记账)/i], ['education', /(学习|教育|课程|考试)/i],
    ['security', /(安全|security|密码|auth|认证)/i], ['vpn', /vpn/i], ['proxy', /(proxy|代理)/i], ['backup', /(backup|备份)/i], ['sync', /(同步|sync)/i],
    ['markdown', /markdown/i], ['rss', /rss/i], ['bookmark', /(bookmark|书签|收藏)/i], ['email', /(email|邮件)/i], ['calendar', /(calendar|日历)/i],
    ['task-management', /(task management|任务管理|todo|待办)/i], ['prompt-management', /(prompt|提示词)/i], ['chat-management', /(对话|chat)/i], ['code-generation', /(代码生成|code generation|coding agent)/i]
  ]
}

function scoreCategories(record, value) {
  const scores = new Map()
  const signals = new Map()
  for (const [category, rules] of CATEGORY_RULES) {
    let score = 0
    const matched = []
    for (const [pattern, weight, label] of rules) {
      if (matches(value, pattern)) {
        score += weight
        matched.push(label)
      }
    }
    scores.set(category, score)
    signals.set(category, matched)
  }

  if (record.category === 'game') scores.set('games', (scores.get('games') || 0) + 10)
  if (record.category === 'developer-tool') scores.set('developer-tools', (scores.get('developer-tools') || 0) + 1.5)

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1])
  const [bestCategory, bestScore] = ranked[0] || ['other', 0]
  const secondScore = ranked[1]?.[1] || 0
  const category = bestScore >= 4 ? bestCategory : 'other'
  const selectedSignals = category === 'other' ? [] : (signals.get(category) || [])
  const confidence = category === 'other'
    ? 0.35
    : Math.min(0.98, 0.58 + Math.min(bestScore, 14) * 0.02 + Math.min(Math.max(bestScore - secondScore, 0), 8) * 0.025)
  return { category, confidence: Number(confidence.toFixed(2)), selectedSignals }
}

function classifySubcategories(category, value) {
  const rules = SUBCATEGORY_RULES[category] || []
  const found = rules.filter(([, pattern]) => matches(value, pattern)).map(([label]) => label)
  if (found.length) return found.slice(0, 3)
  if (category === 'other') return ['其他']
  return []
}

function classifyTags(value) {
  return Object.fromEntries(Object.entries(TAG_RULES).map(([namespace, rules]) => [
    namespace,
    rules.filter(([, pattern]) => matches(value, pattern)).map(([tag]) => tag).slice(0, namespace === 'capabilities' ? 10 : 5)
  ]))
}

export function classifyProduct(record, taxonomyVersion = '1.0') {
  const value = text(record)
  const scored = scoreCategories(record, value)
  const subCategories = classifySubcategories(scored.category, value)
  const tags = classifyTags(value)
  const evidence = [
    ...scored.selectedSignals.map((signal) => `category:${signal}`),
    ...subCategories.map((item) => `sub:${item}`),
    ...Object.entries(tags).flatMap(([namespace, values]) => values.slice(0, 2).map((tag) => `${namespace}:${tag}`))
  ].slice(0, 10)

  return {
    productId: record.id,
    primaryCategory: scored.category,
    subCategories,
    tags,
    confidence: scored.confidence,
    taxonomyVersion,
    signals: evidence
  }
}

export function classifyProducts(records, taxonomyVersion = '1.0') {
  return records.map((record) => classifyProduct(record, taxonomyVersion))
}
