import { db } from "./db.js";
import { moduleById, moduleMilestones, modules, starterTasks } from "./data.js";

const state = {
  tasks: [],
  sessions: [],
  papers: [],
  health: [],
};

const viewTitles = {
  today: "把今天学扎实。",
  modules: "建立可以迁移的能力。",
  papers: "读懂，也讲得清。",
  health: "让身体支撑长期投入。",
  review: "把数据变成下一步。",
};

const todayKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function startOfWeek(date = new Date()) {
  const result = new Date(date);
  const weekday = result.getDay() || 7;
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - weekday + 1);
  return result;
}

function formatMinutes(minutes) {
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}小时${remainder}分` : `${hours}小时`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function seedTodayTasks() {
  const existing = state.tasks.filter((task) => task.date === todayKey());
  if (existing.length) return;

  for (const task of starterTasks) {
    await db.put("tasks", {
      ...task,
      id: crypto.randomUUID(),
      date: todayKey(),
      done: false,
      createdAt: new Date().toISOString(),
    });
  }
  state.tasks = await db.getAll("tasks");
}

function currentWeekSessions() {
  const start = startOfWeek();
  return state.sessions.filter((session) => new Date(session.createdAt) >= start);
}

function todaySessions() {
  return state.sessions.filter((session) => session.date === todayKey());
}

function renderRuler() {
  const sessions = todaySessions();
  const minutes = sessions.reduce((sum, item) => sum + Number(item.minutes), 0);
  const hours = minutes / 60;
  document.querySelector("#today-hours").textContent = hours.toFixed(1);

  const track = document.querySelector("#ruler-track");
  track.innerHTML = sessions
    .map((session) => {
      const module = moduleById(session.moduleId) || modules[0];
      const width = Math.min((Number(session.minutes) / 360) * 100, 100);
      return `<span class="ruler-segment" title="${escapeHtml(module.name)} ${formatMinutes(session.minutes)}" style="width:${width}%;background:${module.color}"></span>`;
    })
    .join("");

  const status =
    minutes === 0
      ? "从第一个专注块开始。"
      : minutes < 180
        ? "已经启动，继续守住深度。"
        : minutes < 360
          ? "过半了，下一块只做一个明确结果。"
          : "今日标准计划已完成。";
  document.querySelector("#day-status").textContent = status;
}

function renderTasks() {
  const list = document.querySelector("#task-list");
  const tasks = state.tasks
    .filter((task) => task.date === todayKey())
    .sort((a, b) => Number(a.done) - Number(b.done));

  if (!tasks.length) {
    list.innerHTML = '<div class="empty-state">今天还没有任务。先添加一个可以验证的学习结果。</div>';
    return;
  }

  list.innerHTML = tasks
    .map((task) => {
      const module = moduleById(task.moduleId) || modules[0];
      return `
        <label class="task-item ${task.done ? "is-done" : ""}">
          <input class="task-check" type="checkbox" data-task-id="${task.id}" ${task.done ? "checked" : ""} />
          <span class="task-copy">
            <strong>${escapeHtml(task.title)}</strong>
            <span style="color:${module.color}">${escapeHtml(module.name)}</span>
          </span>
          <span class="task-minutes">${formatMinutes(task.minutes)}</span>
        </label>`;
    })
    .join("");

  list.querySelectorAll("[data-task-id]").forEach((checkbox) => {
    checkbox.addEventListener("change", async () => {
      const task = state.tasks.find((item) => item.id === checkbox.dataset.taskId);
      task.done = checkbox.checked;
      await db.put("tasks", task);
      renderTasks();
      renderReview();
    });
  });
}

function renderWeekProgress() {
  const sessions = currentWeekSessions();
  const targetTotal = modules.reduce((sum, module) => sum + module.targetHours, 0);
  const container = document.querySelector("#week-progress");
  container.innerHTML = modules
    .map((module) => {
      const minutes = sessions
        .filter((session) => session.moduleId === module.id)
        .reduce((sum, session) => sum + Number(session.minutes), 0);
      const hours = minutes / 60;
      const progress = Math.min((hours / module.targetHours) * 100, 100);
      return `
        <div class="progress-row">
          <div class="progress-row-head">
            <span>${escapeHtml(module.name)}</span>
            <span>${hours.toFixed(1)} / ${module.targetHours}h</span>
          </div>
          <div class="progress-track" title="周总目标 ${targetTotal} 小时">
            <div class="progress-fill" style="width:${progress}%;background:${module.color}"></div>
          </div>
        </div>`;
    })
    .join("");
}

function renderRecentSessions() {
  const container = document.querySelector("#recent-sessions");
  const recent = [...state.sessions]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);
  if (!recent.length) {
    container.innerHTML = '<div class="empty-state">完成一个学习块后，记录会出现在这里。</div>';
    return;
  }
  container.innerHTML = recent
    .map((session) => {
      const module = moduleById(session.moduleId) || modules[0];
      return `<div class="recent-item">
        <span class="recent-dot" style="background:${module.color}"></span>
        <span><strong>${escapeHtml(module.name)}</strong><br>${escapeHtml(session.note || "完成学习记录")}</span>
        <span>${formatMinutes(session.minutes)}</span>
      </div>`;
    })
    .join("");
}

function renderModules() {
  document.querySelector("#module-board").innerHTML = modules
    .map((module) => `
      <article class="module-card">
        <div class="module-card-head">
          <span class="module-code" style="background:${module.color}">${module.short}</span>
          <span>${module.targetHours}h / 周</span>
        </div>
        <h3>${escapeHtml(module.name)}</h3>
        <p>${escapeHtml(module.description)}</p>
        <div class="milestone-list">
          ${moduleMilestones[module.id].map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
        </div>
      </article>`)
    .join("");
}

function renderPapers() {
  const container = document.querySelector("#paper-list");
  const papers = [...state.papers].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (!papers.length) {
    container.innerHTML = '<div class="empty-state">还没有论文学习包。第一篇可以只读摘要、引言与结论。</div>';
    return;
  }
  container.innerHTML = papers
    .map((paper) => `
      <article class="paper-card">
        <h3>${escapeHtml(paper.title)}</h3>
        ${paper.url ? `<a href="${escapeHtml(paper.url)}" target="_blank" rel="noreferrer">打开原文</a>` : ""}
        ${paper.insight ? `<p><strong>专业：</strong>${escapeHtml(paper.insight)}</p>` : ""}
        ${paper.summary ? `<p><strong>English：</strong>${escapeHtml(paper.summary)}</p>` : ""}
      </article>`)
    .join("");
}

function renderHealth() {
  const container = document.querySelector("#health-summary");
  const latest = [...state.health].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  if (!latest) {
    container.innerHTML = '<div class="empty-state">记录第一组身体数据后，这里会展示最近状态。目标区间：67.5–70 kg。</div>';
    return;
  }
  container.innerHTML = `
    <p class="ruler-kicker">最近体重</p>
    <div class="health-number">${Number(latest.weight).toFixed(1)}<small> kg</small></div>
    <div class="health-meta">
      <div><span>腰围</span><strong>${latest.waist ? `${latest.waist} cm` : "未记录"}</strong></div>
      <div><span>睡眠</span><strong>${latest.sleep ? `${latest.sleep} h` : "未记录"}</strong></div>
      <div><span>步数</span><strong>${latest.steps || "未记录"}</strong></div>
      <div><span>训练</span><strong>${escapeHtml(latest.training)}</strong></div>
    </div>`;
}

function reviewData() {
  const sessions = currentWeekSessions();
  const minutes = sessions.reduce((sum, item) => sum + Number(item.minutes), 0);
  const weekTasks = state.tasks.filter((task) => new Date(`${task.date}T00:00:00`) >= startOfWeek());
  const doneTasks = weekTasks.filter((task) => task.done).length;
  const completion = weekTasks.length ? Math.round((doneTasks / weekTasks.length) * 100) : 0;
  const paperCount = state.papers.filter((paper) => new Date(paper.createdAt) >= startOfWeek()).length;
  return { sessions, minutes, weekTasks, doneTasks, completion, paperCount };
}

function buildMarkdownReview() {
  const data = reviewData();
  const moduleLines = modules.map((module) => {
    const minutes = data.sessions
      .filter((session) => session.moduleId === module.id)
      .reduce((sum, session) => sum + Number(session.minutes), 0);
    return `- ${module.name}：${(minutes / 60).toFixed(1)}h / ${module.targetHours}h`;
  });
  const completed = data.weekTasks.filter((task) => task.done).map((task) => `- ${task.title}`);

  return `# 本周复盘

> 由研习台生成于 ${new Date().toLocaleString("zh-CN")}

## 1. 本周数据

- 有效学习时间：${(data.minutes / 60).toFixed(1)}h / 42h
- 任务完成率：${data.completion}%
- 完成任务：${data.doneTasks} / ${data.weekTasks.length}
- 论文学习包：${data.paperCount}

## 2. 模块投入

${moduleLines.join("\n")}

## 3. 已完成成果

${completed.length ? completed.join("\n") : "- 本周暂无已勾选成果"}

## 4. 问题诊断

- 哪些任务持续拖延？
- 是时间、难度、精力还是任务定义的问题？
- 哪项学习尚不能独立完成？

## 5. 下周调整

- 增加：
- 减少：
- 保持：
- 暂停：

## 6. 下周关键成果

1.
2.
3.
`;
}

function renderReview() {
  const data = reviewData();
  document.querySelector("#review-preview").innerHTML = `
    <h2>本周事实</h2>
    <div class="review-grid">
      <div class="review-stat"><strong>${(data.minutes / 60).toFixed(1)}h</strong><span>有效学习</span></div>
      <div class="review-stat"><strong>${data.completion}%</strong><span>任务完成率</span></div>
      <div class="review-stat"><strong>${data.paperCount}</strong><span>论文学习包</span></div>
    </div>
    <div class="review-notes">
      <h3>复盘不在这里完成</h3>
      <p>下载Markdown并在Obsidian里判断：哪些投入有效、问题在哪里、下一周需要改变什么。</p>
    </div>`;
}

function renderAll() {
  renderRuler();
  renderTasks();
  renderWeekProgress();
  renderRecentSessions();
  renderModules();
  renderPapers();
  renderHealth();
  renderReview();
}

function setupNavigation() {
  function activate(viewName) {
    document.querySelectorAll(".view").forEach((view) => view.classList.remove("is-active"));
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("is-active"));
    document.querySelector(`#view-${viewName}`).classList.add("is-active");
    document.querySelector(`.nav-item[data-view="${viewName}"]`).classList.add("is-active");
    document.querySelector("#view-title").textContent = viewTitles[viewName];
    history.replaceState(null, "", `#${viewName}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  document.querySelectorAll("[data-view]").forEach((button) =>
    button.addEventListener("click", () => activate(button.dataset.view)),
  );
  document.querySelectorAll("[data-view-jump]").forEach((button) =>
    button.addEventListener("click", () => activate(button.dataset.viewJump)),
  );

  const initial = location.hash.slice(1);
  if (viewTitles[initial]) activate(initial);
}

function setupDialogs() {
  document.querySelectorAll("[data-open-dialog]").forEach((button) => {
    button.addEventListener("click", () => document.querySelector(`#${button.dataset.openDialog}`).showModal());
  });

  const options = modules.map((module) => `<option value="${module.id}">${module.name}</option>`).join("");
  document.querySelector("#session-module").innerHTML = options;
  document.querySelector("#task-module").innerHTML = options;
}

