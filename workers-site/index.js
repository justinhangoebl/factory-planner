export default {
  async fetch(request, env) {
    // If Wrangler uploads assets and binds them as `ASSETS`, forward the request.
    if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    // Fallback: return the static index page body if available at build time.
    return new Response('Factory Planner (static assets unavailable)', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  },
};
