#!/usr/bin/env python3
"""
LeetCode -> GitHub Auto-Sync Script
Fetches solved problems from LeetCode and automatically organizes them
into data structure folders (arrays, strings, linked-lists, trees, etc.).
"""

import os
import sys
import json
import re
import argparse
import urllib.request
import urllib.error
from pathlib import Path
from datetime import datetime

LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql"

DEFAULT_HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://leetcode.com"
}

# Language extension to markdown code fence mapping
LANG_MAP = {
    "python": "python",
    "python3": "python",
    "cpp": "cpp",
    "c": "c",
    "csharp": "csharp",
    "java": "java",
    "javascript": "javascript",
    "typescript": "typescript",
    "golang": "go",
    "go": "go",
    "rust": "rust",
    "swift": "swift",
    "kotlin": "kotlin",
    "ruby": "ruby",
    "scala": "scala",
    "php": "php"
}

def load_config(config_path="config.json"):
    """Loads category and priority rules from config.json."""
    if os.path.exists(config_path):
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "category_mappings": {
            "Array": "arrays",
            "String": "strings",
            "Linked List": "linked-lists",
            "Doubly-Linked List": "linked-lists",
            "Tree": "trees",
            "Binary Tree": "trees",
            "Binary Search Tree": "trees",
            "Graph": "graphs",
            "Heap (Priority Queue)": "heaps",
            "Stack": "stacks-and-queues",
            "Queue": "stacks-and-queues",
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
        },
        "priority_order": [
            "Linked List", "Doubly-Linked List", "Tree", "Binary Tree", "Binary Search Tree",
            "Trie", "Heap (Priority Queue)", "Graph", "Stack", "Queue", "String", "Array",
            "Matrix", "Sliding Window", "Two Pointers", "Binary Search", "Hash Table",
            "Dynamic Programming", "Backtracking", "Greedy", "Bit Manipulation", "Math"
        ],
        "default_category": "misc"
    }

def clean_slug(slug: str) -> str:
    """
    Cleans problem title slug into concise snake_case format.
    E.g.
    'two-sum' -> 'two_sum'
    'remove-duplicates-from-sorted-array' -> 'remove_duplicates'
    'best-time-to-buy-and-sell-stock' -> 'best_time_to_buy_sell_stock'
    'longest-substring-without-repeating-characters' -> 'longest_substring'
    'longest-palindromic-substring' -> 'longest_palindrome'
    'reverse-words-in-a-string' -> 'reverse_words'
    'merge-two-sorted-lists' -> 'merge_sorted_lists'
    """
    replacements = [
        (r"-from-sorted-array.*", ""),
        (r"-without-repeating-characters.*", ""),
        (r"-palindromic-substring", "-palindrome"),
        (r"-in-a-string.*", ""),
        (r"-two-sorted-lists", "-sorted-lists"),
        (r"-to-buy-and-sell-stock", "-to-buy-sell-stock"),
    ]
    s = slug.lower()
    for pattern, repl in replacements:
        s = re.sub(pattern, repl, s)
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")
    return s

def determine_category(topic_tags, config):
    """
    Determines the appropriate data structure folder based on topic tags and priority list.
    """
    mappings = config.get("category_mappings", {})
    priority_order = config.get("priority_order", [])
    default_cat = config.get("default_category", "misc")

    tag_names = [t.get("name") if isinstance(t, dict) else t for t in topic_tags]

    # Check tags in order of priority
    for prio in priority_order:
        if prio in tag_names and prio in mappings:
            return mappings[prio]

    # Otherwise check any available tag in mappings
    for tag in tag_names:
        if tag in mappings:
            return mappings[tag]

    return default_cat

def html_to_markdown(html_content: str) -> str:
    """Basic HTML to markdown conversion for problem statement."""
    if not html_content:
        return ""
    text = html_content
    # Replace pre and code tags
    text = re.sub(r'<pre>\s*', '\n```\n', text)
    text = re.sub(r'\s*</pre>', '\n```\n', text)
    text = re.sub(r'<code>(.*?)</code>', r'`\1`', text)
    text = re.sub(r'<strong class="example">(.*?)</strong>', r'### \1', text)
    text = re.sub(r'<strong>(.*?)</strong>', r'**\1**', text)
    text = re.sub(r'<b>(.*?)</b>', r'**\1**', text)
    text = re.sub(r'<em>(.*?)</em>', r'*\1*', text)
    text = re.sub(r'<i>(.*?)</i>', r'*\1*', text)
    text = re.sub(r'<p>\s*', '', text)
    text = re.sub(r'\s*</p>', '\n\n', text)
    text = re.sub(r'<ul>\s*', '\n', text)
    text = re.sub(r'\s*</ul>', '\n', text)
    text = re.sub(r'<li>\s*', '- ', text)
    text = re.sub(r'\s*</li>', '\n', text)
    text = re.sub(r'&nbsp;', ' ', text)
    text = re.sub(r'&lt;', '<', text)
    text = re.sub(r'&gt;', '>', text)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&quot;', '"', text)
    text = re.sub(r'<font[^>]*>(.*?)</font>', r'\1', text)
    # Remove remaining HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Clean up excess newlines
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

