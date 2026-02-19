// Wrangler entry point — ESM wrapper for Cloudflare Workers
import * as handlerModule from './index.js';

// Handle CommonJS module.exports interop
const handler = handlerModule.default || handlerModule;

export default {
  async fetch(request, env, ctx) {
    return handler.fetch(request, env, ctx);
  }
};
