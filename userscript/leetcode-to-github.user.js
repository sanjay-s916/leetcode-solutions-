// ==UserScript==
// @name         LeetCode to GitHub Auto-Sync (Instant)
// @namespace    https://github.com/
// @version      1.0.0
// @description  Instantly syncs accepted LeetCode solutions to your GitHub repository organized by topic folders in 1 second.
// @author       LeetCode Auto-Sync
// @match        https://leetcode.com/problems/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      api.github.com
// @connect      leetcode.com
// ==/UserScript==

(function () {
  'use strict';

  // Topic category mappings & priority
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

  let lastSync = 0;
  let activeCode = "";

  // Menu commands for configuration
  GM_registerMenuCommand("⚙️ Configure GitHub Repo & Token", () => {
    const curRepo = GM_getValue("GH_REPO", "");
    const curToken = GM_getValue("GH_TOKEN", "");
    const curBranch = GM_getValue("GH_BRANCH", "main");

    const repo = prompt("Enter your GitHub repository (owner/repo):", curRepo);
    if (repo === null) return;
    const token = prompt("Enter your GitHub Personal Access Token (repo scope):", curToken);
    if (token === null) return;
    const branch = prompt("Enter branch (default: main):", curBranch) || "main";

    GM_setValue("GH_REPO", repo.trim());
    GM_setValue("GH_TOKEN", token.trim());
    GM_setValue("GH_BRANCH", branch.trim());
    alert("LeetCode Sync settings saved!");
  });

  function cleanSlug(slug) {
    let s = (slug || "").toLowerCase();
    const replacements = [
      [/-from-sorted-array.*/g, ""],
      [/-without-repeating-characters.*/g, ""],
      [/-palindromic-substring/g, "-palindrome"],
      [/-in-a-string.*/g, ""],
      [/-two-sorted-lists/g, "-sorted-lists"],
      [/-to-buy-and-sell-stock/g, "-to-buy-sell-stock"],
    ];
    for (const [pattern, repl] of replacements) {
      s = s.replace(pattern, repl);
    }
    return s.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function showToast(message, isSuccess = true, url = null) {
    const toast = document.createElement("div");
    toast.style.position = "fixed";
    toast.style.bottom = "20px";
    toast.style.right = "20px";
    toast.style.zIndex = "9999999";
    toast.style.background = isSuccess ? "#0f172a" : "#881337";
    toast.style.border = `1px solid ${isSuccess ? "#10b981" : "#f43f5e"}`;
    toast.style.color = "#f8fafc";
    toast.style.padding = "12px 18px";
    toast.style.borderRadius = "8px";
    toast.style.fontSize = "13px";
    toast.style.fontWeight = "600";
    toast.style.boxShadow = "0 8px 24px rgba(0,0,0,0.5)";
    toast.innerHTML = `<span>${isSuccess ? '✨' : '⚠️'} ${message}</span>` + (url ? ` <a href="${url}" target="_blank" style="color: #38bdf8; margin-left: 8px;">View →</a>` : "");
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  async function fetchQuestion(slug) {
    const query = `query getQuestionDetail($titleSlug: String!) { question(titleSlug: $titleSlug) { questionFrontendId title titleSlug difficulty content topicTags { name } } }`;
    const res = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { titleSlug: slug } })
    });
    const json = await res.json();
    return json?.data?.question;
  }

  function commitToGitHub(path, content, message) {
    const repo = GM_getValue("GH_REPO");
    const token = GM_getValue("GH_TOKEN");
    const branch = GM_getValue("GH_BRANCH", "main");

    if (!repo || !token) {
      showToast("Configure GitHub token in Tampermonkey menu!", false);
      return;
    }

    const [owner, repoName] = repo.split("/");
    const checkUrl = `https://api.github.com/repos/${owner}/${repoName}/contents/${path}?ref=${branch}`;

    GM_xmlhttpRequest({
      method: "GET",
      url: checkUrl,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      onload: (res) => {
        let sha = null;
        if (res.status === 200) {
          const data = JSON.parse(res.responseText);
          sha = data.sha;
        }

        const putUrl = `https://api.github.com/repos/${owner}/${repoName}/contents/${path}`;
        const payload = {
          message: message,
          content: utf8ToBase64(content),
          branch: branch
        };
        if (sha) payload.sha = sha;

        GM_xmlhttpRequest({
          method: "PUT",
          url: putUrl,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json"
          },
          data: JSON.stringify(payload),
          onload: (putRes) => {
            if (putRes.status === 200 || putRes.status === 201) {
              const respData = JSON.parse(putRes.responseText);
              showToast(`Auto-synced: ${path} in 1s!`, true, respData.content?.html_url);
            } else {
              showToast(`Sync failed: HTTP ${putRes.status}`, false);
            }
          }
        });
      }
    });
  }

  // Monitor clicks & DOM for submission
  document.addEventListener("click", () => {
    const lines = document.querySelectorAll(".view-line");
    if (lines.length > 0) {
      activeCode = Array.from(lines).map(l => l.textContent).join("\n");
    }
  }, true);

  const observer = new MutationObserver(() => {
    const isAccepted = Array.from(document.querySelectorAll("*")).some(
      el => el.innerText === "Accepted" && (el.classList.contains("text-green-s") || el.getAttribute("data-e2e-locator") === "submission-result")
    );

    if (isAccepted && Date.now() - lastSync > 4000) {
      lastSync = Date.now();
      const match = window.location.pathname.match(/\/problems\/([^/]+)/);
      if (!match) return;
      const slug = match[1];

      fetchQuestion(slug).then(q => {
        if (!q) return;
        const qid = q.questionFrontendId;
        const clean = cleanSlug(slug);
        const tags = (q.topicTags || []).map(t => t.name);

        let category = "misc";
        for (const p of PRIORITY_ORDER) {
          if (tags.includes(p) && CATEGORY_MAPPINGS[p]) { category = CATEGORY_MAPPINGS[p]; break; }
        }
        if (category === "misc" && tags[0] && CATEGORY_MAPPINGS[tags[0]]) {
          category = CATEGORY_MAPPINGS[tags[0]];
        }

        const filename = `${qid}_${clean}.md`;
        const filePath = `${category}/${filename}`;
        const md = `# ${qid}. ${q.title}\n\n- **Difficulty:** ${q.difficulty}\n- **Topic:** ${tags.join(", ")}\n- **Link:** https://leetcode.com/problems/${slug}/\n\n---\n\n## Solution\n\n\`\`\`python\n${activeCode || "// Solution"}\n\`\`\`\n`;

        commitToGitHub(filePath, md, `Solve: [${qid}] ${q.title} (${category})`);
      });
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
