import { db } from "./db.js?v=20260921-10";
import {
  codingExercises,
  civilModules,
  civilKnowledgeSources,
  civilMentalModels,
  civilQuestionBank,
  civilYearPlan,
  cpaQuestionBank,
  cpaSubjects,
  cpaYearPlan,
  dailyExpressions,
  dataAiTheory,
  englishQuickLessons,
  englishVocabulary,
  fallbackPapers,
  learningPaths,
  learningResources,
  moduleById,
  modules,
  paperCategories,
  shadowingSentences,
  shenlunTypes,
  yearlyPhases,
} from "./data.js?v=20260921-10";

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
  cpaView: "today",
  activeCpaSubjectId: cpaSubjects[0].id,
  activeCpaChapterIndex: 0,
  cpaQuestionIndex: 0,
  cpaAnswered: null,
  civilView: "today",
  activeCivilModuleId: civilModules[0].id,
  activeCivilTopicIndex: 1,
  civilQuestionIndex: 0,
  civilAnswered: null,
  civilQuestionStartedAt: Date.now(),
  activeShenlunTypeId: shenlunTypes[0].id,
  englishView: "today",
  vocabularyRevealed: false,
  activeVocabularyId: englishVocabulary[0].id,
  quickLessonIndex: 0,
  quickLessonScore: 0,
  quickLessonAnswered: null,
  activeShadowingIndex: 0,
  shadowMode: "echo",
  dictationResult: null,
  activeCustomSentenceIndex: 0,
  activeExpressionIndex: 0,
  quickLessonFinished: false,
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
        <article class="module-card ${["data-ai", "cpa", "civil", "english"].includes(module.id) ? "is-priority" : ""}">
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

function cpaPracticeState() {
  return getSetting("cpa-practice", {
    id: "cpa-practice",
    activePhase: cpaYearPlan[0].id,
    completedChapters: {},
    activities: [],
    attempts: [],
    errors: [],
  });
}

function currentCpaSubject() {
  return cpaSubjects.find((subject) => subject.id === state.activeCpaSubjectId) || cpaSubjects[0];
}

function cpaActivity(type, minutes, label) {
  return { id: crypto.randomUUID(), type, minutes, label, subjectId: state.activeCpaSubjectId, date: todayKey(), createdAt: new Date().toISOString() };
}

function syncCpaPanels() {
  document.querySelectorAll("[data-cpa-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.cpaView === state.cpaView));
  document.querySelectorAll("[data-cpa-panel]").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.cpaPanel === state.cpaView));
}

function renderCpaSummary() {
  const practice = cpaPracticeState();
  const totalChapters = cpaSubjects.reduce((sum, subject) => sum + subject.chapters.length, 0);
  const completed = Object.values(practice.completedChapters || {}).filter(Boolean).length;
  const attempts = practice.attempts || [];
  const correct = attempts.filter((attempt) => attempt.correct).length;
  const accuracy = attempts.length ? Math.round((correct / attempts.length) * 100) : 0;
  document.querySelector("#cpa-summary").innerHTML = `
    <div><strong>${completed}<small>/${totalChapters}</small></strong><span>章节完成</span></div>
    <div><strong>${attempts.length}</strong><span>累计作答</span></div>
    <div><strong>${accuracy}<small>%</small></strong><span>练习正确率</span></div>`;
}

