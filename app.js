import { db } from "./db.js?v=20260920-3";
import {
  codingExercises,
  dataAiTheory,
  fallbackPapers,
  learningPaths,
  learningResources,
  moduleById,
  modules,
  paperCategories,
  yearlyPhases,
} from "./data.js?v=20260920-3";

const state = {
  tasks: [],
  sessions: [],
  papers: [],
  health: [],
  settings: [],
  dailyPapers: [],
  paperFeedStatus: "正在获取最新论文…",
  paperCategory: "all",
  studioView: "theory",
  activeExerciseId: codingExercises[0].id,
};

let plannerDraft = [];

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

function getSetting(id, fallback) {
  return state.settings.find((item) => item.id === id) || fallback;
}

function learningPlan() {
  return getSetting("learning-plan", {
    id: "learning-plan",
    activePhase: yearlyPhases[0].id,
    completedUnits: {},
  });
}

async function saveSetting(value) {
  const index = state.settings.findIndex((item) => item.id === value.id);
  if (index >= 0) state.settings[index] = value;
  else state.settings.push(value);
  await db.put("settings", value);
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

  for (const task of buildDailyPlan(360)) {
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

function moduleMinutesThisWeek(moduleId) {
  return currentWeekSessions()
    .filter((session) => session.moduleId === moduleId)
    .reduce((sum, session) => sum + Number(session.minutes), 0);
}

function currentUnit(moduleId) {
  const completed = learningPlan().completedUnits || {};
  const path = learningPaths[moduleId] || [];
  return path.find((unit) => !completed[unit.id]) || path.at(-1);
}

function buildDailyPlan(totalMinutes) {
  if (totalMinutes <= 0) return [];

  const studyModules = modules
    .filter((module) => ["data-ai", "cpa", "civil", "english"].includes(module.id))
    .sort((a, b) => {
      const aGap = Math.max(a.targetHours * 60 - moduleMinutesThisWeek(a.id), 0) / (a.targetHours * 60);
      const bGap = Math.max(b.targetHours * 60 - moduleMinutesThisWeek(b.id), 0) / (b.targetHours * 60);
      return bGap - aGap;
    });

  const preferredBlocks = [120, 90, 90, 60];
  const durations = [];
  let remaining = totalMinutes;
  for (const preferred of preferredBlocks) {
    if (remaining <= 0) break;
    let block = Math.min(preferred, remaining);
    if (remaining - block > 0 && remaining - block < 30) block = remaining - 30;
    if (block > 0) durations.push(block);
    remaining -= block;
  }
  if (remaining > 0) durations[durations.length - 1] += remaining;

  return durations.map((minutes, index) => {
    const module = studyModules[index % studyModules.length];
    const unit = currentUnit(module.id);
    return {
      title: unit ? `${unit.title}：${unit.output}` : `推进${module.name}当前内容`,
      moduleId: module.id,
      minutes,
    };
  });
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

function renderRoadmap() {
  const plan = learningPlan();
  document.querySelector("#phase-track").innerHTML = yearlyPhases
    .map((phase, index) => `
      <button class="phase-step ${plan.activePhase === phase.id ? "is-active" : ""}" data-phase-id="${phase.id}" type="button">
        <span class="phase-number">${index + 1}</span>
        <span class="phase-copy">
          <strong>${escapeHtml(phase.name)}</strong>
          <small>${escapeHtml(phase.weeks)}</small>
          <span>${escapeHtml(phase.objective)}</span>
        </span>
      </button>`)
    .join("");

  document.querySelectorAll("[data-phase-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const next = { ...learningPlan(), activePhase: button.dataset.phaseId };
      await saveSetting(next);
      renderRoadmap();
      renderReview();
      showToast("当前阶段已更新");
    });
  });
}

