const cleanText = (record) => [
  record.productName,
  record.description,
  record.sourceCategory
].filter(Boolean).join(' ').toLowerCase()
  .replace(/(?:没有|无需|不使用|不上传|不写入|无须)[^，。；]{0,12}(?:数据库|database)/gi, ' ')

const PRIMARY_RULES = [
  ['developer-tools', [
    [/(开发者工具|开发工具|程序员|编程|coding|developer tool|devtool|代码编辑|代码编辑器|源码管理|代码仓库|version control|git\b|ide\b|vscode|代码审查|code review|代码格式化|formatter|linter|包管理|package manager)/i, 6, '开发工具'],
    [/(api\b|sdk\b|cli\b|命令行|terminal|终端|ssh\b|sftp\b|docker|kubernetes|k8s|devops|webhook|http client|接口调试|接口测试|单元测试|测试框架|debug|调试|mock\b|mcp\b)/i, 6, '工程能力'],
    [/(数据库管理|database client|database tool|sql client|sql editor|mysql|postgres|sqlite|mongodb|redis client)/i, 6, '数据库工具'],
    [/(claude code|codex|cursor|copilot|ai 编程|ai coding|ai 开发|开发工作台|coding agent|代码生成|code generation)/i, 10, 'AI 编程']
  ]],
  ['ai-productivity', [
    [/(人工智能|\bai\b|chatgpt|llm|claude|gemini|deepseek|豆包|大模型|智能助手|ai助手|agent|智能体)/i, 4, 'AI'],
    [/(效率|productivity|自动化|automation|workflow|工作流|待办|todo|任务管理|日程|calendar|日历|提醒|reminder|会议|meeting|录音转写|总结|summary)/i, 5, '效率场景'],
    [/(prompt|提示词|写作|writing|翻译|translation|搜索|search|检索|问答|对话|assistant|助手)/i, 3, '知识工作']
  ]],
  ['business-marketing', [[/(crm|客户关系|营销|marketing|推广|seo\b|销售|sales|客服|客户支持|工单|反馈|feedback|投票|招聘|recruit|人力资源|hr\b|newsletter|邮件营销|增长工具|项目管理|团队协作|协同办公|办公协作|企业管理|企业服务|erp\b|oa\b|进销存|排班|工时|表单|问卷|survey|预约管理|门店管理|商户管理)/i, 6, '商业运营']]],
  ['design-creative', [[/(设计工具|design tool|figma|原型|prototype|ui\s*设计|ux\s*设计|配色|字体工具|图标工具|绘图|画图|图片生成|图像生成|image generation|海报|信息图|infographic|素材生成|素材管理|摄影|photo editor|图片编辑|修图|抠图|背景移除|去背景|视频剪辑|video editor|视频生成|video generation|logo|logo 设计|3d 建模|3d modeling)/i, 6, '设计创意']]],
  ['content-knowledge', [[/(笔记|note[- ]?taking|知识库|knowledge base|wiki\b|markdown|文档管理|文档编辑|博客|blog|阅读器|reader|稍后读|read later|rss\b|书签|bookmark|收藏管理|写作工具|内容创作|电子书|ebook|epub|脑图|mind map|思维导图|文本编辑|信息管理|知识管理|新闻聚合|news reader|词典|dictionary)/i, 6, '内容知识']]],
  ['data-analytics', [[/(数据分析|data analytics|analytics platform|business intelligence|\bbi\b|dashboard|仪表盘|数据可视化|data visualization|埋点|数据采集|crawler|爬虫|etl\b|data pipeline|统计分析|分析平台|数据处理|数据清洗|data processing|charting|图表工具|指标平台)/i, 6, '数据分析']]],
  ['education', [[/(教育|education|教师|老师|课堂|classroom|课程|course|题库|考试|exam|quiz|刷题|背单词|单词学习|vocabulary|语言学习|flashcard|学习工具|学习平台|学生工具|儿童教育|少儿学习|专注力训练|记忆训练|技能学习|training|教程|tutorial)/i, 6, '教育学习']]],
  ['finance', [[/(记账|账单管理|预算|budget|财务|finance|发票|invoice|投资|invest|股票|stock|证券|基金|trading|交易策略|加密货币|crypto|bitcoin|支付工具|支付|收款|汇率|currency|理财|税务|tax\b)/i, 6, '金融财务']]],
  ['ecommerce', [[/(电商|e-?commerce|在线商店|online store|商城|购物平台|购物|shopping|商品管理|订单管理|商家工具|二手交易|闲置交易|marketplace|比价|价格比较|返利|shop\b|店铺)/i, 6, '电商交易']]],
  ['social-community', [[/(社交|social network|社区|community|论坛|forum|群聊|chat room|聊天室|即时通讯|messaging|交友|dating|好友|用户社区|群组|兴趣社区|匿名社交|评论社区|用户互动)/i, 6, '社交社区']]],
  ['lifestyle-health', [[/(健康|health|健身|fitness|运动记录|workout|冥想|meditation|习惯追踪|habit tracker|睡眠|sleep|旅行|travel|行程规划|trip planner|导航|navigation|地图|map\b|天气|weather|菜谱|recipe|饮食|diet|热量|calorie|家庭管理|家庭|宠物|pet|医疗|medicine|心理|wellbeing|租房|房产|home automation|智能家居)/i, 5, '生活健康']]],
  ['media-entertainment', [
    [/(音乐|music|歌曲|song|播客|podcast|影视|movie|电影|播放器|media player|music player|video player|媒体服务|media server|spotify|字幕|subtitle|音频播放|漫画|comic|小说|novel|动漫|anime|直播|live stream|radio|电台|youtube|bilibili|弹幕)/i, 7, '媒体娱乐'],
    [/(音频|audio|视频|video)/i, 2, '媒体']
  ]],
  ['infrastructure-security', [[/(服务器管理|server management|云服务|cloud service|基础设施|infrastructure|运维平台|监控平台|网站监控|ssl\s*证书|uptime|日志平台|网络工具|网络诊断|dns\b|cdn\b|域名管理|安全工具|网络安全|security tool|认证服务|权限管理|身份认证|authentication|密码管理|password manager|2fa|totp|vpn\b|proxy\b|代理工具|防火墙|firewall|备份工具|对象存储|云存储|storage service)/i, 6, '基础设施']]],
  ['utilities', [
    [/(系统工具|实用工具|utility|文件管理|文件传输|文件分享|下载工具|下载管理|download manager|磁盘清理|剪贴板|clipboard|输入法|截图工具|截图美化|二维码|qr code|压缩工具|解压|格式转换|文件转换|converter|excel.*pdf|pdf.*(?:转换|合并|拆分)|计时器|timer|倒计时|calculator|计算器|单位转换|设备查询|标签管理|文件标签|窗口管理|窗口停靠|画中画|picture[- ]?in[- ]?picture|启动项|壁纸|wallpaper|网盘客户端|鼠标工具|键盘工具|快捷键|launcher|启动器|菜单栏工具|状态栏工具|浏览器增强)/i, 6, '实用工具'],
    [/(下载|download|传输|transfer|转换|convert|清理|cleaner|同步|sync|分享|sharing)/i, 3, '通用工具'],
    [/(工具|tool\b)/i, 4, '通用工具']
  ]],
  ['games', [[/(游戏|game\b|games\b|手游|独立游戏|steam\b|roguelike|rpg\b|棋牌|益智游戏)/i, 9, '游戏']]]
]

