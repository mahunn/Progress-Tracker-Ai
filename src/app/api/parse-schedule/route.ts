import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, Part } from "@google/generative-ai";

const SYSTEM_PROMPT = `You are an intelligent NSU (North South University) course schedule parser. The user gives you a screenshot or text of their course timing.

Extract the courses and their timings, and return ONLY valid JSON in this exact structure:

{
  "courses": [
    {
      "courseCode": "CSE332.2",
      "startTime": "01:00 PM",
      "endTime": "02:30 PM",
      "days": ["Mon", "Wed"]
    }
  ]
}

CRITICAL RULES for Days Parsing (NSU specific mappings):
- "MW" means ["Mon", "Wed"]
- "RA" means ["Thu", "Sat"]
- "ST" means ["Sun", "Tue"]
- "R" means ["Thu"]
- "A" means ["Sat"]
- "M" means ["Mon"]
- "T" means ["Tue"]
- "W" means ["Wed"]
- "S" means ["Sun"]
- If a course has a combined time format like "01:00 PM - 02:30 PM MW", separate it cleanly.
- Ensure the days array only contains: "Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri".
- Ignore lab/theory distinctions in terms of structure, just extract them as separate courses or separate time slots if they are listed separately (e.g. CSE332.2 and CSE332L.2).
- Return valid parseable JSON. No markdown fences like \`\`\`json.`;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "GEMINI_API_KEY not configured. Please add it to your Vercel Environment Variables." },
        { status: 400 }
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
    const parts: Part[] = [{ text: SYSTEM_PROMPT }];

    if (text?.trim()) {
      parts.push({ text: `User schedule input: "${text}"` });
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
        text: "The above image is a screenshot of the user's schedule. Extract all the courses, timings, and days as requested.",
      });
    }

    const modelsToTry = [
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
      "gemini-1.5-pro",
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
        console.warn(`[parse-schedule] Model ${modelName} failed, trying fallback:`, e);
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

    return NextResponse.json({ success: true, courses: parsed.courses || [] });
  } catch (err) {
    console.error("[parse-schedule] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error occurred",
      },
      { status: 400 }
    );
  }
}
