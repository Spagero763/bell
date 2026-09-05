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

  // The override comes first so the gate can be exercised from anywhere. Everything
  // after it is set by the platform edge and cannot be forged by the caller; the
  // client-supplied fallbacks only ever apply in local development, where no edge
  // has stamped a country on the request.
  const country =
    process.env.REGION_OVERRIDE ??
    h.get("x-vercel-ip-country") ??
    h.get("cf-ipcountry") ??
    h.get("x-country-code") ??
    null;

  return {
    country,
    restricted: country !== null && RESTRICTED.has(country.toUpperCase()),
  };
}
