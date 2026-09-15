import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const maxDuration = 60; 

export async function GET(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const [vehiclesRes, tripsRes, fuelRes, repairsRes] = await Promise.all([
      supabase.from('vehicles').select('*').eq('is_active', true),
      supabase.from('trips').select('*, vehicles(vehicle_number), drivers(full_name)').order('trip_id', { ascending: false }).limit(30),
      supabase.from('diesel_fuel_logs').select('*, vehicles(vehicle_number)').order('fuel_date', { ascending: false }).limit(30),
      supabase.from('workshop_repairs').select('*, vehicles(vehicle_number)').order('repair_date', { ascending: false }).limit(20)
    ]);

    const fleetData = {
      vehicles: vehiclesRes.data || [],
      recentTrips: tripsRes.data || [],
      recentFuelLogs: fuelRes.data || [],
      recentRepairs: repairsRes.data || []
    };

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            anomalies: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  truckNo: { type: SchemaType.STRING },
                  severity: { type: SchemaType.STRING },
                  issueDescription: { type: SchemaType.STRING },
                  actionItem: { type: SchemaType.STRING }
                }
              }
            },
            efficiency_leaks: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  area: { type: SchemaType.STRING },
                  details: { type: SchemaType.STRING },
                  estimatedLoss: { type: SchemaType.STRING }
                }
              }
            },
            retention_suggestions: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  category: { type: SchemaType.STRING },
                  suggestion: { type: SchemaType.STRING }
                }
              }
            }
          }
        },
        temperature: 0.1,
        // 🚀 CRITICAL FIX: Disable internal thinking loop so it doesn't dump tokens into text output
        thinkingConfig: { thinkingBudget: 0 }
      } as any
    });

    const prompt = `You are a professional Fleet Operations Director for KSS Roadways managing 26 commercial heavy trucks in South India. 
    Analyze the provided fleet database JSON and output a short, precise JSON response. Do not repeat words or write long essays. Keep issue descriptions under 2 sentences.

    Database JSON:
    ${JSON.stringify(fleetData)}`.slice(0, 15000);

    const result = await model.generateContent([prompt]);
    const textResponse = result.response.text();
    const cleanText = textResponse.replace(/```json/gi, "").replace(/```/gi, "").trim();
    const auditJson = JSON.parse(cleanText);

    await supabase.from('daily_ai_audits').upsert([{
      audit_date: new Date().toISOString().split('T')[0],
      anomalies: auditJson.anomalies || [],
      efficiency_leaks: auditJson.efficiency_leaks || [],
      retention_suggestions: auditJson.retention_suggestions || []
    }], { onConflict: 'audit_date' });

    return NextResponse.json({ success: true, message: "Professional Audit completed!", audit: auditJson });

  } catch (error: any) {
    console.error("Cron Audit Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error." }, { status: 500 });
  }
}