const SUB_RULES = {
  'developer-tools': [
    ['AI 编程', /(ai 编程|ai coding|claude code|codex|cursor|copilot|代码生成|code generation|mcp\b)/i], ['DevOps', /(devops|docker|kubernetes|k8s|ci\/cd|容器|运维)/i],
    ['API 工具', /(api\b|webhook|http client|接口调试|接口测试)/i], ['数据库工具', /(数据库管理|database client|sql client|mysql|postgres|sqlite|mongodb|redis client)/i],
    ['测试与调试', /(接口测试|单元测试|测试框架|debug|调试|mock\b)/i], ['IDE 与编辑器', /(ide\b|vscode|代码编辑器|code editor)/i],
    ['终端与 SSH', /(terminal|终端|ssh\b|sftp\b)/i], ['部署', /(deploy|部署|hosting|托管)/i], ['代码与版本管理', /(git\b|代码仓库|version control)/i],
    ['开发者效率', /(formatter|linter|包管理|package manager|代码审查|code review)/i]
  ],
  'ai-productivity': [
    ['AI 助手', /(assistant|助手|chatgpt|claude|gemini|deepseek|豆包|对话|问答)/i], ['写作', /(写作|writing|润色|改写)/i], ['翻译', /(翻译|translation)/i],
    ['搜索', /(搜索|search|检索)/i], ['会议', /(会议|meeting|录音转写)/i], ['自动化', /(自动化|automation|workflow|agent|智能体)/i], ['Prompt 工具', /(prompt|提示词)/i],
    ['个人效率', /(效率|productivity|待办|todo|任务管理|日程|calendar|日历|提醒|reminder)/i]
  ],
  'business-marketing': [['CRM', /crm|客户关系/i], ['营销', /营销|marketing|推广|增长/i], ['SEO', /seo/i], ['销售', /销售|sales/i], ['客户支持', /客服|工单|客户支持/i], ['反馈', /反馈|feedback/i], ['招聘', /招聘|recruit|人力|hr\b/i], ['项目协作', /项目管理|团队协作|协同/i], ['办公效率', /办公|erp|oa|表单|问卷|排班|工时/i]],
  'design-creative': [['图像创作', /(图像|图片|绘图|海报|修图|抠图|背景|logo)/i], ['视频创作', /(视频剪辑|video editor|视频生成|video generation)/i], ['设计工具', /(设计|design|figma|ui\b|ux\b)/i], ['原型', /原型|prototype/i], ['素材管理', /素材/i], ['摄影', /摄影|photo/i]],
  'content-knowledge': [['笔记', /笔记|note-taking/i], ['知识库', /知识库|knowledge base|wiki/i], ['阅读', /阅读|reader|epub|ebook|词典|dictionary/i], ['博客', /博客|blog/i], ['文档', /文档|markdown|pdf/i], ['书签', /书签|bookmark/i], ['RSS', /rss/i], ['内容创作', /内容创作|写作工具|文本编辑/i]],
  'data-analytics': [['数据分析', /数据分析|analytics/i], ['BI 与仪表盘', /\bbi\b|dashboard|仪表盘/i], ['数据可视化', /可视化|visualization|图表/i], ['数据采集', /采集|爬虫|crawler|埋点/i], ['ETL 与处理', /etl|数据处理|数据清洗|pipeline/i]],
  'education': [['语言学习', /语言学习|单词|vocabulary/i], ['考试题库', /考试|题库|exam|quiz|刷题/i], ['课程', /课程|course|教程|tutorial/i], ['记忆训练', /flashcard|记忆/i], ['儿童教育', /儿童|少儿/i], ['技能学习', /技能学习|training/i]],
  'finance': [['记账与预算', /记账|预算|budget/i], ['投资', /投资|股票|基金/i], ['交易', /trading|交易策略/i], ['支付', /支付|收款/i], ['发票与财务', /发票|财务|税务|tax/i], ['加密资产', /crypto|bitcoin|加密货币/i]],
  'ecommerce': [['在线商店', /商店|store|商城|shop/i], ['商品与订单', /商品管理|订单/i], ['商家工具', /商家|merchant|店铺/i], ['二手交易', /二手|闲置/i], ['支付结算', /支付|结算/i]],
  'social-community': [['社区', /社区|community/i], ['聊天', /群聊|chat room|messaging|聊天室/i], ['论坛', /论坛|forum/i], ['社交网络', /社交|social/i], ['约会', /交友|dating/i], ['用户互动', /评论|互动|群组/i]],
  'lifestyle-health': [['健康', /健康|health|医疗|medicine|心理|wellbeing/i], ['健身', /健身|fitness|运动/i], ['习惯', /习惯|habit/i], ['旅行', /旅行|travel|行程|导航|地图/i], ['天气', /天气|weather/i], ['饮食', /菜谱|recipe|饮食|diet|热量/i], ['家庭', /家庭|宠物|智能家居/i], ['日程生活', /日历|todo|待办|提醒/i]],
  'media-entertainment': [['音乐', /音乐|music|spotify/i], ['播客', /播客|podcast/i], ['视频', /视频|video|直播/i], ['影视', /影视|movie|电影/i], ['播放器', /player|播放器/i], ['媒体服务', /media server|媒体服务|漫画|小说|动漫|radio|电台/i]],
  'infrastructure-security': [['云与服务器', /server|服务器|cloud|云服务/i], ['网络', /network|网络|dns|cdn|域名/i], ['安全', /安全|security|密码|password|2fa|totp/i], ['认证与权限', /认证|authentication|权限/i], ['监控', /monitoring|监控|uptime/i], ['代理与 VPN', /vpn|proxy|代理/i], ['存储与备份', /storage|存储|backup|备份/i]],
  'utilities': [['文件工具', /(文件管理|文件传输|下载|download|网盘|压缩|解压)/i], ['系统工具', /(磁盘|剪贴板|输入法|窗口管理|窗口停靠|画中画|启动项|壁纸|鼠标|键盘|快捷键|launcher|菜单栏|状态栏)/i], ['转换工具', /(转换|convert|pdf|excel)/i], ['计时与计算', /(计时|timer|倒计时|calculator|计算器)/i], ['截图与二维码', /(截图|二维码|qr code)/i], ['设备工具', /设备|device/i]],
  'games': [['游戏', /./]],
  'other': [['其他', /./]]
}