function renderCpaToday() {
  const practice = cpaPracticeState();
  const todayActivities = (practice.activities || []).filter((item) => item.date === todayKey());
  const todayMinutes = todayActivities.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
  const phase = cpaYearPlan.find((item) => item.id === practice.activePhase) || cpaYearPlan[0];
  const subject = currentCpaSubject();
  const blocks = [
    { type: "theory", minutes: 35, name: "教材与框架", detail: "先写本章主线，再补定义、条件和例外" },
    { type: "drill", minutes: 30, name: "题型训练", detail: "先作答，后看解析；记录每个干扰项为什么错" },
    { type: "errors", minutes: 15, name: "错题回炉", detail: "只处理仍说不清原因的题，不机械重刷" },
    { type: "recall", minutes: 10, name: "闭卷复述", detail: "用关键词、公式或分录还原本章结构" },
  ];
  document.querySelector("#cpa-today").innerHTML = `
    <div class="cpa-today-grid">
      <aside class="cpa-year-ledger">
        <header><span>一年路线</span><strong>${escapeHtml(phase.name)}</strong><p>${escapeHtml(phase.target)}</p></header>
        ${cpaYearPlan.map((item) => `<button type="button" class="cpa-phase ${item.id === phase.id ? "is-active" : ""}" data-cpa-phase="${item.id}"><span>${escapeHtml(item.weeks)}</span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.focus)}</small></button>`).join("")}
      </aside>
      <section class="cpa-daily-sheet">
        <div class="cpa-daily-head">
          <div><span>今日答题单</span><h3>${todayMinutes}<small> / 90 分钟</small></h3></div>
          <label>当前主科<select id="cpa-active-subject">${cpaSubjects.map((item) => `<option value="${item.id}" ${item.id === subject.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></label>
        </div>
        <div class="cpa-blocks">
          ${blocks.map((block, index) => {
            const done = todayActivities.some((item) => item.type === block.type && item.subjectId === subject.id);
            return `<article class="cpa-block ${done ? "is-done" : ""}"><span>${done ? "✓" : String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHtml(block.name)}</strong><p>${escapeHtml(block.detail)}</p></div><button type="button" data-cpa-block="${block.type}" data-minutes="${block.minutes}" ${done ? "disabled" : ""}>${done ? "已完成" : `${block.minutes}m 完成`}</button></article>`;
          }).join("")}
        </div>
        <footer><strong>完成标准</strong><span>今天必须留下可检查的痕迹：一道错题解释、一组分录/公式，或一段闭卷复述。</span></footer>
      </section>
    </div>`;
  document.querySelectorAll("[data-cpa-phase]").forEach((button) => {
    button.addEventListener("click", async () => {
      await saveSetting({ ...cpaPracticeState(), activePhase: button.dataset.cpaPhase });
      renderCpaToday();
    });
  });
  document.querySelector("#cpa-active-subject").addEventListener("change", (event) => {
    state.activeCpaSubjectId = event.target.value;
    state.activeCpaChapterIndex = 0;
    state.cpaQuestionIndex = 0;
    state.cpaAnswered = null;
    renderCpaStudio();
  });
  document.querySelectorAll("[data-cpa-block]").forEach((button) => {
    button.addEventListener("click", async () => {
      const practiceNow = cpaPracticeState();
      await saveSetting({ ...practiceNow, activities: [...(practiceNow.activities || []), cpaActivity(button.dataset.cpaBlock, Number(button.dataset.minutes), button.closest("article").querySelector("strong").textContent)] });
      renderCpaStudio();
      showToast("CPA 学习块已计入今日进度");
    });
  });
}

function renderCpaMap() {
  const practice = cpaPracticeState();
  const subject = currentCpaSubject();
  const selectedChapter = subject.chapters[state.activeCpaChapterIndex] || subject.chapters[0];
  const selectedChapterNumber = String(state.activeCpaChapterIndex + 1).padStart(2, "0");
  const selectedQuestions = cpaQuestionBank.filter((question) => question.subjectId === subject.id && question.chapter === selectedChapter);
  const hasFocusLesson = subject.focusLesson.chapter === selectedChapter;
  const completedCount = subject.chapters.filter((_, index) => practice.completedChapters?.[`${subject.id}:${index}`]).length;
  document.querySelector("#cpa-map").innerHTML = `
    <div class="cpa-map-layout">
      <aside class="cpa-subject-index">
        ${cpaSubjects.map((item) => {
          const done = item.chapters.filter((_, index) => practice.completedChapters?.[`${item.id}:${index}`]).length;
          return `<button type="button" class="${item.id === subject.id ? "is-active" : ""}" data-cpa-subject="${item.id}"><b>${item.code}</b><span><strong>${escapeHtml(item.name)}</strong><small>${done} / ${item.chapters.length} 章</small></span></button>`;
        }).join("")}
      </aside>
      <section class="cpa-chapter-sheet">
        <header><div><span>${escapeHtml(subject.duration)} · 2026 题型参考</span><h3>${escapeHtml(subject.name)}</h3></div><strong>${completedCount}<small> / ${subject.chapters.length}</small></strong></header>
        <div class="cpa-score-strip">${subject.questionTypes.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
        <article class="cpa-chapter-reader" id="cpa-chapter-reader">
          <header><span>第 ${selectedChapterNumber} 章</span><h4>${escapeHtml(selectedChapter)}</h4><p>${hasFocusLesson ? escapeHtml(subject.focusLesson.essence) : "按理解、应用、综合三个层级推进本章；完成后再勾选归档。"}</p></header>
          <div class="cpa-chapter-levels">
            ${hasFocusLesson ? subject.focusLesson.framework.map((item, index) => `<div><b>${index + 1}</b><span><strong>${["理解本质", "应用规则", "综合输出"][index]}</strong><small>${escapeHtml(item)}</small></span></div>`).join("") : `<div><b>1</b><span><strong>理解本质</strong><small>整理定义、适用条件与关键术语。</small></span></div><div><b>2</b><span><strong>应用规则</strong><small>完成基础题，并解释每个选项的判断依据。</small></span></div><div><b>3</b><span><strong>综合输出</strong><small>闭卷复述框架，留下公式、分录或案例答案。</small></span></div>`}
          </div>
          ${hasFocusLesson ? `<aside><strong>本章易错点</strong><span>${escapeHtml(subject.focusLesson.pitfall)}</span></aside>` : ""}
          <footer><a class="button button-quiet" href="${subject.sourceUrl}" target="_blank" rel="noreferrer">打开教材资料库</a><button class="button button-quiet" type="button" id="open-cpa-tutor-chapter">用 AI 学本章</button><button class="button button-primary" type="button" id="open-cpa-chapter-drill" ${selectedQuestions.length ? "" : "disabled"}>${selectedQuestions.length ? `练本章题 · ${selectedQuestions.length}` : "本章题库待接入"}</button></footer>
        </article>
        <div class="cpa-chapter-list">
          ${subject.chapters.map((chapter, index) => {
            const key = `${subject.id}:${index}`;
            return `<div class="cpa-chapter ${practice.completedChapters?.[key] ? "is-done" : ""} ${index === state.activeCpaChapterIndex ? "is-active" : ""}"><label title="标记章节完成"><input type="checkbox" data-cpa-chapter="${key}" ${practice.completedChapters?.[key] ? "checked" : ""}><span class="sr-only">标记 ${escapeHtml(chapter)} 完成</span></label><button type="button" data-cpa-open-chapter="${index}"><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(chapter)}</strong><em>${index === state.activeCpaChapterIndex ? "学习中" : "打开"}</em></button></div>`;
          }).join("")}
        </div>
      </section>
    </div>`;
  document.querySelectorAll("[data-cpa-subject]").forEach((button) => button.addEventListener("click", () => {
    state.activeCpaSubjectId = button.dataset.cpaSubject;
    state.activeCpaChapterIndex = 0;
    state.cpaQuestionIndex = 0;
    state.cpaAnswered = null;
    renderCpaStudio();
  }));
  document.querySelectorAll("[data-cpa-open-chapter]").forEach((button) => button.addEventListener("click", () => {
    state.activeCpaChapterIndex = Number(button.dataset.cpaOpenChapter);
    renderCpaMap();
    document.querySelector("#cpa-chapter-reader")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }));
  document.querySelectorAll("[data-cpa-chapter]").forEach((checkbox) => checkbox.addEventListener("change", async () => {
    const next = cpaPracticeState();
    await saveSetting({ ...next, completedChapters: { ...(next.completedChapters || {}), [checkbox.dataset.cpaChapter]: checkbox.checked } });
    renderCpaStudio();
    showToast(checkbox.checked ? "章节已归档" : "章节已重新打开");
  }));
  document.querySelector("#open-cpa-tutor-chapter").addEventListener("click", () => {
    state.cpaView = "tutor";
    renderCpaStudio();
  });
  document.querySelector("#open-cpa-chapter-drill").addEventListener("click", () => {
    if (!selectedQuestions.length) return;
    const subjectQuestions = cpaQuestionBank.filter((question) => question.subjectId === subject.id);
    state.cpaQuestionIndex = subjectQuestions.findIndex((question) => question.id === selectedQuestions[0].id);
    state.cpaAnswered = null;
    state.cpaView = "drill";
    renderCpaStudio();
  });
}

function renderCpaDrill() {
  const subject = currentCpaSubject();
  const questions = cpaQuestionBank.filter((question) => question.subjectId === subject.id);
  const question = questions[state.cpaQuestionIndex % questions.length];
  const answered = state.cpaAnswered?.questionId === question.id ? state.cpaAnswered.answer : null;
  document.querySelector("#cpa-drill").innerHTML = `
    <div class="cpa-drill-layout">
      <aside class="cpa-drill-subjects">
        <header><strong>按科训练</strong><span>当前内置 ${cpaQuestionBank.length} 道示范题，题库结构可继续批量扩充。</span></header>
        ${cpaSubjects.map((item) => `<button type="button" class="${item.id === subject.id ? "is-active" : ""}" data-cpa-drill-subject="${item.id}"><span>${item.code}</span><strong>${escapeHtml(item.name)}</strong><small>${cpaQuestionBank.filter((q) => q.subjectId === item.id).length} 题</small></button>`).join("")}
      </aside>
      <section class="cpa-question-sheet">
        <div class="cpa-question-meta"><span>${escapeHtml(subject.name)} / ${escapeHtml(question.chapter)}</span><span>${escapeHtml(question.type)} · ${escapeHtml(question.difficulty)}</span></div>
        <h3>${escapeHtml(question.prompt)}</h3>
        <div class="cpa-options">
          ${question.options.map((option, index) => {
            const result = answered === null ? "" : index === question.answer ? "is-correct" : index === answered ? "is-wrong" : "";
            return `<button type="button" class="${result}" data-cpa-answer="${index}" ${answered !== null ? "disabled" : ""}><span>${String.fromCharCode(65 + index)}</span><strong>${escapeHtml(option)}</strong></button>`;
          }).join("")}
        </div>
        ${answered !== null ? `<div class="cpa-answer-note ${answered === question.answer ? "is-correct" : "is-wrong"}"><header><strong>${answered === question.answer ? "判断正确" : `正确答案 ${String.fromCharCode(65 + question.answer)}`}</strong><span>先说考点，再解释答案</span></header><p>${escapeHtml(question.explanation)}</p><div><button class="button button-primary" type="button" id="next-cpa-question">下一题</button>${answered !== question.answer ? `<label>错因<select id="cpa-error-reason"><option>概念不清</option><option>条件遗漏</option><option>计算错误</option><option>审题错误</option><option>时间不足</option></select></label><button class="button button-quiet" type="button" id="save-cpa-error">记入错题簿</button>` : ""}</div></div>` : ""}
      </section>
    </div>`;
  document.querySelectorAll("[data-cpa-drill-subject]").forEach((button) => button.addEventListener("click", () => {
    state.activeCpaSubjectId = button.dataset.cpaDrillSubject;
    state.activeCpaChapterIndex = 0;
    state.cpaQuestionIndex = 0;
    state.cpaAnswered = null;
    renderCpaStudio();
  }));
  document.querySelectorAll("[data-cpa-answer]").forEach((button) => button.addEventListener("click", async () => {
    const answer = Number(button.dataset.cpaAnswer);
    state.cpaAnswered = { questionId: question.id, answer };
    const practice = cpaPracticeState();
    const attempt = { id: crypto.randomUUID(), questionId: question.id, subjectId: question.subjectId, chapter: question.chapter, answer, correct: answer === question.answer, date: todayKey(), createdAt: new Date().toISOString() };
    await saveSetting({ ...practice, attempts: [...(practice.attempts || []), attempt] });
    renderCpaStudio();
  }));
  document.querySelector("#next-cpa-question")?.addEventListener("click", () => {
    state.cpaQuestionIndex = (state.cpaQuestionIndex + 1) % questions.length;
    state.cpaAnswered = null;
    renderCpaDrill();
  });
  document.querySelector("#save-cpa-error")?.addEventListener("click", async () => {
    const practice = cpaPracticeState();
    const alreadySaved = (practice.errors || []).some((item) => item.questionId === question.id && !item.resolved);
    if (alreadySaved) return showToast("这道题已在待复习错题中");
    const error = { id: crypto.randomUUID(), questionId: question.id, subjectId: question.subjectId, chapter: question.chapter, prompt: question.prompt, reason: document.querySelector("#cpa-error-reason").value, note: question.explanation, resolved: false, date: todayKey(), createdAt: new Date().toISOString() };
    await saveSetting({ ...practice, errors: [...(practice.errors || []), error] });
    renderCpaStudio();
    showToast("已记入错题簿");
  });
}

function renderCpaErrors() {
  const practice = cpaPracticeState();
  const errors = [...(practice.errors || [])].reverse();
  const unresolved = errors.filter((item) => !item.resolved).length;
  document.querySelector("#cpa-errors").innerHTML = `
    <div class="cpa-error-layout">
      <section class="cpa-error-list">
        <header><div><span>待回炉</span><strong>${unresolved} 道</strong></div><p>重做正确不等于掌握；能说出原错因和新判断规则，才标记为已解决。</p></header>
        ${errors.length ? errors.map((item) => `<article class="cpa-error ${item.resolved ? "is-resolved" : ""}"><div><span>${escapeHtml(cpaSubjects.find((subject) => subject.id === item.subjectId)?.name || "CPA")} / ${escapeHtml(item.chapter)}</span><strong>${escapeHtml(item.prompt)}</strong><p><b>${escapeHtml(item.reason)}</b>${escapeHtml(item.note || "等待补充复盘说明")}</p></div><button type="button" data-cpa-resolve="${item.id}">${item.resolved ? "重新打开" : "标记已解决"}</button></article>`).join("") : `<div class="cpa-empty"><strong>错题簿还是空的</strong><span>在“题型训练”答错后记录，或在右侧登记外部题目。</span></div>`}
      </section>
      <form class="cpa-error-form" id="cpa-error-form">
        <span>登记教材 / 外部题库错题</span>
        <label>科目<select name="subjectId">${cpaSubjects.map((subject) => `<option value="${subject.id}">${escapeHtml(subject.name)}</option>`).join("")}</select></label>
        <label>章节或考点<input name="chapter" required placeholder="例如：所得税 / 暂时性差异"></label>
        <label>题目摘要<textarea name="prompt" required rows="3" placeholder="只保留能帮助你再次识别这类题的信息"></textarea></label>
        <label>主要错因<select name="reason"><option>概念不清</option><option>条件遗漏</option><option>计算错误</option><option>审题错误</option><option>时间不足</option></select></label>
        <label>下次判断规则<textarea name="note" rows="3" placeholder="看到什么信号，应该使用哪条规则？"></textarea></label>
        <button class="button button-primary" type="submit">保存错题</button>
      </form>
    </div>`;
  document.querySelectorAll("[data-cpa-resolve]").forEach((button) => button.addEventListener("click", async () => {
    const next = cpaPracticeState();
    const updated = (next.errors || []).map((item) => item.id === button.dataset.cpaResolve ? { ...item, resolved: !item.resolved, resolvedAt: !item.resolved ? new Date().toISOString() : null } : item);
    await saveSetting({ ...next, errors: updated });
    renderCpaStudio();
  }));
  document.querySelector("#cpa-error-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const practiceNow = cpaPracticeState();
    const error = { id: crypto.randomUUID(), questionId: null, subjectId: data.get("subjectId"), chapter: data.get("chapter"), prompt: data.get("prompt"), reason: data.get("reason"), note: data.get("note"), resolved: false, date: todayKey(), createdAt: new Date().toISOString() };
    await saveSetting({ ...practiceNow, errors: [...(practiceNow.errors || []), error] });
    renderCpaStudio();
    showToast("外部错题已保存");
  });
}

function buildCpaTutorPrompt(subject, chapter, mode, level, material) {
  const modeInstructions = {
    explain: "按“一句话本质 → 生活化类比 → 正式定义/公式或分录 → 考点定位 → 易混点”讲解，并解释所有术语。",
    solve: "先让我作答，不要直接给答案；之后指出考点，逐步拆解，并逐项解释每个错误选项的陷阱。",
    practice: "按 CPA 真实题型生成 3 道由浅入深的练习。先只出题，等我回答后再逐题评分与解析。",
    review: "根据材料诊断我的错因属于概念、条件、计算、审题还是时间问题，并给出最小复习任务和一道变式题。",
  };
  const levels = { 1: "能力等级 1：理解概念与基本原理", 2: "能力等级 2：在简单职业情境中应用", 3: "能力等级 3：在复杂情境中综合运用" };
  return `你是我的中国 CPA 私人辅导老师。\n科目：${subject.name}\n章节/考点：${chapter}\n目标：${levels[level]}\n任务：${modeInstructions[mode]}\n\n要求：中文为主，关键专业术语附英文；区分当前规则、通用原理与可能变化的年度口径；不确定时明确说明并提醒核对中注协最新资料。\n${material ? `\n我的教材、题目或作答：\n${material}` : ""}`;
}

function renderCpaTutor() {
  const subject = currentCpaSubject();
  const activeChapter = subject.chapters[state.activeCpaChapterIndex] || subject.chapters[0];
  document.querySelector("#cpa-tutor").innerHTML = `
    <div class="cpa-tutor-layout">
      <section class="cpa-tutor-builder">
        <header><span>AI 辅导提示生成器</span><h3>让 AI 按考点讲，不让它泛泛作答。</h3><p>结构参考 CPA-Skill：零基础四步讲解、真实题型、先答后析与错因诊断。</p></header>
        <div class="cpa-tutor-fields">
          <label>科目<select id="cpa-tutor-subject">${cpaSubjects.map((item) => `<option value="${item.id}" ${item.id === subject.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></label>
          <label>章节 / 考点<select id="cpa-tutor-chapter">${subject.chapters.map((chapter) => `<option ${chapter === activeChapter ? "selected" : ""}>${escapeHtml(chapter)}</option>`).join("")}</select></label>
          <label>辅导模式<select id="cpa-tutor-mode"><option value="explain">从零讲懂</option><option value="solve">拆解一道题</option><option value="practice">生成同考点练习</option><option value="review">诊断错题</option></select></label>
          <label>能力等级<select id="cpa-tutor-level"><option value="1">1 · 知识理解</option><option value="2">2 · 基本应用</option><option value="3">3 · 综合运用</option></select></label>
        </div>
        <label>粘贴教材、题目或你的作答（可选）<textarea id="cpa-tutor-material" rows="6" placeholder="资料只在当前浏览器中处理；生成提示后复制到你使用的 AI。"></textarea></label>
        <button class="button button-primary" type="button" id="generate-cpa-prompt">生成辅导提示</button>
      </section>
      <section class="cpa-tutor-output"><span>可复制提示</span><textarea id="cpa-tutor-output" rows="17" readonly>${escapeHtml(buildCpaTutorPrompt(subject, activeChapter, "explain", "1", ""))}</textarea><button class="button button-quiet" type="button" id="copy-cpa-prompt">复制提示</button><p>提示词负责约束讲解流程；具体教材口径仍以你提供的资料和中注协最新公告为准。</p><div class="cpa-source-links"><a href="https://www.cicpa.org.cn/ztzl1/exam/exam_outline/" target="_blank" rel="noreferrer">中注协考试大纲</a><a href="https://github.com/CacinieP/CICPA-Learning" target="_blank" rel="noreferrer">CICPA-Learning</a><a href="https://github.com/yjkj999999/cpa-china-2026" target="_blank" rel="noreferrer">cpa-china-2026</a><a href="https://github.com/lyra81604/CPA-Skill" target="_blank" rel="noreferrer">CPA-Skill</a></div></section>
    </div>`;
  document.querySelector("#cpa-tutor-subject").addEventListener("change", (event) => {
    state.activeCpaSubjectId = event.target.value;
    state.activeCpaChapterIndex = 0;
    renderCpaTutor();
  });
  document.querySelector("#generate-cpa-prompt").addEventListener("click", () => {
    const selectedSubject = cpaSubjects.find((item) => item.id === document.querySelector("#cpa-tutor-subject").value);
    document.querySelector("#cpa-tutor-output").value = buildCpaTutorPrompt(selectedSubject, document.querySelector("#cpa-tutor-chapter").value, document.querySelector("#cpa-tutor-mode").value, document.querySelector("#cpa-tutor-level").value, document.querySelector("#cpa-tutor-material").value.trim());
  });
  document.querySelector("#copy-cpa-prompt").addEventListener("click", async () => {
    await navigator.clipboard.writeText(document.querySelector("#cpa-tutor-output").value);
    showToast("CPA 辅导提示已复制");
  });
}

function renderCpaStudio() {
  renderCpaSummary();
  renderCpaToday();
  renderCpaMap();
  renderCpaDrill();
  renderCpaErrors();
  renderCpaTutor();
  document.querySelectorAll("[data-cpa-view]").forEach((button) => {
    button.onclick = () => {
      state.cpaView = button.dataset.cpaView;
      syncCpaPanels();
    };
  });
  syncCpaPanels();
}

function civilPracticeState() {
  return getSetting("civil-practice", {
    id: "civil-practice",
    activePhase: civilYearPlan[0].id,
    completedTopics: {},
    activities: [],
    attempts: [],
    errors: [],
    shenlunDrafts: {},
  });
}

function currentCivilModule() {
  return civilModules.find((item) => item.id === state.activeCivilModuleId) || civilModules[0];
}

function initialCivilTopicIndex(module) {
  const featuredQuestion = civilQuestionBank.find((question) => question.moduleId === module.id);
  const questionTopicIndex = module.topics.indexOf(featuredQuestion?.topic);
  return questionTopicIndex >= 0 ? questionTopicIndex : 0;
}

function civilCoachPrompt(module, topic) {
  return `你是我的行测专项教练。当前模块：${module.name}；当前知识点：${topic}。\n\n请按以下顺序训练我：\n1. 用通俗中文解释这个知识点的识别信号、核心概念与适用边界；\n2. 基于“${module.methods.join(" → ")}”给出可执行的解题步骤；\n3. 先出一道基础题，只给题目，不给答案；\n4. 等我作答后，判断我错在识别、方法、计算还是时间分配；\n5. 最后给一道变式题，并要求我复述本题的识别信号。\n\n不要虚构真题来源；如果缺少题库材料，请明确说明是原创训练题。`;
}

function syncCivilPanels() {
  document.querySelectorAll("[data-civil-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.civilView === state.civilView));
  document.querySelectorAll("[data-civil-panel]").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.civilPanel === state.civilView));
}

function renderCivilSummary() {
  const practice = civilPracticeState();
  const totalTopics = civilModules.reduce((sum, module) => sum + module.topics.length, 0);
  const completed = Object.values(practice.completedTopics || {}).filter(Boolean).length;
  const attempts = practice.attempts || [];
  const accuracy = attempts.length ? Math.round((attempts.filter((attempt) => attempt.correct).length / attempts.length) * 100) : 0;
  const shenlunCount = (practice.activities || []).filter((item) => item.type === "shenlun-complete").length;
  document.querySelector("#civil-summary").innerHTML = `
    <div><strong>${completed}<small>/${totalTopics}</small></strong><span>专项完成</span></div>
    <div><strong>${accuracy}<small>%</small></strong><span>行测正确率</span></div>
    <div><strong>${shenlunCount}</strong><span>申论作答</span></div>`;
}

function renderCivilToday() {
  const practice = civilPracticeState();
  const phase = civilYearPlan.find((item) => item.id === practice.activePhase) || civilYearPlan[0];
  const activities = (practice.activities || []).filter((item) => item.date === todayKey());
  const minutes = activities.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
  const blocks = [
    { type: "data", minutes: 25, title: "资料分析限时组", detail: "先看题再定位，写出式子后再选速算方法", view: "aptitude", moduleId: "data-analysis" },
    { type: "aptitude", minutes: 20, title: "言语 / 判断轮换", detail: "记录题型、正确率和单题耗时，不只记录答案", view: "aptitude", moduleId: "reasoning" },
    { type: "shenlun", minutes: 20, title: "申论小题一则", detail: "审题、找点、加工、分条，保留完整草稿", view: "shenlun", moduleId: "shenlun" },
    { type: "review", minutes: 10, title: "错题复盘", detail: "为每道错题写下识别信号和下次动作", view: "errors", moduleId: null },
  ];
  document.querySelector("#civil-today").innerHTML = `
    <div class="civil-today-layout">
      <aside class="civil-cycle">
        <header><span>一年备考阶段</span><strong>${escapeHtml(phase.name)}</strong><p>${escapeHtml(phase.target)}</p></header>
        ${civilYearPlan.map((item) => `<button type="button" class="${item.id === phase.id ? "is-active" : ""}" data-civil-phase="${item.id}"><span>${escapeHtml(item.weeks)}</span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.focus)}</small></button>`).join("")}
      </aside>
      <section class="civil-daily-card">
        <header><div><span>今日建议训练</span><h3>${minutes}<small> / 75 分钟</small></h3></div><p>目前不进入招聘主攻模式，按长线节奏积累正确率、速度和表达。</p></header>
        <div class="civil-daily-blocks">
          ${blocks.map((block, index) => {
            const done = activities.some((item) => item.type === block.type);
            return `<article class="${done ? "is-done" : ""}"><span>${done ? "✓" : String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHtml(block.title)}</strong><small>${escapeHtml(block.detail)}</small></div><button type="button" data-civil-start="${block.view}" data-civil-module="${block.moduleId || ""}">去训练</button><button type="button" data-civil-complete="${block.type}" data-minutes="${block.minutes}" ${done ? "disabled" : ""}>${done ? "已记录" : `完成 ${block.minutes}m`}</button></article>`;
          }).join("")}
        </div>
      </section>
    </div>`;
  document.querySelectorAll("[data-civil-phase]").forEach((button) => button.addEventListener("click", async () => {
    await saveSetting({ ...civilPracticeState(), activePhase: button.dataset.civilPhase });
    renderCivilStudio();
  }));
  document.querySelectorAll("[data-civil-start]").forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.civilModule) {
      state.activeCivilModuleId = button.dataset.civilModule;
      state.activeCivilTopicIndex = initialCivilTopicIndex(currentCivilModule());
    }
    state.civilView = button.dataset.civilStart;
    state.civilAnswered = null;
    state.civilQuestionStartedAt = Date.now();
    renderCivilStudio();
  }));
  document.querySelectorAll("[data-civil-complete]").forEach((button) => button.addEventListener("click", async () => {
    const practiceNow = civilPracticeState();
    const activity = { id: crypto.randomUUID(), type: button.dataset.civilComplete, minutes: Number(button.dataset.minutes), date: todayKey(), createdAt: new Date().toISOString() };
    await saveSetting({ ...practiceNow, activities: [...(practiceNow.activities || []), activity] });
    renderCivilStudio();
    showToast("训练时长已计入今日进度");
  }));
}

