import { NextResponse } from 'next/server';

// Default Tenor API Key with fallback for development and open-source instances
const TENOR_API_KEY = process.env.TENOR_API_KEY || process.env.NEXT_PUBLIC_TENOR_API_KEY || 'LIVDSRZULELA';
const CLIENT_KEY = 'openjam_music_app';

// Rich, high-quality curated fallback GIF collection for offline/no-key resilience
const CURATED_FALLBACK_GIFS = [
  // Trending / Vibe / Music
  {
    id: 'fb_vibe_1',
    title: 'Cat Vibing to Music',
    tags: ['trending', 'vibe', 'cat', 'music', 'headbob', 'jam'],
    preview_url: 'https://media.tenor.com/images/7a0bfef6c2f37ec2e5f3aa5391d4e0e2/tenor.gif',
    url: 'https://media.tenor.com/images/7a0bfef6c2f37ec2e5f3aa5391d4e0e2/tenor.gif',
    dims: [320, 240]
  },
  {
    id: 'fb_dance_1',
    title: 'Snoop Dogg Dancing',
    tags: ['trending', 'dance', 'party', 'hyped', 'snoop', 'groove'],
    preview_url: 'https://media.tenor.com/images/e6f52e379b32524a1b02ea428fcb0a32/tenor.gif',
    url: 'https://media.tenor.com/images/e6f52e379b32524a1b02ea428fcb0a32/tenor.gif',
    dims: [300, 200]
  },
  {
    id: 'fb_party_1',
    title: 'Party Parrot Groove',
    tags: ['trending', 'party', 'dance', 'hyped', 'parrot', 'rave'],
    preview_url: 'https://media.tenor.com/images/8537b8fb98eb2a68fb28c50259b19e2f/tenor.gif',
    url: 'https://media.tenor.com/images/8537b8fb98eb2a68fb28c50259b19e2f/tenor.gif',
    dims: [240, 240]
  },
  {
    id: 'fb_hyped_1',
    title: 'DJ Khaled Let\'s Go',
    tags: ['hyped', 'party', 'trending', 'dj', 'fire', 'energy'],
    preview_url: 'https://media.tenor.com/images/cfba8e3cf3d722cfa3769c0d381014e7/tenor.gif',
    url: 'https://media.tenor.com/images/cfba8e3cf3d722cfa3769c0d381014e7/tenor.gif',
    dims: [320, 240]
  },
  {
    id: 'fb_laugh_1',
    title: 'Leonardo DiCaprio Laughing',
    tags: ['laugh', 'funny', 'trending', 'lol', 'haha', 'smile'],
    preview_url: 'https://media.tenor.com/images/41804791550c1f2b60455c1db2706346/tenor.gif',
    url: 'https://media.tenor.com/images/41804791550c1f2b60455c1db2706346/tenor.gif',
    dims: [320, 240]
  },
  {
    id: 'fb_cat_1',
    title: 'DJ Cat Scratching Vinyl',
    tags: ['cat', 'music', 'dj', 'vibe', 'trending', 'turntable'],
    preview_url: 'https://media.tenor.com/images/f395f1f8b46e382d56a3501ee709a3bf/tenor.gif',
    url: 'https://media.tenor.com/images/f395f1f8b46e382d56a3501ee709a3bf/tenor.gif',
    dims: [320, 240]
  },
  {
    id: 'fb_sad_1',
    title: 'Sad Crying Hamster',
    tags: ['sad', 'cry', 'tears', 'mood', 'crying'],
    preview_url: 'https://media.tenor.com/images/d30bca9713606f7df2b61f95be3083e5/tenor.gif',
    url: 'https://media.tenor.com/images/d30bca9713606f7df2b61f95be3083e5/tenor.gif',
    dims: [280, 280]
  },
  {
    id: 'fb_dance_2',
    title: 'Kermit Dance Moves',
    tags: ['dance', 'party', 'funny', 'kermit', 'vibe'],
    preview_url: 'https://media.tenor.com/images/07d8b5774a383dca8d8108a735ec0a0f/tenor.gif',
    url: 'https://media.tenor.com/images/07d8b5774a383dca8d8108a735ec0a0f/tenor.gif',
    dims: [300, 250]
  },
  {
    id: 'fb_vibe_2',
    title: 'Lofi Girl Studying and Vibing',
    tags: ['vibe', 'chill', 'music', 'lofi', 'relax', 'focus'],
    preview_url: 'https://media.tenor.com/images/5f04a622d645d0baec9aa875f4c5e317/tenor.gif',
    url: 'https://media.tenor.com/images/5f04a622d645d0baec9aa875f4c5e317/tenor.gif',
    dims: [320, 240]
  },
  {
    id: 'fb_hyped_2',
    title: 'Guitar Solo Fire',
    tags: ['hyped', 'music', 'rock', 'guitar', 'solo', 'epic'],
    preview_url: 'https://media.tenor.com/images/a41ea4aa30b62e49c719e7a6f2334f3b/tenor.gif',
    url: 'https://media.tenor.com/images/a41ea4aa30b62e49c719e7a6f2334f3b/tenor.gif',
    dims: [300, 200]
  },
  {
    id: 'fb_laugh_2',
    title: 'Shaq Laughing Meme',
    tags: ['laugh', 'funny', 'shaq', 'lol', 'haha'],
    preview_url: 'https://media.tenor.com/images/2f928e1d24c31168fbfa4a9dfbb3e76f/tenor.gif',
    url: 'https://media.tenor.com/images/2f928e1d24c31168fbfa4a9dfbb3e76f/tenor.gif',
    dims: [320, 240]
  },
  {
    id: 'fb_cat_2',
    title: 'Headphones Cat Jamming',
    tags: ['cat', 'music', 'headphones', 'cute', 'vibe'],
    preview_url: 'https://media.tenor.com/images/7376c24158498f7972bf62ba205d97f2/tenor.gif',
    url: 'https://media.tenor.com/images/7376c24158498f7972bf62ba205d97f2/tenor.gif',
    dims: [280, 280]
  },
  {
    id: 'fb_sad_2',
    title: 'Rain Window Mood',
    tags: ['sad', 'rain', 'mood', 'lonely', 'lofi'],
    preview_url: 'https://media.tenor.com/images/6df2159048c279c6d37617b077a96495/tenor.gif',
    url: 'https://media.tenor.com/images/6df2159048c279c6d37617b077a96495/tenor.gif',
    dims: [320, 240]
  },
  {
    id: 'fb_party_2',
    title: 'Confetti Party Celebration',
    tags: ['party', 'celebrate', 'hyped', 'confetti', 'woo'],
    preview_url: 'https://media.tenor.com/images/c2ca1c7d23d8c11fb087a329d4791ee3/tenor.gif',
    url: 'https://media.tenor.com/images/c2ca1c7d23d8c11fb087a329d4791ee3/tenor.gif',
    dims: [320, 240]
  },
  {
    id: 'fb_dance_3',
    title: 'Carlton Dance Fresh Prince',
    tags: ['dance', 'funny', 'party', 'carlton', 'groove'],
    preview_url: 'https://media.tenor.com/images/5f04b2eb2617a2fb0495fdbbcf1ba611/tenor.gif',
    url: 'https://media.tenor.com/images/5f04b2eb2617a2fb0495fdbbcf1ba611/tenor.gif',
    dims: [300, 220]
  },
  {
    id: 'fb_vibe_3',
    title: 'Retro Synthwave Neon Drive',
    tags: ['vibe', 'synthwave', 'music', 'chill', 'neon', 'drive'],
    preview_url: 'https://media.tenor.com/images/0ef23d240d869408b049d5a9228d7085/tenor.gif',
    url: 'https://media.tenor.com/images/0ef23d240d869408b049d5a9228d7085/tenor.gif',
    dims: [320, 180]
  }
];

