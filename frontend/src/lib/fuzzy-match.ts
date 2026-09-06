/**
 * Small dependency-free fuzzy matcher used to map a spoken/typed phrase to
 * the closest item in a known list (villages, categories, etc).
 *
 * Uses normalized Levenshtein distance. Good enough for short place names
 * and category labels; not a substitute for a real NLP fuzzy-matching
 * service if the vocabulary grows much larger.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[] = new Array(n + 1).fill(0);
  for (let j = 0; j <= n; j++) dp[j] = j;

  for (let i = 1; i <= m; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j]!;
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j]!, dp[j - 1]!);
      prev = temp;
    }
  }
  return dp[n]!;
}

export function similarity(a: string, b: string): number {
  const normA = a.trim().toLowerCase();
  const normB = b.trim().toLowerCase();
  if (!normA || !normB) return 0;
  const distance = levenshtein(normA, normB);
  const maxLen = Math.max(normA.length, normB.length);
  return 1 - distance / maxLen;
}

/** Returns the best match from `choices` for `query`, or null if nothing clears the threshold. */
export function findBestMatch(
  query: string,
  choices: string[],
  threshold = 0.5,
): { match: string; score: number } | null {
  let best: { match: string; score: number } | null = null;
  for (const choice of choices) {
    const score = similarity(query, choice);
    if (!best || score > best.score) best = { match: choice, score };
  }
  return best && best.score >= threshold ? best : null;
}
