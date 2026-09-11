import { serve } from '@hono/node-server';
import { app } from './api/app.js';

const port = Number(process.env.PORT) || 8000;
const hostname = process.env.HOST || '0.0.0.0';

console.log(`=== OpenC4 Platform (TypeScript) ===`);
console.log(`Serving OpenC4 at http://${hostname}:${port}`);
console.log(`MCP endpoint active at http://${hostname}:${port}/mcp`);

serve({
  fetch: app.fetch,
  port,
  hostname
});
