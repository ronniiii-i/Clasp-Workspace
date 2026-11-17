// next-sitemap.config.js
/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://claspworkspace.com",
  generateRobotsTxt: true,
  robotsTxtOptions: {
    policies: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/login",
          "/register",
          "/forgot-password",
          "/reset-password",
          "/verify-email",
          "/dashboard",
          "/profile",
          "/admin",
          // "/api",
        ],
      },
    ],
  },
};
// This is the configuration file for next-sitemap, a library to generate sitemaps and robots.txt files for Next.js applications.
