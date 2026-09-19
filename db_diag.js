require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log("🔍 RUNNING DB SCHEMA DIAGNOSTICS...\n");

  const { count: vCount, data: vData } = await supabase.from('vehicles').select('*', { count: 'exact' }).limit(1);
  const { count: tCount, data: tData } = await supabase.from('trucks').select('*', { count: 'exact' }).limit(1);
  const { data: tripData } = await supabase.from('trips').select('*').limit(1);

  console.log(`🚛 [vehicles] table: ${vCount} rows`);
  if (vData && vData.length) console.log(`   Columns: ${Object.keys(vData[0]).join(', ')}\n`);

  console.log(`🚚 [trucks] table: ${tCount} rows`);
  if (tData && tData.length) console.log(`   Columns: ${Object.keys(tData[0]).join(', ')}\n`);

  console.log(`🛣️ [trips] table references:`);
  if (tripData && tripData.length) {
    const tripKeys = Object.keys(tripData[0]);
    const fks = tripKeys.filter(k => k.includes('truck') || k.includes('vehicle') || k.includes('id'));
    console.log(`   Keys: ${fks.join(', ')}\n`);
  }
}

diagnose();
