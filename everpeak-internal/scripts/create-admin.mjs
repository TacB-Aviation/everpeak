// Generates a SQL statement to create your first Manager account.
// Usage:
//   node scripts/create-admin.mjs you@example.com "A very-strong-P@ssw0rd!"
// Then run the printed command (it uses `wrangler d1 execute`) to insert it.

import crypto from "node:crypto";

const [, , email, password] = process.argv;

if (!email || !password) {
  console.error('Usage: node scripts/create-admin.mjs <email> "<password>"');
  process.exit(1);
}
if (password.length < 12) {
  console.error("Password must be at least 12 characters.");
  process.exit(1);
}

const ITERATIONS = 210000;
const salt = crypto.randomBytes(16);
const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");
const stored = `pbkdf2:${ITERATIONS}:${salt.toString("base64")}:${hash.toString("base64")}`;
const id = crypto.randomUUID();

const sql = `INSERT INTO users (id, email, password_hash, role, active) VALUES ('${id}', '${email
  .trim()
  .toLowerCase()}', '${stored}', 'manager', 1);`;

console.log("\nRun this to create your first Manager account:\n");
console.log(
  `wrangler d1 execute everpeak-internal-db --remote --command "${sql.replace(/"/g, '\\"')}"\n`
);
