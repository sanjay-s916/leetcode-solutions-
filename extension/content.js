// Content Script for LeetCode to GitHub Auto-Sync

(function () {
  console.log("[LeetCode GitHub Auto-Sync] Content script active.");

  const CATEGORY_MAPPINGS = {
    "Array": "arrays",
    "String": "strings",
    "Linked List": "linked-lists",
    "Doubly-Linked List": "linked-lists",
    "Tree": "trees",
    "Binary Tree": "trees",
    "Binary Search Tree": "trees",
    "Trie": "tries",
    "Graph": "graphs",
    "Breadth-First Search": "graphs",
    "Depth-First Search": "graphs",
    "Topological Sort": "graphs",
    "Heap (Priority Queue)": "heaps",
    "Stack": "stacks-and-queues",
    "Queue": "stacks-and-queues",
    "Monotonic Stack": "stacks-and-queues",
    "Matrix": "matrices",
    "Hash Table": "hash-tables",
    "Dynamic Programming": "dynamic-programming",
    "Two Pointers": "two-pointers",
    "Sliding Window": "sliding-window",
    "Binary Search": "binary-search",
    "Greedy": "greedy",
    "Backtracking": "backtracking",
    "Bit Manipulation": "bit-manipulation",
    "Math": "math"
  };

  const PRIORITY_ORDER = [
    "Linked List", "Doubly-Linked List", "Tree", "Binary Tree", "Binary Search Tree",
    "Trie", "Heap (Priority Queue)", "Graph", "Stack", "Queue", "String", "Array",
    "Matrix", "Sliding Window", "Two Pointers", "Binary Search", "Hash Table",
    "Dynamic Programming", "Backtracking", "Greedy", "Bit Manipulation", "Math"
  ];

  let lastSubmissionPayload = null;
  let lastSyncTimestamp = 0;

  // Clean problem title slug
  function cleanSlug(slug) {
    let s = (slug || "").toLowerCase();
    const replacements = [
      [/-from-sorted-array.*/g, ""],
      [/-without-repeating-characters.*/g, ""],
      [/-palindromic-substring/g, "-palindrome"],
      [/-in-a-string.*/g, ""],
      [/-two-sorted-lists/g, "-sorted-lists"],
      [/-to-buy-and-sell-stock/g, "-to-buy-sell-stock"],
      [/-in-a-shop.*/g, ""],
      [/-in-a-sorted-matrix/g, "_sorted_matrix"],
    ];
    for (const [pattern, repl] of replacements) {
      s = s.replace(pattern, repl);
    }
    return s.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  function getProblemSlug() {
    const match = window.location.pathname.match(/\/problems\/([^/]+)/);
    return match ? match[1] : null;
  }

  function determineCategory(topicTags) {
    const tagNames = topicTags.map(t => (typeof t === "string" ? t : t.name));
    for (const prio of PRIORITY_ORDER) {
      if (tagNames.includes(prio) && CATEGORY_MAPPINGS[prio]) {
        return CATEGORY_MAPPINGS[prio];
      }
    }
    for (const name of tagNames) {
      if (CATEGORY_MAPPINGS[name]) {
        return CATEGORY_MAPPINGS[name];
      }
    }
    return "misc";
  }

  function htmlToMarkdown(html) {
    if (!html) return "";
    let text = html;
    text = text.replace(/<pre>\s*/gi, "\n```\n");
    text = text.replace(/\s*<\/pre>/gi, "\n```\n");
    text = text.replace(/<code>(.*?)<\/code>/gi, "`$1`");
    text = text.replace(/<strong class="example">(.*?)<\/strong>/gi, "### $1");
    text = text.replace(/<(strong|b)>(.*?)<\/(strong|b)>/gi, "**$2**");
    text = text.replace(/<(em|i)>(.*?)<\/(em|i)>/gi, "*$2*");
    text = text.replace(/<p>\s*/gi, "");
    text = text.replace(/\s*<\/p>/gi, "\n\n");
    text = text.replace(/<ul>\s*/gi, "\n");
    text = text.replace(/\s*<\/ul>/gi, "\n");
    text = text.replace(/<li>\s*/gi, "- ");
    text = text.replace(/\s*<\/li>/gi, "\n");
    text = text.replace(/&nbsp;/g, " ");
    text = text.replace(/&lt;/g, "<");
    text = text.replace(/&gt;/g, ">");
    text = text.replace(/&amp;/g, "&");
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/<[^>]+>/g, "");
    return text.replace(/\n{3,}/g, "\n\n").trim();
  }

  async function fetchQuestionData(titleSlug) {
    const query = `
      query getQuestionDetail($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          questionFrontendId
          title
          titleSlug
          difficulty
          content
          topicTags {
            name
          }
        }
      }
    `;
    const res = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { titleSlug } })
    });
    const json = await res.json();
    return json?.data?.question;
  }

  function getMonacoCode() {
    const lines = document.querySelectorAll(".view-line");
    if (lines && lines.length > 0) {
      return Array.from(lines).map(line => line.textContent).join("\n");
    }
    return null;
  }

  function showToast(message, type = "success", linkUrl = null) {
    const oldToast = document.getElementById("leetcode-sync-toast");
    if (oldToast) oldToast.remove();

    const toast = document.createElement("div");
    toast.id = "leetcode-sync-toast";
    toast.style.position = "fixed";
    toast.style.bottom = "24px";
    toast.style.right = "24px";
    toast.style.zIndex = "9999999";
    toast.style.background = type === "success" ? "#0f172a" : "#881337";
    toast.style.border = `1px solid ${type === "success" ? "#10b981" : "#f43f5e"}`;
    toast.style.borderRadius = "8px";
    toast.style.padding = "14px 18px";
    toast.style.color = "#f8fafc";
    toast.style.fontSize = "13px";
    toast.style.fontWeight = "600";
    toast.style.boxShadow = "0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3)";
    toast.style.display = "flex";
    toast.style.alignItems = "center";
    toast.style.gap = "10px";
    toast.style.transition = "opacity 0.3s ease";

    const icon = type === "success" ? "✨" : "⚠️";
    let linkHtml = "";
    if (linkUrl) {
      linkHtml = ` <a href="${linkUrl}" target="_blank" style="color: #38bdf8; text-decoration: underline; margin-left: 8px;">View on GitHub →</a>`;
    }

    toast.innerHTML = `<span>${icon}</span><span>${message}</span>${linkHtml}`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 400);
    }, 5000);
  }

  async function performSync(stats = {}) {
    const titleSlug = getProblemSlug();
    if (!titleSlug) return { success: false, error: "Not on a LeetCode problem page." };

    showToast("Syncing solution to GitHub in 1s...", "success");

    try {
      const qData = await fetchQuestionData(titleSlug);
      if (!qData) {
        showToast("Could not retrieve problem metadata.", "error");
        return { success: false, error: "Could not retrieve problem metadata." };
      }

      const qid = qData.questionFrontendId;
      const title = qData.title;
      const difficulty = qData.difficulty;
      const topicTags = qData.topicTags || [];
      const category = determineCategory(topicTags);
      const cleanName = cleanSlug(titleSlug);
      const filename = `${qid}_${cleanName}.md`;

      const code = lastSubmissionPayload?.typed_code || getMonacoCode() || "// Solution code";
      const rawLang = lastSubmissionPayload?.lang || "python3";
      const lang = rawLang.toLowerCase().includes("python") ? "python" : rawLang;

      const runtimeStr = stats.runtime || "Accepted";
      const memoryStr = stats.memory || "";
      const dateStr = new Date().toISOString().split("T")[0];

      const diffBadge = `![${difficulty}](https://img.shields.io/badge/Difficulty-${difficulty}-${
        difficulty === "Easy" ? "green" : difficulty === "Medium" ? "orange" : "red"
      })`;
      const topicBadge = `![Topic](https://img.shields.io/badge/Topic-${category.replace(/-/g, "_")}-blue)`;

      const markdown = `# ${qid}. ${title}

${diffBadge}
${topicBadge}

- **LeetCode Link:** [${title}](https://leetcode.com/problems/${titleSlug}/)
- **Topic:** ${topicTags.map(t => t.name).join(", ") || category}
- **Date Solved:** ${dateStr}
- **Language:** ${rawLang}
- **Runtime:** ${runtimeStr}
- **Memory:** ${memoryStr}

---

## 📝 Problem Statement

${htmlToMarkdown(qData.content)}

---

## 💡 Solution

\`\`\`${lang}
${code}
\`\`\`

---

## ⏱️ Complexity Analysis

- **Time Complexity:** $O(n)$
- **Space Complexity:** $O(1)$
`;

      return new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            action: "SYNC_SOLUTION",
            data: {
              problem: { qid, title, difficulty, titleSlug },
              code,
              lang,
              category,
              filename,
              markdown
            }
          },
          response => {
            if (response && response.success) {
              showToast(`Auto-synced to GitHub: ${response.filePath} ✨`, "success", response.commitUrl);
              resolve({ success: true, filePath: response.filePath, commitUrl: response.commitUrl });
            } else {
              showToast(`Sync Failed: ${response?.error || "Unknown error"}`, "error");
              resolve({ success: false, error: response?.error || "Unknown error" });
            }
          }
        );
      });
    } catch (err) {
      console.error("[Auto-Sync Error]", err);
      showToast(`Error: ${err.message}`, "error");
      return { success: false, error: err.message };
    }
  }

  async function handleAcceptedSolve(stats = {}) {
    const now = Date.now();
    if (now - lastSyncTimestamp < 4000) {
      return; // prevent rapid duplicate triggers
    }
    lastSyncTimestamp = now;
    await performSync(stats);
  }

  // Listen for exact code from injected main-world script
  window.addEventListener("message", event => {
    if (event.data?.type === "LEETCODE_SUBMIT_PAYLOAD") {
      lastSubmissionPayload = {
        typed_code: event.data.code,
        lang: event.data.lang || "python3"
      };
      console.log("[LeetCode Sync] Intercepted submit payload with full code!");
    } else if (event.data?.type === "LEETCODE_MONACO_CODE") {
      if (!lastSubmissionPayload || !lastSubmissionPayload.typed_code) {
        lastSubmissionPayload = {
          typed_code: event.data.code,
          lang: "python3"
        };
      }
    }
  });

  // Intercept submit button click (fallback)
  document.addEventListener(
    "click",
    e => {
      const btn = e.target.closest("button");
      if (btn && (btn.innerText?.includes("Submit") || btn.getAttribute("data-e2e-locator") === "console-submit-button")) {
        const code = getMonacoCode();
        if (code && (!lastSubmissionPayload || !lastSubmissionPayload.typed_code)) {
          lastSubmissionPayload = { typed_code: code, lang: "python3" };
        }
      }
    },
    true
  );

  // Monitor DOM for Accepted state
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node;
          const text = el.innerText || "";
          
          if (
            (el.getAttribute("data-e2e-locator") === "submission-result" && text.includes("Accepted")) ||
            (el.classList && el.classList.contains("text-green-s") && text.includes("Accepted")) ||
            (text.includes("Accepted") && (text.includes("Runtime:") || text.includes("Beats") || text.includes("Memory:")))
          ) {
            const parentText = el.closest('[data-layout-path]')?.innerText || el.parentElement?.innerText || text;
            const runtimeMatch = parentText.match(/Runtime\s*([0-9]+\s*ms(?:\s*\(Beats\s*[0-9.]+%\))?)/i);
            const memoryMatch = parentText.match(/Memory\s*([0-9.]+\s*MB(?:\s*\(Beats\s*[0-9.]+%\))?)/i);

            handleAcceptedSolve({
              runtime: runtimeMatch ? runtimeMatch[1] : "Accepted",
              memory: memoryMatch ? memoryMatch[1] : ""
            });
            return;
          }
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Message listener from extension popup (e.g. force sync active tab)
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "FORCE_SYNC_ACTIVE") {
      performSync().then(result => sendResponse(result));
      return true;
    }
  });
})();
