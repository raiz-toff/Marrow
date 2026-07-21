/** Pure spotlight-search scoring — unit-tested outside the DOM. */

export interface SearchDoc {
  id: string;
  name: string;
  role?: string;
  zone?: string;
  tier?: string;
  ip?: string;
  extra?: string[];
}

export interface SearchHit {
  id: string;
  score: number;
}

export function searchDocs(query: string, docs: readonly SearchDoc[], max = 12): SearchHit[] {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9./:-]+/)
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return [];
  const hits: SearchHit[] = [];
  for (const doc of docs) {
    const fields: Array<[string, number]> = [
      [doc.id.toLowerCase(), 10],
      [doc.name.toLowerCase(), 8],
      [doc.ip?.toLowerCase() ?? '', 7],
      [doc.role?.toLowerCase() ?? '', 4],
      [doc.zone?.toLowerCase() ?? '', 3],
      [doc.tier?.toLowerCase() ?? '', 2],
      [(doc.extra ?? []).join(' ').toLowerCase(), 2],
    ];
    let score = 0;
    let allHit = true;
    for (const token of tokens) {
      let tokenScore = 0;
      for (const [text, weight] of fields) {
        if (text === '') continue;
        if (text === token) tokenScore = Math.max(tokenScore, weight * 3);
        else if (text.startsWith(token)) tokenScore = Math.max(tokenScore, weight * 2);
        else if (text.includes(token)) tokenScore = Math.max(tokenScore, weight);
      }
      if (tokenScore === 0) {
        allHit = false;
        break;
      }
      score += tokenScore;
    }
    if (allHit) hits.push({ id: doc.id, score });
  }
  hits.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return hits.slice(0, max);
}
