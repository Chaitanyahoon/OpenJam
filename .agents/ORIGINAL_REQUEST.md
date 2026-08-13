# Original User Request

## Initial Request — 2026-08-13T20:21:10Z

<USER_REQUEST>
Comprehensive SEO overhaul and organic growth engine for OpenJam to achieve top search engine rankings on Google and Bing for target queries like "openjam", "listen to music with friends online", "shared music listening room", and "sync youtube music with friends".

Working directory: c:/Users/patil/OneDrive/Desktop/open/OpenJam
Integrity mode: development

## Requirements

### R1. Search Indexing & Public Room Visibility
Fix search engine accessibility by allowing search engine crawlers (Googlebot, Bingbot, AI crawlers) to index public jam rooms (`app/room/[id]/page.js`), removing strict `noindex` directives on public sessions while keeping private password-protected rooms hidden (`robots: { index: true, follow: true }`). Dynamic sitemap (`sitemap.js`) must automatically fetch active public rooms to submit to search engines.

### R2. High-Intent Keyword Metadata & Schema.org Rich Snippets
Enrich primary landing pages (`app/page.js`, `app/layout.js`) and room pages with targeted long-tail search keywords ("listen music with friends online free", "virtual music room", "synced music playback"). Integrate Schema.org `FAQPage` and `SoftwareApplication` structured data in `JsonLd.js` to render Google Search rich snippets.

### R3. Open Graph Social Card & Click-Through Rate (CTR) Optimization
Optimize dynamic social share previews (Discord, Twitter/X, WhatsApp, Reddit) with track cover art, host names, and live listener counts to maximize social click-through rates.

## Acceptance Criteria

### Technical SEO & Indexing
- [ ] Public room pages (`/room/[id]`) return `robots: { index: true, follow: true }` when `is_private: false`.
- [ ] `sitemap.js` dynamically queries active public rooms and generates valid XML sitemaps for Googlebot.
- [ ] `JsonLd.js` includes `FAQPage` schema corresponding to the homepage FAQ section.

### Metadata & Build Validation
- [ ] `npm run build` inside `frontend-next` completes with 0 errors.
- [ ] Google Search Console & Bing Webmaster HTML verification metadata options are supported.
</USER_REQUEST>
