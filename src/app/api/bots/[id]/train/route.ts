import { NextResponse } from "next/server";
import { asId } from "@/lib/sqlite";
import { getCurrentUser } from "@/lib/auth";
import { ownedBot } from "@/lib/owner";
import { getQaInBot, createQa, updateBot } from "@/lib/repo";
import { extractQaFromUrl, extractQaFromText, QaPair } from "@/lib/llm";
import { parseQaJson, insertQaRecursive } from "@/lib/qaimport";
import { extractText } from "unpdf";

export const runtime = "nodejs";
export const maxDuration = 60;

function fileKind(file: File): "pdf" | "json" | "other" | "unknown" {
  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();
  if (name.endsWith(".pdf") || type === "application/pdf") return "pdf";
  if (name.endsWith(".json") || type === "application/json") return "json";
  if (name) return "other";
  return "unknown";
}

async function extractPdfText(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const { text } = await extractText(buf, { mergePages: true });
  return String(text || "").trim();
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const bot = await ownedBot(id, user.id);
  if (!bot) return NextResponse.json({ error: "not found" }, { status: 404 });

  const form = await req.formData();
  const mode = String(form.get("mode") || "url").trim();

  let parentId: number | null = null;
  const pid = asId(form.get("parent_id"));
  if (pid && getQaInBot(pid, id)) parentId = pid;

  if (mode === "pdf-save") {
    const pairsText = String(form.get("pairs") || "");
    let pairs: QaPair[] = [];
    try {
      const parsed = JSON.parse(pairsText);
      if (Array.isArray(parsed)) {
        pairs = parsed
          .filter((p) => p && typeof p === "object")
          .map((p) => {
            const o = p as Record<string, unknown>;
            return { question: String(o.question || "").trim(), answer: String(o.answer || "").trim() };
          })
          .filter((p) => p.question && p.answer);
      }
    } catch {
      return NextResponse.json({ ok: false, message: "Preview data was invalid — please re-run the PDF extraction.", category: "error" });
    }
    if (!pairs.length) return NextResponse.json({ ok: false, message: "No valid Q&A pairs to save.", category: "error" });
    for (const p of pairs) {
      createQa({ botId: id, question: p.question.slice(0, 1000), answer: p.answer.slice(0, 4000), keywords: "", source: "autotrain", parentId });
    }
    return NextResponse.json({
      ok: true,
      message: `Added ${pairs.length} Q&A pair${pairs.length !== 1 ? "s" : ""} from PDF.`,
      category: "success",
      result: pairs,
    });
  }

  if (mode === "json") {
    const file = form.get("file");
    if (file instanceof File && file.name) {
      const kind = fileKind(file);
      if (kind === "other" || kind === "unknown") {
        return NextResponse.json({ ok: false, message: "Unsupported file type. Please upload a PDF (.pdf) or JSON (.json) file.", category: "error" });
      }

      if (kind === "pdf") {
        let pdfText = "";
        try {
          pdfText = await extractPdfText(file);
        } catch (e) {
          return NextResponse.json({ ok: false, message: `Could not read the PDF: ${e instanceof Error ? e.message : e}`, category: "error" });
        }
        if (!pdfText || pdfText.length < 40) {
          return NextResponse.json({ ok: false, message: "The PDF is empty or has no extractable text (it may be a scanned/image-only PDF).", category: "error" });
        }
        const { pairs, error } = await extractQaFromText(pdfText, 8, "the PDF");
        if (error) return NextResponse.json({ ok: false, message: `Training failed: ${error}`, category: "error" });
        if (!pairs.length) return NextResponse.json({ ok: false, message: "Training failed: no Q&A pairs could be generated from this PDF.", category: "error" });
        return NextResponse.json({
          ok: true,
          preview: true,
          message: `Extracted ${pairs.length} Q&A pair${pairs.length !== 1 ? "s" : ""} from the PDF. Review below, then save.`,
          category: "success",
          result: pairs,
        });
      }

      // JSON file → existing behavior.
      let text = "";
      try {
        text = (await file.text()).replace(/^\uFEFF/, "");
      } catch (e) {
        return NextResponse.json({ ok: false, message: `Could not read the JSON file: ${e instanceof Error ? e.message : e}`, category: "error" });
      }
      if (!text.trim()) return NextResponse.json({ ok: false, message: "The uploaded JSON file is empty.", category: "error" });
      try {
        const items = parseQaJson(text);
        const count = insertQaRecursive(id, items, parentId, "json");
        const result = items
          .filter((i) => i && typeof i === "object")
          .map((i) => ({ question: String(i.question || i.q || ""), answer: String(i.answer || i.a || "") }))
          .slice(0, 20);
        return NextResponse.json({ ok: true, message: `Fine-tuned with ${count} Q&A entries from JSON.`, category: "success", result });
      } catch (e) {
        return NextResponse.json({ ok: false, message: `Invalid JSON: ${e instanceof Error ? e.message : e}`, category: "error" });
      }
    }

    // Paste JSON → existing behavior.
    let text = "";
    try {
      text = String(form.get("data") || "").replace(/^\uFEFF/, "").trim();
    } catch (e) {
      return NextResponse.json({ ok: false, message: `Invalid JSON: ${e instanceof Error ? e.message : e}`, category: "error" });
    }
    if (!text) return NextResponse.json({ ok: false, message: "Paste JSON or upload a PDF/JSON file.", category: "error" });
    try {
      const items = parseQaJson(text);
      const count = insertQaRecursive(id, items, parentId, "json");
      const result = items
        .filter((i) => i && typeof i === "object")
        .map((i) => ({ question: String(i.question || i.q || ""), answer: String(i.answer || i.a || "") }))
        .slice(0, 20);
      return NextResponse.json({ ok: true, message: `Fine-tuned with ${count} Q&A entries from JSON.`, category: "success", result });
    } catch (e) {
      return NextResponse.json({ ok: false, message: `Invalid JSON: ${e instanceof Error ? e.message : e}`, category: "error" });
    }
  }

  const url = String(form.get("url") || "").trim();
  const maxPairs = Number(form.get("max_pairs") || 8) || 8;
  if (!url) return NextResponse.json({ ok: false, message: "URL required", category: "error" });
  const { pairs, error } = await extractQaFromUrl(url, maxPairs);
  if (error) return NextResponse.json({ ok: false, message: `Training failed: ${error}`, category: "error" });
  if (!pairs.length) return NextResponse.json({ ok: false, message: "Training failed: no Q&A pairs could be generated from this URL.", category: "error" });
  for (const p of pairs) {
    createQa({ botId: id, question: p.question.slice(0, 1000), answer: p.answer.slice(0, 4000), keywords: "", source: "autotrain", parentId });
  }
  updateBot(id, { trainedFromUrl: url });
  return NextResponse.json({ ok: true, message: `Added ${pairs.length} Q&A pairs from ${url}`, category: "success", result: pairs });
}
