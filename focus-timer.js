import { db } from './db.js?v=20260921-10';
import { modules } from './data.js?v=20260921-10';

const STORAGE_KEY = 'workstation-focus-v1';
const modes = { focus: { name: '专注', minutes: 25 }, short: { name: '短休息', minutes: 5 }, long: { name: '长休息', minutes: 15 } };
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const freshRound = (mode = 'focus', minutes = modes[mode].minutes) => ({
  id: crypto.randomUUID(), mode, minutes, remaining: minutes * 60, deadline: null,
  status: 'idle', moduleId: 'data-ai', task: '', recorded: false, completed: [],
});
let storageAvailable = true;
function readState() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (value && modes[value.mode] && ['idle', 'running', 'paused', 'complete'].includes(value.status)
        && Number.isFinite(value.minutes) && value.minutes > 0 && value.minutes <= 60
        && Number.isFinite(value.remaining) && value.remaining >= 0
        && (value.status !== 'running' || Number.isFinite(value.deadline))
        && modules.some(module => module.id === value.moduleId) && typeof value.id === 'string') {
      return { ...freshRound(), ...value, completed: Array.isArray(value.completed) ? value.completed : [] };
    }
  } catch { storageAvailable = false; }
  return freshRound();
}
let timer = readState();
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(timer)); }
  catch { storageAvailable = false; }
}

const panel = document.createElement('aside');
panel.id = 'focus-timer';
panel.className = 'focus-timer';
panel.hidden = true;
panel.setAttribute('aria-labelledby', 'focus-title');
panel.innerHTML = `
  <header class="focus-head"><div><span class="focus-eyebrow">留一段时间，做一件事</span><h2 id="focus-title">专注时刻</h2></div><button type="button" id="close-focus" class="focus-icon-button" aria-label="收起计时面板"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button></header>
  <div class="focus-modes" aria-label="计时阶段">${Object.entries(modes).map(([id, mode]) => `<button type="button" data-focus-mode="${id}">${mode.name}</button>`).join('')}</div>
  <div class="focus-clock"><svg viewBox="0 0 200 200" aria-hidden="true"><circle class="focus-track" cx="100" cy="100" r="88"/><circle id="focus-arc" cx="100" cy="100" r="88" pathLength="100"/></svg><div><span id="focus-phase">准备专注</span><time id="focus-time" role="timer" aria-live="off">25:00</time><span id="focus-count">今天完成 0 轮</span></div></div>
  <div class="focus-fields"><label>学习方向<select id="focus-module">${modules.map(module => `<option value="${module.id}">${module.name}</option>`).join('')}</select></label><label id="focus-duration-label">专注时长<select id="focus-duration"><option value="25">25 分钟</option><option value="50">50 分钟</option></select></label><label class="focus-task-label">这一轮想完成什么<input id="focus-task" maxlength="140" placeholder="例如：练习 5 道增长率题" /></label></div>
  <div class="focus-controls"><button type="button" class="button button-primary" id="toggle-focus">开始专注</button><button type="button" class="button button-quiet" id="reset-focus">重置本轮</button></div>
  <button type="button" class="button button-quiet focus-record" id="record-focus" hidden>记入学习时长</button>
  <p id="focus-status" role="status" aria-atomic="true">完成一轮后，可以确认记入学习时长。</p>
  <p id="focus-storage-warning" hidden>浏览器未允许保存计时状态，关闭页面后将无法恢复。</p>`;
