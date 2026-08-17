const SITE_URL = "https://www.openjam.fun";

export function FaqJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
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
        name: "Can I use OpenJam as a free Watch2Gether or Spotify Jam alternative?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes! OpenJam is the ideal free alternative to Watch2Gether, JQBX, and Spotify Jam. Unlike Spotify Jam which requires Spotify Premium subscriptions for all participants, OpenJam allows anyone to stream and sync YouTube music together for free with no subscriptions required."
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
        name: "What is Stage Mode with synchronized karaoke lyrics?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Stage Mode provides a full-screen, ambient visualizer featuring dynamic album artwork glow and real-time kinetic karaoke lyrics synchronized to the exact millisecond of playback."
        }
      },
      {
        "@type": "Question",
        name: "Can I import playlists from Spotify or YouTube into OpenJam?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes! OpenJam supports instant playlist importing from public Spotify and YouTube URLs, automatically loading all tracks directly into your live room queue or personal playlist."
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
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
