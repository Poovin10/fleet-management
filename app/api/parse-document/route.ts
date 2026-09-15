import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { NextResponse } from 'next/server';

// Force Vercel to allow up to 60 seconds so Gemini doesn't timeout!
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

    switch (documentType) {
      case "TRIP_INVOICE":
        prompt = "Extract the transport details from this invoice or bilty. If a field is unreadable, omit it.";
        schema = {
          type: SchemaType.OBJECT,
          properties: {
            lrNo: { type: SchemaType.STRING, description: "The LR, Consignment, or Bilty number" },
            tonnage: { type: SchemaType.NUMBER, description: "The total loaded weight in metric tons (MT)" },
            destination: { type: SchemaType.STRING, description: "The delivery destination city" },
            date: { type: SchemaType.STRING, description: "The document date in YYYY-MM-DD format" },
            truckNo: { type: SchemaType.STRING, description: "The vehicle or truck registration number (e.g., TN 33 AB 1234)" },
            cargoType: { type: SchemaType.STRING, description: "The cargo packaging type, strictly return either 'BULK' or 'BAG'" },
            source: { type: SchemaType.STRING, description: "The source or origin city where the trip starts" }
          }
        };
        break;
      
      case "FUEL_SLIP":
        prompt = "Extract the diesel fuel receipt details. If a field is unreadable, omit it.";
        schema = {
          type: SchemaType.OBJECT,
          properties: {
            truckNo: { type: SchemaType.STRING, description: "The vehicle or truck registration number" },
            litres: { type: SchemaType.NUMBER, description: "Total diesel volume in litres" },
            rate: { type: SchemaType.NUMBER, description: "Price per litre" },
            totalAmount: { type: SchemaType.NUMBER, description: "Total bill amount" },
          }
        };
        break;

      case "POD_CLOSURE":
        prompt = "Extract the weighment slip and POD details. If a field is unreadable, omit it.";
        schema = {
          type: SchemaType.OBJECT,
          properties: {
            lrNo: { type: SchemaType.STRING, description: "The LR, Consignment, or Bilty number" },
            shortageKg: { type: SchemaType.NUMBER, description: "Any weight shortage in KG" },
            deliveryDate: { type: SchemaType.STRING, description: "Date of delivery in YYYY-MM-DD format" },
          }
        };
        break;
    }

    // 🚀 FIX: Use "gemini-1.5-flash-latest" which is the safest global fallback
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
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
    
    // Clean markdown if Gemini accidentally wraps the JSON response
    const cleanText = textResponse.replace(/```json/gi, "").replace(/```/gi, "").trim();
    const parsedData = JSON.parse(cleanText);
    
    return NextResponse.json({ data: parsedData });

  } catch (error: any) {
    console.error("AI Parsing Error:", error);
    return NextResponse.json({ error: error?.message || "Unknown internal server crash." }, { status: 500 });
  }
}
