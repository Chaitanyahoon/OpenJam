# Handoff Report — Explorer 3 (M2: High-Intent Keyword Metadata & Site Verification)

## 1. Observation

### Codebase State
1. **`frontend-next/app/layout.js` (lines 37-87)**:
   - Exports `const metadata` for the root layout.
   - Currently specifies `metadataBase`, `title`, `description`, `manifest`, `icons`, `robots`, `openGraph`, `twitter`, and `appleWebApp`.
   - **Missing**: No `verification` property currently exists in `export const metadata`.

2. **`frontend-next/public/` directory**:
   - Contains static files (`manifest.json`, `sw.js`, `sw-register.js`, SVG graphics, images in `static/` and `covers/`).
   - Next.js automatically routes files in `public/` directly to root URL routes (`/filename`).
   - **Missing**: Currently no site verification files exist for Google Search Console (e.g. `google-site-verification.html`) or Bing Webmaster Tools (`BingSiteAuth.xml`).

3. **`tests/test_seo_e2e.py` (lines 487-508: `test_search_engine_verification_meta_tags`)**:
   ```python
   def test_search_engine_verification_meta_tags(self):
       """app/layout.js metadata MUST support Google Search Console & Bing Webmaster verification options."""
       node_script = """
       import fs from 'fs';
       const SITE_URL = 'https://www.openjam.fun';
       const code = fs.readFileSync('./frontend-next/app/layout.js', 'utf8');
       const match = code.match(/export const metadata = (\\{[\\s\\S]*?\\});\\s*export const viewport/);
       if (!match) throw new Error('metadata not found in layout.js');
       const metadata = eval('(' + match[1] + ')');
       console.log(JSON.stringify(metadata));
       """
       output_json = run_node_js(node_script)
       meta = json.loads(output_json)

       verification = meta.get("verification", {})
       assert "google" in verification or "google-site-verification" in meta
       assert any(k in verification for k in ["bing", "yandex", "other", "msvalidate.01"])
   ```
   - Test parses `layout.js` by extracting `export const metadata = ({...});\s*export const viewport` and evaluating the metadata object.
   - Assertions require `"google"` key in `verification` object AND either `"bing"`, `"yandex"`, `"other"`, or `"msvalidate.01"` key in `verification` (or inside `verification.other`).

---

## 2. Logic Chain

1. **Next.js 16 Metadata API Standards**:
   - In Next.js App Router, `verification` metadata maps object fields to HTML `<head>` `<meta>` tags:
     - `verification.google` -> `<meta name="google-site-verification" content="..." />`
     - `verification.other["msvalidate.01"]` -> `<meta name="msvalidate.01" content="..." />`
   - Using environment variables `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` and `NEXT_PUBLIC_BING_SITE_VERIFICATION` allows dynamic configuration at build/deploy time without hardcoding secret site verification tokens into source code.
   - Providing `|| ""` fallbacks ensures metadata structure remains intact when environment variables are not set during local development or build time, passing test assertions without throwing runtime errors.

2. **Regex Parsing Compatibility**:
   - `test_seo_e2e.py` parses `app/layout.js` using `code.match(/export const metadata = (\{[\s\S]*?\});\s*export const viewport/)`.
   - To maintain compatibility, `export const metadata` must remain an inline JS object exported directly before `export const viewport`.

3. **HTML Verification File Support**:
   - Webmasters frequently verify domain ownership in Google Search Console using HTML verification files (e.g., `google<code >.html` or `google-site-verification.html`) and in Bing Webmaster Tools using `BingSiteAuth.xml`.
   - In Next.js App Router, placing static verification files inside `frontend-next/public/` exposes them immediately at `/google-site-verification.html` and `/BingSiteAuth.xml`.
   - Adding placeholder template files in `frontend-next/public/` establishes supported HTML file verification options out-of-the-box.

---

## 3. Caveats

1. **Empty String Meta Tags**: When environment variables `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` and `NEXT_PUBLIC_BING_SITE_VERIFICATION` are empty/unset (`""`), Next.js renders `<meta name="google-site-verification" content="" />`. This satisfies test suite validation and produces valid HTML, but operators must provide actual verification keys in production env for search engine validation to succeed.
2. **Specific Google Verification Filename**: Google Search Console sometimes assigns a randomized filename per account (e.g. `google1234567890abcdef.html`). Providing `public/google-site-verification.html` acts as a generic template; operators can place any `google*.html` file directly into `frontend-next/public/`.

---

## 4. Conclusion & Implementation Guidance for Worker

Worker must execute the following two updates:

### Task A: Update `frontend-next/app/layout.js`
Add `verification` configuration inside `export const metadata`:

```javascript
export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Open Jam — Listen Together in Real-Time",
    template: "%s | Open Jam"
  },
  description: "Create and join public listening rooms. Stream music, sync playback with friends, share queues, and discover new songs together in real-time.",
  manifest: "/manifest.json",
  icons: {
    icon: "/static/img/logo.png",
    apple: "/static/img/icon-192.png",
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || "",
    other: {
      "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION || "",
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    // ...
  },
  // ...
};
```

### Task B: Add Static Verification Files to `frontend-next/public/`

1. **`frontend-next/public/BingSiteAuth.xml`**:
   Create file with contents:
   ```xml
   <?xml version="1.0"?>
   <users>
   	<user>BING_SITE_VERIFICATION_CODE_PLACEHOLDER</user>
   </users>
   ```

2. **`frontend-next/public/google-site-verification.html`**:
   Create file with contents:
   ```html
   google-site-verification: google-site-verification.html
   ```

3. **`frontend-next/.env.example`** (or create if missing):
   Add environment variable entries:
   ```env
   # Site Verification
   NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=
   NEXT_PUBLIC_BING_SITE_VERIFICATION=
   ```

---

## 5. Verification Method

To independently verify the implementation:

1. **Run E2E Test Suite Verification Test**:
   ```bash
   pytest tests/test_seo_e2e.py -k test_search_engine_verification_meta_tags -v
   ```
   *Expected result*: Test passes with `1 passed`.

2. **Node.js Inline Verification Script**:
   ```bash
   node --input-type=module -e "
   import fs from 'fs';
   const SITE_URL = 'https://www.openjam.fun';
   const code = fs.readFileSync('./frontend-next/app/layout.js', 'utf8');
   const match = code.match(/export const metadata = (\\{[\\s\\S]*?\\});\\s*export const viewport/);
   const metadata = eval('(' + match[1] + ')');
   console.log('Verification object:', metadata.verification);
   "
   ```
   *Expected output*:
   `Verification object: { google: '', other: { 'msvalidate.01': '' } }`

3. **Verify Static Verification File Routes**:
   Verify files exist at paths:
   - `frontend-next/public/BingSiteAuth.xml`
   - `frontend-next/public/google-site-verification.html`

4. **Frontend Build Check**:
   ```bash
   cd frontend-next && npm run build
   ```
   *Expected result*: Next.js build completes with 0 errors.
