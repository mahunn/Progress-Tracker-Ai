import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import { ParsedEntry } from "@/lib/types";

const SYSTEM_PROMPT = `You are an AI planner. The user provides a natural language description of tasks they intend to do today.

Your job is to separate their plan into multiple distinct tasks.
For example, if the user says "learn python for 1 hr, learn ml for 1 hr, i'll learn eco today", you should return 3 tasks.

Extract the following fields for EACH task and return ONLY a valid JSON array of objects (no markdown, no explanation):

[
  {
    "date": "YYYY-MM-DD",           // ISO date. Use today's date.
    "subject": "string",             // High-level subject area, e.g. "AI/ML", "Mathematics", "Programming"
    "course": "string",              // Course name if mentioned, else infer from context or leave empty
    "module": "string",              // Module name/number if mentioned
    "lesson": "string",              // Specific lesson/video/chapter if mentioned
    "estimated_time": "string",      // E.g. "1 hr", "30 mins". Extract if mentioned, else leave empty
    "notes": "string",               // The raw task description
    "status": "todo",                // MUST always be "todo"
    "confidence": number             // 0-100: how confident you are in the parse
  }
]

Rules:
- Be generous with inference. "learn python" -> subject="Programming", notes="Learn Python".
- Always return a JSON array, even if there's only 1 task.
- For missing optional fields, use empty string ""`;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "GEMINI_API_KEY not configured. Please add it to your Vercel Environment Variables." },
        { status: 400 }
      );
    }

    const { text, clientDate } = await req.json();

    if (!text?.trim()) {
      return NextResponse.json(
        { success: false, error: "No text provided" },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const dateToUse = clientDate || new Date().toISOString().split("T")[0];
    const systemInstruction = `${SYSTEM_PROMPT}\n- Today's date for reference: ${dateToUse}`;
    
    const parts: Part[] = [
      { text: systemInstruction },
      { text: `User plan: "${text}"` }
    ];

    const modelsToTry = [
      "gemini-3.5-flash-lite",
      "gemini-3.5-flash",
      "gemini-flash-latest",
    ];
    
    let responseText = "";
    let lastError: any = null;

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
      } catch (e: any) {
        console.warn(`[parse-plan] Model ${modelName} failed:`, e.message);
        lastError = e;
      }
    }

    if (!responseText) {
      return NextResponse.json(
        { success: false, error: lastError?.message || "Failed to generate content with any Gemini model." },
        { status: 400 }
      );
    }

    const cleaned = responseText
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "")
      .trim();

    let parsedArray: ParsedEntry[] = JSON.parse(cleaned);
    if (!Array.isArray(parsedArray)) {
      parsedArray = [parsedArray];
    }

    parsedArray = parsedArray.map((p) => ({
      ...p,
      date: dateToUse,
      status: "todo",
      confidence: typeof p.confidence === "number" 
        ? (p.confidence <= 1 ? Math.round(p.confidence * 100) : Math.min(100, Math.max(0, Math.round(p.confidence))))
        : 90
    }));

    return NextResponse.json({ success: true, parsed: parsedArray });
  } catch (err) {
    console.error("[parse-plan] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error occurred",
      },
      { status: 400 }
    );
  }
}
