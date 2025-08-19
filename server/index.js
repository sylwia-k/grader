import express from "express";
import cors from "cors";
import multer from "multer";
import visionPkg from "@google-cloud/vision";
const { v2: vision } = visionPkg;
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Initialize clients if keys are present
let visionClient = null;
try {
  visionClient = new vision.ImageAnnotatorClient();
} catch (e) {
  console.warn("Google Vision client not initialized. Set GOOGLE_APPLICATION_CREDENTIALS to enable OCR.");
}

let openaiClient = null;
if (process.env.OPENAI_API_KEY) {
  openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// Utility: extract header fields from text lines
function extractHeaderFields(fullText) {
  const lines = fullText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let name = "";
  let surname = "";
  let journalNumber = "";
  let warning = "";

  // Polish labels that may appear near header fields
  const nameLabels = [/^imi[eę]/i, /^nazwisko/i];
  const journalLabels = [/nr/i, /numer/i, /dziennika/i, /dziennik/i];

  // 1) Try labeled lines like "Imię: Jan" / "Nazwisko: Kowalski" / "Nr: 12"
  for (const line of lines.slice(0, 8)) {
    const parts = line.split(/[:\-]/).map(s => s.trim());
    if (parts.length >= 2) {
      const label = parts[0];
      const value = parts.slice(1).join(" ");
      if (/imi[eę]/i.test(label) && !name) name = value.split(/\s+/)[0] || "";
      if (/nazwisko/i.test(label) && !surname) surname = value.split(/\s+/)[0] || "";
      if (journalLabels.some(r => r.test(label)) && !journalNumber) {
        const m = value.match(/\d{1,3}/);
        if (m) journalNumber = m[0];
      }
    }
  }

  // 2) Fallback: first two capitalized words near top (supports Polish diacritics)
  const nameWord = /^(?:[A-ZŁŚŻŹĆŃÓĄĘ])[a-ząćęłńóśźż\-]{2,}$/;
  if (!name || !surname) {
    for (const line of lines.slice(0, 5)) {
      const words = line.split(/\s+/).filter(Boolean);
      for (let i = 0; i < words.length - 1; i++) {
        const w1 = words[i].replace(/[^\p{L}\-]/gu, "");
        const w2 = words[i + 1].replace(/[^\p{L}\-]/gu, "");
        if (!name && nameWord.test(w1)) name = w1;
        if (!surname && nameWord.test(w2)) surname = w2;
        if (name && surname) break;
      }
      if (name && surname) break;
    }
  }

  // 3) Journal number fallback anywhere in first lines
  if (!journalNumber) {
    for (const line of lines.slice(0, 8)) {
      const m = line.match(/(?:nr|numer|dziennik)\D*(\d{1,3})/i) || line.match(/\b(\d{1,3})\b/);
      if (m) { journalNumber = m[1]; break; }
    }
  }

  if (!name || !surname) {
    warning = "Nie udało się pewnie odczytać imienia i nazwiska. Upewnij się, że nagłówek jest czytelny.";
  }
  return { name, surname, journalNumber, warning };
}

app.post("/api/ocr/header", upload.single("file"), async (req, res) => {
  try {
    if (!visionClient) {
      return res.status(503).json({ error: "OCR niedostępny. Skonfiguruj GOOGLE_APPLICATION_CREDENTIALS." });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Brak pliku." });
    }

    const [result] = await visionClient.documentTextDetection({ image: { content: req.file.buffer } });
    const fullText = result?.fullTextAnnotation?.text || result?.textAnnotations?.[0]?.description || "";
    if (!fullText) {
      return res.status(200).json({ name: "", surname: "", journalNumber: "", warning: "Nie wykryto tekstu na obrazie." });
    }

    const { name, surname, journalNumber, warning } = extractHeaderFields(fullText);
    const ocrConfidence = result?.fullTextAnnotation?.pages?.[0]?.confidence ?? null;

    // Best-effort detection of question indices and crossed-out marks from OCR text
    const detectedQuestionsSet = new Set();
    const crossedOutSet = new Set();
    const rawLines = fullText.split(/\r?\n/);
    for (const line of rawLines) {
      const t = line.trim();
      const m = t.match(/^(\d{1,3})[).:\-\s]+/);
      if (m) {
        const q = parseInt(m[1]);
        if (!Number.isNaN(q)) detectedQuestionsSet.add(q);
      }
      const m1 = t.match(/^\s*[Xx]\s*(\d{1,3})\b/);
      if (m1) {
        const q = parseInt(m1[1]);
        if (!Number.isNaN(q)) crossedOutSet.add(q);
      }
      const m2 = t.match(/^\s*(\d{1,3})\s*[).:\-]*\s*[Xx]\s*$/);
      if (m2) {
        const q = parseInt(m2[1]);
        if (!Number.isNaN(q)) crossedOutSet.add(q);
      }
      const m3 = t.match(/(zad(?:anie)?|nr)?\s*(\d{1,3}).{0,15}(skre|przekre)/i);
      if (m3) {
        const q = parseInt(m3[2]);
        if (!Number.isNaN(q)) crossedOutSet.add(q);
      }
    }
    const detectedQuestions = Array.from(detectedQuestionsSet).sort((a, b) => a - b);
    const crossedOutQuestions = Array.from(crossedOutSet).sort((a, b) => a - b);

    return res.json({
      name,
      surname,
      journalNumber,
      fullText,
      confidence: ocrConfidence,
      warning,
      detectedQuestions,
      crossedOutQuestions,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Błąd OCR.", details: String(e?.message || e) });
  }
});

app.post("/api/llm/score-open", async (req, res) => {
  try {
    if (!openaiClient) {
      return res.status(503).json({ error: "LLM niedostępny. Skonfiguruj OPENAI_API_KEY." });
    }
    const { prompt, studentAnswer, rubric } = req.body || {};
    if (!studentAnswer) {
      return res.status(400).json({ error: "Brak odpowiedzi ucznia." });
    }
    const system =
      "Jesteś nauczycielem. Oceń odpowiedź ucznia zgodnie z kluczem i rubryką. Skala 0-5 pkt: poprawność (0-1), styl (0-2), argumentacja (0-2). Zwróć JSON: {score, notes}.";
    const user = `Klucz/rubryka: ${rubric || prompt || "brak"}\nOdpowiedź: ${studentAnswer}`;

    const resp = await openaiClient.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });
    const content = resp.choices?.[0]?.message?.content || "{}";
    let parsed = {};
    try { parsed = JSON.parse(content); } catch { parsed = { score: 0, notes: "Błąd parsowania odpowiedzi modelu." }; }
    return res.json(parsed);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Błąd oceny LLM.", details: String(e?.message || e) });
  }
});

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`API server listening on :${port}`);
});