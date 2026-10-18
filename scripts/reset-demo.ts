/** Deletes local demo data; fictional seed data is regenerated on the next server start. Demo mode only. */
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(process.env.DEMO_DATA_DIR || ".data");
fs.rmSync(dir, { recursive: true, force: true });
console.log(`Removed ${dir}. Fictional demo data will be recreated on next start.`);
