// migration/export_onspace_data.js
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const ONSPACE_URL = "https://oqgojklyjnegldsyoqgo.backend.onspace.ai";
const ONSPACE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjIwNzcxMjMwMjksImlhdCI6MTc2MTc2MzAyOSwiaXNzIjoib25zcGFjZSIsInJlZiI6Im9xZ29qa2x5am5lZ2xkc3lvcWdvIiwicm9sZSI6ImFub24ifQ.kIG1YQDOb1ki4cx3GRk1zurzi-xBB89mV6rNb90q4nUY"; // from your .env

const client = createClient(ONSPACE_URL, ONSPACE_KEY);

async function exportTables() {
  const tables = [
    "user_profiles",
    "interests",
    "user_interests",
    "groups",
    "group_members",
    "events",
    "event_attendees",
    "connections",
  ];

  fs.mkdirSync("./migration/export", { recursive: true });

  for (const table of tables) {
    console.log(`Exporting ${table}...`);
    const { data, error } = await client.from(table).select("*");
    if (error) {
      console.log(`Skipping ${table} (no read access)`);
      continue;
    }
    fs.writeFileSync(
      `./migration/export/${table}.json`,
      JSON.stringify(data, null, 2)
    );
  }

  console.log("✅ Export complete. Files saved to /migration/export/");
}

exportTables();