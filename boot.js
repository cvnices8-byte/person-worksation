(() => {
  const retry = document.querySelector("#retry-startup");
  function showRetry(message) {
    const status = document.querySelector("#startup-message");
    if (!status) return;
    status.textContent = message;
    retry.hidden = false;
  }
  retry.addEventListener("click", () => {
    const url = new URL(location.href);
    url.searchParams.set("reload", String(Date.now()));
    location.replace(url.href);
  });
  const timer = setTimeout(() => showRetry("加载时间较长，请检查网络后重新加载。学习记录仍保存在本机。"), 12000);
  import("./app.js?v=20260921-12").then(() => {
    return import("./experience.js?v=20260921-11");
  }).catch(() => {
    clearTimeout(timer);
    showRetry("学习功能未能加载，请重新加载页面。此操作不会清除学习记录。");
  });
})();
