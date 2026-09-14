import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { NextResponse } from 'next/server';

// Initialize the Gemini AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { imageBase64, documentType } = await req.json();

    // 1. Define the Expected JSON Schema based on Document Type
    let schema;
    let prompt = "";

    switch (documentType) {
      case "TRIP_INVOICE":
        prompt = "Extract the transport details from this invoice or bilty.";
        schema = {
          type: SchemaType.OBJECT,
          properties: {
            lrNo: { type: SchemaType.STRING, description: "The LR, Consignment, or Bilty number" },
            tonnage: { type: SchemaType.NUMBER, description: "The total loaded weight in metric tons (MT)" },
            destination: { type: SchemaType.STRING, description: "The delivery destination city" },
          }
        };
        break;
      
      case "FUEL_SLIP":
        prompt = "Extract the diesel fuel receipt details.";
        schema = {
          type: SchemaType.OBJECT,
          properties: {
            litres: { type: SchemaType.NUMBER, description: "Total diesel volume in litres" },
            rate: { type: SchemaType.NUMBER, description: "Price per litre" },
            totalAmount: { type: SchemaType.NUMBER, description: "Total bill amount" },
          }
        };
        break;

      case "POD_CLOSURE":
        prompt = "Extract the weighment slip and POD details.";
        schema = {
          type: SchemaType.OBJECT,
          properties: {
            shortageKg: { type: SchemaType.NUMBER, description: "Any weight shortage in KG" },
            deliveryDate: { type: SchemaType.STRING, description: "Date of delivery in YYYY-MM-DD format" },
          }
        };
        break;
    }

    // 2. Call the Gemini 1.5 Flash Model
    // We strictly enforce the JSON schema so it never breaks our frontend app
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      }
    });

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageBase64,
          mimeType: "image/jpeg"
        }
      }
    ]);

    // 3. Return the clean, parsed data to the mobile app
    const parsedData = JSON.parse(result.response.text());
    return NextResponse.json({ data: parsedData });

  } catch (error: any) {
    console.error("AI Parsing Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
