import { serve } from '@hono/node-server';
import { app } from './api/app.js';

const port = Number(process.env.PORT) || 8000;

console.log(`=== OpenC4 Platform (TypeScript) ===`);
console.log(`Serving OpenC4 at http://localhost:${port}`);
console.log(`MCP endpoint active at http://localhost:${port}/mcp`);

serve({
  fetch: app.fetch,
  port
});
