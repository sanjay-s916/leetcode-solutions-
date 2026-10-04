// Injected into the MAIN world (page context) to access Monaco editor and fetch events directly
(function () {
  // 1. Intercept network submission fetch calls
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    try {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
      if (url.includes("/submit/") || url.includes("submitSolution")) {
        const reqOptions = args[1];
        if (reqOptions && reqOptions.body) {
          try {
            const parsed = JSON.parse(reqOptions.body);
            if (parsed.typed_code) {
              window.postMessage(
                {
                  type: "LEETCODE_SUBMIT_PAYLOAD",
                  code: parsed.typed_code,
                  lang: parsed.lang || "python3"
                },
                "*"
              );
            }
          } catch (e) {
            // Body was not JSON
          }
        }
      }
    } catch (err) {
      console.warn("[LeetCode Sync Bridge] Fetch intercept error:", err);
    }
    return originalFetch.apply(this, args);
  };

  // 2. Direct Monaco editor reader on click
  document.addEventListener(
    "click",
    e => {
      const btn = e.target.closest("button");
      if (btn && (btn.innerText?.includes("Submit") || btn.getAttribute("data-e2e-locator") === "console-submit-button")) {
        try {
          const models = window.monaco?.editor?.getModels();
          if (models && models.length > 0) {
            const activeCode = models[0].getValue();
            if (activeCode) {
              window.postMessage(
                {
                  type: "LEETCODE_MONACO_CODE",
                  code: activeCode
                },
                "*"
              );
            }
          }
        } catch (e) {}
      }
    },
    true
  );
})();
