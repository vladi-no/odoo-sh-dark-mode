(function () {
  "use strict";

  const btn = document.getElementById("toggle");

  function render(enabled) {
    btn.textContent = enabled ? "Enabled — click to disable" : "Disabled — click to enable";
    btn.classList.toggle("on", enabled);
    btn.classList.toggle("off", !enabled);
  }

  chrome.storage.local.get({ enabled: true }, (data) => render(data.enabled !== false));

  btn.addEventListener("click", () => {
    chrome.storage.local.get({ enabled: true }, (data) => {
      const next = !(data.enabled !== false);
      chrome.storage.local.set({ enabled: next }, () => render(next));
    });
  });
})();
