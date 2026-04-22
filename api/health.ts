import { getDatabaseUrl, getSql } from "./_lib/database.js";
import { jsonResponse } from "./_lib/request.js";

export async function GET() {
  try {
    const sql = getSql();

    if (!sql) {
      return jsonResponse({
        data: {
          databaseConfigured: false,
          databaseReachable: false,
          status: "degraded",
        },
      });
    }

    await sql`select 1 as ok`;

    return jsonResponse({
      data: {
        databaseConfigured: Boolean(getDatabaseUrl()),
        databaseReachable: true,
        status: "ok",
      },
    });
  } catch (error) {
    console.error("GET /api/health failed", error);
    return jsonResponse(
      {
        error: "Health check failed.",
      },
      { status: 500 },
    );
  }
}
