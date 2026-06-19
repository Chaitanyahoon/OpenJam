export default function robots() {
  const baseUrl = "https://www.openjam.fun";
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/offline', '/_next/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