function getFilteredFallback(query, type) {
  const q = (query || '').trim().toLowerCase();
  if (!q || type === 'trending' || q === 'trending') {
    return CURATED_FALLBACK_GIFS.map(({ tags, ...rest }) => rest);
  }

  const matches = CURATED_FALLBACK_GIFS.filter(item => {
    if (item.title.toLowerCase().includes(q)) return true;
    if (item.tags.some(tag => tag.toLowerCase().includes(q) || q.includes(tag.toLowerCase()))) return true;
    return false;
  });

  if (matches.length > 0) {
    return matches.map(({ tags, ...rest }) => rest);
  }

  // If no direct matches, return general fallback so user always sees content
  return CURATED_FALLBACK_GIFS.map(({ tags, ...rest }) => rest);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const reqType = searchParams.get('type') || (query ? 'search' : 'trending');
  const limitParam = parseInt(searchParams.get('limit') || '24', 10);
  const limit = Math.min(Math.max(isNaN(limitParam) ? 24 : limitParam, 1), 50);
  const pos = searchParams.get('pos') || searchParams.get('next') || '';

  // Determine Tenor endpoint
  let tenorEndpoint;
  if (reqType === 'trending' || (!query && reqType !== 'search')) {
    tenorEndpoint = `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&client_key=${CLIENT_KEY}&limit=${limit}&media_filter=gif,tinygif,nanogif${pos ? `&pos=${encodeURIComponent(pos)}` : ''}`;
  } else {
    tenorEndpoint = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${TENOR_API_KEY}&client_key=${CLIENT_KEY}&limit=${limit}&media_filter=gif,tinygif,nanogif${pos ? `&pos=${encodeURIComponent(pos)}` : ''}`;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(tenorEndpoint, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'OpenJam/1.0'
      },
      next: { revalidate: 300 } // Cache for 5 mins
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Tenor API responded with status ${response.status}. Using curated fallback.`);
      const fallbackResults = getFilteredFallback(query, reqType);
      return NextResponse.json({
        results: fallbackResults.slice(0, limit),
        next: null,
        fallback: true
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400'
        }
      });
    }

    const data = await response.json();
    const rawResults = data.results || [];

    const results = rawResults.map((item, idx) => {
      const media = item.media_formats || {};
      const gifObj = media.gif || media.mediumgif || media.tinygif || {};
      const tinyObj = media.tinygif || media.nanogif || media.gif || {};

      return {
        id: item.id || `tenor_${idx}_${Date.now()}`,
        title: item.title || item.content_description || 'GIF',
        preview_url: tinyObj.url || gifObj.url || item.url || '',
        url: gifObj.url || tinyObj.url || item.url || '',
        dims: gifObj.dims || tinyObj.dims || [200, 200]
      };
    }).filter(g => Boolean(g.url));

    return NextResponse.json({
      results,
      next: data.next || null,
      fallback: false
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=86400'
      }
    });

  } catch (err) {
    console.warn('Failed to fetch from Tenor API, serving fallback:', err?.message || err);
    const fallbackResults = getFilteredFallback(query, reqType);

    return NextResponse.json({
      results: fallbackResults.slice(0, limit),
      next: null,
      fallback: true
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400'
      }
    });
  }
}