def send_graphql_request(query, variables, session_cookie=None):
    """Executes a GraphQL POST request to LeetCode API."""
    headers = dict(DEFAULT_HEADERS)
    if session_cookie:
        headers["Cookie"] = f"LEETCODE_SESSION={session_cookie}"

    data = json.dumps({"query": query, "variables": variables}).encode("utf-8")
    req = urllib.request.Request(LEETCODE_GRAPHQL_URL, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"[Error] HTTP {e.code}: {e.read().decode('utf-8')}")
        return None
    except Exception as e:
        print(f"[Error] GraphQL request failed: {e}")
        return None

def fetch_recent_submissions(username: str, limit: int = 20, session_cookie: str = None):
    """Fetches recently accepted submissions for a given username."""
    query = """
    query recentAcSubmissions($username: String!, $limit: Int!) {
      recentAcSubmissionList(username: $username, limit: $limit) {
        id
        title
        titleSlug
        timestamp
      }
    }
    """
    res = send_graphql_request(query, {"username": username, "limit": limit}, session_cookie)
    if res and "data" in res and res["data"]:
        return res["data"].get("recentAcSubmissionList", [])
    return []

def fetch_question_details(title_slug: str):
    """Fetches problem metadata, topic tags, difficulty, and problem description."""
    query = """
    query getQuestionDetail($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        questionFrontendId
        title
        titleSlug
        difficulty
        content
        topicTags {
          name
          slug
        }
      }
    }
    """
    res = send_graphql_request(query, {"titleSlug": title_slug})
    if res and "data" in res and res["data"]:
        return res["data"].get("question")
    return None

def fetch_submission_details(submission_id: str, session_cookie: str):
    """Fetches submission code and runtime/memory details (requires LEETCODE_SESSION)."""
    if not session_cookie:
        return None
    query = """
    query submissionDetails($submissionId: Int!) {
      submissionDetails(submissionId: $submissionId) {
        runtime
        runtimeDisplay
        runtimePercentile
        memory
        memoryDisplay
        memoryPercentile
        code
        timestamp
        lang {
          name
          verboseName
        }
      }
    }
    """
    res = send_graphql_request(query, {"submissionId": int(submission_id)}, session_cookie)
    if res and "data" in res and res["data"]:
        return res["data"].get("submissionDetails")
    return None

def generate_markdown(question, submission, category):
    """Builds a formatted markdown file for the solved problem."""
    qid = question.get("questionFrontendId", "0")
    title = question.get("title", "")
    title_slug = question.get("titleSlug", "")
    difficulty = question.get("difficulty", "Medium")
    topic_tags = [t.get("name") for t in question.get("topicTags", [])]
    topics_str = ", ".join(topic_tags) if topic_tags else category.capitalize()
    
    # Difficulty badge color
    diff_badge = f"![{difficulty}](https://img.shields.io/badge/Difficulty-{difficulty}-"
    if difficulty.lower() == "easy":
        diff_badge += "green)"
    elif difficulty.lower() == "medium":
        diff_badge += "orange)"
    else:
        diff_badge += "red)"

    code = "# Solution code"
    lang_name = "python"
    runtime_info = "N/A"
    memory_info = "N/A"
    date_solved = datetime.now().strftime("%Y-%m-%d")

    if submission:
        code = submission.get("code") or code
        lang_obj = submission.get("lang", {})
        raw_lang = lang_obj.get("name", "python3") if isinstance(lang_obj, dict) else str(lang_obj)
        lang_name = LANG_MAP.get(raw_lang.lower(), raw_lang.lower())
        
        runtime = submission.get("runtimeDisplay") or (f"{submission.get('runtime')} ms" if submission.get("runtime") else None)
        r_pct = submission.get("runtimePercentile")
        if runtime and r_pct:
            runtime_info = f"{runtime} (Beats {r_pct:.1f}%)"
        elif runtime:
            runtime_info = runtime

        memory = submission.get("memoryDisplay") or (f"{submission.get('memory')} MB" if submission.get("memory") else None)
        m_pct = submission.get("memoryPercentile")
        if memory and m_pct:
            memory_info = f"{memory} (Beats {m_pct:.1f}%)"
        elif memory:
            memory_info = memory

        ts = submission.get("timestamp")
        if ts:
            try:
                date_solved = datetime.fromtimestamp(int(ts)).strftime("%Y-%m-%d")
            except Exception:
                pass

    content_md = html_to_markdown(question.get("content", ""))

    doc = f"""# {qid}. {title}

{diff_badge}
![Topic](https://img.shields.io/badge/Topic-{category.replace('-', '_')}-blue)

- **LeetCode Link:** [{title}](https://leetcode.com/problems/{title_slug}/)
- **Topic:** {topics_str}
- **Date Solved:** {date_solved}
- **Runtime:** {runtime_info}
- **Memory:** {memory_info}

---

## 📝 Problem Statement

{content_md}

---

## 💡 Solution

```{lang_name}
{code}
```

---

## ⏱️ Complexity Analysis

- **Time Complexity:** $O(n)$
- **Space Complexity:** $O(1)$
"""
    return doc

