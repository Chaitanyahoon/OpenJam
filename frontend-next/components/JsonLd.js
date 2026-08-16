const SITE_URL = "https://www.openjam.fun";

export function JsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "OpenJam",
        url: SITE_URL,
        logo: `${SITE_URL}/static/img/logo.png`,
        sameAs: ["https://github.com/Chaitanyahoon/OpenJam"],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: "OpenJam",
        description: "Create and join public listening rooms. Discover music with friends in real-time.",
        publisher: { "@id": `${SITE_URL}/#organization` },
        inLanguage: "en",
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/?q={search_term_string}` },
          "query-input": "required name=search_term_string"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${SITE_URL}/#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Rooms", item: `${SITE_URL}/#rooms` },
        ]
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#application`,
        name: "Open Jam",
        alternateName: "OpenJam",
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
            name: "What is OpenJam and how does it work?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "OpenJam is a real-time collaborative music listening platform that lets you create virtual rooms, invite friends, queue YouTube music, and listen together in millisecond-accurate sync across all devices."
            }
          },
          {
            "@type": "Question",
            name: "Is OpenJam completely free to use?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes, OpenJam is 100% free with no subscription fees, hidden paywalls, or feature restrictions. You can create unlimited public or private listening rooms."
            }
          },
          {
            "@type": "Question",
            name: "How does real-time music synchronization work on OpenJam?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "OpenJam uses WebSocket NTP-style clock synchronization to measure network latency and calculate clock offsets, ensuring every listener in the room hears the exact same audio beat simultaneously."
            }
          },
          {
            "@type": "Question",
            name: "Do my friends need to create an account to join my room?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "No, anyone with the room link can join instantly as a guest without signing up. Account creation is optional for saving playlists, listening history, and custom avatars."
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
