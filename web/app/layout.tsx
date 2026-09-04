import type {Metadata} from "next";
import {Inter, JetBrains_Mono} from "next/font/google";
import Providers from "@/components/Providers";
import "./globals.css";

const inter = Inter({subsets: ["latin"], variable: "--font-inter"});
const mono = JetBrains_Mono({subsets: ["latin"], variable: "--font-mono-face"});

export const metadata: Metadata = {
  title: "Bell",
  description:
    "Tokenized equities trade around the clock. Their price feed does not. Bell is the venue for the hours in between.",
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
