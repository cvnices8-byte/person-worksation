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
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto(baseUrl);
  await page.waitForLoadState("networkidle");

  if (!(await page.getByRole("heading", { name: "把今天学扎实。" }).isVisible())) throw new Error("首页标题未显示");
  if ((await page.locator(".task-item").count()) !== 4) throw new Error("初始任务数量不正确");
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

  await page.locator('[data-view="papers"]').click();
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

  if (consoleErrors.length) throw new Error(`Console errors: ${consoleErrors.join(" | ")}`);
  await browser.close();
  console.log(`Smoke tests passed. Screenshots: ${output}`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
