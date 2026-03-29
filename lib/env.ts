export function getSupabaseEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  };
}

export function hasSupabaseEnv() {
  return Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL) &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function getAutomationBearerToken() {
  return process.env.CALENDAR_NOTIFICATIONS_CRON_SECRET ?? process.env.CRON_SECRET ?? "";
}

export function getInternalAutomationBearerToken() {
  return (
    process.env.CHATBOT_INTERNAL_CRON_SECRET ??
    process.env.CALENDAR_NOTIFICATIONS_CRON_SECRET ??
    process.env.CRON_SECRET ??
    ""
  );
}

export function getGeminiEnv() {
  return {
    apiKey: process.env.GEMINI_API_KEY ?? "",
    model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
  };
}
