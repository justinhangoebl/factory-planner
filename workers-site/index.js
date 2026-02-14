const handler = {
	async fetch(request, env) {
		try {
			// Prefer the provided `ASSETS` binding (Workers Sites) when available.
			if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
				return await env.ASSETS.fetch(request);
			}

			// Embedded fallback assets for local dev when `ASSETS` isn't available.
			const embedded = {
				'/': INDEX_HTML,
				'/index.html': INDEX_HTML,
				'/app.js': APP_JS,
				'/styles.css': STYLES_CSS,
				'/recipes.json': RECIPES_JSON,
				'/favicon.ico': FAVICON
			};

			const url = new URL(request.url);
			const path = url.pathname === '/' ? '/index.html' : url.pathname;
			if (embedded[path]) {
				const body = embedded[path];
				const ct = contentType(path);
				return new Response(body, { headers: { 'Content-Type': ct } });
			}

			// Default fallback response
			return new Response(INDEX_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
		} catch (err) {
			return new Response('Worker error: ' + (err && err.stack ? err.stack : String(err)), { status: 500 });
		}
	}
};

export default handler;

// Register a `fetch` listener so the dev middleware facade sees a fetch handler
// and the FetchEvent.respondWith will be called synchronously. Pass
// `globalThis` as the `env` argument so bindings (like `ASSETS`) are available
// in the handler when running under Wrangler dev.
addEventListener('fetch', (event) => {
	try {
		event.respondWith(handler.fetch(event.request, globalThis));
	} catch (e) {
		event.respondWith(Promise.resolve(new Response('Worker listener error: ' + String(e), { status: 500 })));
	}
});
