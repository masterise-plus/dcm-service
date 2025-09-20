import 'dotenv/config';
import { Application } from './application/Application.js';

async function main(): Promise<void> {
  const app = new Application();
  await app.run();
}

// Node 18+ has global fetch. If running older Node, install undici or node-fetch.
main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