function renderCivilAptitude() {
  const practice = civilPracticeState();
  let module = currentCivilModule();
  if (module.id === "shenlun") {
    state.activeCivilModuleId = civilModules[0].id;
    module = civilModules[0];
    state.activeCivilTopicIndex = initialCivilTopicIndex(module);
  }
  if (!module.topics[state.activeCivilTopicIndex]) state.activeCivilTopicIndex = initialCivilTopicIndex(module);
  const selectedTopic = module.topics[state.activeCivilTopicIndex];
  const selectedTopicNumber = String(state.activeCivilTopicIndex + 1).padStart(2, "0");
  const questions = civilQuestionBank.filter((question) => question.moduleId === module.id && question.topic === selectedTopic);
  const question = questions[state.civilQuestionIndex % Math.max(questions.length, 1)];
  const answered = question && state.civilAnswered?.questionId === question.id ? state.civilAnswered.answer : null;
  const completed = module.topics.filter((_, index) => practice.completedTopics?.[`${module.id}:${index}`]).length;
  const modelStart = state.activeCivilTopicIndex % civilMentalModels.length;
  const recommendedModels = [0, 1, 2].map((offset) => civilMentalModels[(modelStart + offset) % civilMentalModels.length]);
  document.querySelector("#civil-aptitude").innerHTML = `
    <div class="civil-aptitude-layout">
      <aside class="civil-module-rail">
        <header><strong>行测五模块</strong><span>优先记录正确率和耗时，再判断要不要学新方法。</span></header>
        ${civilModules.filter((item) => item.id !== "shenlun").map((item) => `<button type="button" class="${item.id === module.id ? "is-active" : ""}" data-civil-module-id="${item.id}"><b style="border-color:${item.accent};color:${item.accent}">${item.code}</b><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.target)}</small></span></button>`).join("")}
      </aside>
      <section class="civil-method-sheet">
        <header><div><span>${escapeHtml(module.target)} · 方法优先于计算</span><h3>${escapeHtml(module.name)}</h3><p>${escapeHtml(module.essence)}</p></div><strong>${completed}<small>/${module.topics.length}</small></strong></header>
        <div class="civil-methods">${module.methods.map((method) => `<span>${escapeHtml(method)}</span>`).join("")}</div>
        <div class="civil-perspective-strip">
          <div><span>蒸馏解题视角</span><strong>先选视角，再动笔。</strong></div>
          ${civilMentalModels.map((model) => `<details><summary>${escapeHtml(model.name)}</summary><p>${escapeHtml(model.note)}</p></details>`).join("")}
          <a href="${module.sourceUrl}" target="_blank" rel="noreferrer">打开本模块知识库</a>
        </div>
        <article class="civil-topic-reader" id="civil-topic-reader">
          <header><span>专项 ${selectedTopicNumber}</span><h4>${escapeHtml(selectedTopic)}</h4><p>${escapeHtml(module.essence)}</p></header>
          <div class="civil-topic-levels">
            <div><b>1</b><span><strong>识别题型</strong><small>看到题干后先确认它属于“${escapeHtml(selectedTopic)}”，圈出条件、问题与干扰信息。</small></span></div>
            <div><b>2</b><span><strong>执行方法</strong><small>${escapeHtml(module.methods.join(" → "))}</small></span></div>
            <div><b>3</b><span><strong>限时输出</strong><small>${escapeHtml(module.target)}；做完必须说明依据，并记录单题耗时。</small></span></div>
          </div>
          <aside><strong>推荐视角</strong><span>${recommendedModels.map((model) => `${escapeHtml(model.name)}：${escapeHtml(model.note)}`).join("　")}</span></aside>
          <footer><a class="button button-quiet" href="${module.sourceUrl}" target="_blank" rel="noreferrer">打开知识库</a><button class="button button-quiet" type="button" id="copy-civil-coach">复制 AI 教练提示</button><button class="button button-primary" type="button" id="start-civil-topic-drill" ${question ? "" : "disabled"}>${question ? `练本专项题 · ${questions.length}` : "本专项题库待接入"}</button></footer>
        </article>
        <div class="civil-topic-grid">
          ${module.topics.map((topic, index) => {
            const key = `${module.id}:${index}`;
            return `<div class="civil-topic ${practice.completedTopics?.[key] ? "is-done" : ""} ${index === state.activeCivilTopicIndex ? "is-active" : ""}"><label title="标记专项完成"><input type="checkbox" data-civil-topic="${key}" ${practice.completedTopics?.[key] ? "checked" : ""}><span class="sr-only">标记 ${escapeHtml(topic)} 完成</span></label><button type="button" data-civil-open-topic="${index}"><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(topic)}</strong><em>${index === state.activeCivilTopicIndex ? "学习中" : "打开"}</em></button></div>`;
          }).join("")}
        </div>
        ${question ? `<article class="civil-question">
          <div class="civil-question-meta"><span>${escapeHtml(question.topic)} · ${escapeHtml(question.difficulty)}</span><b>目标 ${question.targetSeconds}s</b></div>
          <h4>${escapeHtml(question.prompt)}</h4>
          <div class="civil-options">${question.options.map((option, index) => {
            const result = answered === null ? "" : index === question.answer ? "is-correct" : index === answered ? "is-wrong" : "";
            return `<button type="button" class="${result}" data-civil-answer="${index}" ${answered !== null ? "disabled" : ""}><span>${String.fromCharCode(65 + index)}</span>${escapeHtml(option)}</button>`;
          }).join("")}</div>
          ${answered !== null ? `<div class="civil-answer ${answered === question.answer ? "is-correct" : "is-wrong"}"><strong>${answered === question.answer ? "回答正确" : `正确答案 ${String.fromCharCode(65 + question.answer)}`}</strong><p><b>方法：</b>${escapeHtml(question.method)}</p><p><b>易错：</b>${escapeHtml(question.pitfall)}</p><button type="button" class="button button-primary" id="retry-civil-question">再练一次</button></div>` : ""}
        </article>` : `<div class="civil-empty-question"><strong>该模块示范题待接入</strong><span>基础交互已经准备好，后续题库可以直接按 moduleId 和 topic 批量添加。</span></div>`}
      </section>
    </div>`;
  document.querySelectorAll("[data-civil-module-id]").forEach((button) => button.addEventListener("click", () => {
    state.activeCivilModuleId = button.dataset.civilModuleId;
    state.activeCivilTopicIndex = initialCivilTopicIndex(currentCivilModule());
    state.civilQuestionIndex = 0;
    state.civilAnswered = null;
    state.civilQuestionStartedAt = Date.now();
    renderCivilAptitude();
  }));
  document.querySelectorAll("[data-civil-open-topic]").forEach((button) => button.addEventListener("click", () => {
    state.activeCivilTopicIndex = Number(button.dataset.civilOpenTopic);
    state.civilQuestionIndex = 0;
    state.civilAnswered = null;
    state.civilQuestionStartedAt = Date.now();
    renderCivilAptitude();
    document.querySelector("#civil-topic-reader")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }));
  document.querySelectorAll("[data-civil-topic]").forEach((checkbox) => checkbox.addEventListener("change", async () => {
    const next = civilPracticeState();
    await saveSetting({ ...next, completedTopics: { ...(next.completedTopics || {}), [checkbox.dataset.civilTopic]: checkbox.checked } });
    renderCivilStudio();
    showToast(checkbox.checked ? "专项已完成" : "专项已重新打开");
  }));
  document.querySelector("#copy-civil-coach").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(civilCoachPrompt(module, selectedTopic));
      showToast("行测专项教练提示已复制");
    } catch {
      showToast("浏览器未允许剪贴板，请稍后重试");
    }
  });
  document.querySelector("#start-civil-topic-drill").addEventListener("click", () => {
    if (!question) return;
    state.civilAnswered = null;
    state.civilQuestionStartedAt = Date.now();
    renderCivilAptitude();
    document.querySelector(".civil-question")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  document.querySelectorAll("[data-civil-answer]").forEach((button) => button.addEventListener("click", async () => {
    const answer = Number(button.dataset.civilAnswer);
    const seconds = Math.max(1, Math.round((Date.now() - state.civilQuestionStartedAt) / 1000));
    state.civilAnswered = { questionId: question.id, answer };
    const practiceNow = civilPracticeState();
    const attempt = { id: crypto.randomUUID(), questionId: question.id, moduleId: module.id, topic: question.topic, answer, correct: answer === question.answer, seconds, date: todayKey(), createdAt: new Date().toISOString() };
    const errors = answer === question.answer ? practiceNow.errors || [] : [...(practiceNow.errors || []), { id: crypto.randomUUID(), questionId: question.id, moduleId: module.id, topic: question.topic, prompt: question.prompt, reason: "待诊断", rule: question.method, resolved: false, date: todayKey(), createdAt: new Date().toISOString() }];
    await saveSetting({ ...practiceNow, attempts: [...(practiceNow.attempts || []), attempt], errors });
    renderCivilStudio();
  }));
  document.querySelector("#retry-civil-question")?.addEventListener("click", () => {
    state.civilAnswered = null;
    state.civilQuestionStartedAt = Date.now();
    renderCivilAptitude();
  });
}

function shenlunPrompt(type, material, answer) {
  return `你是严格的申论阅卷教练。请按“识别题型 → 核对材料采分点 → 评价结构与表达 → 给出最小改写任务”的顺序批改。\n\n题型：${type.name}\n任务：${type.task}\n评分维度：${type.rubric.join("、")}\n作答结构：${type.structure.join(" → ")}\n\n给定材料：\n${material || "（未提供，请提醒我补充材料，不能凭空推断采分点。）"}\n\n我的作答：\n${answer || "（未提供）"}\n\n输出要求：先列命中的采分点和遗漏点，再逐句指出问题；不要只给泛化评价，不要虚构标准答案。`;
}

function renderCivilShenlun() {
  const practice = civilPracticeState();
  const type = shenlunTypes.find((item) => item.id === state.activeShenlunTypeId) || shenlunTypes[0];
  const draft = practice.shenlunDrafts?.[type.id] || { material: "", answer: "" };
  document.querySelector("#civil-shenlun").innerHTML = `
    <div class="shenlun-layout">
      <aside class="shenlun-types">
        <header><strong>申论四类任务</strong><span>先识别任务，再决定从材料中找什么。</span></header>
        ${shenlunTypes.map((item) => `<button type="button" class="${item.id === type.id ? "is-active" : ""}" data-shenlun-type="${item.id}"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.task)}</small></button>`).join("")}
      </aside>
      <section class="shenlun-workspace">
        <header><span>${escapeHtml(type.name)}</span><h3>${escapeHtml(type.task)}</h3><div>${type.structure.map((item, index) => `<p><b>${index + 1}</b>${escapeHtml(item)}</p>`).join("")}</div></header>
        <div class="shenlun-editor-grid">
          <label>给定材料<textarea id="shenlun-material" rows="12" placeholder="粘贴题干与材料；后续题库接入后可自动带入。">${escapeHtml(draft.material)}</textarea></label>
          <label>我的作答 <span id="shenlun-word-count">${draft.answer.length} 字</span><textarea id="shenlun-answer" rows="12" placeholder="先独立作答，再生成批改提示。">${escapeHtml(draft.answer)}</textarea></label>
        </div>
        <div class="shenlun-rubric">${type.rubric.map((item) => `<label><input type="checkbox">${escapeHtml(item)}</label>`).join("")}</div>
        <div class="shenlun-actions"><button class="button button-quiet" id="save-shenlun-draft" type="button">保存草稿</button><button class="button button-primary" id="generate-shenlun-prompt" type="button">生成批改提示</button><button class="button button-quiet" id="complete-shenlun" type="button">完成本次作答</button></div>
        <label class="shenlun-prompt-output">AI 批改提示<textarea id="shenlun-prompt-output" rows="9" readonly>${escapeHtml(shenlunPrompt(type, draft.material, draft.answer))}</textarea></label>
        <footer class="civil-source-ledger"><span>参考知识库</span>${civilKnowledgeSources.map((source) => `<a href="${source.url}" target="_blank" rel="noreferrer"><strong>${escapeHtml(source.name)}</strong><small>${escapeHtml(source.scope)}</small></a>`).join("")}</footer>
      </section>
    </div>`;
  document.querySelectorAll("[data-shenlun-type]").forEach((button) => button.addEventListener("click", () => {
    state.activeShenlunTypeId = button.dataset.shenlunType;
    renderCivilShenlun();
  }));
  document.querySelector("#shenlun-answer").addEventListener("input", (event) => {
    document.querySelector("#shenlun-word-count").textContent = `${event.target.value.replace(/\s/g, "").length} 字`;
  });
  const saveDraft = async () => {
    const next = civilPracticeState();
    const value = { material: document.querySelector("#shenlun-material").value, answer: document.querySelector("#shenlun-answer").value, updatedAt: new Date().toISOString() };
    await saveSetting({ ...next, shenlunDrafts: { ...(next.shenlunDrafts || {}), [type.id]: value } });
    return value;
  };
  document.querySelector("#save-shenlun-draft").addEventListener("click", async () => {
    await saveDraft();
    showToast("申论草稿已保存在本机");
  });
  document.querySelector("#generate-shenlun-prompt").addEventListener("click", () => {
    document.querySelector("#shenlun-prompt-output").value = shenlunPrompt(type, document.querySelector("#shenlun-material").value.trim(), document.querySelector("#shenlun-answer").value.trim());
  });
  document.querySelector("#complete-shenlun").addEventListener("click", async () => {
    const value = await saveDraft();
    if (!value.answer.trim()) return showToast("先完成作答，再记录本次训练");
    const next = civilPracticeState();
    const activity = { id: crypto.randomUUID(), type: "shenlun-complete", shenlunType: type.id, minutes: 20, date: todayKey(), createdAt: new Date().toISOString() };
    await saveSetting({ ...next, activities: [...(next.activities || []), activity] });
    renderCivilStudio();
    showToast("申论作答已计入训练记录");
  });
}

