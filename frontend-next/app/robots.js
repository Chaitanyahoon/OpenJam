export default function robots() {
  const baseUrl = "https://www.openjam.fun";
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/offline', '/_next/'],
      },
      {
        userAgent: ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'],
        allow: ['/', '/privacy', '/terms', '/room/', '/playlist/', '/profile/'],
        disallow: ['/admin', '/offline', '/_next/'],
      }
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
