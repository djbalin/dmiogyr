import { ImageResponse } from "next/og";

export const alt = "DMI og Yr: vejret fra DMI og Yr side om side";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The card shown when a link is shared: the name, the promise, and two
 * temperature curves in the providers' colours drifting apart and back, which
 * is what the app shows.
 */
export default function OpenGraphImage() {
  const curve = (phase: number, lift: number) =>
    Array.from({ length: 49 }, (_, i) => {
      const x = 80 + (i / 48) * 1040;
      const y =
        470 - lift - Math.sin(i / 7.6 + phase) * 60 - Math.sin(i / 3.1) * 8;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(" ");

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#eef4fb",
        padding: "72px 80px",
        fontFamily: "serif",
        position: "relative",
      }}
    >
      <div style={{ fontSize: 104, fontWeight: 700, color: "#0f172a" }}>
        DMI og Yr
      </div>
      <div
        style={{
          fontSize: 44,
          fontStyle: "italic",
          color: "#475569",
          marginTop: 8,
        }}
      >
        Vejret fra DMI og Yr, side om side.
      </div>
      <svg
        width="1200"
        height="630"
        viewBox="0 0 1200 630"
        style={{ position: "absolute", left: 0, top: 0 }}
        aria-hidden="true"
      >
        <path
          d={curve(0.4, 0)}
          fill="none"
          stroke="#4338ca"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d={curve(0, 14)}
          fill="none"
          stroke="#0f766e"
          strokeWidth="8"
          strokeLinecap="round"
        />
      </svg>
    </div>,
    size,
  );
}
