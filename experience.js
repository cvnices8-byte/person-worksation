// The overview remains available; focus only changes which workspace is visible.
const workspacePage = document.querySelector("#view-modules");
const workspaceSections = {
  data: ".learning-studio",
  cpa: ".cpa-studio",
  civil: ".civil-studio",
  english: ".english-studio",
};
const workspaceButtons = [...document.querySelectorAll("[data-workspace]")];
function selectWorkspace(key) {
  workspacePage.dataset.currentWorkspace = key;
  workspaceButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.workspace === key)));
  Object.entries(workspaceSections).forEach(([name, selector]) => {
    workspacePage.querySelector(selector).hidden = key !== "all" && key !== name;
  });
  const label = workspaceButtons.find((button) => button.dataset.workspace === key).textContent;
  document.querySelector("#workspace-status").textContent = key === "all"
    ? "浏览学习地图，或选择一个工作台开始专注。"
    : `${label} · 专注学习中，可随时切换或返回全部概览。`;
  workspacePage.scrollIntoView({ block: "start", behavior: "instant" });
}
workspaceButtons.forEach((button, index) => {
  button.addEventListener("click", () => selectWorkspace(button.dataset.workspace));
  button.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? workspaceButtons.length - 1
      : (index + (event.key === "ArrowRight" ? 1 : -1) + workspaceButtons.length) % workspaceButtons.length;
    workspaceButtons[next].focus();
    workspaceButtons[next].click();
  });
});

// Expose the selected state of existing workspace sub-navigation to assistive tech.
function syncPressedStates() {
  document.querySelectorAll("[data-studio-view], [data-cpa-view], [data-civil-view], [data-english-view]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.classList.contains("is-active")));
  });
}
document.addEventListener("click", () => queueMicrotask(syncPressedStates));
syncPressedStates();
