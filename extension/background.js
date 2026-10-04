// Background Service Worker for LeetCode GitHub Auto-Sync (Multi-User)
try {
  importScripts("env.js");
} catch (e) {
  // env.js is optional (used for local pre-configuration if present)
}

// UTF-8 safe Base64 encoder
function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// UTF-8 safe Base64 decoder
function base64ToUtf8(b64) {
  const binary = atob(b64.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

// GitHub API helper
async function getFileSha(owner, repo, path, branch, token) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json"
    }
  });
  if (res.status === 200) {
    const data = await res.json();
    return { sha: data.sha, content: data.content ? base64ToUtf8(data.content) : null };
  }
  return { sha: null, content: null };
}

async function commitFileToGitHub({ owner, repo, path, branch, content, message, token }) {
  const { sha } = await getFileSha(owner, repo, path, branch, token);
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  const body = {
    message: message || `Auto-sync: ${path}`,
    content: utf8ToBase64(content),
    branch: branch || "main"
  };

  if (sha) {
    body.sha = sha;
  }

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub API Error (${res.status}): ${errText}`);
  }

  return await res.json();
}

// Update or append row to README.md
async function updateReadmeIndex({ owner, repo, branch, token, problem, filePath, category }) {
  try {
    const { sha, content } = await getFileSha(owner, repo, "README.md", branch, token);
    let readmeText = content;

    const row = `| ${problem.qid} | [${problem.title}](${filePath}) | \`${problem.difficulty}\` | [View Solution](${filePath}) |`;

    if (!readmeText) {
      // Create initial README
      readmeText = `# 🚀 LeetCode Solutions Archive\n\n> Auto-synced repository containing solved LeetCode problems organized by topic.\n\n![LeetCode Sync](https://img.shields.io/badge/LeetCode-Sync-orange?logo=leetcode)\n\n### 📁 ${category.toUpperCase()}\n\n| # | Problem Title | Difficulty | Solution |\n|:---:|:---|:---:|:---:|\n${row}\n`;
    } else {
      // Check if problem already listed
      if (readmeText.includes(`| ${problem.qid} |`)) {
        return; // Already in table
      }

      const catHeader = `### 📁 ${category.toUpperCase()}`;
      if (readmeText.includes(catHeader)) {
        readmeText = readmeText.replace(catHeader, `${catHeader}\n${row}`);
      } else {
        readmeText += `\n\n${catHeader}\n\n| # | Problem Title | Difficulty | Solution |\n|:---:|:---|:---:|:---:|\n${row}\n`;
      }
    }

    await commitFileToGitHub({
      owner,
      repo,
      path: "README.md",
      branch,
      content: readmeText,
      message: `Update README: Add [${problem.qid}] ${problem.title}`,
      token
    });
  } catch (err) {
    console.warn("Could not update README.md automatically:", err);
  }
}

// Update Sync Stats in storage
async function updateLocalStats(problem) {
  try {
    const data = await chrome.storage.local.get(["syncStats"]);
    const stats = data.syncStats || { total: 0, easy: 0, medium: 0, hard: 0, history: [] };

    stats.total += 1;
    const diff = (problem.difficulty || "Medium").toLowerCase();
    if (diff === "easy") stats.easy += 1;
    else if (diff === "medium") stats.medium += 1;
    else if (diff === "hard") stats.hard += 1;

    stats.lastProblem = {
      qid: problem.qid,
      title: problem.title,
      difficulty: problem.difficulty,
      timestamp: Date.now()
    };

    stats.history = [stats.lastProblem, ...(stats.history || [])].slice(0, 50);
    await chrome.storage.local.set({ syncStats: stats });
  } catch (err) {
    console.warn("Failed updating sync stats:", err);
  }
}