function renderCivilErrors() {
  const practice = civilPracticeState();
  const errors = [...(practice.errors || [])].reverse();
  const attempts = practice.attempts || [];
  document.querySelector("#civil-errors").innerHTML = `
    <div class="civil-review-layout">
      <section class="civil-diagnosis">
        <header><span>分模块诊断</span><h3>正确率与速度必须一起看。</h3></header>
        ${civilModules.filter((item) => item.id !== "shenlun").map((module) => {
          const records = attempts.filter((item) => item.moduleId === module.id);
          const accuracy = records.length ? Math.round((records.filter((item) => item.correct).length / records.length) * 100) : 0;
          const seconds = records.length ? Math.round(records.reduce((sum, item) => sum + item.seconds, 0) / records.length) : 0;
          return `<div class="civil-diagnosis-row"><span style="background:${module.accent}">${module.code}</span><strong>${escapeHtml(module.name)}</strong><b>${accuracy}%</b><small>${records.length ? `${seconds}s / 题` : "暂无作答"}</small></div>`;
        }).join("")}
      </section>
      <section class="civil-error-book">
        <header><div><span>错题复盘</span><strong>${errors.filter((item) => !item.resolved).length} 道待处理</strong></div><p>写下“看到什么信号 → 应该用什么方法”，再标记解决。</p></header>
        ${errors.length ? errors.map((item) => `<article class="${item.resolved ? "is-resolved" : ""}"><div><span>${escapeHtml(civilModules.find((module) => module.id === item.moduleId)?.name || "行测")} / ${escapeHtml(item.topic)}</span><strong>${escapeHtml(item.prompt)}</strong><p>${escapeHtml(item.rule)}</p></div><label>错因<select data-civil-error-reason="${item.id}" ${item.resolved ? "disabled" : ""}><option ${item.reason === "待诊断" ? "selected" : ""}>待诊断</option><option ${item.reason === "题型未识别" ? "selected" : ""}>题型未识别</option><option ${item.reason === "方法选错" ? "selected" : ""}>方法选错</option><option ${item.reason === "计算失误" ? "selected" : ""}>计算失误</option><option ${item.reason === "时间失控" ? "selected" : ""}>时间失控</option></select></label><button type="button" data-civil-resolve="${item.id}">${item.resolved ? "重新打开" : "标记已解决"}</button></article>`).join("") : `<div class="civil-empty"><strong>还没有错题</strong><span>在行测专项中答错后会自动加入这里。</span></div>`}
      </section>
    </div>`;
  document.querySelectorAll("[data-civil-error-reason]").forEach((select) => select.addEventListener("change", async () => {
    const next = civilPracticeState();
    await saveSetting({ ...next, errors: (next.errors || []).map((item) => item.id === select.dataset.civilErrorReason ? { ...item, reason: select.value } : item) });
  }));
  document.querySelectorAll("[data-civil-resolve]").forEach((button) => button.addEventListener("click", async () => {
    const next = civilPracticeState();
    await saveSetting({ ...next, errors: (next.errors || []).map((item) => item.id === button.dataset.civilResolve ? { ...item, resolved: !item.resolved } : item) });
    renderCivilStudio();
  }));
}

