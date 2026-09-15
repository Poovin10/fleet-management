import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const maxDuration = 60; // Allow up to 60s for heavy audit processing

export async function GET(req: Request) {
  try {
    // 1. Secure the cron endpoint (Optional: check for a Vercel cron secret header if desired)
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // For development ease, you can hit this route directly from a browser or curl without a secret if not set
    }

    // Initialize Supabase Admin Client (to bypass RLS for background cron jobs)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2. Fetch fleet data for analysis
    const [vehiclesRes, tripsRes, fuelRes, repairsRes] = await Promise.all([
      supabase.from('vehicles').select('*').eq('is_active', true),
      supabase.from('trips').select('*, vehicles(vehicle_number), drivers(full_name)').order('trip_id', { ascending: false }).limit(50),
      supabase.from('diesel_fuel_logs').select('*, vehicles(vehicle_number)').order('fuel_date', { ascending: false }).limit(50),
      supabase.from('workshop_repairs').select('*, vehicles(vehicle_number)').order('repair_date', { ascending: false }).limit(30)
    ]);

    const fleetData = {
      vehicles: vehiclesRes.data || [],
      recentTrips: tripsRes.data || [],
      recentFuelLogs: fuelRes.data || [],
      recentRepairs: repairsRes.data || []
    };

    // 3. Initialize Gemini
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
                  severity: { type: SchemaType.STRING, description: "HIGH, MEDIUM, or LOW" },
                  issue: { type: SchemaType.STRING },
                  recommendation: { type: SchemaType.STRING }
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
                  potentialSavings: { type: SchemaType.STRING }
                }
              }
            },
            retention_suggestions: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  category: { type: SchemaType.STRING },
                  insight: { type: SchemaType.STRING },
                  actionableStep: { type: SchemaType.STRING }
                }
              }
            }
          }
        },
        thinkingConfig: { thinkingBudget: 0 }
      } as any
    });

    const prompt = `You are an elite Fleet Data Scientist and Operations Auditor for KSS Roadways managing 26 commercial heavy trucks.
    Analyze the following live database JSON containing fleet vehicles, recent trips, fuel logs, and workshop repair costs.
    
    Review the data thoroughly and generate a strict JSON audit report covering:
    1. "anomalies": Spot abnormal fuel consumption drops, suspicious spending, repetitive workshop breakdowns for the same truck, or missing weighment shortage deductions.
    2. "efficiency_leaks": Spot operational bottlenecks like trucks idling too long, slow POD turnaround times, or routes bleeding margin.
    3. "retention_suggestions": Provide data-driven insights on driver bata structures, halt times, and transit stress to improve driver retention.

    Here is the fleet database JSON:
    ${JSON.stringify(fleetData)}`.slice(0, 30000); // Prevent token overflow

    const result = await model.generateContent([prompt]);
    const textResponse = result.response.text();
    const cleanText = textResponse.replace(/```json/gi, "").replace(/```/gi, "").trim();
    const auditJson = JSON.parse(cleanText);

    // 4. Save the AI report into Supabase
    const { error: insertError } = await supabase.from('daily_ai_audits').upsert([{
      audit_date: new Date().toISOString().split('T')[0],
      anomalies: auditJson.anomalies || [],
      efficiency_leaks: auditJson.efficiency_leaks || [],
      retention_suggestions: auditJson.retention_suggestions || []
    }], { onConflict: 'audit_date' });

    if (insertError) {
      console.error("Failed to save audit report:", insertError);
    }

    return NextResponse.json({ success: true, message: "Nightly AI Audit completed successfully!", audit: auditJson });

  } catch (error: any) {
    console.error("Cron Audit Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error during nightly audit." }, { status: 500 });
  }
}
