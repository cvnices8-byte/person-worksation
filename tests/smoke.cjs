const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

(async () => {
  const output = "/tmp/personal-workstation-tests";
  const baseUrl = process.env.TEST_URL || "http://127.0.0.1:4173";
  fs.mkdirSync(output, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const consoleErrors = [];
  await page.route("https://huggingface.co/api/daily_papers", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{" }),
  );
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto(baseUrl);
  await page.waitForLoadState("networkidle");

  if (!(await page.getByRole("heading", { name: "把今天学扎实。" }).isVisible())) throw new Error("首页标题未显示");
  if ((await page.locator(".task-item").count()) !== 4) throw new Error("初始任务数量不正确");

  await page.getByRole("button", { name: "安排今天" }).click();
  if ((await page.locator(".planner-row").count()) !== 4) throw new Error("自动排课未生成四个学习块");
  await page.getByRole("button", { name: "应用今日计划" }).click();
  await page.locator("#planner-dialog").waitFor({ state: "hidden" });

  await page.locator(".task-check").first().check();
  await page.waitForSelector(".task-item.is-done");
  if ((await page.locator(".task-item.is-done").count()) !== 1) throw new Error("任务完成状态未保存");

  await page.getByRole("button", { name: "记录学习" }).click();
  await page.locator("#session-form select[name=moduleId]").selectOption("cpa");
  await page.locator("#session-form input[name=minutes]").fill("45");
  await page.locator("#session-form textarea[name=note]").fill("完成CPA会计章节练习");
  await page.locator("#session-form button[type=submit]").click();
  await page.waitForFunction(() => document.querySelector("#today-hours")?.textContent === "0.8");
  if ((await page.locator("#today-hours").innerText()) !== "0.8") throw new Error("学习时长未更新");

  await page.locator('[data-view="modules"]').click();
  if (!(await page.getByRole("heading", { name: "长线投入分成四次清晰推进。" }).isVisible())) throw new Error("年度路线未显示");
  const dataModule = page.locator(".module-card").filter({ has: page.getByRole("heading", { name: "数据科学与 AI" }) });
  if ((await dataModule.locator(".course-unit").count()) !== 6) throw new Error("数据科学课程树不完整");
  await dataModule.locator('[data-course-unit="ds-python-sql"]').check();
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".module-card")].some((card) => card.textContent.includes("数据科学与 AI") && card.textContent.includes("1 / 6 个阶段完成")),
  );
  if ((await page.locator(".theory-stage").count()) !== 6) throw new Error("理论学习主线不完整");
  await page.locator('[data-studio-view="resources"]').click();
  if ((await page.locator(".resource-row").count()) < 10) throw new Error("官方课程资源不完整");
  if (!(await page.getByRole("link", { name: /Machine Learning in Python with scikit-learn/ }).isVisible())) throw new Error("机器学习主课未显示");
  await page.locator('[data-studio-view="code"]').click();
  if ((await page.locator(".exercise-link").count()) !== 8) throw new Error("代码练习数量不正确");
  await page.locator('[data-exercise-id="agent-state-machine"]').click();
  await page.locator("#code-editor").fill("def agent_loop():\n    return 'draft'\n");
  await page.getByRole("button", { name: "保存草稿" }).click();
  await page.getByRole("button", { name: "标记完成" }).click();
  await page.waitForFunction(() => document.querySelector("#toggle-exercise")?.textContent.includes("已完成"));
  if (!(await page.locator("#toggle-exercise").innerText()).includes("已完成")) throw new Error("代码练习完成状态未更新");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: path.join(output, "code-lab.png"), fullPage: true });
  await page.locator('[data-studio-view="theory"]').click();
  await page.screenshot({ path: path.join(output, "modules.png"), fullPage: true });

  if (!(await page.getByRole("heading", { name: "CPA 学习工作台" }).isVisible())) throw new Error("CPA 学习工作台未显示");
  if ((await page.locator("[data-cpa-view]").count()) !== 5) throw new Error("CPA 工作台视图不完整");
  await page.locator('[data-cpa-view="map"]').click();
  if ((await page.locator("[data-cpa-subject]").count()) !== 6) throw new Error("CPA 六科地图不完整");
  if ((await page.locator("[data-cpa-chapter]").count()) !== 30) throw new Error("会计 30 章目录不完整");
  const cpaSubjectChapterCounts = { auditing: 8, finance: 7, tax: 14, law: 12, strategy: 8 };
  for (const [subjectId, chapterCount] of Object.entries(cpaSubjectChapterCounts)) {
    await page.locator(`[data-cpa-subject="${subjectId}"]`).click();
    await page.waitForFunction(({ id, count }) => document.querySelector(`[data-cpa-subject="${id}"]`)?.classList.contains("is-active") && document.querySelectorAll("[data-cpa-chapter]").length === count, { id: subjectId, count: chapterCount });
  }
  await page.locator('[data-cpa-subject="accounting"]').click();
  await page.locator('[data-cpa-open-chapter="1"]').click();
  if ((await page.locator("#cpa-chapter-reader h4").innerText()) !== "存货") throw new Error("CPA 后续章节无法打开");
  if (!(await page.locator('[data-cpa-open-chapter="1"]').locator("xpath=..").getAttribute("class")).includes("is-active")) throw new Error("CPA 当前章节状态未更新");
  await page.screenshot({ path: path.join(output, "cpa-chapter-map.png"), fullPage: true });
  await page.getByRole("button", { name: "用 AI 学本章" }).click();
  if ((await page.locator("#cpa-tutor-chapter").inputValue()) !== "存货") throw new Error("CPA 章节未传递到 AI 辅导");
  await page.locator('[data-cpa-view="map"]').click();
  await page.locator('[data-cpa-chapter="accounting:0"]').check();
  await page.waitForFunction(() => document.querySelector("#cpa-map")?.textContent.includes("1 / 30"));
  await page.locator('[data-cpa-view="drill"]').click();
  if ((await page.locator("[data-cpa-drill-subject]").count()) !== 6) throw new Error("CPA 练题科目不完整");
  await page.locator('[data-cpa-answer="0"]').click();
  if (!(await page.locator(".cpa-answer-note").innerText()).includes("正确答案 B")) throw new Error("CPA 即时解析未显示");
  await page.getByRole("button", { name: "记入错题簿" }).click();
  await page.locator('[data-cpa-view="errors"]').click();
  if ((await page.locator(".cpa-error").count()) !== 1) throw new Error("CPA 错题未保存");
  await page.getByRole("button", { name: "标记已解决" }).click();
  await page.locator(".cpa-error.is-resolved").waitFor();
  if ((await page.locator(".cpa-error.is-resolved").count()) !== 1) throw new Error("CPA 错题解决状态未保存");
  await page.locator('[data-cpa-view="tutor"]').click();
  await page.locator("#cpa-tutor-mode").selectOption("practice");
  await page.locator("#cpa-tutor-material").fill("我不清楚收入确认五步法。 ");
  await page.getByRole("button", { name: "生成辅导提示" }).click();
  if (!(await page.locator("#cpa-tutor-output").inputValue()).includes("先只出题")) throw new Error("CPA AI 辅导提示未生成");
  await page.locator('[data-cpa-view="today"]').click();
  await page.locator('[data-cpa-block="theory"]').click();
  await page.waitForFunction(() => document.querySelector("#cpa-today")?.textContent.includes("35 / 90 分钟"));
  await page.screenshot({ path: path.join(output, "cpa-studio.png"), fullPage: true });

  if (!(await page.getByRole("heading", { name: "考公考编训练台" }).isVisible())) throw new Error("考公考编训练台未显示");
  if ((await page.locator("[data-civil-view]").count()) !== 4) throw new Error("考公考编视图不完整");
  await page.locator('[data-civil-view="aptitude"]').click();
  if ((await page.locator("[data-civil-module-id]").count()) !== 5) throw new Error("行测五模块不完整");
  if ((await page.locator(".civil-perspective-strip details").count()) !== 7) throw new Error("蒸馏解题视角不完整");
  if ((await page.locator("[data-civil-topic]").count()) !== 6) throw new Error("资料分析题型目录不完整");
  await page.locator('[data-civil-open-topic="1"]').click();
  if ((await page.locator("#civil-topic-reader h4").innerText()) !== "增长量与增长率") throw new Error("行测知识点未能独立打开");
  if (!(await page.locator('.civil-topic.is-active [data-civil-open-topic="1"] em').innerText()).includes("学习中")) throw new Error("行测知识点选中状态未显示");
  if ((await page.locator(".civil-topic-levels > div").count()) !== 3) throw new Error("行测知识点三层学习框架不完整");
  await page.locator('[data-civil-topic="data-analysis:0"]').check();
  await page.locator('[data-civil-answer="0"]').click();
  if (!(await page.locator(".civil-answer").innerText()).includes("正确答案 B")) throw new Error("行测即时解析未显示");
  const civilModuleTopics = { quant: "工程问题", verbal: "中心理解", reasoning: "翻译推理", common: "法律常识" };
  for (const [moduleId, topic] of Object.entries(civilModuleTopics)) {
    await page.locator(`[data-civil-module-id="${moduleId}"]`).click();
    if ((await page.locator("#civil-topic-reader h4").innerText()) !== topic) throw new Error(`行测 ${moduleId} 知识点地图切换失败`);
    if ((await page.locator("[data-civil-topic]").count()) !== 6) throw new Error(`行测 ${moduleId} 知识点目录不完整`);
  }
  await page.locator('[data-civil-module-id="quant"]').click();
  if (!(await page.locator(".civil-question h4").innerText()).includes("甲单独完成")) throw new Error("行测模块对应练习切换失败");
  await page.screenshot({ path: path.join(output, "civil-topic-map.png"), fullPage: true });
  await page.locator('[data-civil-view="shenlun"]').click();
  if ((await page.locator("[data-shenlun-type]").count()) !== 4) throw new Error("申论四类任务不完整");
  await page.locator("#shenlun-material").fill("某地通过公开议事、线上反馈和跟踪问效提升公共服务质量。群众从旁观者转变为参与者。");
  await page.locator("#shenlun-answer").fill("一是公开议事，拓宽群众参与渠道；二是线上反馈，及时回应群众诉求；三是跟踪问效，提升服务质量。");
  if (!(await page.locator("#shenlun-word-count").innerText()).includes("字")) throw new Error("申论字数统计未更新");
  await page.getByRole("button", { name: "保存草稿" }).click();
  await page.getByRole("button", { name: "生成批改提示" }).click();
  if (!(await page.locator("#shenlun-prompt-output").inputValue()).includes("核对材料采分点")) throw new Error("申论批改提示未生成");
  await page.getByRole("button", { name: "完成本次作答" }).click();
  await page.waitForFunction(() => document.querySelector("#civil-summary")?.textContent.includes("1申论作答"));
  await page.locator('[data-civil-view="errors"]').click();
  if ((await page.locator(".civil-error-book article").count()) !== 1) throw new Error("行测错题未自动保存");
  await page.locator("[data-civil-error-reason]").selectOption({ label: "方法选错" });
  await page.getByRole("button", { name: "标记已解决" }).click();
  await page.locator(".civil-error-book article.is-resolved").waitFor();
  await page.locator('[data-civil-view="aptitude"]').click();
  await page.screenshot({ path: path.join(output, "civil-studio.png"), fullPage: true });

  if (!(await page.getByRole("heading", { name: "英语训练台" }).isVisible())) throw new Error("英语训练台未显示");
  if ((await page.locator("[data-english-view]").count()) !== 5) throw new Error("英语训练视图不完整");
  if (!(await page.locator(".quick-translation").innerText()).includes("这一结论")) throw new Error("语法短课中文翻译未显示");
  const quickAnswers = [0, 1, 1, 1, 1];
  for (let index = 0; index < quickAnswers.length; index += 1) {
    await page.locator(`[data-lesson-answer="${quickAnswers[index]}"]`).click();
    if (index === 0 && !(await page.locator(".quick-feedback").innerText()).includes("中文语法说明")) throw new Error("中文语法说明未显示");
    await page.locator("#next-quick-lesson").click();
  }
  await page.waitForFunction(() => document.querySelector("#english-today-stats")?.textContent.includes("10/60"));
  await page.locator('[data-english-view="vocabulary"]').click();
  if (!(await page.getByRole("button", { name: "显示答案" }).isVisible())) throw new Error("词汇回忆卡未显示");
  const dueBefore = Number(await page.locator(".vocabulary-ledger strong").first().innerText());
  await page.getByRole("button", { name: "显示答案" }).click();
  if (!(await page.locator(".word-answer").isVisible())) throw new Error("词汇答案未揭示");
  await page.locator('[data-vocab-rating="good"]').click();
  await page.waitForFunction((previous) => Number(document.querySelector(".vocabulary-ledger strong")?.textContent) < previous, dueBefore);
  await page.locator('[data-english-view="expressions"]').click();
  if ((await page.locator("[data-expression-index]").count()) !== 12) throw new Error("日常用语场景不完整");
  if (!(await page.locator(".expression-translation").innerText()).includes("解释一下")) throw new Error("日常用语中文翻译未显示");
  await page.locator("#expression-draft").fill("Could you clarify what you mean by a reliable model?");
  await page.getByRole("button", { name: "保存表达" }).click();
  await page.getByRole("button", { name: "完成并练下一句" }).click();
  await page.waitForFunction(() => document.querySelector("#english-today-stats")?.textContent.includes("21/60"));
  await page.locator('[data-english-view="shadowing"]').click();
  if ((await page.locator("[data-shadow-mode]").count()) !== 3) throw new Error("回声、听写与自选材料模式不完整");
  await page.getByRole("button", { name: "完成本轮跟读" }).click();
  await page.waitForFunction(() => document.querySelector("#english-today-stats")?.textContent.includes("31/60"));
  await page.locator('[data-shadow-mode="dictation"]').click();
  await page.locator("#dictation-answer").fill("We cannot infer causality from correlation alone.");
  await page.getByRole("button", { name: "检查听写" }).click();
  if (!(await page.locator(".dictation-result").innerText()).includes("100%")) throw new Error("听写即时校对失败");
  await page.locator('[data-shadow-mode="custom"]').click();
  await page.locator("#custom-material-input").fill("This is my first custom sentence. I want to practice with real research abstracts.");
  await page.getByRole("button", { name: "切分并保存材料" }).click();
  await page.waitForFunction(() => document.querySelectorAll("[data-custom-index]").length === 2);
  if ((await page.locator("[data-custom-index]").count()) !== 2) throw new Error("自选材料切句失败");
  await page.locator('[data-english-view="paper"]').click();
  await page.locator('#paper-english-form input[name="question"]').fill("This paper investigates how a model can learn useful representations from data.");
  await page.locator('#paper-english-form textarea[name="summary"]').fill("This paper studies a practical machine learning problem and proposes a clear modeling approach. The authors evaluate the method on several datasets and compare it with strong baselines. Their results suggest that the proposed design improves performance, although the evidence should be interpreted carefully because the experiments cover only a limited set of tasks and conditions.");
  await page.getByRole("button", { name: "保存草稿" }).click();
  await page.getByRole("button", { name: "完成本次训练" }).click();
  await page.waitForFunction(() => document.querySelector("#english-today-stats")?.textContent.includes("51/60"));
  await page.locator('[data-english-view="today"]').click();
  await page.screenshot({ path: path.join(output, "english-studio.png"), fullPage: true });

  await page.locator('[data-view="papers"]').click();
  await page.waitForFunction(() => document.querySelectorAll(".daily-paper").length >= 4);
  if (!(await page.locator("#paper-feed-status").innerText()).includes("本机基础精选")) throw new Error("离线论文推荐未启用");
  if ((await page.locator(".paper-filter").count()) !== 4) throw new Error("论文领域筛选不完整");
  await page.getByRole("button", { name: "财务", exact: true }).click();
  if ((await page.locator(".daily-paper").count()) < 3) throw new Error("财务论文精选不足");
  if (!(await page.locator(".daily-paper").first().innerText()).match(/FinBERT|BloombergGPT|FinGPT|Finance/)) throw new Error("财务论文筛选失败");
  await page.locator("[data-start-paper]").first().click();
  if (!(await page.locator("#paper-form input[name=title]").inputValue())) throw new Error("论文推荐未加入精读台");
  await page.screenshot({ path: path.join(output, "paper-feed.png"), fullPage: true });
  await page.locator("#paper-form input[name=title]").fill("A test paper");
  await page.locator("#paper-form textarea[name=insight]").fill("验证专业理解记录。");
  await page.locator("#paper-form textarea[name=summary]").fill("This paper tests the study workflow.");
  await page.locator("#paper-form button[type=submit]").click();
  await page.getByRole("heading", { name: "A test paper" }).waitFor();
  if (!(await page.getByRole("heading", { name: "A test paper" }).isVisible())) throw new Error("论文学习包未显示");

  await page.locator('[data-view="health"]').click();
  await page.locator("#health-form input[name=weight]").fill("82.5");
  await page.locator("#health-form input[name=sleep]").fill("7.5");
  await page.locator("#health-form select[name=training]").selectOption("上肢力量");
  await page.locator("#health-form button[type=submit]").click();
  await page.waitForFunction(() => document.querySelector(".health-number")?.textContent.includes("82.5"));
  if (!(await page.locator(".health-number").innerText()).includes("82.5")) throw new Error("健康记录未显示");

  await page.locator('[data-view="review"]').click();
  if (!(await page.getByRole("heading", { name: "本周事实" }).isVisible())) throw new Error("复盘摘要未显示");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载本周复盘" }).click();
  const download = await downloadPromise;
  if (!download.suggestedFilename().endsWith(".md")) throw new Error("周报文件格式不正确");

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: path.join(output, "desktop.png"), fullPage: true });

  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(`${baseUrl}/#today`);
  await mobile.waitForLoadState("networkidle");
  if (!(await mobile.getByRole("heading", { name: "把今天学扎实。" }).isVisible())) throw new Error("移动端首页未显示");
  await mobile.screenshot({ path: path.join(output, "mobile.png"), fullPage: true });
  await mobile.locator('[data-view="modules"]').click();
  await mobile.locator('[data-studio-view="code"]').click();
  if (!(await mobile.locator("#code-editor").isVisible())) throw new Error("移动端代码实验台未显示");
  await mobile.screenshot({ path: path.join(output, "mobile-code-lab.png"), fullPage: true });
  await mobile.locator('[data-cpa-view="map"]').click();
  if (!(await mobile.locator("#cpa-map").isVisible())) throw new Error("移动端 CPA 六科地图未显示");
  await mobile.locator('[data-civil-view="aptitude"]').click();
  if (!(await mobile.locator("#civil-aptitude").isVisible())) throw new Error("移动端行测专项未显示");
  if (!(await mobile.locator("#civil-topic-reader").isVisible())) throw new Error("移动端行测知识点阅读器未显示");
  await mobile.locator('[data-civil-view="shenlun"]').click();
  if (!(await mobile.locator("#shenlun-answer").isVisible())) throw new Error("移动端申论工坊未显示");
  await mobile.locator('[data-english-view="expressions"]').click();
  if (!(await mobile.locator("#expression-draft").isVisible())) throw new Error("移动端日常用语训练未显示");
  await mobile.locator('[data-english-view="shadowing"]').click();
  await mobile.locator('[data-shadow-mode="dictation"]').click();
  if (!(await mobile.locator("#dictation-answer").isVisible())) throw new Error("移动端精听听写未显示");
  await mobile.screenshot({ path: path.join(output, "mobile-english.png"), fullPage: true });

  await page.locator('[data-view="modules"]').click();
  await page.locator('[data-workspace="civil"]').click();
  if (await page.locator('.cpa-studio').isVisible()) throw new Error('专注模式未隐藏其他工作台');
  if (await page.locator('#module-board').isVisible()) throw new Error('专注模式未隐藏概览');
  if (!(await page.locator('.civil-studio').isVisible())) throw new Error('专注模式隐藏了当前工作台');
  await page.screenshot({ path: path.join(output, 'focused-desktop.png'), animations: 'disabled' });
  await page.locator('[data-workspace="civil"]').press('ArrowRight');
  if (!(await page.locator('.english-studio').isVisible())) throw new Error('键盘切换工作台失败');
  await page.locator('[data-view="health"]').click();
  await page.goBack();
  await page.locator('#view-modules.is-active').waitFor();
  await page.locator('[data-workspace="all"]').click();
  if (!(await page.locator('.cpa-studio').isVisible())) throw new Error('退出专注模式失败');
  await mobile.locator('[data-workspace="civil"]').click();
  await mobile.locator('[data-civil-view="aptitude"]').click();
  await mobile.screenshot({ path: path.join(output, 'focused-mobile.png'), animations: 'disabled' });
  if (await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw new Error('移动端出现横向溢出');
  if (consoleErrors.length) throw new Error(`Console errors: ${consoleErrors.join(" | ")}`);
  await browser.close();
  console.log(`Smoke tests passed. Screenshots: ${output}`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
