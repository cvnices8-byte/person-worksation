export const modules = [
  {
    id: "data-ai",
    short: "DS",
    name: "数据科学与 AI",
    targetHours: 14,
    color: "#2d5bff",
    description: "Python、SQL、统计、机器学习与项目实践",
  },
  {
    id: "cpa",
    short: "CPA",
    name: "CPA",
    targetHours: 10,
    color: "#dd4d3f",
    description: "以年度大纲为轴的章节学习、做题与复习",
  },
  {
    id: "civil",
    short: "公考",
    name: "考公考编",
    targetHours: 8,
    color: "#7d5abb",
    description: "行测专项、申论输出与限时训练",
  },
  {
    id: "english",
    short: "EN",
    name: "英语",
    targetHours: 7,
    color: "#16806a",
    description: "口语、通用英语、专业英语与论文表达",
  },
  {
    id: "career",
    short: "CARE",
    name: "求职维护",
    targetHours: 1,
    color: "#b27b21",
    description: "每周摘要、能力缺口与材料维护",
  },
  {
    id: "review",
    short: "REV",
    name: "复盘",
    targetHours: 2,
    color: "#53636d",
    description: "周计划、问题诊断与 Obsidian 导出",
  },
];

export const starterTasks = [
  {
    title: "完成一个数据科学深度学习块",
    moduleId: "data-ai",
    minutes: 120,
  },
  { title: "CPA 章节学习与基础题", moduleId: "cpa", minutes: 90 },
  { title: "行测专项训练", moduleId: "civil", minutes: 90 },
  { title: "论文英语：摘要精读与复述", moduleId: "english", minutes: 60 },
];

export const yearlyPhases = [
  {
    id: "foundation",
    name: "打底",
    weeks: "第 1–12 周",
    objective: "建立稳定节奏，补齐必要基础。",
    evidence: "每个主模块完成一份基线测评与首个可展示成果。",
  },
  {
    id: "system",
    name: "成体系",
    weeks: "第 13–26 周",
    objective: "从零散学习进入完整知识树。",
    evidence: "形成 CPA 章节框架、数据项目与英语表达素材库。",
  },
  {
    id: "reinforce",
    name: "强化",
    weeks: "第 27–39 周",
    objective: "用错题、限时训练与项目迭代暴露短板。",
    evidence: "完成阶段模考、项目复盘和专业英文输出。",
  },
  {
    id: "sprint",
    name: "冲刺",
    weeks: "第 40–52 周",
    objective: "围绕考试与成果交付收束投入。",
    evidence: "形成可考试、可面试、可复用的最终成果集。",
  },
];