const TAG_RULES = {
  audience: [
    ['developer', /(开发者|程序员|developer|coding|api\b|sdk\b|cli\b|代码|devops|ssh\b)/i], ['creator', /(创作者|creator|写作|设计|视频剪辑|图像生成|内容创作|blog)/i],
    ['designer', /(设计师|designer|figma|ui\b|ux\b)/i], ['marketer', /(marketing|营销|seo|增长)/i], ['student', /(学生|student|学习|考试|课程)/i],
    ['team', /(团队|team|协作|多人)/i], ['enterprise', /(企业|enterprise|组织|b2b)/i], ['merchant', /(商家|merchant|电商|商城)/i], ['sysadmin', /(运维|服务器管理|ssh|docker|kubernetes)/i],
    ['consumer', /(个人|用户|生活|音乐|健康|旅行|社交|家庭|宠物)/i]
  ],
  platform: [
    ['ios', /(\bios\b|iphone|ipad|app store)/i], ['android', /(android|安卓|google play)/i], ['macos', /(macos|mac os|\bmac\b)/i], ['windows', /windows/i], ['linux', /(linux|ubuntu|debian)/i],
    ['browser', /(chrome|firefox|edge|浏览器|browser extension|浏览器插件)/i], ['wechat', /(微信|wechat|小程序)/i], ['vscode', /vscode/i], ['web', /(web|网页|网站|在线|saas|http)/i]
  ],
  productForm: [
    ['browser-extension', /(chrome(?:\s+\w+){0,2}\s+插件|chrome extension|浏览器插件|浏览器扩展)/i], ['desktop-app', /(桌面应用|desktop app|macos app|windows app|桌面客户端)/i],
    ['mobile-app', /(\bios\b|android|iphone|安卓|app store|google play|移动应用)/i], ['cli', /(\bcli\b|命令行)/i], ['api', /\bapi\b/i], ['sdk', /\bsdk\b/i], ['plugin', /(plugin|插件)/i],
    ['self-hosted', /(self[- ]?hosted|自托管|私有部署|本地部署)/i], ['bot', /(bot\b|机器人)/i], ['saas', /saas/i], ['web-app', /(web app|网页应用|在线工具)/i]
  ],
  characteristics: [
    ['open-source', /(开源|open[- ]?source)/i], ['self-hosted', /(self[- ]?hosted|自托管|私有部署)/i], ['local-first', /(local[- ]?first|本地优先|本地数据|本机存储)/i],
    ['privacy-focused', /(隐私|privacy|私有部署|端侧)/i], ['offline', /(离线|offline)/i], ['no-code', /(no[- ]?code|零代码|无代码)/i], ['ai-native', /(ai-native|ai 原生|人工智能|\bai\b|llm|chatgpt|claude|agent|智能体)/i]
  ],
  capabilities: [
    ['ai', /(人工智能|\bai\b|llm|chatgpt|claude|gemini|deepseek|豆包)/i], ['agent', /(agent|智能体)/i], ['automation', /(自动化|automation)/i], ['collaboration', /(协作|多人|team)/i],
    ['analytics', /(analytics|数据分析|dashboard)/i], ['search', /(搜索|search|检索)/i], ['workflow', /(workflow|工作流)/i], ['ssh', /\bssh\b/i], ['sftp', /\bsftp\b/i], ['docker', /docker/i], ['kubernetes', /(kubernetes|k8s)/i],
    ['translation', /(翻译|translation)/i], ['ocr', /\bocr\b|文字识别/i], ['writing', /(写作|writing|润色|改写)/i], ['image-generation', /(图片生成|图像生成|image generation)/i], ['video', /(视频|video)/i],
    ['note-taking', /(笔记|note-taking)/i], ['monitoring', /(监控|monitoring|uptime)/i], ['database', /(数据库管理|database client|sql client)/i], ['api', /\bapi\b/i], ['testing', /(接口测试|单元测试|测试框架|debug|调试)/i],
    ['deployment', /(部署|deploy)/i], ['music', /(音乐|music)/i], ['audio', /(音频|audio)/i], ['podcast', /(播客|podcast)/i], ['sharing', /(分享|sharing)/i], ['crm', /crm/i], ['seo', /seo/i], ['feedback', /(反馈|feedback)/i],
    ['payments', /(支付|收款)/i], ['finance', /(财务|投资|股票|预算|记账|汇率|理财|税务)/i], ['education', /(学习|教育|课程|考试|quiz|题库)/i], ['security', /(安全|security|密码|password|2fa|totp)/i], ['vpn', /\bvpn\b/i], ['proxy', /(\bproxy\b|代理工具)/i],
    ['backup', /(backup|备份)/i], ['sync', /(同步|sync)/i], ['markdown', /markdown/i], ['rss', /\brss\b/i], ['bookmark', /(bookmark|书签)/i], ['email', /(email|邮件)/i], ['calendar', /(calendar|日历)/i],
    ['task-management', /(任务管理|todo|待办)/i], ['prompt-management', /(prompt|提示词)/i], ['code-generation', /(代码生成|code generation|coding agent)/i]
  ]
}

