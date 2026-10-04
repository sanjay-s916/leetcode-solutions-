# 49. Group Anagrams

![Medium](https://img.shields.io/badge/Difficulty-Medium-orange)
![Topic](https://img.shields.io/badge/Topic-strings-blue)

- **LeetCode Link:** [Group Anagrams](https://leetcode.com/problems/group-anagrams/)
- **Topic:** Array, Hash Table, String, Sorting
- **Date Solved:** 2026-08-05
- **Author:** [Sanjay_Sakthivel-2](https://leetcode.com/u/Sanjay_Sakthivel-2/)

---

## 📝 Problem Statement

Given an array of strings `strs`, group the anagrams together. You can return the answer in **any order**.

 

### Example 1:

**Input:** strs = ["eat","tea","tan","ate","nat","bat"]

**Output:** [["bat"],["nat","tan"],["ate","eat","tea"]]

**Explanation:**

- There is no string in strs that can be rearranged to form `"bat"`.

	- The strings `"nat"` and `"tan"` are anagrams as they can be rearranged to form each other.

	- The strings `"ate"`, `"eat"`, and `"tea"` are anagrams as they can be rearranged to form each other.

### Example 2:

**Input:** strs = [""]

**Output:** [[""]]

### Example 3:

**Input:** strs = ["a"]

**Output:** [["a"]]

 

**Constraints:**

- `1 4`

	- `0 <= strs[i].length <= 100`

	- `strs[i]` consists of lowercase English letters.

---

## 💡 Solution

```python
# Optimal Solution for Group Anagrams
# LeetCode Problem #49
```

---

## ⏱️ Complexity Analysis

- **Time Complexity:** $O(n)$
- **Space Complexity:** $O(1)$
