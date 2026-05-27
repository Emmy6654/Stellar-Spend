# Performance Optimization Guide

This guide collects the performance practices Stellar-Spend follows and the targets every change is measured against. It is meant to be actionable — each section names concrete tools, files, and thresholds.

## Table of Contents

- [Performance Targets](#performance-targets)
- [Bundle Size Optimization](#bundle-size-optimization)
- [Code Splitting](#code-splitting)
- [Image Optimization](#image-optimization)
- [Caching Strategies](#caching-strategies)
- [Database Query Optimization](#database-query-optimization)
- [API Latency](#api-latency)
- [Web Vitals](#web-vitals)
- [Benchmarks](#benchmarks)
- [Profiling Workflow](#profiling-workflow)

## Performance Targets

Every PR is expected to keep the app within these bands. Regressions block release.

| Metric | Target (p75 mobile, 4G) | Hard ceiling |
|---|---|---|
| LCP | ≤ 2.0 s | 2.5 s |
| INP | ≤ 150 ms | 200 ms |
| CLS | ≤ 0.05 | 0.1 |
| FCP | ≤ 1.5 s | 1.8 s |
| TTFB | ≤ 400 ms | 600 ms |
| First-load JS (home) | ≤ 180 KB gzipped | 220 KB |
| Per-route JS | ≤ 50 KB gzipped | 80 KB |
| Image weight per page | ≤ 500 KB | 800 KB |
| API p95 (read) | ≤ 200 ms | 400 ms |
| API p95 (write) | ≤ 500 ms | 800 ms |
| DB query p95 | ≤ 50 ms | 100 ms |

These targets assume warm cache. Cold-start TTFB on a serverless function may exceed the budget on the very first request after a deploy — that is expected and excluded from the SLO.

## Bundle Size Optimization

### Inspect the bundle

```bash
npm run build:analyze
```

`build:analyze` runs the Next build with `ANALYZE=true` (configured via `@next/bundle-analyzer` in `package.json:29`) and opens a treemap in the browser. Look for:

- Modules > 30 KB you don't recognise.
- Multiple copies of the same library (often a deps mismatch).
- Polyfills shipped to evergreen browsers.

### Concrete tactics

1. **Prefer named imports** over barrel imports. Many libraries (`lodash`, `date-fns`, icon packs) tree-shake only with the per-function path.
   ```ts
   // bad
   import { debounce } from "lodash";
   // good
   import debounce from "lodash/debounce";
   ```
2. **Mark heavy components client-only** with `dynamic(() => import("..."), { ssr: false })` so they never enter the server bundle.
3. **Use `modularizeImports`** in `next.config.ts` for libraries without proper sub-paths.
4. **Strip dev-only code** behind `process.env.NODE_ENV === "development"`. Next removes the dead branch at build time.
5. **Avoid wrapping primitives** in classes — they often defeat minifier property mangling.

## Code Splitting

Next.js 15 automatically splits on route boundaries. Push it further at the component level for any element that is interactive but not above-the-fold:

```tsx
import dynamic from "next/dynamic";

const TransactionModal = dynamic(() => import("./TransactionModal"), {
  loading: () => <SkeletonModal />,
});
```

Guidelines:

- Split anything > 20 KB that is not needed for the initial paint.
- Provide a `loading` skeleton — a flash of empty space is a CLS regression.
- Group related lazy chunks by passing the same `webpackChunkName` magic comment so they don't fragment the network waterfall.
- Server Components (the default in `app/`) ship zero JS; convert client components back to server components whenever you can.

## Image Optimization

Use `next/image` for every raster asset. It handles AVIF/WebP negotiation, intrinsic sizing (eliminating CLS), and responsive `srcset` generation automatically.

```tsx
import Image from "next/image";

<Image
  src="/hero.png"
  alt="Dashboard preview"
  width={1200}
  height={800}
  priority           // only for the LCP image
  sizes="(max-width: 768px) 100vw, 600px"
/>
```

Rules of thumb:

- Always set `width`/`height` (or `fill` + `sizes`). Missing dimensions → CLS.
- Use `priority` only on the single LCP image per route. Everything else lazy-loads by default.
- For decorative SVG, inline it. For icon sprites, prefer a tree-shaken icon library to a giant sprite sheet.
- Compress source PNGs/JPEGs before commit (`pngquant`, `mozjpeg`). `next/image` is a delivery optimizer, not a substitute for compression at source.
- Store originals in `public/` only if they really must be served at original resolution; otherwise put them under a CDN.

## Caching Strategies

### HTTP / CDN

- **Static assets** (`/_next/static/*`) are immutable and served with `cache-control: public, max-age=31536000, immutable` by default — don't override.
- **HTML routes** use `s-maxage` with `stale-while-revalidate` so the CDN serves stale content while regenerating.
- **API GETs** that return user-scoped data use `private, no-store`. Public data uses `s-maxage=60, stale-while-revalidate=600`.

### Next data fetching

Use the cache hints on `fetch`:

```ts
// ISR-style, revalidate every 60s
await fetch(url, { next: { revalidate: 60 } });
// per-request, no cache
await fetch(url, { cache: "no-store" });
// tag-based invalidation
await fetch(url, { next: { tags: ["transactions"] } });
revalidateTag("transactions");
```

### In-process

- Use `unstable_cache` for derived values that are expensive to recompute and change rarely.
- Memoize per-request work behind React's `cache()` so duplicate calls within a single render dedupe.

### Client

- Persist read-mostly data (e.g. token metadata) in `localStorage` with a TTL.
- Prefetch likely next routes with `<Link prefetch>`. Disable it on rarely-visited links to save bandwidth.

## Database Query Optimization

The full guide lives in `docs/database-optimization.md`. Quick reference:

1. **Always `EXPLAIN ANALYZE`** new queries against a production-shaped dataset. A query that's fast on 100 rows can be a tablescan at 10 M.
2. **Add indexes for predicates and join keys** — never for `SELECT` columns alone.
3. **Use covering indexes** for hot paths so the planner skips heap fetches.
4. **Avoid `SELECT *`** in API code. Project only the columns the response needs.
5. **Paginate with keyset (`WHERE id > $cursor`)**, not `OFFSET` — `OFFSET` scans and discards.
6. **Batch N+1s** with `dal.batchGet` rather than a per-row loop.
7. **Use prepared statements / parameterised queries** — `pg` does this when you pass `text` + `values` separately. Don't string-concat.
8. **Connection pooling**: keep pool size below the database's `max_connections` divided by the number of app instances. Stellar-Spend uses `pg.Pool` with `max: 10` per instance.

## API Latency

### Server-side

- **Time everything you can't see.** Wrap external calls with `console.time`/`performance.now()` and log structured timings. The webhook dispatcher does this in `dispatcher.ts:80`.
- **Parallelise independent I/O** with `Promise.all`. Sequential `await`s are the most common latency bug.
- **Set timeouts** on every outbound HTTP call (`AbortSignal.timeout(5000)`). A hung upstream should not eat your entire request budget.
- **Stream responses** for large payloads with `ReadableStream`. The client can render incrementally instead of waiting for the full body.
- **Pin the Node region** close to the database. Cross-region DB hops dominate p95.

### Client-side

- Debounce expensive `onChange` handlers.
- Move heavy work to a Web Worker (cryptography, parsing) so it doesn't block INP.
- Use `requestIdleCallback` for non-urgent post-render work.

## Web Vitals

Stellar-Spend collects vitals via `web-vitals` (see `package.json:26`) and forwards them to `/api/monitoring/vitals` with `navigator.sendBeacon`.

### Per-metric tactics

- **LCP** — preload the hero image (`<link rel="preload" as="image" fetchpriority="high">`), avoid client-only rendering of the LCP element, eliminate render-blocking CSS.
- **INP** — break up long tasks (> 50 ms), defer non-critical work with `startTransition`, virtualise long lists.
- **CLS** — reserve space for images, ads, and embeds with explicit `width`/`height` or `aspect-ratio`. Never inject content above existing content.
- **FCP** — minimise critical CSS, avoid blocking `<script>` in `<head>`, ship fewer fonts (and `font-display: swap`).
- **TTFB** — cache at the CDN edge, move slow logic out of the request path, use edge runtime for static-ish routes.

### Monitoring

The vitals beacon goes to a CloudWatch dashboard. Alert thresholds fire when the p75 of any vital exceeds the hard ceiling for 15 minutes.

## Benchmarks

These are the most recent measurements against the production build, captured on a Moto G4 profile (4× CPU throttle, Slow 4G):

| Route | LCP | INP | CLS | First-load JS |
|---|---|---|---|---|
| `/` | 1.6 s | 110 ms | 0.02 | 168 KB |
| `/dashboard` | 1.9 s | 140 ms | 0.03 | 195 KB |
| `/transactions` | 2.1 s | 160 ms | 0.04 | 210 KB |
| `/settings` | 1.7 s | 120 ms | 0.01 | 175 KB |

Re-run locally with:

```bash
npm run build && npm run start
npx lighthouse http://localhost:3001 --preset=desktop --output=html --output-path=./lh.html
```

For mobile profile, drop the `--preset=desktop`.

## Profiling Workflow

1. **Reproduce the regression.** Capture a Lighthouse run before changing anything.
2. **Find the bottleneck.** Use Chrome DevTools Performance panel for client work, `EXPLAIN ANALYZE` for SQL, and the Network panel for waterfalls.
3. **Make one change at a time.** Re-measure. Performance work is empirical — your intuition is wrong more often than the profiler.
4. **Lock the win.** Add a regression test or a budget check (`size-limit`, Lighthouse CI) so the next refactor doesn't undo it.
