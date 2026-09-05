import type {MetadataRoute} from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bell.markets";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{url: SITE, lastModified: new Date(), changeFrequency: "hourly", priority: 1}];
}