export const learningPaths = {
  "data-ai": [
    { id: "ds-python-sql", title: "Python 与 SQL", focus: "数据处理、查询与可复现分析", output: "完成一份真实数据分析报告" },
    { id: "ds-statistics", title: "统计与实验", focus: "概率、推断、回归与 A/B 测试", output: "解释一组业务实验结果" },
    { id: "ds-analysis", title: "分析与可视化", focus: "指标体系、探索分析与信息表达", output: "制作一份面向决策的数据故事" },
    { id: "ds-ml", title: "机器学习", focus: "建模、验证、特征与误差分析", output: "交付一个带评估报告的模型" },
    { id: "ds-dl", title: "深度学习", focus: "神经网络、Transformer 与训练流程", output: "复现一个小型模型实验" },
    { id: "ds-ai", title: "AI 系统", focus: "LLM、RAG、智能体、评测与工程边界", output: "构建一个可演示的 AI 工具" },
  ],
  cpa: [
    { id: "cpa-framework", title: "会计框架", focus: "准则逻辑、分录与报表勾稽", output: "画出章节框架并完成基础题" },
    { id: "cpa-core", title: "核心科目推进", focus: "按年度教材与大纲逐章学习", output: "形成章节笔记与题型索引" },
    { id: "cpa-errors", title: "错题回炉", focus: "定位概念、条件与计算错误", output: "建立可重复复习的错题卡" },
    { id: "cpa-cases", title: "综合案例", focus: "跨章节判断、计算与书面表达", output: "完成限时综合题与复盘" },
  ],
  civil: [
    { id: "civil-baseline", title: "基线测评", focus: "行测各模块正确率与速度", output: "获得分模块能力基线" },
    { id: "civil-special", title: "行测专项", focus: "资料、判断、言语与数量", output: "形成稳定解题流程" },
    { id: "civil-writing", title: "申论表达", focus: "概括、分析、对策与文章", output: "每周完成一份限时输出" },
    { id: "civil-mock", title: "整卷模考", focus: "时间分配、取舍与复盘", output: "连续记录分数和失分原因" },
  ],
  english: [
    { id: "en-vocabulary", title: "主动词汇", focus: "词族、搭配、例句与间隔回忆", output: "建立能说能写的表达库" },
    { id: "en-listening", title: "听力与语音", focus: "精听、影子跟读、重音与连读", output: "完成逐句听写和跟读录音" },
    { id: "en-speaking", title: "口语输出", focus: "复述、观点陈述与自我纠错", output: "完成 3–5 分钟无稿表达" },
    { id: "en-writing", title: "结构化写作", focus: "段落逻辑、论证与改写", output: "完成一篇短文并建立错误清单" },
    { id: "en-professional", title: "专业英语", focus: "数据、AI 与财务场景表达", output: "完成一次专业概念英文讲解" },
    { id: "en-paper", title: "论文英语", focus: "摘要、方法、结果与局限表达", output: "用英文讲清一篇专业论文" },
  ],
  career: [
    { id: "career-direction", title: "方向维护", focus: "数据、AI 与财务交叉岗位", output: "更新目标岗位画像" },
    { id: "career-evidence", title: "经历证据库", focus: "项目、技能与量化结果", output: "维护可复用的简历素材" },
    { id: "career-market", title: "窗口观察", focus: "9–10 月与 3–4 月招聘节奏", output: "每周保留一次市场摘要" },
    { id: "career-switch", title: "模式切换", focus: "招聘窗口前的材料与练习", output: "在需要时切换为求职主线" },
  ],
  review: [
    { id: "review-facts", title: "收集事实", focus: "时间、成果、错题与身体状态", output: "导出本周客观数据" },
    { id: "review-diagnose", title: "诊断问题", focus: "拖延、难度、精力与任务定义", output: "找到一个主要约束" },
    { id: "review-adjust", title: "调整投入", focus: "增加、减少、保持与暂停", output: "给下周设置三个关键成果" },
    { id: "review-archive", title: "沉淀 Obsidian", focus: "长期规划与决策留痕", output: "完成一篇周复盘" },
  ],
};

export const moduleMilestones = {
  "data-ai": ["Python / SQL 基础", "统计与数据分析", "机器学习", "端到端项目"],
  cpa: ["年度大纲", "章节理解", "错题回炉", "综合案例"],
  civil: ["资料与判断", "言语与数量", "申论", "限时模考"],
  english: ["核心词汇", "听力与跟读", "论文英语", "口头表达"],
  career: ["方向维护", "JD 能力提取", "经历库", "阶段切换"],
  review: ["周数据", "问题诊断", "下周调整", "导出 Obsidian"],
};

export function moduleById(id) {
  return modules.find((item) => item.id === id);
}

export const fallbackPapers = [
  {
    id: "1706.03762",
    title: "Attention Is All You Need",
    summary: "Introduces the Transformer architecture, replacing recurrence with attention for sequence modeling.",
    url: "https://arxiv.org/abs/1706.03762",
    source: "基础精选",
  },
  {
    id: "1810.04805",
    title: "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding",
    summary: "Presents bidirectional Transformer pre-training and fine-tuning for language understanding tasks.",
    url: "https://arxiv.org/abs/1810.04805",
    source: "基础精选",
  },
  {
    id: "1512.03385",
    title: "Deep Residual Learning for Image Recognition",
    summary: "Introduces residual learning to make very deep neural networks easier to optimize.",
    url: "https://arxiv.org/abs/1512.03385",
    source: "基础精选",
  },
  {
    id: "1603.02754",
    title: "XGBoost: A Scalable Tree Boosting System",
    summary: "Describes a scalable tree boosting system widely used for structured data problems.",
    url: "https://arxiv.org/abs/1603.02754",
    source: "基础精选",
  },
  {
    id: "2005.14165",
    title: "Language Models are Few-Shot Learners",
    summary: "Studies how scale enables language models to perform tasks from instructions and examples in context.",
    url: "https://arxiv.org/abs/2005.14165",
    source: "基础精选",
  },
];
