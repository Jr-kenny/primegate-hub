import { getDatabaseUrl, getSql } from "./_lib/database";

export async function GET() {
  try {
    const sql = getSql();

    if (!sql) {
      return Response.json({
        data: {
          databaseConfigured: false,
          databaseReachable: false,
          status: "degraded",
        },
      });
    }

    await sql`select 1 as ok`;

    return Response.json({
      data: {
        databaseConfigured: Boolean(getDatabaseUrl()),
        databaseReachable: true,
        status: "ok",
      },
    });
  } catch (error) {
    console.error("GET /api/health failed", error);
    return Response.json(
      {
        error: "Health check failed.",
      },
      { status: 500 },
    );
  }
}