function renderModules() {
  const completed = learningPlan().completedUnits || {};
  document.querySelector("#module-board").innerHTML = modules
    .map((module) => {
      const path = learningPaths[module.id] || [];
      const completeCount = path.filter((unit) => completed[unit.id]).length;
      const progress = path.length ? Math.round((completeCount / path.length) * 100) : 0;
      return `
        <article class="module-card ${["data-ai", "english"].includes(module.id) ? "is-priority" : ""}">
          <div class="module-card-head">
            <span class="module-code" style="background:${module.color}">${module.short}</span>
            <span>${module.targetHours}h / 周</span>
          </div>
          <h3>${escapeHtml(module.name)}</h3>
          <p>${escapeHtml(module.description)}</p>
          <div class="course-progress" aria-label="${escapeHtml(module.name)}课程完成度">
            <span style="width:${progress}%;background:${module.color}"></span>
          </div>
          <div class="course-progress-copy">${completeCount} / ${path.length} 个阶段完成</div>
          <div class="course-unit-list">
            ${path
              .map(
                (unit) => `
                  <label class="course-unit ${completed[unit.id] ? "is-complete" : ""}">
                    <input type="checkbox" data-course-unit="${unit.id}" ${completed[unit.id] ? "checked" : ""} />
                    <span>
                      <strong>${escapeHtml(unit.title)}</strong>
                      <small>${escapeHtml(unit.focus)}</small>
                      <em>${escapeHtml(unit.output)}</em>
                    </span>
                  </label>`,
              )
              .join("")}
          </div>
        </article>`;
    })
    .join("");

  document.querySelectorAll("[data-course-unit]").forEach((checkbox) => {
    checkbox.addEventListener("change", async () => {
      const plan = learningPlan();
      const next = {
        ...plan,
        completedUnits: { ...(plan.completedUnits || {}), [checkbox.dataset.courseUnit]: checkbox.checked },
      };
      await saveSetting(next);
      renderModules();
      renderReview();
      showToast(checkbox.checked ? "课程阶段已完成" : "课程阶段已重新打开");
    });
  });
}

function codingPracticeState() {
  return getSetting("coding-practice", {
    id: "coding-practice",
    drafts: {},
    completed: {},
  });
}

