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
        name: "OpenJam",
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
