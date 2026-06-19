export default async function sitemap() {
  const baseUrl = "https://www.openjam.fun";
  
  const routes = [
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

  try {
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
    // Fetch active rooms from the backend (limit 100 to avoid overly large pages)
    const response = await fetch(`${backendUrl}/rooms?limit=100`, { next: { revalidate: 60 } });
    if (response.ok) {
      const data = await response.json();
      if (data && data.rooms) {
        data.rooms.forEach((room) => {
          if (!room.is_private) {
            routes.push({
              url: `${baseUrl}/room/${room.id}`,
              lastModified: new Date(),
              changeFrequency: 'hourly',
              priority: 0.8,
            });
          }
        });
      }
    }
  } catch (error) {
    console.warn("Could not fetch active rooms for sitemap:", error.message || error);
  }

  return routes;
}
