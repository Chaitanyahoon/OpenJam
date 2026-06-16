/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: "https://www.openjam.fun",
  generateRobotsTxt: false,
  exclude: ["/admin", "/offline", "/room/*"],
  robotsTxtOptions: {
    policies: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/room/", "/offline", "/_next/"] },
    ],
  },
};
