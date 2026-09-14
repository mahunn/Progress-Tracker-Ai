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
- Today's date for reference: ${new Date().toISOString().split("T")[0]}
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

    if (!text?.trim() && !imageFile) {
      return NextResponse.json(
        { success: false, error: "No text or image provided" },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const parts: Part[] = [{ text: SYSTEM_PROMPT }];

    if (text?.trim()) {
      parts.push({ text: `User note: "${text}"` });
    }

    if (imageFile) {
      const bytes = await imageFile.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      parts.push({
        inlineData: {
          data: base64,
          mimeType: imageFile.type as "image/jpeg" | "image/png" | "image/webp",
        },
      });
      parts.push({
        text: "The above image is a screenshot of the user's learning platform. Extract any relevant course/module/lesson information from it to enrich the parsed entry.",
      });
    }

    const result = await model.generateContent(parts);
    const responseText = result.response.text().trim();

    // Strip markdown code fences if present
    const cleaned = responseText
      .replace(/^```json\n?/, "")
      .replace(/\n?```$/, "")
      .trim();

    const parsed = JSON.parse(cleaned);

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
