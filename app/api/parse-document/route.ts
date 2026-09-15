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

    switch (documentType) {
      case "TRIP_INVOICE":
        prompt = `You are a Master Logistics Data Extractor for an Indian fleet. You will receive invoices from various cement and fly ash plants (e.g., UltraTech, JSW, ACC, Ambuja, Udupi, Tuticorin). Every company uses different layouts and terminology. Ignore the layout and extract the data based on these universal concepts:
        1. LR Number / Invoice No: The primary tracking number for the load. It might be called Bilty, Consignment, Document No, or Invoice No. If it is attached to a date or text (e.g., "677/20260915" or "INV-1029"), extract ONLY the core numbers/letters identifying the trip.
        2. Truck Number: Scan the entire document for an Indian vehicle registration plate (e.g., TN 23 DA 8092, KL 43 L 9218). It might be labeled 'Vehicle', 'Truck', 'Lorry', or have no label at all. Strip out spaces.
        3. Tonnage (MT): The net cargo weight in Metric Tons. This is usually a number between 15 and 45. It might be labeled 'Net Wt', 'Qty in MT', 'Invoiced Quantity', or 'Weight'. Return the exact number.
        4. Cargo Type: Deduce the packaging. If the item description says "LOOSE", "BULK", or "FLY ASH", return "BULK". If it mentions "BAGS", return "BAG".
        5. Source & Destination: The origin plant city/town (where it was dispatched from) and the final delivery destination.`;
        
        schema = {
          type: SchemaType.OBJECT,
          properties: {
            lrNo: { type: SchemaType.STRING, description: "The core LR or Invoice number" },
            tonnage: { type: SchemaType.NUMBER, description: "The loaded net weight in MT" },
            destination: { type: SchemaType.STRING, description: "Delivery city or town" },
            date: { type: SchemaType.STRING, description: "Document date (YYYY-MM-DD)" },
            truckNo: { type: SchemaType.STRING, description: "The Indian vehicle registration number" },
            cargoType: { type: SchemaType.STRING, description: "'BULK' or 'BAG'" },
            source: { type: SchemaType.STRING, description: "Origin plant city" }
          }
        };
        break;
      
      case "FUEL_SLIP":
        prompt = `You are an expert data extractor. Read this diesel/fuel receipt from any Indian fuel station (IOCL, BPCL, Reliance, Nayara, private bunks) and extract:
        1. Truck Number: Look for an Indian vehicle registration number.
        2. Litres: The total diesel volume dispensed.
        3. Rate: The price per litre.
        4. Total Amount: The final billed amount in INR.`;
        schema = {
          type: SchemaType.OBJECT,
          properties: {
            truckNo: { type: SchemaType.STRING, description: "Vehicle registration number" },
            litres: { type: SchemaType.NUMBER, description: "Total diesel volume" },
            rate: { type: SchemaType.NUMBER, description: "Price per litre" },
            totalAmount: { type: SchemaType.NUMBER, description: "Total bill amount" },
          }
        };
        break;

      case "POD_CLOSURE":
        prompt = `You are an expert data extractor. Read this weighment slip or Proof of Delivery (POD) from any destination site:
        1. LR Number: The reference tracking number.
        2. Shortage: If there is a weight difference, shortage, or deduction noted, extract it in KG.
        3. Delivery Date: The date the goods were received, unloaded, or weighed.`;
        schema = {
          type: SchemaType.OBJECT,
          properties: {
            lrNo: { type: SchemaType.STRING, description: "LR or Consignment number" },
            shortageKg: { type: SchemaType.NUMBER, description: "Shortage in KG" },
            deliveryDate: { type: SchemaType.STRING, description: "Date of delivery (YYYY-MM-DD)" },
          }
        };
        break;
    }

    // 🚀 RESTORED: Using your exact working configuration with gemini-3.6-flash
    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
        thinkingConfig: { thinkingBudget: 0 }
      } as any
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
