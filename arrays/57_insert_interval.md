# 57. Insert Interval

![Medium](https://img.shields.io/badge/Difficulty-Medium-orange)
![Topic](https://img.shields.io/badge/Topic-arrays-blue)

- **LeetCode Link:** [Insert Interval](https://leetcode.com/problems/insert-interval/)
- **Topic:** Array
- **Date Solved:** 2026-08-12
- **Author:** [Sanjay_Sakthivel-2](https://leetcode.com/u/Sanjay_Sakthivel-2/)

---

## 📝 Problem Statement

You are given an array of non-overlapping intervals `intervals` where `intervals[i] = [starti, endi]` represent the start and the end of the `ith` interval and `intervals` is sorted in ascending order by `starti`. You are also given an interval `newInterval = [start, end]` that represents the start and end of another interval.

Two intervals are considered overlapping if they share **at least** one point.

Insert `newInterval` into `intervals` such that `intervals` is still sorted in ascending order by `starti` and `intervals` still does not have any overlapping intervals (merge overlapping intervals if necessary).

Return `intervals`* after the insertion*.

**Note** that you don&#39;t need to modify `intervals` in-place. You can make a new array and return it.

 

### Example 1:

```
**Input:** intervals = [[1,3],[6,9]], newInterval = [2,5]
**Output:** [[1,5],[6,9]]
```

### Example 2:

```
**Input:** intervals = [[1,2],[3,5],[6,7],[8,10],[12,16]], newInterval = [4,8]
**Output:** [[1,2],[3,10],[12,16]]
**Explanation:** Because the new interval [4,8] overlaps with [3,5],[6,7],[8,10].
```

 

**Constraints:**

- `0 4`

	- `intervals[i].length == 2`

	- `0 i i 5`

	- `intervals` is sorted by `starti` in **ascending** order.

	- `newInterval.length == 2`

	- `0 5`

---

## 💡 Solution

```python
# Optimal Solution for Insert Interval
# LeetCode Problem #57
```

---

## ⏱️ Complexity Analysis

- **Time Complexity:** $O(n)$
- **Space Complexity:** $O(1)$