function renderCivilStudio() {
  renderCivilSummary();
  renderCivilToday();
  renderCivilAptitude();
  renderCivilShenlun();
  renderCivilErrors();
  document.querySelectorAll("[data-civil-view]").forEach((button) => {
    button.onclick = () => {
      state.civilView = button.dataset.civilView;
      syncCivilPanels();
    };
  });
  syncCivilPanels();
}

function englishPracticeState() {
  return getSetting("english-practice", {
    id: "english-practice",
    reviews: {},
    activities: [],
    paperDrafts: {},
    shadowCompleted: {},
    customMaterial: "",
    customSentences: [],
    customCompleted: {},
    dictationCompleted: {},
    expressionDrafts: {},
    expressionCompleted: {},
  });
}

function englishTodayActivities() {
  return (englishPracticeState().activities || []).filter((activity) => activity.date === todayKey());
}

function englishStreak() {
  const dates = new Set((englishPracticeState().activities || []).map((activity) => activity.date));
  const cursor = new Date();
  if (!dates.has(todayKey())) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (true) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    if (!dates.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function newEnglishActivity(type, minutes, xp, label) {
  return {
    id: crypto.randomUUID(),
    type,
    minutes,
    xp,
    label,
    date: todayKey(),
    createdAt: new Date().toISOString(),
  };
}

async function recordEnglishActivity(type, minutes, xp, label) {
  const practice = englishPracticeState();
  await saveSetting({
    ...practice,
    activities: [...(practice.activities || []), newEnglishActivity(type, minutes, xp, label)],
  });
}

function speakEnglish(text, rate = 0.88) {
  if (!("speechSynthesis" in window)) {
    showToast("当前浏览器不支持语音朗读");
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = rate;
  const voice = window.speechSynthesis.getVoices().find((item) => item.lang.startsWith("en"));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

function speakEnglishLoop(text, rate = 0.82, repeats = 3) {
  if (!("speechSynthesis" in window)) {
    showToast("当前浏览器不支持语音朗读");
    return;
  }
  window.speechSynthesis.cancel();
  const voice = window.speechSynthesis.getVoices().find((item) => item.lang.startsWith("en"));
  for (let index = 0; index < repeats; index += 1) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = rate;
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  }
}

function normalizedWords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function wordEditDistance(expected, actual) {
  const source = normalizedWords(expected);
  const target = normalizedWords(actual);
  const rows = Array.from({ length: source.length + 1 }, () => Array(target.length + 1).fill(0));
  for (let index = 0; index <= source.length; index += 1) rows[index][0] = index;
  for (let index = 0; index <= target.length; index += 1) rows[0][index] = index;
  for (let row = 1; row <= source.length; row += 1) {
    for (let column = 1; column <= target.length; column += 1) {
      const cost = source[row - 1] === target[column - 1] ? 0 : 1;
      rows[row][column] = Math.min(rows[row - 1][column] + 1, rows[row][column - 1] + 1, rows[row - 1][column - 1] + cost);
    }
  }
  const distance = rows[source.length][target.length];
  return {
    distance,
    accuracy: Math.max(0, Math.round((1 - distance / Math.max(source.length, 1)) * 100)),
    expectedWords: source.length,
    actualWords: target.length,
  };
}

function splitEnglishSentences(text) {
  return (text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [])
    .map((sentence) => sentence.trim().replace(/\s+/g, " "))
    .filter((sentence) => normalizedWords(sentence).length >= 3)
    .slice(0, 50);
}

function renderEnglishStats() {
  const activities = englishTodayActivities();
  const minutes = activities.reduce((sum, activity) => sum + Number(activity.minutes || 0), 0);
  const xp = activities.reduce((sum, activity) => sum + Number(activity.xp || 0), 0);
  const progress = Math.min((minutes / 60) * 100, 100);
  document.querySelector("#english-today-stats").innerHTML = `
    <div class="english-stat"><strong>${englishStreak()}</strong><span>连续天数</span></div>
    <div class="english-stat"><strong>${minutes}<small>/60</small></strong><span>今日分钟</span></div>
    <div class="english-stat"><strong>${xp}</strong><span>练习点</span></div>
    <div class="english-progress" aria-label="今日英语训练进度"><span style="width:${progress}%"></span></div>`;
}

function renderQuickLesson() {
  const container = document.querySelector("#english-quick-lesson");
  if (!container) return;
  const completedToday = englishTodayActivities().some((activity) => activity.type === "quick-lesson");
  if (state.quickLessonFinished || (completedToday && state.quickLessonIndex === 0 && state.quickLessonAnswered === null)) {
    container.innerHTML = `
      <div class="quick-finish">
        <span>短课完成</span>
        <strong>${completedToday && !state.quickLessonFinished ? "今日已练" : `${state.quickLessonScore} / ${englishQuickLessons.length}`}</strong>
        <p>反馈已经留下。下一步不要继续刷题，去做一次词汇回忆或口头输出。</p>
        <button class="text-button" id="restart-quick-lesson" type="button">再练一次</button>
      </div>`;
    document.querySelector("#restart-quick-lesson").addEventListener("click", () => {
      state.quickLessonIndex = 0;
      state.quickLessonScore = 0;
      state.quickLessonAnswered = null;
      state.quickLessonFinished = false;
      renderEnglishToday();
    });
    return;
  }

  const lesson = englishQuickLessons[state.quickLessonIndex];
  const answered = state.quickLessonAnswered;
  container.innerHTML = `
    <div class="quick-progress"><span>短课 ${state.quickLessonIndex + 1} / ${englishQuickLessons.length}</span><span>答对 ${state.quickLessonScore}</span></div>
    <h3>${escapeHtml(lesson.prompt)}</h3>
    <p class="quick-translation"><span>中文</span>${escapeHtml(lesson.translation)}</p>
    <div class="quick-options">
      ${lesson.options
        .map((option, index) => {
          const resultClass = answered === null ? "" : index === lesson.answer ? "is-correct" : index === answered ? "is-wrong" : "";
          return `<button class="quick-option ${resultClass}" type="button" data-lesson-answer="${index}" ${answered !== null ? "disabled" : ""}><span>${String.fromCharCode(65 + index)}</span>${escapeHtml(option)}</button>`;
        })
        .join("")}
    </div>
    ${answered !== null ? `<div class="quick-feedback ${answered === lesson.answer ? "is-correct" : "is-wrong"}"><strong>${answered === lesson.answer ? "回答正确" : "需要重看"}</strong><span><b>中文语法说明：</b>${escapeHtml(lesson.explanation)}</span><button class="button button-primary" id="next-quick-lesson" type="button">${state.quickLessonIndex === englishQuickLessons.length - 1 ? "完成短课" : "下一题"}</button></div>` : ""}`;

  container.querySelectorAll("[data-lesson-answer]").forEach((button) => {
    button.addEventListener("click", () => {
      state.quickLessonAnswered = Number(button.dataset.lessonAnswer);
      if (state.quickLessonAnswered === lesson.answer) state.quickLessonScore += 1;
      renderQuickLesson();
    });
  });
  document.querySelector("#next-quick-lesson")?.addEventListener("click", async () => {
    if (state.quickLessonIndex === englishQuickLessons.length - 1) {
      state.quickLessonFinished = true;
      await recordEnglishActivity("quick-lesson", 10, state.quickLessonScore * 4, `语法与表达短课 ${state.quickLessonScore}/${englishQuickLessons.length}`);
      renderEnglishStudio();
      showToast("短课完成，今日英语进度已更新");
    } else {
      state.quickLessonIndex += 1;
      state.quickLessonAnswered = null;
      renderQuickLesson();
    }
  });
}

function renderEnglishToday() {
  const activities = englishTodayActivities();
  const vocabularyCount = activities.filter((activity) => activity.type === "vocabulary").length;
  const steps = [
    { type: "quick-lesson", minutes: 10, title: "语法与表达短课", detail: "英文题干、中文翻译与语法解释", done: activities.some((item) => item.type === "quick-lesson") },
    { type: "vocabulary", minutes: 10, title: "语境词汇", detail: `主动回忆 10 个词 · 今日 ${vocabularyCount} 个`, done: vocabularyCount >= 10 },
    { type: "expressions", minutes: 10, title: "日常用语", detail: "听一句、替换结构、说自己的版本", done: activities.some((item) => item.type === "daily-expression") },
    { type: "shadowing", minutes: 10, title: "回声与听写", detail: "循环跟读、精听校对或练习自己的材料", done: activities.some((item) => ["shadowing", "dictation", "custom-material"].includes(item.type)) },
    { type: "paper", minutes: 20, title: "论文英语", detail: "拆摘要结构，再用自己的话改写", done: activities.some((item) => item.type === "paper") },
  ];
  document.querySelector("#english-today").innerHTML = `
    <div class="english-day-grid">
      <aside class="english-route">
        <div class="english-route-head"><strong>今日 60 分钟</strong><span>完成短课即可延续连续天数</span><span>这里按建议时长累计；总学习时长仍由顶部“记录学习”统计</span></div>
        ${steps
          .map(
            (step, index) => `<button type="button" class="english-route-step ${step.done ? "is-done" : ""}" data-route-view="${step.type === "quick-lesson" ? "today" : step.type}">
              <span>${step.done ? "✓" : String(index + 1).padStart(2, "0")}</span>
              <span><strong>${escapeHtml(step.title)}</strong><small>${escapeHtml(step.detail)}</small></span>
              <b>${step.minutes}m</b>
            </button>`,
          )
          .join("")}
      </aside>
      <section class="english-lesson-sheet" id="english-quick-lesson"></section>
    </div>`;
  document.querySelectorAll("[data-route-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextView = button.dataset.routeView;
      if (nextView === "today") return;
      state.englishView = nextView;
      syncEnglishPanels();
    });
  });
  renderQuickLesson();
}

