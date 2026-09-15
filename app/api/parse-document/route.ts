import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY is missing on the server." }, { status: 500 });
    }

    const { imageBase64, documentType } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "No image data received from the app." }, { status: 400 });
    }

    let schema: any; 
    let prompt = "";

    // ... (keep switch statement exactly as it was) ...

    // 🚀 FIX: Upgraded to Google's current active model (1.5 Flash was retired)
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      }
    });

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: imageBase64, mimeType: "image/jpeg" } }
    ]);

    const textResponse = result.response.text();
    const cleanText = textResponse.replace(/```json/gi, "").replace(/```/gi, "").trim();
    const parsedData = JSON.parse(cleanText);

    return NextResponse.json({ data: parsedData });

  } catch (error: any) {
    console.error("AI Parsing Error:", error);
    return NextResponse.json({ error: error?.message || "Unknown internal server crash." }, { status: 500 });
  }
}
