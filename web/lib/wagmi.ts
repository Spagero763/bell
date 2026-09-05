import {createConfig, http} from "wagmi";
import {base} from "wagmi/chains";
import {injected, coinbaseWallet} from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [base],
  // Coinbase first: it is the native account on Base and the only one that works
  // without an extension, via a passkey. The browser wallet is the fallback.
  connectors: [
    coinbaseWallet({
      appName: "Bell",
      preference: "all",
    }),
    injected({shimDisconnect: true}),
  ],
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_RPC ?? "https://mainnet.base.org"),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