def find_existing_file(base_dir: Path, qid: str):
    """Checks if a problem with questionFrontendId is already saved in any folder."""
    for path in base_dir.rglob(f"{qid}_*.md"):
        return path
    return None

def update_root_readme(base_dir: Path):
    """
    Scans the repository and auto-generates a rich README.md with problem statistics
    and categorized tables of contents.
    """
    categories = {}
    difficulty_counts = {"Easy": 0, "Medium": 0, "Hard": 0}
    total_solved = 0

    # Discover all solved problems across category directories
    for item in sorted(base_dir.iterdir()):
        if item.is_dir() and not item.name.startswith(".") and item.name not in ["extension", "userscript", "scratch"]:
            md_files = sorted(list(item.glob("*.md")), key=lambda p: int(p.stem.split("_")[0]) if p.stem.split("_")[0].isdigit() else 99999)
            if md_files:
                categories[item.name] = []
                for f in md_files:
                    total_solved += 1
                    # Extract difficulty and title from file
                    try:
                        content = f.read_text(encoding="utf-8")
                        title_match = re.search(r"^#\s*(\d+)\.\s*(.*)$", content, re.MULTILINE)
                        diff_match = re.search(r"Difficulty-(Easy|Medium|Hard)", content)
                        
                        qid = f.stem.split("_")[0]
                        title = title_match.group(2).strip() if title_match else f.stem
                        diff = diff_match.group(1) if diff_match else "Medium"
                        
                        difficulty_counts[diff] = difficulty_counts.get(diff, 0) + 1
                        rel_path = f.relative_to(base_dir).as_posix()
                        
                        categories[item.name].append({
                            "id": qid,
                            "title": title,
                            "difficulty": diff,
                            "path": rel_path
                        })
                    except Exception as e:
                        print(f"[Warning] Failed parsing {f}: {e}")

    # Build README Markdown
    emoji_map = {
        "arrays": "📊",
        "strings": "📝",
        "linked-lists": "🔗",
        "trees": "🌳",
        "graphs": "🌐",
        "heaps": "🏔️",
        "stacks-and-queues": "🥞",
        "matrices": "🔲",
        "hash-tables": "🔑",
        "dynamic-programming": "⚡",
        "two-pointers": "👉👈",
        "sliding-window": "🪟",
        "binary-search": "🔍",
        "greedy": "💰",
        "backtracking": "🔄",
        "bit-manipulation": "⚙️",
        "math": "📐",
        "misc": "📦"
    }

    readme_content = f"""# 🚀 LeetCode Solutions Archive

> Auto-synced repository containing solved LeetCode problems organized strictly by data structure and algorithmic topics.

![LeetCode Sync](https://img.shields.io/badge/LeetCode-Sync-orange?logo=leetcode)
![Problems Solved](https://img.shields.io/badge/Solved-{total_solved}-brightgreen)
![Easy](https://img.shields.io/badge/Easy-{difficulty_counts.get('Easy', 0)}-green)
![Medium](https://img.shields.io/badge/Medium-{difficulty_counts.get('Medium', 0)}-yellow)
![Hard](https://img.shields.io/badge/Hard-{difficulty_counts.get('Hard', 0)}-red)

---

## 📈 Overview & Statistics

| Total Solved | Easy | Medium | Hard |
|:---:|:---:|:---:|:---:|
| **{total_solved}** | {difficulty_counts.get('Easy', 0)} | {difficulty_counts.get('Medium', 0)} | {difficulty_counts.get('Hard', 0)} |

---

## 📚 Problems by Topic

"""

    for cat_name, problems in sorted(categories.items()):
        emoji = emoji_map.get(cat_name, "📁")
        formatted_cat = cat_name.replace("-", " ").title()
        readme_content += f"### {emoji} {formatted_cat} ({len(problems)})\n\n"
        readme_content += "| # | Problem Title | Difficulty | Solution |\n"
        readme_content += "|:---:|:---|:---:|:---:|\n"
        for p in problems:
            diff_badge = f"`{p['difficulty']}`"
            readme_content += f"| {p['id']} | [{p['title']}]({p['path']}) | {diff_badge} | [View Solution]({p['path']}) |\n"
        readme_content += "\n"

    readme_content += """---

## ⚡ How It Works

1. **Instant Browser Sync (1-Second on Solve):**
   - Install the included Chrome Extension (`extension/`) or Userscript (`userscript/`).
   - Solve any problem on LeetCode and click **Submit**.
   - Upon green **Accepted** verdict, the solution is instantly committed to GitHub in `<topic>/<id>_<title>.md`.

2. **Automated GitHub Actions Sync:**
   - Runs automatically on schedule (or manual trigger via Actions tab).
   - Fetches accepted submissions and updates the repository index.

---
*Auto-generated with ❤️ by [LeetCode GitHub Auto-Sync](https://github.com)*
"""
    readme_path = base_dir / "README.md"
    readme_path.write_text(readme_content, encoding="utf-8")
    print(f"[Success] Updated {readme_path} ({total_solved} problems indexed)")

