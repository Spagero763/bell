import {ImageResponse} from "next/og";

export const alt = "Bell — the price of a stock market that is closed";
export const size = {width: 1200, height: 630};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#060709",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{display: "flex", alignItems: "center", gap: 14}}>
          <div style={{width: 9, height: 9, borderRadius: 9, background: "#e8a33d"}} />
          <div style={{color: "#767d88", fontSize: 22, letterSpacing: 4, textTransform: "uppercase"}}>
            Bell · Base
          </div>
        </div>

        <div style={{display: "flex", flexDirection: "column", gap: 18}}>
          <div style={{color: "#f2f4f7", fontSize: 68, lineHeight: 1.1, letterSpacing: -1.5}}>
            Tokenized equities trade
          </div>
          <div style={{color: "#f2f4f7", fontSize: 68, lineHeight: 1.1, letterSpacing: -1.5}}>
            around the clock.
          </div>
          <div style={{color: "#767d88", fontSize: 68, lineHeight: 1.1, letterSpacing: -1.5}}>
            Their price feed does not.
          </div>
        </div>

        <div style={{display: "flex", gap: 56}}>
          {[
            ["65.5h", "weekend blackout"],
            ["$5.6M", "traded in the dark"],
            ["-2.0%", "gap at the bell"],
          ].map(([v, l]) => (
            <div key={l} style={{display: "flex", flexDirection: "column", gap: 6}}>
              <div style={{color: "#f2f4f7", fontSize: 40}}>{v}</div>
              <div style={{color: "#4e555f", fontSize: 20}}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
