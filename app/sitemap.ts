import type { MetadataRoute } from 'next';
export const dynamic = 'force-static';

/** Personal noindex PWA: retain a harmless empty endpoint without advertising a public sitemap. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [];
}
