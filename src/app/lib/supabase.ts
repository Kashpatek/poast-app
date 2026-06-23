import { createClient } from "@/app/lib/neon-db";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = supabaseUrl
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
