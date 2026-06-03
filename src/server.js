import { neon } from "@neondatabase/serverless";

// Initialize NeonDB connection using process.env
const databaseUrl = process.env.DATABASE_URL_PROD;
if (!databaseUrl) {
  console.error("❌ DATABASE_URL_PROD environment variable is not set!");
  process.exit(1);
}

const sql = neon(databaseUrl);

// Create table if it doesn't exist
try {
  await sql`
    CREATE TABLE IF NOT EXISTS conversation_history (
      id SERIAL PRIMARY KEY,
      floor INTEGER,
      challenge TEXT,
      player_answer TEXT,
      admin_remark TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  console.log("⚡ NeonDB Table 'conversation_history' checked/created successfully.");
} catch (e) {
  console.error("❌ Failed to initialize NeonDB table:", e);
}

Bun.serve({
  port: 3002,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/api/memory" && req.method === "GET") {
      try {
        const history = await sql`SELECT * FROM conversation_history ORDER BY id DESC LIMIT 5`;
        // Reverse to get chronological order of the last 5
        const reversedHistory = [...history].reverse();
        return new Response(JSON.stringify(reversedHistory), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (e) {
        console.error("❌ GET /api/memory error:", e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    if (url.pathname === "/api/memory" && req.method === "POST") {
      try {
        const body = await req.json();
        const { floor, challenge, player_answer, admin_remark } = body;
        
        await sql`
          INSERT INTO conversation_history (floor, challenge, player_answer, admin_remark) 
          VALUES (${floor}, ${challenge}, ${player_answer}, ${admin_remark})
        `;
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (e) {
        console.error("❌ POST /api/memory error:", e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    return new Response("Not found", { status: 404 });
  }
});

console.log("🧠 NeonDB-connected Administrator Memory Server listening on http://localhost:3002");
