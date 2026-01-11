export type Difficulty = "easy" | "medium" | "hard";
export type PlanBadge = "NEW" | "DUE" | "DONE";

export type Problem = {
  id: string,
  title: string,
  difficulty: Difficulty,
  pattern?: string,
  leetcodeUrl: string,
  videoUrl?: string,
};

export type PlanItem = {
  problemId: string,
  badge: PlanBadge,
};

export const problems: Problem[] = [
  {
    id: "two-sum",
    title: "Two Sum",
    difficulty: "easy",
    pattern: "Hash Map",
    leetcodeUrl: "https://leetcode.com/problems/two-sum/",
    videoUrl:
      "https://www.youtube.com/results?search_query=two+sum+leetcode+solution",
  },
  {
    id: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "easy",
    pattern: "Stack",
    leetcodeUrl: "https://leetcode.com/problems/valid-parentheses/",
  },
  {
    id: "top-k-frequent",
    title: "Top K Frequent Elements",
    difficulty: "medium",
    pattern: "Heap",
    leetcodeUrl: "https://leetcode.com/problems/top-k-frequent-elements/",
  },
  {
    id: "product-array-except-self",
    title: "Product of Array Except Self",
    difficulty: "medium",
    pattern: "Prefix/Suffix",
    leetcodeUrl: "https://leetcode.com/problems/product-of-array-except-self/",
  },
];

export function buildTodayPlan(): PlanItem[] {
  // Mock: bạn thay logic "due/new" sau
  return [
    { problemId: "two-sum", badge: "DUE" },
    { problemId: "valid-parentheses", badge: "NEW" },
    { problemId: "top-k-frequent", badge: "NEW" },
    { problemId: "product-array-except-self", badge: "DUE" },
  ];
}

export function getProblemById(id: string) {
  return problems.find((p) => p.id === id);
}