const hasAny = (values, expected) => expected.some((value) => values.includes(value))

function classifyPrimary(record, value) {
  const ranked = PRIMARY_RULES.map(([category, rules]) => {
    let score = 0
    const signals = []
    for (const [pattern, weight, label] of rules) {
      if (pattern.test(value)) {
        score += weight
        signals.push(label)
      }
    }
    if (category === 'games' && record.category === 'game') {
      score += 12
      signals.push('来源游戏分类')
    }
    if (category === 'developer-tools' && record.category === 'developer-tool') {
      score += 1.5
      signals.push('来源程序员清单')
    }
    return { category, score, signals }
  }).sort((a, b) => b.score - a.score)

  const best = ranked[0] || { category: 'other', score: 0, signals: [] }
  const second = ranked[1]?.score || 0
  if (best.score < 4) return { category: 'other', confidence: 0.35, signals: [], method: 'other' }
  const gap = Math.max(0, best.score - second)
  const confidence = Math.min(0.98, 0.58 + Math.min(best.score, 14) * 0.022 + Math.min(gap, 8) * 0.022)
  return { category: best.category, confidence: Number(confidence.toFixed(2)), signals: best.signals, method: 'rules' }
}

function classifyTags(value, record) {
  const tags = Object.fromEntries(Object.entries(TAG_RULES).map(([namespace, rules]) => [
    namespace,
    rules.filter(([, pattern]) => pattern.test(value)).map(([tag]) => tag).slice(0, namespace === 'capabilities' ? 10 : 5)
  ]))
  const url = String(record.productUrl || '').toLowerCase()
  if (/github\.com\/[^/]+\/[^/]+/.test(url) && !tags.characteristics.includes('open-source')) tags.characteristics.push('open-source')
  if (/chromewebstore\.google\.com/.test(url)) {
    if (!tags.platform.includes('browser')) tags.platform.push('browser')
    if (!tags.productForm.includes('browser-extension')) tags.productForm.push('browser-extension')
  }
  return tags
}

