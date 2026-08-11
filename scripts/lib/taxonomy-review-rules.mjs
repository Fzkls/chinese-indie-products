const productText = (record) => [record.productName, record.description, record.sourceCategory].filter(Boolean).join(' ').toLowerCase()

const REVIEWED_SEMANTIC_RULES = [
  {
    category: 'utilities',
    subCategories: ['转换工具'],
    pattern: /(image\s*to\s*excel|图片[^，。；]{0,24}(?:表格|excel)|识别[^，。；]{0,24}表格[^，。；]{0,24}excel|ocr[^，。；]{0,24}excel)/i,
    reason: '图片/表格识别后转换为 Excel 属于明确的文档转换实用工具'
  }
]

export function applyReviewedSemanticRule(record, classification) {
  if (classification.primaryCategory !== 'other') return classification
  const value = productText(record)
  const matched = REVIEWED_SEMANTIC_RULES.find((rule) => rule.pattern.test(value))
  if (!matched) return classification
  return {
    ...classification,
    primaryCategory: matched.category,
    subCategories: matched.subCategories,
    confidence: 0.92,
    classificationMethod: 'reviewed-rule',
    reviewStatus: 'reviewed',
    reviewReason: matched.reason,
    reviewPreviousPrimaryCategory: classification.primaryCategory,
    reviewPreviousMethod: classification.classificationMethod,
    signals: [`review:semantic-rule`, `review:primary:${matched.category}`, ...(classification.signals || [])].slice(0, 10)
  }
}
