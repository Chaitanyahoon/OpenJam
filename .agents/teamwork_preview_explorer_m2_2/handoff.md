# Handoff Report: Explorer 2 (M2: High-Intent Keyword Metadata & Schema.org Rich Snippets)

## 1. Observation
- **Target Files Inspected**:
  - `frontend-next/components/JsonLd.js`: Lines 1–50. Defines JSON-LD structured data injected into `app/layout.js`. Currently contains an `@graph` array with 3 nodes: `@type: "Organization"`, `@type: "WebSite"`, and `@type: "SoftwareApplication"`. It lacks an `@type: "FAQPage"` node, and `@type: "SoftwareApplication"` lacks `keywords` and `featureList` properties.
  - `frontend-next/components/FaqSection.js`: Lines 7–28. Contains the static array `FAQS` defining 5 questions and answers displayed on the landing page:
    1. Q: "Is OpenJam completely free to use?" / A: "Yes! OpenJam is 100% free with zero monthly subscription fees, paywalls, or hidden charges."
    2. Q: "Do I need a Spotify or YouTube account to listen?" / A: "No! You can join any room as an anonymous guest or host your own session without logging into third-party accounts."
    3. Q: "How does real-time music synchronization work?" / A: "OpenJam uses NTP-style clock offset calculation over WebSockets to measure network round-trip time. It continuously adjusts playback positions so all listeners in a room hear the exact same audio beat at the same millisecond."
    4. Q: "How many friends can join a single jam room?" / A: "There is no strict limit! Dozens of listeners can join a single room simultaneously, chat, send floating emoji reactions, and vote on track skips."
    5. Q: "Can I use OpenJam on my mobile phone?" / A: "Absolutely. OpenJam features a responsive mobile interface with bottom tabs, touch controls, and Progressive Web App (PWA) support so you can install it on iOS and Android."
  - `frontend-next/app/layout.js`: Line 6 imports `JsonLd` and Line 105 renders `<JsonLd />` inside `RootLayout` `<body>`.

## 2. Logic Chain
1. **Rich Snippet Requirement**: Project acceptance criterion R2 / M2 requires Schema.org `FAQPage` and enriched `SoftwareApplication` structured data in `JsonLd.js` to render Google Search rich snippets.
2. **FAQ Alignment**: Google Search Console JSON-LD guidelines for `FAQPage` require that questions and answers in JSON-LD structured data match the visible text content rendered on the page (`FaqSection.js`).
3. **SoftwareApplication Keyword & Feature Enrichment**: Adding `keywords` (focusing on high-intent target queries like `"openjam", "listen to music with friends online", "shared music listening room", "sync youtube music with friends"`) and `featureList` (list of key product capabilities) to `@type: "SoftwareApplication"` informs search engine crawlers of the application's functionality, boosting search ranking relevance.
4. **Implementation Scope**: Worker can perform a single, clean replacement of `frontend-next/components/JsonLd.js` to add the `@type: "FAQPage"` node to `@graph` and add `keywords` + `featureList` to `@type: "SoftwareApplication"`.

## 3. Caveats
- `JsonLd.js` is rendered globally via `layout.js`. Having `FAQPage` in root layout metadata is valid for single-page applications where FAQ is present on the primary route (`/`), but search engines evaluate FAQ schema on pages where the FAQ content is accessible.
- Ensure exact string matching between `FAQS` in `FaqSection.js` and `FAQPage` in `JsonLd.js` to pass Google Rich Results test without warnings.

## 4. Conclusion & Implementation Guidance for Worker

Worker should update `frontend-next/components/JsonLd.js` with the following implementation:

### Complete Target Code for `frontend-next/components/JsonLd.js`

```javascript
const SITE_URL = "https://www.openjam.fun";

export function JsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "Open Jam",
        url: SITE_URL,
        logo: `${SITE_URL}/static/img/logo.png`,
        sameAs: [],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: "Open Jam",
        description: "Create and join public listening rooms. Discover music with friends in real-time.",
        publisher: { "@id": `${SITE_URL}/#organization` },
        inLanguage: "en",
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#application`,
        name: "Open Jam",
        url: SITE_URL,
        image: `${SITE_URL}/static/img/logo.png`,
        applicationCategory: "MusicApplication",
        operatingSystem: "Windows, macOS, Linux, iOS, Android",
        browserRequirements: "Requires HTML5, Web Audio API, JavaScript",
        description: "A real-time collaborative music listening platform to stream music, synchronize queues, and enjoy audio sessions with friends.",
        keywords: "openjam, listen to music with friends online, shared music listening room, sync youtube music with friends, listen music with friends online free, virtual music room, synced music playback, real-time music sync",
        featureList: [
          "Real-time sub-millisecond audio playback synchronization",
          "Collaborative music queues with real-time voting",
          "Public and private virtual music listening rooms",
          "YouTube and custom audio track synchronization",
          "Live room chat and interactive emoji reactions",
          "Cross-platform Progressive Web App (PWA) support"
        ],
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD"
        }
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/#faq`,
        mainEntity: [
          {
            "@type": "Question",
            name: "Is OpenJam completely free to use?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes! OpenJam is 100% free with zero monthly subscription fees, paywalls, or hidden charges."
            }
          },
          {
            "@type": "Question",
            name: "Do I need a Spotify or YouTube account to listen?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "No! You can join any room as an anonymous guest or host your own session without logging into third-party accounts."
            }
          },
          {
            "@type": "Question",
            name: "How does real-time music synchronization work?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "OpenJam uses NTP-style clock offset calculation over WebSockets to measure network round-trip time. It continuously adjusts playback positions so all listeners in a room hear the exact same audio beat at the same millisecond."
            }
          },
          {
            "@type": "Question",
            name: "How many friends can join a single jam room?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "There is no strict limit! Dozens of listeners can join a single room simultaneously, chat, send floating emoji reactions, and vote on track skips."
            }
          },
          {
            "@type": "Question",
            name: "Can I use OpenJam on my mobile phone?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Absolutely. OpenJam features a responsive mobile interface with bottom tabs, touch controls, and Progressive Web App (PWA) support so you can install it on iOS and Android."
            }
          }
        ]
      }
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
```

## 5. Verification Method
1. **Syntax & Import Check**: Inspect `frontend-next/components/JsonLd.js` using `view_file` to confirm valid JSON object structure and matching strings from `FaqSection.js`.
2. **Build Validation**: Run `npm run build` in `frontend-next` directory to verify Next.js builds cleanly with 0 errors.
3. **JSON-LD Validation**: Parse `JSON.stringify(jsonLd)` output using standard JSON parser to ensure no trailing commas or missing bracket syntax.
