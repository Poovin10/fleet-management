import { NextResponse } from 'next/server';
import { parseDocumentLocally } from '@/lib/localParser';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { imageBase64, documentType, rawOcrText } = await req.json();

    if (!documentType) {
      return NextResponse.json({ error: "Document type is required." }, { status: 400 });
    }

    // Fallback sample text if rawOcrText isn't passed directly from client-side OCR
    const textToParse = rawOcrText || "";

    // Run 100% local pattern matching extraction
    const parsedData = parseDocumentLocally(textToParse, documentType);
    
    return NextResponse.json({ 
      success: true, 
      source: "local-pattern-engine",
      data: parsedData 
    });

  } catch (error: any) {
    console.error("Local Parsing Error:", error);
    return NextResponse.json({ error: error?.message || "Internal parser error." }, { status: 500 });
  }
}
