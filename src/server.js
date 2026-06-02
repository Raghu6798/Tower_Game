import { Database } from "bun:sqlite";

// Initialize SQLite Database
const db = new Database("admin_memory.sqlite");

// Create table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS conversation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    floor INTEGER,
    challenge TEXT,
    player_answer TEXT,
    admin_remark TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const insertMemory = db.prepare("INSERT INTO conversation_history (floor, challenge, player_answer, admin_remark) VALUES (?, ?, ?, ?)");
const getMemory = db.prepare("SELECT * FROM conversation_history ORDER BY id DESC LIMIT 5"); // Limit to last 5 to save context

Bun.serve({
  port: 3002,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/api/memory" && req.method === "GET") {
      try {
        const history = getMemory.all().reverse(); // Reverse to get chronological order of the last 5
        return new Response(JSON.stringify(history), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    if (url.pathname === "/api/memory" && req.method === "POST") {
      try {
        const body = await req.json();
        const { floor, challenge, player_answer, admin_remark } = body;
        
        insertMemory.run(floor, challenge, player_answer, admin_remark);
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }


    return new Response("Not found", { status: 404 });
  }
});

console.log("🧠 Administrator Memory Server listening on http://localhost:3002");
