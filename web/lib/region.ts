import {headers} from "next/headers";

/// Coinbase issues these equities to eligible non-US users only, and enforces that at
/// the application layer rather than in the token. Bell does the same: the whole page
/// stays readable everywhere, but the book will not transact for a US visitor.
export const RESTRICTED = new Set(["US"]);

export type Region = {
  country: string | null;
  restricted: boolean;
};

export async function getRegion(): Promise<Region> {
  const h = await headers();

  // Set by the platform edge. Absent in local development.
  const country =
    h.get("x-vercel-ip-country") ??
    h.get("cf-ipcountry") ??
    h.get("x-country-code") ??
    process.env.REGION_OVERRIDE ??
    null;

  return {
    country,
    restricted: country !== null && RESTRICTED.has(country.toUpperCase()),
  };
}
