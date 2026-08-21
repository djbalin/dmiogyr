import { CONDITION_LABELS, type Condition } from "@/lib/weather/conditions";

/**
 * Inline SVG weather icons.
 *
 * Emoji were the obvious shortcut but they render as a different drawing on
 * every platform and several of the useful ones (light rain, sleet) have no
 * emoji at all, so the icon row stopped meaning anything precise. These are
 * built from a shared cloud and sun so the set looks like one family, and they
 * take their colours from theme tokens.
 */

type Props = {
  condition: Condition;
  night?: boolean;
  /** Pixel size of the square icon. */
  size?: number;
  className?: string;
  /**
   * Icons next to text that already names the condition are decorative; set
   * this to keep them out of the accessibility tree.
   */
  decorative?: boolean;
};

const Sun = ({ cx = 16, cy = 13, r = 5.5 }) => (
  <g stroke="var(--icon-sun)" strokeWidth="2" strokeLinecap="round">
    <circle cx={cx} cy={cy} r={r} fill="var(--icon-sun)" stroke="none" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
      const radians = (angle * Math.PI) / 180;
      const inner = r + 2.2;
      const outer = r + 5;
      return (
        <line
          key={angle}
          x1={cx + Math.cos(radians) * inner}
          y1={cy + Math.sin(radians) * inner}
          x2={cx + Math.cos(radians) * outer}
          y2={cy + Math.sin(radians) * outer}
        />
      );
    })}
  </g>
);

const Moon = () => (
  <path
    d="M20.4 18.6A8 8 0 0 1 11.2 7.4a8.4 8.4 0 1 0 9.2 11.2Z"
    fill="var(--icon-moon)"
  />
);

/** Built from overlapping circles so the silhouette is always well-formed. */
const Cloud = ({ y = 0, shade = "var(--icon-cloud)" }) => (
  <g fill={shade} transform={`translate(0 ${y})`}>
    <circle cx="12.5" cy="17" r="5" />
    <circle cx="19" cy="15.5" r="6.2" />
    <circle cx="23" cy="19" r="4.2" />
    <rect x="12" y="17.5" width="11.5" height="5.5" rx="2.75" />
  </g>
);

const Drops = ({ count = 3, colour = "var(--icon-rain)" }) => (
  <g stroke={colour} strokeWidth="2.2" strokeLinecap="round">
    {Array.from({ length: count }, (_, i) => 12 + i * 4.5).map((x) => (
      <line key={x} x1={x} y1={25} x2={x - 1.5} y2={29} />
    ))}
  </g>
);

const Flakes = ({ count = 2 }) => (
  <g stroke="var(--icon-snow)" strokeWidth="1.8" strokeLinecap="round">
    {Array.from({ length: count }, (_, i) => 14 + i * 6).map((cx) => {
      const cy = 27;
      return (
        <g key={cx}>
          <line x1={cx - 2.4} y1={cy} x2={cx + 2.4} y2={cy} />
          <line x1={cx - 1.2} y1={cy - 2.1} x2={cx + 1.2} y2={cy + 2.1} />
          <line x1={cx + 1.2} y1={cy - 2.1} x2={cx - 1.2} y2={cy + 2.1} />
        </g>
      );
    })}
  </g>
);

const Bolt = () => (
  <path
    d="M18 23.5h-4.4l4-8.5-1.2 6h4l-5 9.5Z"
    fill="var(--icon-bolt)"
    stroke="var(--icon-bolt)"
    strokeWidth="1.4"
    strokeLinejoin="round"
  />
);

function Shapes({
  condition,
  night,
}: {
  condition: Condition;
  night: boolean;
}) {
  const luminary = night ? <Moon /> : <Sun />;

  switch (condition) {
    case "clear":
      return night ? <Moon /> : <Sun cx={16} cy={16} r={7} />;
    case "fair":
      return (
        <>
          <g transform="translate(-3 -3)">{luminary}</g>
          <Cloud y={3} />
        </>
      );
    case "partlycloudy":
      return (
        <>
          <g transform="translate(1 -3)">{luminary}</g>
          <Cloud y={2} />
        </>
      );
    case "cloudy":
      return (
        <>
          <Cloud y={-3} shade="var(--icon-cloud-dark)" />
          <Cloud y={1} />
        </>
      );
    case "fog":
      return (
        <>
          <Cloud y={-3} />
          <g
            stroke="var(--icon-cloud-dark)"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <line x1="9" y1="24" x2="24" y2="24" />
            <line x1="11" y1="28" x2="22" y2="28" />
          </g>
        </>
      );
    case "lightrain":
      return (
        <>
          <Cloud y={-2} />
          <Drops count={2} />
        </>
      );
    case "rain":
      return (
        <>
          <Cloud y={-2} />
          <Drops count={3} />
        </>
      );
    case "heavyrain":
      return (
        <>
          <Cloud y={-3} shade="var(--icon-cloud-dark)" />
          <Cloud y={-1} />
          <Drops count={4} />
        </>
      );
    case "sleet":
      return (
        <>
          <Cloud y={-2} />
          <g stroke="var(--icon-rain)" strokeWidth="2.2" strokeLinecap="round">
            <line x1="13" y1="25" x2="11.5" y2="29" />
          </g>
          <g transform="translate(4 0)">
            <Flakes count={1} />
          </g>
        </>
      );
    case "snow":
      return (
        <>
          <Cloud y={-2} />
          <Flakes count={2} />
        </>
      );
    case "thunder":
      return (
        <>
          <Cloud y={-3} shade="var(--icon-cloud-dark)" />
          <Bolt />
        </>
      );
  }
}

export function WeatherIcon({
  condition,
  night = false,
  size = 32,
  className,
  decorative = false,
}: Props) {
  const label = CONDITION_LABELS[condition];
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      role={decorative ? "presentation" : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : label}
    >
      {!decorative && <title>{label}</title>}
      <Shapes condition={condition} night={night} />
    </svg>
  );
}
