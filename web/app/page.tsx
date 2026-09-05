import Hero from "@/components/Hero";
import Book from "@/components/Book";
import Evidence from "@/components/Evidence";
import Mechanism from "@/components/Mechanism";
import {Nav, Footer} from "@/components/Chrome";
import {getPulse} from "@/lib/pulse";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  // Rendered on the server so the live numbers are in the first paint and in the
  // markup a crawler sees, then kept current by the client.
  const initial = await getPulse().catch(() => undefined);

  return (
    <>
      <Nav />
      <main id="main">
        <Hero initial={initial} />

        <div className="mx-auto w-full max-w-[1080px] px-6 py-24">
          <div className="rule" />
          <p className="display mx-auto mt-24 max-w-[26ch] text-center text-[26px] leading-[1.25] text-dim sm:text-[34px]">
            An equity that trades for sixty five hours against a price that stopped moving is not a
            market. It is a{" "}
            <span className="text-ink">guess everyone is forced to agree with.</span>
          </p>
        </div>

        <Evidence />
        <Book />
        <Mechanism />
      </main>
      <Footer />
    </>
  );
}
