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
  await mobile.locator('[data-english-view="expressions"]').click();
  if (!(await mobile.locator("#expression-draft").isVisible())) throw new Error("移动端日常用语训练未显示");
  await mobile.locator('[data-english-view="shadowing"]').click();
  await mobile.locator('[data-shadow-mode="dictation"]').click();
  if (!(await mobile.locator("#dictation-answer").isVisible())) throw new Error("移动端精听听写未显示");
  await mobile.screenshot({ path: path.join(output, "mobile-english.png"), fullPage: true });

  if (consoleErrors.length) throw new Error(`Console errors: ${consoleErrors.join(" | ")}`);
  await browser.close();
  console.log(`Smoke tests passed. Screenshots: ${output}`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
