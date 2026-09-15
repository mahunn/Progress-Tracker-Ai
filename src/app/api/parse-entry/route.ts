import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, Part } from "@google/generative-ai";

const SYSTEM_PROMPT = `You are a study progress parser. The user gives you a natural language note about what they studied today, possibly with a screenshot.

Extract the following fields from their message and return ONLY valid JSON (no markdown, no explanation):

{
  "date": "YYYY-MM-DD",           // ISO date. If not provided, use today's date.
  "subject": "string",             // High-level subject area, e.g. "AI/ML", "Mathematics", "Programming"
  "course": "string",              // Course name if mentioned, else infer from context
  "module": "string",              // Module name/number if mentioned
  "lesson": "string",              // Specific lesson/video/chapter if mentioned
  "status": "completed" | "in_progress" | "revisit",
  "notes": "string",               // Any extra notes or what they learned
  "confidence": number             // 0-100: how confident you are in the parse
}

Rules:
- Be generous with inference. "did ai ml module 1" → subject="AI/ML", module="Module 01"
- If screenshot text is provided, use it to fill in missing fields
- Date formats like "14 sep", "sep 14", "today", "yesterday" should all be converted to ISO
- Always return valid parseable JSON with all fields present
- For missing optional fields, use empty string ""`;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "GEMINI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const text = formData.get("text") as string;
    const imageFile = formData.get("image") as File | null;
    const clientDate = (formData.get("clientDate") as string) || new Date().toISOString().split("T")[0];

    if (!text?.trim() && !imageFile) {
      return NextResponse.json(
        { success: false, error: "No text or image provided" },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const systemInstruction = `${SYSTEM_PROMPT}\n- Today's date for reference: ${clientDate}`;
    const parts: Part[] = [{ text: systemInstruction }];

    if (text?.trim()) {
      parts.push({ text: `User note: "${text}"` });
    }

    if (imageFile) {
      const bytes = await imageFile.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      parts.push({
        inlineData: {
          data: base64,
          mimeType: (imageFile.type as "image/jpeg" | "image/png" | "image/webp") || "image/jpeg",
        },
      });
      parts.push({
        text: "The above image is a screenshot of the user's learning platform. Extract any relevant course/module/lesson information from it to enrich the parsed entry.",
      });
    }

    const modelsToTry = [
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-2.5-flash",
      "gemini-1.5-flash-8b",
      "gemini-3.5-flash-lite",
      "gemini-3.1-flash-lite",
      "gemini-3.6-flash",
    ];
    let responseText = "";
    let lastError: unknown = null;

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        });
        const result = await model.generateContent(parts);
        responseText = result.response.text().trim();
        if (responseText) break;
      } catch (e) {
        console.warn(`[parse-entry] Model ${modelName} failed, trying fallback:`, e);
        lastError = e;
      }
    }

    if (!responseText) {
      throw lastError || new Error("Failed to get response from AI model");
    }

    // Strip markdown code fences if present
    const cleaned = responseText
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    // Normalize confidence to 0-100 integer if model returned 0.0-1.0
    if (typeof parsed.confidence === "number") {
      if (parsed.confidence <= 1 && parsed.confidence > 0) {
        parsed.confidence = Math.round(parsed.confidence * 100);
      } else {
        parsed.confidence = Math.min(100, Math.max(0, Math.round(parsed.confidence)));
      }
    } else {
      parsed.confidence = 90;
    }

    return NextResponse.json({ success: true, parsed });
  } catch (err) {
    console.error("[parse-entry] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
