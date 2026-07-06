// Client Supabase — PRÉPARÉ, non branché. Bascule contrôlée par env.
// Tant que EXPO_PUBLIC_USE_SUPABASE !== "1", l'app reste 100 % Firebase.
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const USE_SUPABASE = process.env.EXPO_PUBLIC_USE_SUPABASE === "1";
export const supabase: SupabaseClient | null =
  USE_SUPABASE && url && anon ? createClient(url, anon) : null;