function setupForms() {
  document.querySelector("#session-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await db.put("sessions", {
      id: crypto.randomUUID(),
      moduleId: form.get("moduleId"),
      minutes: Number(form.get("minutes")),
      note: form.get("note").trim(),
      date: todayKey(),
      createdAt: new Date().toISOString(),
    });
    state.sessions = await db.getAll("sessions");
    formElement.reset();
    formElement.closest("dialog").close();
    renderAll();
    showToast("学习记录已保存");
  });

  document.querySelector("#task-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await db.put("tasks", {
      id: crypto.randomUUID(),
      title: form.get("title").trim(),
      moduleId: form.get("moduleId"),
      minutes: Number(form.get("minutes")),
      date: todayKey(),
      done: false,
      createdAt: new Date().toISOString(),
    });
    state.tasks = await db.getAll("tasks");
    formElement.reset();
    formElement.closest("dialog").close();
    renderAll();
    showToast("任务已添加");
  });

  document.querySelector("#paper-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await db.put("papers", {
      id: crypto.randomUUID(),
      title: form.get("title").trim(),
      url: form.get("url").trim(),
      insight: form.get("insight").trim(),
      summary: form.get("summary").trim(),
      phrases: form.get("phrases").trim(),
      createdAt: new Date().toISOString(),
    });
    state.papers = await db.getAll("papers");
    formElement.reset();
    renderPapers();
    renderReview();
    showToast("论文学习包已保存");
  });

  document.querySelector("#health-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await db.put("health", {
      id: crypto.randomUUID(),
      weight: Number(form.get("weight")),
      waist: form.get("waist") ? Number(form.get("waist")) : null,
      sleep: form.get("sleep") ? Number(form.get("sleep")) : null,
      steps: form.get("steps") ? Number(form.get("steps")) : null,
      training: form.get("training"),
      date: todayKey(),
      createdAt: new Date().toISOString(),
    });
    state.health = await db.getAll("health");
    formElement.reset();
    renderHealth();
    showToast("身体数据已保存");
  });
}