function dueVocabulary() {
  const reviews = englishPracticeState().reviews || {};
  const now = Date.now();
  return englishVocabulary.filter((item) => !reviews[item.id] || new Date(reviews[item.id].dueAt).getTime() <= now);
}

function renderEnglishVocabulary() {
  const practice = englishPracticeState();
  const reviews = practice.reviews || {};
  const due = dueVocabulary();
  let word = englishVocabulary.find((item) => item.id === state.activeVocabularyId && due.some((dueItem) => dueItem.id === item.id));
  if (!word) word = due[0];
  if (word) state.activeVocabularyId = word.id;
  const learned = englishVocabulary.filter((item) => reviews[item.id]).length;
  const stable = englishVocabulary.filter((item) => Number(reviews[item.id]?.intervalDays || 0) >= 7).length;
  if (!word) {
    document.querySelector("#english-vocabulary").innerHTML = `<div class="vocab-complete"><span>今日到期词汇已清空</span><h3>先在阅读中遇见新词，再加入记忆。</h3><p>当前已学习 ${learned} 个词，其中 ${stable} 个进入稳定复习阶段。</p></div>`;
    return;
  }
  const blank = word.example.replace(new RegExp(word.word.replace(" ", "\\s+"), "i"), "_____");
  document.querySelector("#english-vocabulary").innerHTML = `
    <div class="vocabulary-layout">
      <aside class="vocabulary-ledger">
        <div><span>今日到期</span><strong>${due.length}</strong></div>
        <div><span>已经学习</span><strong>${learned}</strong></div>
        <div><span>稳定掌握</span><strong>${stable}</strong></div>
        <p>先凭例句回忆，再看答案。评级应反映真实提取难度，而不是熟悉感。</p>
      </aside>
      <section class="word-card ${state.vocabularyRevealed ? "is-revealed" : ""}">
        <div class="word-context"><span>在语境中回忆</span><p>${escapeHtml(blank)}</p></div>
        <div class="word-head"><div><h3>${escapeHtml(word.word)}</h3><span>${escapeHtml(word.phonetic)} · ${escapeHtml(word.pos)}</span></div><button class="word-audio" type="button" id="play-word" aria-label="朗读 ${escapeHtml(word.word)}">▶</button></div>
        ${state.vocabularyRevealed ? `<div class="word-answer"><strong>${escapeHtml(word.meaning)}</strong><span>${escapeHtml(word.collocation)}</span><p>${escapeHtml(word.example)}</p></div><div class="memory-ratings"><button data-vocab-rating="again" type="button"><span>重来</span><small>10 分钟</small></button><button data-vocab-rating="hard" type="button"><span>困难</span><small>1 天</small></button><button data-vocab-rating="good" type="button"><span>记得</span><small>3+ 天</small></button><button data-vocab-rating="easy" type="button"><span>简单</span><small>7+ 天</small></button></div>` : `<button class="reveal-word" id="reveal-word" type="button">显示答案</button>`}
      </section>
    </div>`;
  document.querySelector("#play-word").addEventListener("click", () => speakEnglish(`${word.word}. ${word.example}`, 0.82));
  document.querySelector("#reveal-word")?.addEventListener("click", () => {
    state.vocabularyRevealed = true;
    renderEnglishVocabulary();
  });
  document.querySelectorAll("[data-vocab-rating]").forEach((button) => {
    button.addEventListener("click", async () => {
      const rating = button.dataset.vocabRating;
      const current = englishPracticeState();
      const previous = current.reviews?.[word.id] || { intervalDays: 0, repetitions: 0 };
      const intervalMap = { again: 0, hard: 1, good: Math.max(3, Math.round(previous.intervalDays * 2.1)), easy: Math.max(7, Math.round(previous.intervalDays * 3)) };
      const delayMs = rating === "again" ? 10 * 60 * 1000 : intervalMap[rating] * 24 * 60 * 60 * 1000;
      const review = { intervalDays: intervalMap[rating], repetitions: previous.repetitions + 1, lastReviewedAt: new Date().toISOString(), dueAt: new Date(Date.now() + delayMs).toISOString() };
      await saveSetting({
        ...current,
        reviews: { ...(current.reviews || {}), [word.id]: review },
        activities: [...(current.activities || []), newEnglishActivity("vocabulary", 1, rating === "again" ? 1 : 2, `复习 ${word.word}`)],
      });
      const next = dueVocabulary().find((item) => item.id !== word.id);
      if (next) state.activeVocabularyId = next.id;
      state.vocabularyRevealed = false;
      renderEnglishStudio();
    });
  });
}

