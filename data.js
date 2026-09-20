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