function setupExports() {
  document.querySelector("#export-review").addEventListener("click", () => {
    downloadFile(`weekly-review-${todayKey()}.md`, buildMarkdownReview(), "text/markdown;charset=utf-8");
    showToast("本周复盘已导出");
  });

  document.querySelector("#export-backup").addEventListener("click", async () => {
    const snapshot = await db.exportAll();
    downloadFile(
      `personal-workstation-backup-${todayKey()}.json`,
      JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), ...snapshot }, null, 2),
      "application/json",
    );
    showToast("完整备份已导出");
  });

  document.querySelector("#import-backup").addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (!file) return;
    try {
      const snapshot = JSON.parse(await file.text());
      await db.importAll(snapshot);
      await loadState();
      renderAll();
      showToast("备份已恢复");
    } catch (error) {
      console.error(error);
      showToast("备份无效，未导入任何内容");
    } finally {
      event.target.value = "";
    }
  });
}

function setupPwa() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
  }
  let installPrompt;
  const button = document.querySelector("#install-app");
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    button.hidden = false;
  });
  button.addEventListener("click", async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    button.hidden = true;
  });
}

async function loadState() {
  [state.tasks, state.sessions, state.papers, state.health] = await Promise.all([
    db.getAll("tasks"),
    db.getAll("sessions"),
    db.getAll("papers"),
    db.getAll("health"),
  ]);
}

async function init() {
  document.querySelector("#date-line").textContent = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());

  await loadState();
  await seedTodayTasks();
  setupNavigation();
  setupDialogs();
  setupForms();
  setupExports();
  setupPwa();
  renderAll();
}

init().catch((error) => {
  console.error(error);
  document.querySelector("#main").innerHTML = '<div class="empty-state">本地数据库初始化失败。请检查浏览器是否允许站点存储。</div>';
});