function renderTheoryStudio() {
  const completedUnits = learningPlan().completedUnits || {};
  document.querySelector("#data-ai-theory").innerHTML = `
    <div class="theory-preface">
      <strong>建议顺序</strong>
      <span>阶段 01–03 构成数据科学底座；04–05 建模；06 将能力组合成可评测的 AI 系统。每周 14 小时建议分为理论 4h、课程 4h、编码 5h、复盘 1h。</span>
    </div>
    <div class="theory-sequence">
      ${dataAiTheory
        .map(
          (stage) => `
            <article class="theory-stage ${completedUnits[stage.id] ? "is-complete" : ""}">
              <div class="theory-stage-index"><span>${stage.index}</span><small>${escapeHtml(stage.duration)}</small></div>
              <div class="theory-stage-body">
                <p>${escapeHtml(stage.question)}</p>
                <h3>${escapeHtml(stage.title)}</h3>
                <ul>${stage.theory.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
                <div class="theory-evidence"><b>阶段证据</b><span>${escapeHtml(stage.practice)}</span></div>
              </div>
            </article>`,
        )
        .join("")}
    </div>`;
}

function renderLearningResources() {
  const stages = dataAiTheory.filter((stage) => learningResources.some((resource) => resource.stageId === stage.id));
  document.querySelector("#learning-resources").innerHTML = `
    <div class="resource-note"><strong>资源使用规则</strong><span>每阶段只选一门主课；链接用于学习，真正的完成标准是右侧写出的练习或作品。</span></div>
    <div class="resource-ledger">
      ${stages
        .map(
          (stage) => `
            <section class="resource-group">
              <div class="resource-stage"><span>${stage.index}</span><strong>${escapeHtml(stage.title)}</strong></div>
              <div class="resource-rows">
                ${learningResources
                  .filter((resource) => resource.stageId === stage.id)
                  .map(
                    (resource) => `
                      <a class="resource-row" href="${escapeHtml(resource.url)}" target="_blank" rel="noreferrer">
                        <span class="resource-type">${escapeHtml(resource.type)}</span>
                        <span><strong>${escapeHtml(resource.title)}</strong><small>${escapeHtml(resource.provider)}</small></span>
                        <p>${escapeHtml(resource.note)}</p>
                        <b aria-hidden="true">↗</b>
                      </a>`,
                  )
                  .join("")}
              </div>
            </section>`,
        )
        .join("")}
    </div>`;
}

function coachPrompt(exercise, code) {
  return `你是我的 Python 与 AI 编程教练。请用苏格拉底式提问和逐步提示帮助我完成练习，不要直接给出完整答案。\n\n练习：${exercise.title}\n目标：${exercise.goal}\n验收条件：\n- ${exercise.checks.join("\n- ")}\n\n我的当前代码：\n\`\`\`python\n${code}\n\`\`\`\n\n请先指出最关键的一个问题，再给一个最小提示和一个我可以自己运行的测试。`;
}

function renderExerciseWorkspace() {
  const workspace = document.querySelector("#exercise-workspace");
  const practice = codingPracticeState();
  const exercise = codingExercises.find((item) => item.id === state.activeExerciseId) || codingExercises[0];
  const draft = practice.drafts?.[exercise.id] ?? exercise.starterCode;
  const completed = Boolean(practice.completed?.[exercise.id]);
  workspace.innerHTML = `
    <header class="exercise-brief">
      <div class="exercise-labels"><span>${exercise.domain === "ai" ? "AI LAB" : "DATA LAB"}</span><span>${escapeHtml(exercise.difficulty)}</span><span>${exercise.minutes} min</span></div>
      <h3>${escapeHtml(exercise.title)}</h3>
      <p>${escapeHtml(exercise.brief)}</p>
    </header>
    <div class="exercise-spec">
      <div><b>任务</b><p>${escapeHtml(exercise.goal)}</p></div>
      <div><b>完成检查</b><ul>${exercise.checks.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>
    </div>
    <label class="code-editor-label" for="code-editor"><span>practice.py</span><small>草稿保存在当前浏览器</small></label>
    <textarea id="code-editor" class="code-editor" spellcheck="false" aria-label="Python 代码编辑器">${escapeHtml(draft)}</textarea>
    <div class="code-actions">
      <button class="button button-primary" id="save-code-draft" type="button">保存草稿</button>
      <button class="button button-quiet" id="copy-coach-prompt" type="button">复制 AI 教练提示</button>
      <button class="button button-quiet" id="download-code" type="button">下载 .py</button>
      <button class="exercise-complete ${completed ? "is-complete" : ""}" id="toggle-exercise" type="button">${completed ? "✓ 已完成" : "标记完成"}</button>
    </div>`;

  document.querySelector("#save-code-draft").addEventListener("click", async () => {
    const current = codingPracticeState();
    await saveSetting({ ...current, drafts: { ...(current.drafts || {}), [exercise.id]: document.querySelector("#code-editor").value } });
    showToast("代码草稿已保存到本机");
  });
  document.querySelector("#copy-coach-prompt").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(coachPrompt(exercise, document.querySelector("#code-editor").value));
      showToast("AI 教练提示已复制");
    } catch {
      showToast("浏览器未允许剪贴板，请先保存代码");
    }
  });
  document.querySelector("#download-code").addEventListener("click", () => {
    downloadFile(`${exercise.id}.py`, document.querySelector("#code-editor").value, "text/x-python;charset=utf-8");
  });
  document.querySelector("#toggle-exercise").addEventListener("click", async () => {
    const current = codingPracticeState();
    const nextCompleted = { ...(current.completed || {}) };
    if (nextCompleted[exercise.id]) delete nextCompleted[exercise.id];
    else nextCompleted[exercise.id] = new Date().toISOString();
    await saveSetting({
      ...current,
      drafts: { ...(current.drafts || {}), [exercise.id]: document.querySelector("#code-editor").value },
      completed: nextCompleted,
    });
    renderCodeLab();
    showToast(nextCompleted[exercise.id] ? "练习已计入进度" : "练习已重新打开");
  });
}

function renderCodeLab() {
  const practice = codingPracticeState();
  const completed = practice.completed || {};
  const completeCount = codingExercises.filter((exercise) => completed[exercise.id]).length;
  document.querySelector("#exercise-list").innerHTML = `
    <div class="exercise-index-head"><span>练习进度</span><strong>${completeCount} / ${codingExercises.length}</strong></div>
    ${codingExercises
      .map(
        (exercise, index) => `
          <button class="exercise-link ${exercise.id === state.activeExerciseId ? "is-active" : ""} ${completed[exercise.id] ? "is-complete" : ""}" type="button" data-exercise-id="${exercise.id}">
            <span>${String(index + 1).padStart(2, "0")}</span>
            <span><strong>${escapeHtml(exercise.title)}</strong><small>${exercise.domain === "ai" ? "AI 编程" : "数据科学"} · ${escapeHtml(exercise.difficulty)}</small></span>
          </button>`,
      )
      .join("")}`;
  document.querySelectorAll("[data-exercise-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeExerciseId = button.dataset.exerciseId;
      renderCodeLab();
    });
  });
  renderExerciseWorkspace();
}

