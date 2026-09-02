import { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { getBotByPublicId, getConvoBySession, createConvo, createMessage } from "@/lib/repo";
import { analyzeImage } from "@/lib/llm";
import { corsJson, corsPreflight, domainAllowed, extOk, appBaseUrl, MAX_UPLOAD_MB } from "@/lib/util";

export const runtime = "nodejs";

export async function OPTIONS() {
  return corsPreflight();
}

const MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const bot = getBotByPublicId(publicId);
  if (!bot) return corsJson({ error: "not found" }, 404);
  if (!domainAllowed(bot.allowedDomains, req.headers.get("Origin") || "")) {
    return corsJson({ error: "domain not allowed" }, 403);
  }
  if (!bot.enableImageUpload) return corsJson({ error: "image upload disabled" }, 403);

  const form = await req.formData();
  const file = form.get("image");
  if (!(file instanceof File) || !file.name) return corsJson({ error: "no file" }, 400);
  if (!extOk(file.name)) return corsJson({ error: "unsupported file type" }, 400);
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return corsJson({ error: "file too large" }, 400);

  const ext = file.name.split(".").pop()!.toLowerCase();
  const fname = `${bot.publicId}_${randomBytes(8).toString("hex")}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, fname), buf);

  const publicUrl = `${appBaseUrl()}/uploads/${fname}`;
  const dataUrl = `data:${MIME[ext] || "image/png"};base64,${buf.toString("base64")}`;

  const prompt = String(form.get("prompt") || "Describe this image and answer any user question about it.").trim();
  const sessionId = String(form.get("session_id") || "").trim() || randomBytes(9).toString("base64url");
  const pageUrl = String(form.get("page_url") || "").slice(0, 500);

  let convo = getConvoBySession(bot._id, sessionId);
  if (!convo) convo = createConvo({ botId: bot._id, sessionId, pageUrl });

  createMessage(convo._id, "user", prompt, publicUrl);
  const reply = await analyzeImage(dataUrl, prompt, bot.visionModel);
  const botMsg = createMessage(convo._id, "bot", reply);

  return corsJson({ reply, image_url: publicUrl, session_id: sessionId, message_id: botMsg._id });
}
