export default async function sitemap() {
  const baseUrl = "https://www.openjam.fun";

  const staticEntries = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date('2025-01-01'),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date('2025-01-01'),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/profile`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.4,
    },
  ];

  const getBackendUrl = () => {
    if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_BACKEND_URL) {
      const url = process.env.NEXT_PUBLIC_BACKEND_URL;
      if (url !== 'undefined' && url !== 'null' && url.trim() !== '') {
        return url.replace(/\/$/, '');
      }
    }
    return 'https://api.openjam.fun';
  };

  const backendUrl = getBackendUrl();
  let roomEntries = [];
  let playlistEntries = [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${backendUrl}/rooms?limit=100`, {
      signal: controller.signal,
      next: { revalidate: 60 },
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const rooms = data?.rooms || [];
      const publicRooms = rooms.filter((r) => r && r.id && !r.is_private);

      roomEntries = publicRooms.map((room) => ({
        url: `${baseUrl}/room/${room.id}`,
        lastModified: room.created_at ? new Date(room.created_at) : new Date(),
        changeFrequency: 'hourly',
        priority: 0.8,
      }));
    }
  } catch (error) {
    console.warn('Sitemap build: Could not fetch active rooms from backend', error?.message || error);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${backendUrl}/playlists?limit=50`, {
      signal: controller.signal,
      next: { revalidate: 60 },
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const playlists = data?.playlists || [];
      const publicPlaylists = playlists.filter((p) => p && p.id && !p.is_private);

      playlistEntries = publicPlaylists.map((playlist) => ({
        url: `${baseUrl}/playlist/${playlist.id}`,
        lastModified: playlist.updated_at ? new Date(playlist.updated_at) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.5,
      }));
    }
  } catch (error) {
    console.warn('Sitemap build: Could not fetch public playlists from backend', error?.message || error);
  }

  return [...staticEntries, ...roomEntries, ...playlistEntries];
}