function classifyFallback(record, value, tags) {
  const capabilities = tags.capabilities || []
  const audience = tags.audience || []
  const forms = tags.productForm || []

  const candidates = [
    ['developer-tools', hasAny(capabilities, ['code-generation', 'database', 'testing', 'deployment', 'ssh', 'sftp', 'docker', 'kubernetes']) || (capabilities.includes('api') && audience.includes('developer')), 0.72, '能力标签'],
    ['design-creative', hasAny(capabilities, ['image-generation']), 0.7, '创意能力标签'],
    ['data-analytics', hasAny(capabilities, ['analytics']), 0.68, '分析能力标签'],
    ['finance', hasAny(capabilities, ['finance', 'payments']), 0.7, '金融能力标签'],
    ['education', hasAny(capabilities, ['education']), 0.68, '教育能力标签'],
    ['infrastructure-security', hasAny(capabilities, ['security', 'vpn', 'proxy', 'backup', 'monitoring']), 0.7, '基础设施能力标签'],
    ['business-marketing', hasAny(capabilities, ['crm', 'seo', 'feedback']), 0.68, '商业能力标签'],
    ['media-entertainment', hasAny(capabilities, ['music', 'audio', 'podcast']), 0.68, '媒体能力标签'],
    ['content-knowledge', hasAny(capabilities, ['note-taking', 'markdown', 'rss', 'bookmark']), 0.66, '内容能力标签'],
    ['ai-productivity', hasAny(capabilities, ['ai', 'agent', 'prompt-management', 'translation', 'writing', 'automation', 'workflow']), 0.66, '效率能力标签'],
    ['lifestyle-health', hasAny(capabilities, ['calendar', 'task-management']) && audience.includes('consumer'), 0.62, '个人生活能力标签'],
    ['utilities', forms.includes('browser-extension') || /(?:窗口|画中画|快捷键|菜单栏|状态栏|桌面增强|浏览器增强|文件|剪贴板|截图|二维码|下载|转换|同步|分享)/i.test(value), 0.62, '通用工具兜底']
  ]
  const matched = candidates.find(([, match]) => match)
  if (matched) return { category: matched[0], confidence: matched[2], signals: [matched[3]], method: 'semantic-fallback' }

  if (record.category === 'developer-tool') {
    return { category: 'developer-tools', confidence: 0.58, signals: ['来源程序员清单兜底'], method: 'source-fallback' }
  }
  if (record.category === 'game') {
    return { category: 'games', confidence: 0.8, signals: ['来源游戏分类兜底'], method: 'source-fallback' }
  }

  return { category: 'other', confidence: 0.45, signals: ['未命中现有领域语义'], method: 'other' }
}

export function classifyProduct(record, taxonomyVersion = '1.1') {
  const value = cleanText(record)
  const tags = classifyTags(value, record)
  let primary = classifyPrimary(record, value)
  if (primary.category === 'other') primary = classifyFallback(record, value, tags)
  const subCategories = (SUB_RULES[primary.category] || []).filter(([, pattern]) => pattern.test(value)).map(([label]) => label).slice(0, 3)
  if (primary.category === 'other' && !subCategories.length) subCategories.push('其他')
  const signals = [
    ...primary.signals.map((signal) => `category:${signal}`),
    ...subCategories.map((item) => `sub:${item}`),
    ...Object.entries(tags).flatMap(([namespace, values]) => values.slice(0, 2).map((tag) => `${namespace}:${tag}`))
  ].slice(0, 10)
  return {
    productId: record.id,
    primaryCategory: primary.category,
    subCategories,
    tags,
    confidence: primary.confidence,
    classificationMethod: primary.method,
    taxonomyVersion,
    signals
  }
}

export function classifyProducts(records, taxonomyVersion = '1.1') {
  return records.map((record) => classifyProduct(record, taxonomyVersion))
}
