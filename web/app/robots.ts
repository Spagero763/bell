import type {MetadataRoute} from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bell.markets";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{userAgent: "*", allow: "/", disallow: "/api/"}],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