document.body.append(panel);
const dock = document.createElement('button');
dock.type = 'button';
dock.className = 'focus-dock';
dock.hidden = true;
dock.setAttribute('aria-controls', 'focus-timer');
document.body.append(dock);
const $ = (id) => panel.querySelector(`#${id}`);
const launcher = document.querySelector('#open-focus-timer');
const formatTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
function announce(message) { $('focus-status').textContent = message; }
function render() {
  const active = timer.status === 'running' || timer.status === 'paused';
  $('focus-time').textContent = formatTime(timer.remaining);
  $('focus-phase').textContent = timer.status === 'complete' ? '本轮已完成' : `${modes[timer.mode].name}${timer.status === 'paused' ? ' · 已暂停' : timer.status === 'idle' ? ' · 准备开始' : '中'}`;
  $('focus-arc').style.strokeDashoffset = String(100 * (1 - timer.remaining / (timer.minutes * 60)));
  $('focus-count').textContent = `今天完成 ${timer.completed.filter(round => round.date === dateKey(new Date())).length} 轮专注`;
  $('toggle-focus').textContent = timer.status === 'running' ? '暂停' : timer.status === 'paused' ? '继续计时' : timer.status === 'complete' ? (timer.mode === 'focus' ? '进入休息' : '开始下一轮专注') : `开始${modes[timer.mode].name}`;
  $('reset-focus').disabled = timer.status === 'idle';
  $('focus-module').disabled = active || timer.status === 'complete';
  $('focus-task').disabled = active || timer.status === 'complete';
  $('focus-duration').disabled = active || timer.status === 'complete';
  $('focus-duration-label').hidden = timer.mode !== 'focus';
  panel.querySelectorAll('[data-focus-mode]').forEach(button => {
    button.disabled = active;
    button.setAttribute('aria-pressed', String(button.dataset.focusMode === timer.mode));
  });
  $('record-focus').hidden = timer.status !== 'complete' || timer.mode !== 'focus';
  $('record-focus').disabled = !!timer.recorded;
  $('record-focus').textContent = timer.recorded ? '已记入学习时长' : `记入 ${timer.minutes} 分钟学习`;
  $('focus-storage-warning').hidden = storageAvailable;
  dock.hidden = !panel.hidden || timer.status === 'idle';
  dock.textContent = `${timer.status === 'complete' ? '本轮完成' : modes[timer.mode].name + ' ' + formatTime(timer.remaining)}${timer.status === 'paused' ? ' · 暂停' : ''}`;
  document.querySelector('#focus-launcher-label').textContent = timer.status === 'idle' ? '专注计时' : timer.status === 'complete' ? '专注 · 本轮完成' : `${modes[timer.mode].name} ${formatTime(timer.remaining)}`;
}
function syncFields() {
  $('focus-module').value = timer.moduleId;
  $('focus-duration').value = String(timer.mode === 'focus' ? timer.minutes : 25);
  $('focus-task').value = typeof timer.task === 'string' ? timer.task : '';
}
function tick() {
  if (timer.status === 'running') {
    timer.remaining = Math.max(0, Math.ceil((timer.deadline - Date.now()) / 1000));
    if (!timer.remaining) {
      timer.status = 'complete';
      timer.finishedAt = new Date(timer.deadline).toISOString();
      if (timer.mode === 'focus' && !timer.completed.some(round => round.id === timer.id)) {
        timer.completed = [...timer.completed, { id: timer.id, date: dateKey(new Date(timer.deadline)) }].slice(-200);
      }
      persist();
      announce(timer.mode === 'focus' ? '这一轮已完成。确认记录学习成果，然后休息一下。' : '休息结束。准备好后，再开始下一轮专注。');
    }
  }
  render();
}
function openPanel() {
  panel.hidden = false;
  launcher.setAttribute('aria-expanded', 'true');
  tick();
  $('close-focus').focus();
}
function closePanel() {
  panel.hidden = true;
  launcher.setAttribute('aria-expanded', 'false');
  render();
  (dock.hidden ? launcher : dock).focus();
}
launcher.addEventListener('click', () => panel.hidden ? openPanel() : closePanel());
dock.addEventListener('click', openPanel);
$('close-focus').addEventListener('click', closePanel);
panel.addEventListener('keydown', event => { if (event.key === 'Escape') closePanel(); });
function resetRound(mode, minutes) {
  timer = { ...freshRound(mode, minutes), completed: timer.completed, moduleId: timer.moduleId, task: timer.task };
  persist(); syncFields(); render();
}
panel.querySelectorAll('[data-focus-mode]').forEach(button => button.addEventListener('click', () => {
  resetRound(button.dataset.focusMode, modes[button.dataset.focusMode].minutes);
  announce(`已切换到${modes[timer.mode].name}，点击开始计时。`);
}));
$('focus-module').addEventListener('change', event => { timer.moduleId = event.target.value; persist(); });
$('focus-task').addEventListener('input', event => { timer.task = event.target.value; persist(); });
$('focus-duration').addEventListener('change', event => { resetRound('focus', Number(event.target.value)); });
$('reset-focus').addEventListener('click', () => {
  resetRound(timer.mode, timer.minutes);
  announce('本轮已重置，未完成的时间没有计入学习记录。');
});
$('toggle-focus').addEventListener('click', () => {
  tick();
  if (timer.status === 'complete') {
    const next = timer.mode === 'focus' ? (timer.completed.length % 4 === 0 ? 'long' : 'short') : 'focus';
    resetRound(next, modes[next].minutes);
    announce(`已准备${modes[next].name}，点击开始计时。`);
    return;
  }
  if (timer.status === 'running') {
    timer.status = 'paused'; timer.deadline = null;
    announce('计时已暂停，可以继续或重置本轮。');
  } else {
    timer.deadline = Date.now() + timer.remaining * 1000;
    timer.status = 'running';
    announce(`${modes[timer.mode].name}已开始。切换页面或收起面板后仍会计时。`);
  }
  persist(); render();
});
$('record-focus').addEventListener('click', async () => {
  if (timer.status !== 'complete' || timer.mode !== 'focus' || timer.recorded) return;
  const round = { ...timer };
  $('record-focus').disabled = true;
  try {
    await db.put('sessions', {
      id: `focus-${round.id}`, moduleId: round.moduleId, minutes: round.minutes,
      note: round.task?.trim() || '完成一轮番茄钟专注',
      date: dateKey(new Date(round.finishedAt)), createdAt: round.finishedAt,
    });
    if (timer.id === round.id) { timer.recorded = true; persist(); }
    document.dispatchEvent(new Event('learning-session-saved'));
    announce(`${round.minutes} 分钟已记入学习记录，无需再次手动记录。`);
  } catch { announce('保存失败，请重试。计时成果仍保留在面板中。'); }
  render();
});
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY) return;
  timer = readState(); syncFields(); tick();
});
document.addEventListener('visibilitychange', tick);
syncFields(); tick();
setInterval(tick, 1000);
