import {createConfig, http} from "wagmi";
import {base} from "wagmi/chains";
import {injected, coinbaseWallet} from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    injected({shimDisconnect: true}),
    coinbaseWallet({appName: "Bell", preference: "all"}),
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
