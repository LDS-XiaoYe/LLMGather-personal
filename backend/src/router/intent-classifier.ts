export interface IntentResult {
  intent: string;
  confidence: number;
  matchedKeywords: string[];
}

interface IntentRule {
  name: string;
  keywords: RegExp[];
  weight: number;
}

const RULES: IntentRule[] = [
  {
    name: 'coding',
    keywords: [
      /code|debug|refactor|bug|fix|function|class|api|endpoint|algorithm|compile|runtime|error|exception|import\b|require\b|module|package|npm|pip|docker|k8s|kubernetes|git\b|commit|merge|pull.request|typescript|javascript|python|java|rust|golang?|react|vue|angular|nestjs?|express|sql|database|query|migration|test|unit.test/i,
    ],
    weight: 3,
  },
  {
    name: 'translation',
    keywords: [
      /translate|翻译|翻成|译成|英译|汉译|中译/i,
    ],
    weight: 5,
  },
  {
    name: 'creative',
    keywords: [
      /write|写|创作|故事|小说|诗歌|剧本|文案|广告|slogan|歌词|散文|作文|blog|article|essay|生成.*文|帮我写|请写/i,
    ],
    weight: 4,
  },
  {
    name: 'reasoning',
    keywords: [
      /reason|推理|演绎|归纳|逻辑|证明|推导|math|数学|计算|公式|定理|为何|为什么|分析原因|解释|explain|justify|proof|prove|disprove|假设|hypothes/i,
    ],
    weight: 3,
  },
  {
    name: 'vision',
    keywords: [
      /vision|image|图片|照片|看图|识图|OCR|识别.*文字|描述.*图|这张图|图中|画面|截图|屏幕.*图/i,
    ],
    weight: 5,
  },
  {
    name: 'summary',
    keywords: [
      /summarize|总结|摘要|概括|归纳|提炼|简述|概述|tl;dr|太长不看/i,
    ],
    weight: 4,
  },
  {
    name: 'data',
    keywords: [
      /data|数据|分析|统计|图表|excel|csv|json|xml|parse|解析|提取|清洗|ETL|pipeline|可视化|visualize/i,
    ],
    weight: 2,
  },
];

const GENERAL_INTENT = 'general';

export function classifyIntent(userMessage: string): IntentResult {
  const text = userMessage.trim();
  if (!text) {
    return { intent: GENERAL_INTENT, confidence: 1, matchedKeywords: [] };
  }

  const scores: Record<string, number> = {};
  const matches: Record<string, string[]> = {};

  for (const rule of RULES) {
    let matchCount = 0;
    const matchedPatterns: string[] = [];
    for (const kw of rule.keywords) {
      const m = text.match(kw);
      if (m) {
        matchCount++;
        matchedPatterns.push(m[0]);
      }
    }
    if (matchCount > 0) {
      scores[rule.name] = matchCount * rule.weight;
      matches[rule.name] = matchedPatterns;
    }
  }

  const entries = Object.entries(scores);
  if (entries.length === 0) {
    return { intent: GENERAL_INTENT, confidence: 1, matchedKeywords: [] };
  }

  // Pick highest-scoring intent
  entries.sort((a, b) => b[1] - a[1]);
  const [bestIntent, bestScore] = entries[0];

  // Confidence: ratio of best score to total
  const totalScore = entries.reduce((sum, [, s]) => sum + s, 0);
  const confidence = Math.min(1, Math.round((bestScore / totalScore) * 10) / 10);

  return {
    intent: bestIntent,
    confidence,
    matchedKeywords: matches[bestIntent] ?? [],
  };
}

/** Get the canonical intent names for display */
export function getIntentLabel(intent: string): string {
  const labels: Record<string, string> = {
    coding: '编程开发',
    translation: '翻译',
    creative: '创意写作',
    reasoning: '逻辑推理',
    vision: '视觉理解',
    summary: '摘要总结',
    data: '数据分析',
    general: '通用对话',
  };
  return labels[intent] ?? intent;
}
