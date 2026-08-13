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
          "Listen to music with friends online free",
          "Shared music listening room",
          "Sync YouTube music with friends",
          "Synced music playback in real-time",
          "Virtual music room creation",
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
