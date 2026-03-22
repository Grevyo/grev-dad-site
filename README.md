# my-cloudflare-site

This project now uses a Cloudflare-friendly layout with static assets under `public/assets` and the worker entry point under `src/worker/index.js`.

## Structure

- `public/` contains HTML entry points plus shared CSS and JavaScript assets.
- `src/worker/` contains the modular worker entry point, router, handlers, middleware, and helper libraries.
- `src/worker/legacy-router.js` preserves the original worker logic so the existing site keeps functioning while the new router layers in clearer structure.
- `tests/` contains Node-based smoke tests.

## Development

```bash
npm install
npm test
npm run dev
```

## Notes

- Legacy script and stylesheet paths are preserved through compatibility wrappers, so existing pages continue to work while the project uses the new directory layout.
- The new `/contact.html` page posts to `/api/contact` and returns a validated acknowledgement response.