function renderLearningStudio() {
  renderTheoryStudio();
  renderLearningResources();
  renderCodeLab();
  document.querySelectorAll("[data-studio-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.studioView === state.studioView);
    button.onclick = () => {
      state.studioView = button.dataset.studioView;
      document.querySelectorAll("[data-studio-view]").forEach((item) => item.classList.toggle("is-active", item === button));
      document.querySelectorAll("[data-studio-panel]").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.studioPanel === state.studioView));
    };
  });
  document.querySelectorAll("[data-studio-panel]").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.studioPanel === state.studioView));
}

function classifyPaper(paper) {
  if (paper.categories?.length) return paper.categories;
  const text = `${paper.title || ""} ${paper.summary || ""}`.toLowerCase();
  const categories = [];
  if (["finance", "financial", "accounting", "market", "portfolio", "asset", "stock", "trading", "credit risk", "fintech"].some((word) => text.includes(word))) categories.push("finance");
  if (["data", "machine learning", "statistical", "regression", "forecast", "causal", "tabular", "dataset", "time series", "classification"].some((word) => text.includes(word))) categories.push("data");
  if (["artificial intelligence", "language model", "llm", "agent", "transformer", "neural", "reasoning", "vision", "diffusion", "reinforcement", "multimodal", "retrieval"].some((word) => text.includes(word))) categories.push("ai");
  return categories.length ? [...new Set(categories)] : ["ai"];
}

function normalizeDailyPaper(entry) {
  const paper = entry.paper || entry;
  const id = paper.id || entry.id;
  if (!id || !paper.title) return null;
  const normalized = {
    id,
    title: paper.title,
    summary: paper.summary || entry.summary || "",
    authors: (paper.authors || [])
      .slice(0, 3)
      .map((author) => author.name || author.user?.fullname)
      .filter(Boolean),
    upvotes: Number(paper.upvotes || entry.upvotes || 0),
    publishedAt: paper.publishedAt || entry.publishedAt || "",
    url: `https://huggingface.co/papers/${id}`,
    source: "Hugging Face Daily Papers",
  };
  return { ...normalized, categories: classifyPaper(normalized) };
}

function isRelevantPaper(paper) {
  const text = `${paper.title} ${paper.summary}`.toLowerCase();
  return [
    "machine learning",
    "language model",
    "llm",
    "agent",
    "retrieval",
    "reasoning",
    "neural",
    "data",
    "transformer",
    "benchmark",
    "vision",
    "reinforcement",
  ].some((keyword) => text.includes(keyword));
}

