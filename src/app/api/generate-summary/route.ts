import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 30; // Max timeout for serverless function

export async function POST(req: NextRequest) {
  try {
    const { entries, timeframe } = await req.json();

    if (!entries || !Array.isArray(entries)) {
      return NextResponse.json(
        { error: "Valid entries array is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("Missing GEMINI_API_KEY");
      return NextResponse.json(
        { error: "AI service configuration missing" },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

    // Format entries for the prompt
    const entryDetails = entries.map((e) => {
      return `- [${e.status.toUpperCase()}] ${e.subject} > ${e.course} > ${e.module} > ${e.lesson}
  Notes: ${e.notes || "None"}`;
    }).join("\n");

    const prompt = `You are an encouraging and insightful AI study tutor for TrackPath AI.
The user has requested a progress summary for their studying over the timeframe: "${timeframe}".

Here are their logged study entries:
${entryDetails}

Please write a highly engaging, structured, and motivational summary of their progress.
Include the following in your response using markdown:
1. **The Big Picture**: A brief overview of what they focused on and their general momentum.
2. **Key Concepts Conquered**: Highlight the most significant topics they completed.
3. **What Needs Attention**: Identify any patterns or specific items marked as 'in_progress' or 'revisit'. Suggest a constructive next step.
4. **Encouragement**: A short closing sentence to keep them motivated.

Format the response beautifully in markdown with emojis, bold text, and bullet points where appropriate. Keep it concise but personal. Do not output markdown code blocks (\`\`\`markdown), just raw markdown.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ summary: text });
  } catch (error: any) {
    console.error("Summary generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate summary" },
      { status: 500 }
    );
  }
}
