## 2026-08-13T15:02:51Z

<USER_REQUEST>
You are assigned as Worker M2 to implement Milestone 2 (High-Intent Keyword Metadata & Schema.org Rich Snippets) for OpenJam.

Working Directory: c:/Users/patil/OneDrive/Desktop/open/OpenJam/.agents/teamwork_preview_worker_m2_1

Required Reference Documents:
- ORIGINAL_REQUEST: c:/Users/patil/OneDrive/Desktop/open/OpenJam/.agents/ORIGINAL_REQUEST.md
- PROJECT: c:/Users/patil/OneDrive/Desktop/open/OpenJam/PROJECT.md
- Explorer Handoff 1: c:/Users/patil/OneDrive/Desktop/open/OpenJam/.agents/teamwork_preview_explorer_m2_1/handoff.md
- Explorer Handoff 2: c:/Users/patil/OneDrive/Desktop/open/OpenJam/.agents/teamwork_preview_explorer_m2_2/handoff.md
- Explorer Handoff 3: c:/Users/patil/OneDrive/Desktop/open/OpenJam/.agents/teamwork_preview_explorer_m2_3/handoff.md

Your Tasks:
1. Update `frontend-next/app/layout.js`:
   - Add `keywords` array property containing target high-intent search terms: "openjam", "listen to music with friends online", "shared music listening room", "sync youtube music with friends", "listen music with friends online free", "virtual music room", "synced music playback", "real-time music sync", "collaborative music queue", "listen together free".
   - Add `verification` configuration inside `export const metadata`:
     verification: {
       google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || "",
       other: {
         "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION || ""
       }
     }
   - Align title, description, openGraph, and twitter attributes with high-intent keywords while keeping structure valid for regex parsing `export const metadata = ({...});\s*export const viewport`.
2. Update `frontend-next/app/page.js`:
   - Add `keywords` array property to `export const metadata`.
   - Update title and description for high-intent keywords.
3. Update `frontend-next/components/JsonLd.js`:
   - Add `@type: "FAQPage"` node to `@graph` containing all 5 Q&A items from `frontend-next/components/FaqSection.js`.
   - Enrich `@type: "SoftwareApplication"` node with `keywords` and `featureList`.
4. Create static webmaster verification files in `frontend-next/public/`:
   - `frontend-next/public/google-site-verification.html` containing `google-site-verification: google-site-verification.html`
   - `frontend-next/public/BingSiteAuth.xml` containing `<?xml version="1.0"?><users><user>BING_SITE_VERIFICATION_CODE_PLACEHOLDER</user></users>`
5. Build & Test Verification:
   - Run `npm run build` in `frontend-next/` directory and ensure exit code 0.
   - Run `pytest tests/test_seo_e2e.py` and capture output.
6. Write your handoff report to `c:/Users/patil/OneDrive/Desktop/open/OpenJam/.agents/teamwork_preview_worker_m2_1/handoff.md`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
</USER_REQUEST>
