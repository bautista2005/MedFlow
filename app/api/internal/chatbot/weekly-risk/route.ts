import { NextResponse } from "next/server";

import { recalculateWeeklyRiskSnapshots } from "@/lib/chatbot/service";
import { getInternalAutomationBearerToken } from "@/lib/env";

export const runtime = "nodejs";

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.replace(/^Bearer\s+/i, "").trim() ?? "";
}

export async function POST(request: Request) {
  try {
    const configuredToken = getInternalAutomationBearerToken();

    if (!configuredToken) {
      return NextResponse.json(
        { error: "El proceso interno del chatbot no tiene un token configurado." },
        { status: 503 },
      );
    }

    if (getBearerToken(request) !== configuredToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await request.text();
    const payload =
      rawBody.trim().length > 0 ? ((JSON.parse(rawBody) as { reference_at?: string }) ?? {}) : {};
    const result = await recalculateWeeklyRiskSnapshots(payload.reference_at);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "No se pudo recalcular el riesgo semanal del chatbot." },
      { status: 500 },
    );
  }
}