// Message Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 1. Validate GitHub Token & Get User Info
  if (request.action === "VALIDATE_TOKEN") {
    const token = (request.token || "").trim();
    if (!token) {
      sendResponse({ success: false, error: "Please provide a GitHub Personal Access Token." });
      return false;
    }

    fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" }
    })
      .then(async res => {
        if (res.status === 200) {
          const user = await res.json();
          // Check for repo permissions in response headers
          const scopes = res.headers.get("x-oauth-scopes") || "";
          sendResponse({
            success: true,
            user: {
              login: user.login,
              name: user.name || user.login,
              avatar: user.avatar_url,
              html_url: user.html_url
            },
            scopes: scopes.split(",").map(s => s.trim())
          });
        } else {
          sendResponse({ success: false, error: "Invalid token or expired. Check your token permissions." });
        }
      })
      .catch(err => sendResponse({ success: false, error: err.message }));

    return true; // async
  }

  // 2. Fetch User Repositories
  if (request.action === "GET_USER_REPOS") {
    const token = (request.token || "").trim();
    fetch("https://api.github.com/user/repos?sort=updated&per_page=100&type=all", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" }
    })
      .then(res => res.json())
      .then(repos => {
        if (Array.isArray(repos)) {
          sendResponse({
            success: true,
            repos: repos.map(r => ({
              full_name: r.full_name,
              name: r.name,
              private: r.private,
              default_branch: r.default_branch
            }))
          });
        } else {
          sendResponse({ success: false, error: "Could not list repositories." });
        }
      })
      .catch(err => sendResponse({ success: false, error: err.message }));

    return true;
  }

  // 3. Create a New Repository on GitHub
  if (request.action === "CREATE_REPOSITORY") {
    const { token, repoName, isPrivate, description } = request;
    fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: repoName || "leetcode-solutions",
        description: description || "LeetCode solutions automatically synced with LeetCode GitHub Sync",
        private: !!isPrivate,
        auto_init: true
      })
    })
      .then(async res => {
        const data = await res.json();
        if (res.status === 201) {
          sendResponse({
            success: true,
            repo: {
              full_name: data.full_name,
              default_branch: data.default_branch,
              html_url: data.html_url
            }
          });
        } else {
          sendResponse({ success: false, error: data.message || "Failed to create repository." });
        }
      })
      .catch(err => sendResponse({ success: false, error: err.message }));

    return true;
  }

  // 4. Test Existing Connection
  if (request.action === "TEST_CONNECTION") {
    const { repo, token } = request;
    const [owner, repoName] = (repo || "").split("/").map(s => s.trim());
    if (!owner || !repoName || !token) {
      sendResponse({ success: false, error: "Please provide both Repository (owner/repo) and Token." });
      return false;
    }

    fetch(`https://api.github.com/repos/${owner}/${repoName}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" }
    })
      .then(res => res.json())
      .then(data => {
        if (data.id) {
          sendResponse({
            success: true,
            name: data.full_name,
            defaultBranch: data.default_branch,
            private: data.private
          });
        } else {
          sendResponse({ success: false, error: data.message || "Repository not found or token lacks access." });
        }
      })
      .catch(err => sendResponse({ success: false, error: err.message }));

    return true;
  }

  // 5. Solution Auto-Sync
  if (request.action === "SYNC_SOLUTION") {
    (async () => {
      try {
        const stored = await chrome.storage.sync.get([
          "ghRepo",
          "ghToken",
          "ghBranch",
          "autoSyncEnabled",
          "folderStructure"
        ]);
        if (stored.autoSyncEnabled === false) {
          sendResponse({ success: false, error: "Auto-sync is disabled in extension settings." });
          return;
        }

        const env = self.LEETCODE_SYNC_ENV || {};
        const ghRepo = stored.ghRepo || env.repo;
        const ghToken = stored.ghToken || env.token;
        const ghBranch = stored.ghBranch || env.branch || "main";
        const folderStructure = stored.folderStructure || "topic"; // 'topic', 'difficulty', 'flat'

        if (!ghRepo || !ghToken) {
          sendResponse({ success: false, error: "GitHub repository or Personal Access Token not configured." });
          return;
        }

        const [owner, repo] = ghRepo.split("/").map(s => s.trim());
        const { problem, category, filename, markdown } = request.data;

        let targetFolder = category;
        if (folderStructure === "difficulty") {
          targetFolder = (problem.difficulty || "medium").toLowerCase();
        } else if (folderStructure === "flat") {
          targetFolder = "";
        }

        const filePath = targetFolder ? `${targetFolder}/${filename}` : filename;

        console.log(`[Auto-Sync] Committing ${filePath} to ${ghRepo}...`);

        const commitResult = await commitFileToGitHub({
          owner,
          repo,
          path: filePath,
          branch: ghBranch,
          content: markdown,
          message: `Solve: [${problem.qid}] ${problem.title} (${problem.difficulty}) [skip ci]`,
          token: ghToken
        });

        // Background update index
        updateReadmeIndex({
          owner,
          repo,
          branch: ghBranch,
          token: ghToken,
          problem,
          filePath,
          category: targetFolder || "all"
        });

        // Update local stats
        updateLocalStats(problem);

        sendResponse({
          success: true,
          filePath,
          commitUrl: commitResult.commit?.html_url || `https://github.com/${owner}/${repo}/blob/${ghBranch}/${filePath}`
        });
      } catch (err) {
        console.error("[Auto-Sync Error]", err);
        sendResponse({ success: false, error: err.message });
      }
    })();

    return true;
  }
});