def sync(username: str, session_cookie: str = None, limit: int = 20, base_dir: Path = Path(".")):
    """Main synchronization loop."""
    config = load_config(base_dir / "config.json")
    print(f"[*] Starting sync for user: {username} (limit={limit})...")
    
    submissions = fetch_recent_submissions(username, limit, session_cookie)
    if not submissions:
        print(f"[!] No recent accepted submissions returned for '{username}'.")
        print("    If your profile submissions are private, provide LEETCODE_SESSION cookie.")
        return

    print(f"[*] Found {len(submissions)} recent accepted submissions.")
    synced_count = 0

    for sub in submissions:
        title_slug = sub.get("titleSlug")
        sub_id = sub.get("id")
        
        q_data = fetch_question_details(title_slug)
        if not q_data:
            print(f"[!] Could not fetch question details for {title_slug}")
            continue

        qid = q_data.get("questionFrontendId")
        clean_name = clean_slug(title_slug)
        category = determine_category(q_data.get("topicTags", []), config)
        
        target_dir = base_dir / category
        target_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{qid}_{clean_name}.md"
        target_file = target_dir / filename

        # Check if already present in any folder
        existing = find_existing_file(base_dir, qid)
        if existing and existing.exists():
            print(f"[~] Skipping [{qid}] {title_slug} (already exists at {existing})")
            continue

        # Fetch submission code if session cookie is present
        sub_details = None
        if session_cookie and sub_id:
            sub_details = fetch_submission_details(sub_id, session_cookie)

        md_content = generate_markdown(q_data, sub_details, category)
        target_file.write_text(md_content, encoding="utf-8")
        print(f"[+] Saved: {category}/{filename}")
        synced_count += 1

    print(f"[*] Successfully synced {synced_count} new problems.")
    update_root_readme(base_dir)

def main():
    parser = argparse.ArgumentParser(description="LeetCode to GitHub Auto-Sync")
    parser.add_argument("--username", "-u", default=os.environ.get("LEETCODE_USERNAME"), help="LeetCode username")
    parser.add_argument("--session", "-s", default=os.environ.get("LEETCODE_SESSION"), help="LeetCode session cookie")
    parser.add_argument("--limit", "-l", type=int, default=30, help="Number of recent submissions to check")
    parser.add_argument("--update-readme", action="store_true", help="Only re-index repository and update README.md")
    parser.add_argument("--dir", "-d", default=".", help="Base directory of repository")

    args = parser.parse_args()
    base_dir = Path(args.dir).resolve()

    if args.update_readme:
        update_root_readme(base_dir)
        return

    if not args.username:
        print("[!] LeetCode username is required. Pass --username or set LEETCODE_USERNAME env variable.")
        print("    Running README indexer only...")
        update_root_readme(base_dir)
        sys.exit(0)

    sync(args.username, args.session, args.limit, base_dir)

if __name__ == "__main__":
    main()
