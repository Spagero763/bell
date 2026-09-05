import type {Hex} from "viem";

/// ERC-8021 attribution. The suffix rides on the end of the calldata, the contract
/// ignores the trailing bytes, and Base's indexers read it back off chain to credit
/// the app that produced the transaction. Costs 16 gas per non-zero byte.
///
/// Layout, as issued by the Base dashboard for this app:
///   62635f656e786d74696379   "bc_enxmticy"
///   0b                       code length, 11
///   00                       separator
///   8021 x 8                 marker
///
/// Taken verbatim from the dashboard rather than derived, because the worked example
/// in the docs orders the length byte the other way round and only one of them is
/// what the indexer actually reads.
export const BUILDER_CODE = "bc_enxmticy";

export const DATA_SUFFIX =
  (process.env.NEXT_PUBLIC_BUILDER_SUFFIX as Hex | undefined) ??
  ("0x62635f656e786d746963790b0080218021802180218021802180218021" as Hex);

/// Sanity check for the shape, so a bad paste fails loudly rather than silently
/// losing attribution on every transaction.
export function suffixLooksValid(s: string = DATA_SUFFIX): boolean {
  return /^0x[0-9a-f]+$/.test(s) && s.endsWith("8021".repeat(8)) && (s.length - 2) % 2 === 0;
}