function renderDailyExpressions() {
  const practice = englishPracticeState();
  const item = dailyExpressions[state.activeExpressionIndex];
  const draft = practice.expressionDrafts?.[item.id] || "";
  const completedCount = Object.keys(practice.expressionCompleted || {}).length;
  document.querySelector("#english-expressions").innerHTML = `
    <div class="expression-layout">
      <aside class="expression-scenes">
        <header><strong>沟通场景</strong><span>${completedCount} / ${dailyExpressions.length} 已练</span></header>
        ${dailyExpressions
          .map(
            (expression, index) => `<button type="button" class="${index === state.activeExpressionIndex ? "is-active" : ""} ${practice.expressionCompleted?.[expression.id] ? "is-done" : ""}" data-expression-index="${index}"><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(expression.scene)}</strong></button>`,
          )
          .join("")}
      </aside>
      <section class="expression-sheet">
        <div class="expression-scene-label"><span>场景</span><strong>${escapeHtml(item.scene)}</strong></div>
        <div class="expression-phrase-row"><blockquote>${escapeHtml(item.phrase)}</blockquote><button class="word-audio" id="play-expression" type="button" aria-label="朗读日常用语">▶</button></div>
        <p class="expression-translation">${escapeHtml(item.translation)}</p>
        <div class="expression-guidance">
          <div><b>什么时候用</b><p>${escapeHtml(item.note)}</p></div>
          <div><b>可替换结构</b><p>${escapeHtml(item.pattern)}</p></div>
        </div>
        <div class="expression-variants"><b>再听两种说法</b>${item.variants.map((variant) => `<button type="button" data-speak-variant="${escapeHtml(variant)}">▶ <span>${escapeHtml(variant)}</span></button>`).join("")}</div>
        <label class="expression-practice">换成你自己的表达<span>${escapeHtml(item.prompt)}</span><textarea id="expression-draft" rows="3" placeholder="Write your own sentence here…">${escapeHtml(draft)}</textarea></label>
        <div class="expression-actions"><button class="button button-quiet" id="save-expression" type="button">保存表达</button><button class="button button-primary" id="complete-expression" type="button">完成并练下一句</button><span>${practice.expressionCompleted?.[item.id] ? "✓ 已练习" : "先听，再说出自己的版本"}</span></div>
      </section>
    </div>`;

  document.querySelectorAll("[data-expression-index]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeExpressionIndex = Number(button.dataset.expressionIndex);
      renderDailyExpressions();
    });
  });
  document.querySelector("#play-expression").addEventListener("click", () => speakEnglish(item.phrase, 0.86));
  document.querySelectorAll("[data-speak-variant]").forEach((button) => button.addEventListener("click", () => speakEnglish(button.dataset.speakVariant, 0.86)));
  document.querySelector("#save-expression").addEventListener("click", async () => {
    const current = englishPracticeState();
    await saveSetting({
      ...current,
      expressionDrafts: { ...(current.expressionDrafts || {}), [item.id]: document.querySelector("#expression-draft").value.trim() },
    });
    showToast("自己的表达已保存");
  });
  document.querySelector("#complete-expression").addEventListener("click", async () => {
    const personalSentence = document.querySelector("#expression-draft").value.trim();
    if (personalSentence.length < 8) {
      showToast("先写一句自己的英文表达，再完成练习");
      return;
    }
    const current = englishPracticeState();
    await saveSetting({
      ...current,
      expressionDrafts: { ...(current.expressionDrafts || {}), [item.id]: personalSentence },
      expressionCompleted: { ...(current.expressionCompleted || {}), [item.id]: new Date().toISOString() },
      activities: [...(current.activities || []), newEnglishActivity("daily-expression", 10, 12, `日常用语：${item.scene}`)],
    });
    state.activeExpressionIndex = (state.activeExpressionIndex + 1) % dailyExpressions.length;
    renderEnglishStudio();
    showToast("日常用语已完成，进入下一场景");
  });
}