async function loadDailyPapers(force = false) {
  const cache = getSetting("daily-paper-feed", null);
  if (!force && cache?.date === todayKey() && cache.items?.length) {
    state.dailyPapers = cache.items.map((paper) => ({ ...paper, categories: classifyPaper(paper) }));
    state.paperFeedStatus = "今日推荐已就绪 · 在线内容已缓存到本机";
    renderDailyPapers();
    return;
  }

  state.paperFeedStatus = "正在获取最新论文…";
  renderDailyPapers();
  try {
    const response = await fetch("https://huggingface.co/api/daily_papers", {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Paper feed ${response.status}`);
    const payload = await response.json();
    const normalized = payload.map(normalizeDailyPaper).filter(Boolean);
    const relevant = normalized.filter(isRelevantPaper);
    const candidates = relevant.length >= 4 ? relevant : normalized;
    const merged = [...candidates.slice(0, 16), ...fallbackPapers];
    state.dailyPapers = [...new Map(merged.map((paper) => [paper.id, { ...paper, categories: classifyPaper(paper) }])).values()];
    state.paperFeedStatus = "今日已更新 · 来源 Hugging Face Daily Papers";
    await saveSetting({ id: "daily-paper-feed", date: todayKey(), items: state.dailyPapers });
  } catch (error) {
    console.warn("Daily paper feed unavailable; using local selection.", error);
    const previous = (cache?.items?.length ? cache.items : fallbackPapers).map((paper) => ({ ...paper, categories: classifyPaper(paper) }));
    const offset = Number(todayKey().replaceAll("-", "")) % previous.length;
    state.dailyPapers = [...previous.slice(offset), ...previous.slice(0, offset)];
    state.paperFeedStatus = cache?.items?.length
      ? "网络暂不可用 · 显示最近一次缓存"
      : "网络暂不可用 · 显示本机基础精选";
  }
  renderDailyPapers();
}

function renderDailyPapers() {
  const status = document.querySelector("#paper-feed-status");
  const container = document.querySelector("#daily-paper-list");
  const filters = document.querySelector("#paper-category-filters");
  if (!status || !container || !filters) return;
  status.textContent = state.paperFeedStatus;
  filters.innerHTML = paperCategories
    .map((category) => `<button class="paper-filter ${category.id === state.paperCategory ? "is-active" : ""}" type="button" data-paper-category="${category.id}">${escapeHtml(category.name)}</button>`)
    .join("");
  filters.querySelectorAll("[data-paper-category]").forEach((button) => {
    button.addEventListener("click", () => {
      state.paperCategory = button.dataset.paperCategory;
      renderDailyPapers();
    });
  });
  if (!state.dailyPapers.length) {
    container.innerHTML = '<div class="empty-state">正在整理今天的论文推荐。</div>';
    return;
  }

  const readPapers = getSetting("read-papers", { items: {} }).items || {};
  let visiblePapers;
  if (state.paperCategory === "all") {
    const lead = ["data", "ai", "finance"]
      .map((category) => state.dailyPapers.find((paper) => classifyPaper(paper).includes(category)))
      .filter(Boolean);
    visiblePapers = [...new Map([...lead, ...state.dailyPapers].map((paper) => [paper.id, paper])).values()].slice(0, 6);
  } else {
    visiblePapers = state.dailyPapers.filter((paper) => classifyPaper(paper).includes(state.paperCategory)).slice(0, 6);
  }
  if (!visiblePapers.length) {
    container.innerHTML = '<div class="empty-state">这个领域今天没有匹配内容，可以刷新推荐或查看全部。</div>';
    return;
  }
  container.innerHTML = visiblePapers
    .map(
      (paper, index) => `
        <article class="daily-paper ${index === 0 ? "is-featured" : ""} ${readPapers[paper.id] ? "is-read" : ""}">
          <div class="paper-rank">${index === 0 ? "今日必读" : `备选 ${index}`}</div>
          <div class="paper-tags">${classifyPaper(paper).map((category) => `<span>${escapeHtml(paperCategories.find((item) => item.id === category)?.name || category)}</span>`).join("")}</div>
          <h3>${escapeHtml(paper.title)}</h3>
          <p>${escapeHtml(paper.summary || "打开原文，通过摘要判断它是否值得继续阅读。")}</p>
          <div class="paper-meta">
            <span>${escapeHtml(paper.authors?.join("、") || paper.source || "论文推荐")}</span>
            ${paper.upvotes ? `<span>${paper.upvotes} 票</span>` : ""}
          </div>
          <div class="paper-actions">
            <a class="text-button" href="${escapeHtml(paper.url)}" target="_blank" rel="noreferrer">打开原文</a>
            <button class="text-button" type="button" data-start-paper="${paper.id}">加入今日精读</button>
            <button class="text-button" type="button" data-read-paper="${paper.id}">${readPapers[paper.id] ? "取消已读" : "标记已读"}</button>
          </div>
          ${index === 0 ? '<div class="paper-method"><span>5 分钟扫摘要</span><span>5 分钟找问题</span><span>5 分钟摘表达</span><span>5 分钟英文复述</span></div>' : ""}
        </article>`,
    )
    .join("");

  container.querySelectorAll("[data-start-paper]").forEach((button) => {
    button.addEventListener("click", () => {
      const paper = visiblePapers.find((item) => item.id === button.dataset.startPaper);
      if (!paper) return;
      const form = document.querySelector("#paper-form");
      form.elements.title.value = paper.title;
      form.elements.url.value = paper.url;
      form.scrollIntoView({ behavior: "smooth", block: "start" });
      form.elements.insight.focus({ preventScroll: true });
      showToast("已加入精读台，先写研究问题");
    });
  });

  container.querySelectorAll("[data-read-paper]").forEach((button) => {
    button.addEventListener("click", async () => {
      const setting = getSetting("read-papers", { id: "read-papers", items: {} });
      const items = { ...(setting.items || {}) };
      if (items[button.dataset.readPaper]) delete items[button.dataset.readPaper];
      else items[button.dataset.readPaper] = new Date().toISOString();
      await saveSetting({ ...setting, items });
      renderDailyPapers();
    });
  });
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
  const plan = learningPlan();
  const totalUnits = Object.values(learningPaths).flat().length;
  const completedUnits = Object.values(plan.completedUnits || {}).filter(Boolean).length;
  const phase = yearlyPhases.find((item) => item.id === plan.activePhase) || yearlyPhases[0];
  return { sessions, minutes, weekTasks, doneTasks, completion, paperCount, totalUnits, completedUnits, phase };
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
- 年度阶段：${data.phase.name}（${data.phase.weeks}）
- 课程树进度：${data.completedUnits} / ${data.totalUnits}

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
      <p>当前处于“${escapeHtml(data.phase.name)}”阶段，课程树完成 ${data.completedUnits} / ${data.totalUnits}。下载Markdown并在Obsidian里判断：哪些投入有效、问题在哪里、下一周需要改变什么。</p>
    </div>`;
}

function renderAll() {
  renderRuler();
  renderTasks();
  renderWeekProgress();
  renderRecentSessions();
  renderRoadmap();
  renderLearningStudio();
  renderModules();
  renderDailyPapers();
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

function renderPlannerDraft() {
  const container = document.querySelector("#planner-preview");
  const total = plannerDraft.reduce((sum, task) => sum + Number(task.minutes), 0);
  container.innerHTML = plannerDraft
    .map((task) => {
      const module = moduleById(task.moduleId) || modules[0];
      return `<div class="planner-row">
        <span class="planner-color" style="background:${module.color}"></span>
        <span><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(module.name)}</small></span>
        <b>${formatMinutes(task.minutes)}</b>
      </div>`;
    })
    .join("");
  document.querySelector("#planner-total").textContent = `待安排 ${formatMinutes(total)}；已记录的学习时间不会重复排入。`;
}

function setupPlannerAndFeed() {
  document.querySelector("#open-planner").addEventListener("click", () => {
    const recorded = todaySessions().reduce((sum, session) => sum + Number(session.minutes), 0);
    plannerDraft = buildDailyPlan(Math.max(360 - recorded, 0));
    if (!plannerDraft.length) {
      showToast("今天已记录满 6 小时，无需继续排课");
      return;
    }
    renderPlannerDraft();
    document.querySelector("#planner-dialog").showModal();
  });

  document.querySelector("#planner-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const replaceable = state.tasks.filter((task) => task.date === todayKey() && !task.done);
    await Promise.all(replaceable.map((task) => db.delete("tasks", task.id)));
    for (const task of plannerDraft) {
      await db.put("tasks", {
        ...task,
        id: crypto.randomUUID(),
        date: todayKey(),
        done: false,
        createdAt: new Date().toISOString(),
      });
    }
    state.tasks = await db.getAll("tasks");
    formElement.closest("dialog").close();
    renderTasks();
    renderReview();
    showToast("今日计划已应用");
  });

  document.querySelector("#refresh-paper-feed").addEventListener("click", () => loadDailyPapers(true));
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
  [state.tasks, state.sessions, state.papers, state.health, state.settings] = await Promise.all([
    db.getAll("tasks"),
    db.getAll("sessions"),
    db.getAll("papers"),
    db.getAll("health"),
    db.getAll("settings"),
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
  setupPlannerAndFeed();
  setupForms();
  setupExports();
  setupPwa();
  renderAll();
  loadDailyPapers();
}

init().catch((error) => {
  console.error(error);
  document.querySelector("#main").innerHTML = '<div class="empty-state">本地数据库初始化失败。请检查浏览器是否允许站点存储。</div>';
});
