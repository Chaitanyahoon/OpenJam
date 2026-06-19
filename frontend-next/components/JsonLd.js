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
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD"
        }
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
