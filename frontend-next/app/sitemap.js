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
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
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

  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/rooms?limit=100`, {
      next: { revalidate: 60 },
    });

    if (response.ok) {
      const data = await response.json();
      const rooms = data?.rooms || [];
      const publicRooms = rooms.filter((r) => r && r.id && !r.is_private);

      const roomEntries = publicRooms.map((room) => ({
        url: `${baseUrl}/room/${room.id}`,
        lastModified: room.created_at ? new Date(room.created_at) : new Date(),
        changeFrequency: 'hourly',
        priority: 0.8,
      }));

      return [...staticEntries, ...roomEntries];
    }
  } catch (error) {
    console.warn('Sitemap build: Could not fetch active rooms from backend', error?.message || error);
  }

  return staticEntries;
}
