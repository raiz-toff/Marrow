/** Levenshtein edit distance with an early-exit cap for speed. */
export function editDistance(a: string, b: string, cap = Infinity): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min((prev[j] as number) + 1, (curr[j - 1] as number) + 1, (prev[j - 1] as number) + cost);
      curr[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > cap) return cap + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[n] as number;
}

/**
 * Rank `candidates` by closeness to `input`; only plausibly-intended matches
 * are returned (edit distance scaled to input length).
 */
export function closestMatches(input: string, candidates: Iterable<string>, max = 3): string[] {
  const needle = input.toLowerCase();
  const threshold = Math.max(2, Math.ceil(needle.length * 0.34));
  const scored: Array<{ candidate: string; dist: number }> = [];
  for (const candidate of candidates) {
    const hay = candidate.toLowerCase();
    let dist = editDistance(needle, hay, threshold);
    // A candidate that contains the input verbatim is a likely intent match
    // even when the raw edit distance is large (e.g. short queries).
    if (dist > threshold && needle.length >= 3 && hay.includes(needle)) {
      dist = threshold;
    }
    if (dist <= threshold) scored.push({ candidate, dist });
  }
  scored.sort((x, y) => x.dist - y.dist || x.candidate.localeCompare(y.candidate));
  return scored.slice(0, max).map((s) => s.candidate);
}
