// Deterministisches Chunking.
//
// Strategie: Text an Absatz-/Überschriften-Grenzen (Leerzeilen) in Segmente
// zerlegen, zu große Segmente weiter herunterbrechen (Zeilen -> Sätze ->
// harter Zeichen-Schnitt), dann Segmente bis zum Token-Budget zu Chunks packen
// und benachbarte Chunks leicht überlappen lassen.
//
// Token-Schätzung: dokumentierte Heuristik ~4 Zeichen/Token (grob für
// gemischtes Deutsch/Englisch + Markdown). Bewusst konservativ, damit Chunks
// klar unter dem Modell-Eingabelimit (2048 Tokens) bleiben.

const CHARS_PER_TOKEN = 4;
const TARGET_TOKENS = 700; // Zielgröße pro Chunk (im Bereich 500-800)
const MAX_SEGMENT_CHARS = TARGET_TOKENS * CHARS_PER_TOKEN; // = 2800
const OVERLAP_RATIO = 0.12; // ~12 % Überlappung

export type Chunk = {
  content: string;
  chunkIndex: number;
  charStart: number;
  charEnd: number;
  tokenCount: number;
};

type Segment = { start: number; end: number };

export function estimateTokens(text: string): number {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length === 0) return 0;
  return Math.ceil(normalized.length / CHARS_PER_TOKEN);
}

// Zerlegt [start,end) bei jedem Vorkommen von `separator` (regex) in Stücke
// und behält die Original-Offsets bei.
function splitByRegex(
  text: string,
  start: number,
  end: number,
  separator: RegExp,
): Segment[] {
  const slice = text.slice(start, end);
  const segments: Segment[] = [];
  const re = new RegExp(separator.source, 'g');
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(slice)) !== null) {
    const segEnd = match.index + match[0].length;
    if (segEnd > cursor) segments.push({ start: start + cursor, end: start + segEnd });
    cursor = segEnd;
    if (re.lastIndex === match.index) re.lastIndex++; // Schutz vor Leer-Matches
  }
  if (cursor < slice.length) segments.push({ start: start + cursor, end });
  return segments;
}

// Bricht ein Segment so weit herunter, bis jedes Teil-Segment <= MAX_SEGMENT_CHARS ist.
function breakDown(text: string, seg: Segment): Segment[] {
  if (seg.end - seg.start <= MAX_SEGMENT_CHARS) return [seg];

  // 1. an einzelnen Zeilenumbrüchen
  let parts = splitByRegex(text, seg.start, seg.end, /\n/);
  // 2. zu große Teile an Satzgrenzen
  parts = parts.flatMap((p) =>
    p.end - p.start <= MAX_SEGMENT_CHARS
      ? [p]
      : splitByRegex(text, p.start, p.end, /[.!?]+\s+/),
  );
  // 3. immer noch zu große Teile hart per Zeichenfenster schneiden
  return parts.flatMap((p) => {
    if (p.end - p.start <= MAX_SEGMENT_CHARS) return [p];
    const out: Segment[] = [];
    for (let s = p.start; s < p.end; s += MAX_SEGMENT_CHARS) {
      out.push({ start: s, end: Math.min(s + MAX_SEGMENT_CHARS, p.end) });
    }
    return out;
  });
}

export function chunkText(text: string): Chunk[] {
  // Absätze / Überschriften = durch Leerzeilen getrennte Blöcke.
  const blocks = splitByRegex(text, 0, text.length, /\n\s*\n/);
  const segments = blocks
    .flatMap((b) => breakDown(text, b))
    // leere / reine Whitespace-Segmente überspringen (Offsets bleiben korrekt)
    .filter((s) => text.slice(s.start, s.end).trim().length > 0);

  if (segments.length === 0) return [];

  const chunks: Chunk[] = [];
  const overlapBudget = TARGET_TOKENS * OVERLAP_RATIO;
  let i = 0;
  let chunkIndex = 0;

  while (i < segments.length) {
    // Segmente packen, bis das Token-Budget erreicht ist (mind. eines).
    let j = i;
    let tokens = 0;
    while (j < segments.length) {
      const segTokens = estimateTokens(text.slice(segments[j].start, segments[j].end));
      if (j > i && tokens + segTokens > TARGET_TOKENS) break;
      tokens += segTokens;
      j++;
    }

    const charStart = segments[i].start;
    const charEnd = segments[j - 1].end;
    const content = text.slice(charStart, charEnd);
    chunks.push({
      content,
      chunkIndex: chunkIndex++,
      charStart,
      charEnd,
      tokenCount: estimateTokens(content),
    });

    if (j >= segments.length) break;

    // Überlappung: ein paar Segmente zurückgehen, aber immer Fortschritt machen.
    let k = j;
    let overlapTokens = 0;
    while (k > i + 1 && overlapTokens < overlapBudget) {
      k--;
      overlapTokens += estimateTokens(text.slice(segments[k].start, segments[k].end));
    }
    i = k;
  }

  return chunks;
}
