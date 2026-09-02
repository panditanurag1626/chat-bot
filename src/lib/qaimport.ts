import { createQa } from "./repo";

export type RawItem = Record<string, unknown>;

export function parseQaJson(text: string): RawItem[] {
  let data: unknown = JSON.parse(text);
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    for (const key of ["data", "qa", "qa_pairs", "questions", "items"]) {
      if (Array.isArray(obj[key])) {
        data = obj[key];
        break;
      }
    }
  }
  if (!Array.isArray(data)) throw new Error("Expected a JSON array of Q&A pairs");
  return data as RawItem[];
}

export function insertQaRecursive(
  botId: string | number,
  items: RawItem[],
  parentId: number | null = null,
  source = "json"
): number {
  let count = 0;
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const q = String(item.question || item.q || "").trim();
    const a = String(item.answer || item.a || "").trim();
    const kw = String(item.keywords || item.kw || "").trim();
    if (!q || !a) continue;
    const qa = createQa({
      botId,
      question: q.slice(0, 1000),
      answer: a.slice(0, 4000),
      keywords: kw.slice(0, 500),
      parentId,
      source,
    });
    count += 1;
    const children = item.children || item.subq || item.subquestions;
    if (Array.isArray(children) && children.length) {
      count += insertQaRecursive(botId, children as RawItem[], qa._id, source);
    }
  }
  return count;
}
