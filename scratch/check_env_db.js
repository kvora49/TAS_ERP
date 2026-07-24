require('dotenv').config({ path: '.env.local' });
console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log("Keys available:", Object.keys(process.env).filter(k => k.includes("DB") || k.includes("POSTGRES") || k.includes("SUPABASE") || k.includes("URL")));
