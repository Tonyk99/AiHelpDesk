import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("image");
    const prompt = formData.get("prompt") as string;
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No image uploaded." }, { status: 400 });
    }
    if (!prompt) {
      return NextResponse.json({ error: "No prompt provided." }, { status: 400 });
    }
    // Convert Blob to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Call OpenAI Vision (GPT-4o)
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a helpful IT support assistant for non-technical users. Explain things simply and step by step.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${file.type};base64,${buffer.toString("base64")}` } },
          ],
        },
      ],
      max_tokens: 500,
    });
    const aiMessage = response.choices[0]?.message?.content || "Sorry, I couldn't analyze the screenshot.";
    return NextResponse.json({ result: aiMessage });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unknown error" }, { status: 500 });
  }
}