function renderEnglishShadowing() {
  const practice = englishPracticeState();
  const item = shadowingSentences[state.activeShadowingIndex];
  const completedCount = Object.keys(practice.shadowCompleted || {}).length;
  const totalMinutes = (practice.activities || []).reduce((sum, activity) => sum + Number(activity.minutes || 0), 0);
  const modeLabels = { echo: "回声跟读", dictation: "精听听写", custom: "我的材料" };
  const commonHeader = `
    <header class="shadow-lab-head">
      <nav aria-label="听说训练模式">${Object.entries(modeLabels).map(([id, label]) => `<button type="button" class="${state.shadowMode === id ? "is-active" : ""}" data-shadow-mode="${id}">${label}</button>`).join("")}</nav>
      <div><strong>${(totalMinutes / 60).toFixed(1)}h</strong><span>累计英语训练 / 1000h</span></div>
    </header>`;

  const builtInSequence = (hideText = false) => `
    <aside class="shadow-sequence">
      <strong>${state.shadowMode === "dictation" ? "精听句库" : "跟读句库"}</strong>
      <span>${completedCount} / ${shadowingSentences.length} 句完成</span>
      ${shadowingSentences.map((sentence, index) => `<button type="button" class="${index === state.activeShadowingIndex ? "is-active" : ""} ${practice.shadowCompleted?.[sentence.id] ? "is-done" : ""}" data-shadow-index="${index}"><span>${String(index + 1).padStart(2, "0")}</span>${hideText ? `${normalizedWords(sentence.text).length} words · 点击练习` : escapeHtml(sentence.text)}</button>`).join("")}
    </aside>`;

  let content;
  if (state.shadowMode === "dictation") {
    const result = state.dictationResult;
    content = `
      <div class="shadow-layout">
        ${builtInSequence(true)}
        <section class="dictation-sheet">
          <span>LISTEN → TYPE → CHECK</span>
          <h3>只听句子，不看原文。</h3>
          <p>先听完整意思，再按意群写下；标点和大小写不计分。</p>
          <div class="dictation-controls"><label>语速<select id="dictation-rate"><option value="0.72">慢速 0.72×</option><option value="0.88" selected>练习 0.88×</option><option value="1">原速 1.0×</option></select></label><button class="button button-primary" id="play-dictation" type="button">播放听写</button></div>
          <label class="dictation-input">写下你听到的内容<textarea id="dictation-answer" rows="4" spellcheck="false" placeholder="Type the sentence you hear…">${escapeHtml(result?.input || "")}</textarea></label>
          <button class="button button-quiet" id="check-dictation" type="button">检查听写</button>
          ${result ? `<div class="dictation-result"><strong>${result.accuracy}<small>%</small></strong><div><b>${result.accuracy >= 90 ? "听写准确" : result.accuracy >= 70 ? "接近了，再听一次" : "先对照原文找漏词"}</b><p>${escapeHtml(item.text)}</p><span>${escapeHtml(item.translation)}</span><small>编辑距离 ${result.distance} · 目标 ${result.expectedWords} 词 · 写下 ${result.actualWords} 词</small></div></div><div class="dictation-result-actions"><button class="text-button" id="retry-dictation" type="button">清空重练</button><button class="button button-primary" id="record-dictation" type="button">记录本轮听写</button></div>` : ""}
        </section>
      </div>`;
  } else if (state.shadowMode === "custom") {
    const sentences = practice.customSentences || [];
    const customIndex = Math.min(state.activeCustomSentenceIndex, Math.max(sentences.length - 1, 0));
    const customSentence = sentences[customIndex];
    content = `
      <div class="shadow-layout custom-material-layout">
        <aside class="shadow-sequence custom-sequence">
          <strong>我的句子</strong>
          <span>${sentences.length ? `${sentences.length} 句本地材料` : "尚未导入材料"}</span>
          ${sentences.map((sentence, index) => `<button type="button" class="${index === customIndex ? "is-active" : ""} ${practice.customCompleted?.[index] ? "is-done" : ""}" data-custom-index="${index}"><span>${String(index + 1).padStart(2, "0")}</span>${escapeHtml(sentence)}</button>`).join("")}
        </aside>
        <section class="custom-material-sheet">
          <div class="custom-import">
            <span>导入真实材料</span>
            <p>粘贴论文摘要、视频字幕或日常文章。系统只在本机切句，最多保留 50 句。</p>
            <textarea id="custom-material-input" rows="4" placeholder="Paste English text here…">${escapeHtml(practice.customMaterial || "")}</textarea>
            <button class="button button-quiet" id="import-custom-material" type="button">切分并保存材料</button>
          </div>
          ${customSentence ? `<div class="custom-practice"><span>句子 ${customIndex + 1} / ${sentences.length}</span><blockquote>${escapeHtml(customSentence)}</blockquote><div class="shadow-controls"><button class="button button-primary" id="play-custom-sentence" type="button">播放一次</button><button class="button button-quiet" id="loop-custom-sentence" type="button">回声循环 ×3</button><button class="button button-quiet" id="complete-custom-sentence" type="button">完成这句</button></div></div>` : `<div class="custom-empty"><strong>从你真正想读懂的内容开始。</strong><span>建议一次导入 5–15 句，逐句听、读、复述。</span></div>`}
        </section>
      </div>`;
  } else {
    content = `
      <div class="shadow-layout">
        ${builtInSequence(false)}
        <section class="shadow-sheet">
          <span>LISTEN → ECHO ×3 → RECORD</span>
          <blockquote>${escapeHtml(item.text)}</blockquote>
          <p>${escapeHtml(item.translation)}</p>
          <div class="pronunciation-note"><strong>朗读重点</strong><span>${escapeHtml(item.focus)}</span></div>
          <div class="shadow-controls"><label>语速<select id="shadow-rate"><option value="0.72">慢速 0.72×</option><option value="0.88" selected>练习 0.88×</option><option value="1">原速 1.0×</option></select></label><button class="button button-primary" id="play-shadow" type="button">播放一次</button><button class="button button-quiet" id="loop-shadow" type="button">回声循环 ×3</button><button class="button button-quiet" id="complete-shadow" type="button">完成本轮跟读</button></div>
          <small>听一遍掌握意群，连续跟读三遍，最后用系统录音机录下自己的版本。本站不会调用麦克风。</small>
        </section>
      </div>`;
  }

  document.querySelector("#english-shadowing").innerHTML = `${commonHeader}${content}`;
  document.querySelectorAll("[data-shadow-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.shadowMode = button.dataset.shadowMode;
      state.dictationResult = null;
      renderEnglishShadowing();
    });
  });
  document.querySelectorAll("[data-shadow-index]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeShadowingIndex = Number(button.dataset.shadowIndex);
      state.dictationResult = null;
      renderEnglishShadowing();
    });
  });

  if (state.shadowMode === "echo") {
    document.querySelector("#play-shadow").addEventListener("click", () => speakEnglish(item.text, Number(document.querySelector("#shadow-rate").value)));
    document.querySelector("#loop-shadow").addEventListener("click", () => speakEnglishLoop(item.text, Number(document.querySelector("#shadow-rate").value), 3));
    document.querySelector("#complete-shadow").addEventListener("click", async () => {
      const current = englishPracticeState();
      await saveSetting({
        ...current,
        shadowCompleted: { ...(current.shadowCompleted || {}), [item.id]: new Date().toISOString() },
        activities: [...(current.activities || []), newEnglishActivity("shadowing", 10, 12, `回声跟读：${item.text}`)],
      });
      state.activeShadowingIndex = (state.activeShadowingIndex + 1) % shadowingSentences.length;
      renderEnglishStudio();
      showToast("跟读已记录；请回听自己的最后一遍");
    });
  }

  if (state.shadowMode === "dictation") {
    document.querySelector("#play-dictation").addEventListener("click", () => speakEnglish(item.text, Number(document.querySelector("#dictation-rate").value)));
    document.querySelector("#check-dictation").addEventListener("click", () => {
      const input = document.querySelector("#dictation-answer").value.trim();
      if (!input) {
        showToast("先写下你听到的内容");
        return;
      }
      state.dictationResult = { ...wordEditDistance(item.text, input), input };
      renderEnglishShadowing();
    });
    document.querySelector("#retry-dictation")?.addEventListener("click", () => {
      state.dictationResult = null;
      renderEnglishShadowing();
    });
    document.querySelector("#record-dictation")?.addEventListener("click", async () => {
      const current = englishPracticeState();
      await saveSetting({
        ...current,
        dictationCompleted: { ...(current.dictationCompleted || {}), [item.id]: { accuracy: state.dictationResult.accuracy, completedAt: new Date().toISOString() } },
        activities: [...(current.activities || []), newEnglishActivity("dictation", 10, Math.max(5, Math.round(state.dictationResult.accuracy / 5)), `精听听写：${state.dictationResult.accuracy}%`)],
      });
      state.dictationResult = null;
      state.activeShadowingIndex = (state.activeShadowingIndex + 1) % shadowingSentences.length;
      renderEnglishStudio();
      showToast("听写成绩已记录");
    });
  }

  if (state.shadowMode === "custom") {
    document.querySelectorAll("[data-custom-index]").forEach((button) => {
      button.addEventListener("click", () => {
        state.activeCustomSentenceIndex = Number(button.dataset.customIndex);
        renderEnglishShadowing();
      });
    });
    document.querySelector("#import-custom-material").addEventListener("click", async () => {
      const material = document.querySelector("#custom-material-input").value.trim();
      const sentences = splitEnglishSentences(material);
      if (!sentences.length) {
        showToast("至少粘贴一个包含三个英文词的完整句子");
        return;
      }
      const current = englishPracticeState();
      await saveSetting({ ...current, customMaterial: material, customSentences: sentences, customCompleted: {} });
      state.activeCustomSentenceIndex = 0;
      renderEnglishShadowing();
      showToast(`已切分并保存 ${sentences.length} 个句子`);
    });
    const sentences = englishPracticeState().customSentences || [];
    const customSentence = sentences[state.activeCustomSentenceIndex];
    document.querySelector("#play-custom-sentence")?.addEventListener("click", () => speakEnglish(customSentence, 0.86));
    document.querySelector("#loop-custom-sentence")?.addEventListener("click", () => speakEnglishLoop(customSentence, 0.82, 3));
    document.querySelector("#complete-custom-sentence")?.addEventListener("click", async () => {
      const current = englishPracticeState();
      await saveSetting({
        ...current,
        customCompleted: { ...(current.customCompleted || {}), [state.activeCustomSentenceIndex]: new Date().toISOString() },
        activities: [...(current.activities || []), newEnglishActivity("custom-material", 10, 12, `自选材料：${customSentence}`)],
      });
      state.activeCustomSentenceIndex = Math.min(state.activeCustomSentenceIndex + 1, sentences.length - 1);
      renderEnglishStudio();
      showToast("自选材料练习已记录");
    });
  }
}

function currentPaperForEnglish() {
  return state.dailyPapers[0] || fallbackPapers[0];
}

function paperEnglishDraftFromForm() {
  const form = document.querySelector("#paper-english-form");
  return {
    question: form.elements.question.value.trim(),
    method: form.elements.method.value.trim(),
    result: form.elements.result.value.trim(),
    limitation: form.elements.limitation.value.trim(),
    summary: form.elements.summary.value.trim(),
    updatedAt: new Date().toISOString(),
  };
}

function renderPaperEnglish() {
  const paper = currentPaperForEnglish();
  const practice = englishPracticeState();
  const draft = practice.paperDrafts?.[paper.id] || {};
  document.querySelector("#english-paper").innerHTML = `
    <div class="paper-english-layout">
      <article class="paper-source">
        <span>今日原文</span>
        <h3>${escapeHtml(paper.title)}</h3>
        <p>${escapeHtml(paper.summary || "Open the paper and identify its research question, method, result, and limitation.")}</p>
        <a href="${escapeHtml(paper.url)}" target="_blank" rel="noreferrer">打开论文原文</a>
        <div class="paper-reading-order"><b>阅读顺序</b><span>标题 → 摘要 → 图表 → 结论 → 方法</span></div>
      </article>
      <form class="paper-english-form" id="paper-english-form">
        <div class="paper-structure-grid">
          <label>Research question<input name="question" value="${escapeHtml(draft.question || "")}" placeholder="This paper investigates whether…" /></label>
          <label>Method<input name="method" value="${escapeHtml(draft.method || "")}" placeholder="The authors evaluate…" /></label>
          <label>Main result<input name="result" value="${escapeHtml(draft.result || "")}" placeholder="The results show that…" /></label>
          <label>Limitation<input name="limitation" value="${escapeHtml(draft.limitation || "")}" placeholder="One limitation is…" /></label>
        </div>
        <label>用自己的话写 80–120 词摘要<textarea name="summary" rows="7" placeholder="Do not translate sentence by sentence. Rebuild the logic in your own words.">${escapeHtml(draft.summary || "")}</textarea></label>
        <div class="paper-english-actions"><button class="button button-quiet" id="save-paper-english" type="button">保存草稿</button><button class="button button-primary" id="complete-paper-english" type="button">完成本次训练</button><span>${draft.completedAt ? "✓ 已完成过" : "草稿仅存本机"}</span></div>
      </form>
    </div>`;
  document.querySelector("#save-paper-english").addEventListener("click", async () => {
    const current = englishPracticeState();
    await saveSetting({ ...current, paperDrafts: { ...(current.paperDrafts || {}), [paper.id]: paperEnglishDraftFromForm() } });
    showToast("论文英语草稿已保存");
  });
  document.querySelector("#complete-paper-english").addEventListener("click", async () => {
    const nextDraft = paperEnglishDraftFromForm();
    if (nextDraft.summary.split(/\s+/).filter(Boolean).length < 40) {
      showToast("先完成至少 40 个英文词，再标记训练完成");
      return;
    }
    const current = englishPracticeState();
    await saveSetting({
      ...current,
      paperDrafts: { ...(current.paperDrafts || {}), [paper.id]: { ...nextDraft, completedAt: new Date().toISOString() } },
      activities: [...(current.activities || []), newEnglishActivity("paper", 20, 25, `论文英语：${paper.title}`)],
    });
    renderEnglishStudio();
    showToast("论文英语训练已计入今日进度");
  });
}

function syncEnglishPanels() {
  document.querySelectorAll("[data-english-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.englishView === state.englishView));
  document.querySelectorAll("[data-english-panel]").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.englishPanel === state.englishView));
}

function renderEnglishStudio() {
  renderEnglishStats();
  renderEnglishToday();
  renderEnglishVocabulary();
  renderDailyExpressions();
  renderEnglishShadowing();
  renderPaperEnglish();
  document.querySelectorAll("[data-english-view]").forEach((button) => {
    button.onclick = () => {
      state.englishView = button.dataset.englishView;
      syncEnglishPanels();
    };
  });
  syncEnglishPanels();
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
    renderPaperEnglish();
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
  renderPaperEnglish();
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
  renderCpaStudio();
  renderCivilStudio();
  renderEnglishStudio();
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
