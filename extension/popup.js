document.addEventListener("DOMContentLoaded", async () => {
  // Elements - Header & Views
  const statusPill = document.getElementById("status-pill");
  const statusPillText = document.getElementById("status-pill-text");
  const onboardingView = document.getElementById("onboarding-view");
  const dashboardView = document.getElementById("dashboard-view");
  const messageBanner = document.getElementById("message-banner");

  // Elements - Onboarding
  const ghTokenInput = document.getElementById("ghToken");
  const verifyTokenBtn = document.getElementById("verifyTokenBtn");
  const userPreview = document.getElementById("user-preview");
  const userAvatar = document.getElementById("user-avatar");
  const userName = document.getElementById("user-name");
  const userLogin = document.getElementById("user-login");

  const tabExisting = document.getElementById("tab-existing");
  const tabCreate = document.getElementById("tab-create");
  const sectionExisting = document.getElementById("section-existing-repo");
  const sectionCreate = document.getElementById("section-create-repo");

  const repoSelect = document.getElementById("repoSelect");
  const manualRepoInput = document.getElementById("manualRepoInput");
  const newRepoName = document.getElementById("newRepoName");
  const repoPrivacyToggle = document.getElementById("repoPrivacyToggle");
  const createRepoBtn = document.getElementById("createRepoBtn");

  const folderStructureSelect = document.getElementById("folderStructureSelect");
  const branchInput = document.getElementById("branchInput");
  const completeSetupBtn = document.getElementById("completeSetupBtn");

  // Elements - Dashboard
  const dashAvatar = document.getElementById("dash-avatar");
  const dashRepoTitle = document.getElementById("dash-repo-title");
  const dashRepoLink = document.getElementById("dash-repo-link");
  const statTotal = document.getElementById("stat-total");
  const statEasy = document.getElementById("stat-easy");
  const statMedium = document.getElementById("stat-medium");
  const statHard = document.getElementById("stat-hard");

  const lastSyncedCard = document.getElementById("last-synced-card");
  const lastProblemTitle = document.getElementById("last-problem-title");
  const lastProblemBadge = document.getElementById("last-problem-badge");
  const lastProblemTime = document.getElementById("last-problem-time");

  const dashAutoSyncToggle = document.getElementById("dashAutoSyncToggle");
  const dashFolderStructure = document.getElementById("dashFolderStructure");
  const syncCurrentTabBtn = document.getElementById("syncCurrentTabBtn");
  const editSettingsBtn = document.getElementById("editSettingsBtn");

  let validatedUser = null;

  function showMessage(text, type = "success", duration = 4000) {
    messageBanner.className = `message-banner ${type}`;
    messageBanner.textContent = text;
    messageBanner.classList.remove("hidden");
    setTimeout(() => {
      messageBanner.classList.add("hidden");
    }, duration);
  }

  function setStatusPill(connected, repoName = "") {
    if (connected) {
      statusPill.className = "status-pill connected";
      statusPillText.textContent = "Connected";
    } else {
      statusPill.className = "status-pill disconnected";
      statusPillText.textContent = "Not Connected";
    }
  }

  function formatTimeAgo(timestamp) {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  // Load Saved Configuration
  async function init() {
    const env = window.LEETCODE_SYNC_ENV || {};
    const stored = await chrome.storage.sync.get([
      "ghRepo",
      "ghToken",
      "ghBranch",
      "autoSyncEnabled",
      "folderStructure",
      "userInfo"
    ]);

    const localStats = await chrome.storage.local.get(["syncStats"]);
    const stats = localStats.syncStats || { total: 0, easy: 0, medium: 0, hard: 0 };

    const activeRepo = stored.ghRepo || env.repo;
    const activeToken = stored.ghToken || env.token;

    if (activeRepo && activeToken) {
      renderDashboard(stored, stats);
    } else {
      renderOnboarding();
    }
  }

  // Render Dashboard
  function renderDashboard(stored, stats) {
    onboardingView.classList.add("hidden");
    dashboardView.classList.remove("hidden");
    setStatusPill(true, stored.ghRepo);

    const user = stored.userInfo || {};
    dashAvatar.src = user.avatar || "icons/icon48.png";
    dashRepoTitle.textContent = stored.ghRepo;
    dashRepoLink.href = `https://github.com/${stored.ghRepo}`;

    statTotal.textContent = stats.total || 0;
    statEasy.textContent = stats.easy || 0;
    statMedium.textContent = stats.medium || 0;
    statHard.textContent = stats.hard || 0;

    if (stats.lastProblem) {
      lastSyncedCard.classList.remove("hidden");
      lastProblemTitle.textContent = `#${stats.lastProblem.qid} ${stats.lastProblem.title}`;
      
      const diff = (stats.lastProblem.difficulty || "Medium").toLowerCase();
      lastProblemBadge.className = `badge badge-${diff}`;
      lastProblemBadge.textContent = stats.lastProblem.difficulty || "Medium";
      lastProblemTime.textContent = stats.lastProblem.timestamp ? formatTimeAgo(stats.lastProblem.timestamp) : "Recently";
    } else {
      lastSyncedCard.classList.add("hidden");
    }

    dashAutoSyncToggle.checked = stored.autoSyncEnabled !== false;
    dashFolderStructure.value = stored.folderStructure || "topic";
  }

  // Render Onboarding
  function renderOnboarding() {
    dashboardView.classList.add("hidden");
    onboardingView.classList.remove("hidden");
    setStatusPill(false);
  }

  // 1. Verify GitHub Token
  async function handleVerifyToken(token) {
    if (!token) {
      showMessage("Please enter a Personal Access Token.", "error");
      return;
    }

    verifyTokenBtn.textContent = "...";
    verifyTokenBtn.disabled = true;

    chrome.runtime.sendMessage({ action: "VALIDATE_TOKEN", token }, async (res) => {
      verifyTokenBtn.textContent = "Verify";
      verifyTokenBtn.disabled = false;

      if (res && res.success) {
        validatedUser = res.user;
        userAvatar.src = res.user.avatar;
        userName.textContent = res.user.name;
        userLogin.textContent = `@${res.user.login}`;
        userPreview.classList.remove("hidden");

        showMessage(`Connected as @${res.user.login}! Fetching repos...`, "success");

        // Save user info in storage
        await chrome.storage.sync.set({ userInfo: res.user });

        // Fetch User Repositories
        loadUserRepos(token, res.user.login);
      } else {
        userPreview.classList.add("hidden");
        showMessage(res?.error || "Token verification failed. Check permissions.", "error");
      }
    });
  }

  verifyTokenBtn.addEventListener("click", () => {
    handleVerifyToken(ghTokenInput.value.trim());
  });

  ghTokenInput.addEventListener("change", () => {
    if (ghTokenInput.value.trim().startsWith("ghp_")) {
      handleVerifyToken(ghTokenInput.value.trim());
    }
  });

  // 2. Fetch User Repositories Dropdown
  function loadUserRepos(token, username) {
    repoSelect.innerHTML = "<option value=''>Loading repositories...</option>";
    chrome.runtime.sendMessage({ action: "GET_USER_REPOS", token }, (res) => {
      if (res && res.success && res.repos.length > 0) {
        repoSelect.innerHTML = "<option value=''>-- Select a Repository --</option>";
        
        let foundMatch = false;
        res.repos.forEach(r => {
          const opt = document.createElement("option");
          opt.value = r.full_name;
          opt.textContent = `${r.full_name} ${r.private ? '(Private)' : '(Public)'}`;
          
          // Pre-select if named leetcode
          if (r.name.toLowerCase().includes("leetcode") && !foundMatch) {
            opt.selected = true;
            manualRepoInput.value = r.full_name;
            foundMatch = true;
          }
          repoSelect.appendChild(opt);
        });

        if (!foundMatch) {
          manualRepoInput.value = `${username}/leetcode-solutions`;
        }
      } else {
        repoSelect.innerHTML = "<option value=''>No repositories found</option>";
        manualRepoInput.value = `${username}/leetcode-solutions`;
      }
    });
  }

  repoSelect.addEventListener("change", () => {
    if (repoSelect.value) {
      manualRepoInput.value = repoSelect.value;
    }
  });

  // Tab switching
  tabExisting.addEventListener("click", () => {
    tabExisting.classList.add("active");
    tabCreate.classList.remove("active");
    sectionExisting.classList.remove("hidden");
    sectionCreate.classList.add("hidden");
  });

  tabCreate.addEventListener("click", () => {
    tabCreate.classList.add("active");
    tabExisting.classList.remove("active");
    sectionCreate.classList.remove("hidden");
    sectionExisting.classList.add("hidden");
  });

  // 3. Create New Repository Action
  createRepoBtn.addEventListener("click", () => {
    const token = ghTokenInput.value.trim();
    const repoName = newRepoName.value.trim() || "leetcode-solutions";
    const isPrivate = repoPrivacyToggle.checked;

    if (!token) {
      showMessage("Please verify your GitHub token first.", "error");
      return;
    }

    createRepoBtn.textContent = "Creating...";
    createRepoBtn.disabled = true;

    chrome.runtime.sendMessage(
      { action: "CREATE_REPOSITORY", token, repoName, isPrivate },
      (res) => {
        createRepoBtn.textContent = "Create & Link Repository";
        createRepoBtn.disabled = false;

        if (res && res.success) {
          manualRepoInput.value = res.repo.full_name;
          tabExisting.click();
          showMessage(`Repository created: ${res.repo.full_name}! 🚀`, "success");
        } else {
          showMessage(res?.error || "Failed creating repository.", "error");
        }
      }
    );
  });

  // 4. Complete Setup & Connect
  completeSetupBtn.addEventListener("click", async () => {
    const token = ghTokenInput.value.trim();
    const repo = manualRepoInput.value.trim() || repoSelect.value.trim();
    const branch = branchInput.value.trim() || "main";
    const folderStructure = folderStructureSelect.value;

    if (!token) {
      showMessage("Please provide your GitHub Personal Access Token.", "error");
      return;
    }
    if (!repo || !repo.includes("/")) {
      showMessage("Please specify a valid repository in format 'owner/repo'.", "error");
      return;
    }

    completeSetupBtn.textContent = "Connecting...";
    completeSetupBtn.disabled = true;

    chrome.runtime.sendMessage({ action: "TEST_CONNECTION", repo, token }, async (res) => {
      completeSetupBtn.textContent = "🚀 Connect & Start Auto-Syncing";
      completeSetupBtn.disabled = false;

      if (res && res.success) {
        await chrome.storage.sync.set({
          ghRepo: repo,
          ghToken: token,
          ghBranch: branch,
          folderStructure: folderStructure,
          autoSyncEnabled: true
        });

        const localStats = await chrome.storage.local.get(["syncStats"]);
        renderDashboard(
          { ghRepo: repo, autoSyncEnabled: true, folderStructure, userInfo: validatedUser },
          localStats.syncStats || { total: 0, easy: 0, medium: 0, hard: 0 }
        );
        showMessage("Connected successfully! Ready to sync LeetCode solves ✨", "success");
      } else {
        showMessage(res?.error || "Connection failed. Check repo name and permissions.", "error");
      }
    });
  });

  // Dashboard Controls Listeners
  dashAutoSyncToggle.addEventListener("change", async () => {
    await chrome.storage.sync.set({ autoSyncEnabled: dashAutoSyncToggle.checked });
    showMessage(dashAutoSyncToggle.checked ? "Auto-sync enabled!" : "Auto-sync paused.", "success");
  });

  dashFolderStructure.addEventListener("change", async () => {
    await chrome.storage.sync.set({ folderStructure: dashFolderStructure.value });
    showMessage("Folder organization updated!", "success");
  });

  // Trigger Manual Sync on Active Tab
  syncCurrentTabBtn.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.includes("leetcode.com/problems/")) {
      showMessage("Please open a LeetCode problem page in your active tab.", "error");
      return;
    }

    syncCurrentTabBtn.textContent = "Syncing tab...";
    syncCurrentTabBtn.disabled = true;

    chrome.tabs.sendMessage(tab.id, { action: "FORCE_SYNC_ACTIVE" }, (response) => {
      syncCurrentTabBtn.textContent = "⚡ Sync Active LeetCode Tab Now";
      syncCurrentTabBtn.disabled = false;

      if (response && response.success) {
        showMessage(`Synced: ${response.filePath} ✨`, "success");
        init(); // refresh dashboard stats
      } else {
        showMessage(response?.error || "Could not sync problem from active tab.", "error");
      }
    });
  });

  // Disconnect / Change Settings
  editSettingsBtn.addEventListener("click", async () => {
    if (confirm("Do you want to change settings or disconnect this repository?")) {
      await chrome.storage.sync.remove(["ghRepo"]);
      renderOnboarding();
    }
  });

  init();
});
