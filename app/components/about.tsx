import Link from "next/link";
import { placePath, SITE_NAME, siteUrl } from "@/lib/site";
import { KNOWN_LOCATIONS, type Location } from "@/lib/weather/locations";

/**
 * The questions people actually type when choosing between the two services.
 * One list feeds both the visible section and the FAQ structured data, so the
 * two can never drift apart (Google requires them to match).
 */
const FAQ: { question: string; answer: string }[] = [
  {
    question: "Hvad er forskellen på DMI og Yr?",
    answer:
      "DMI er Danmarks Meteorologiske Institut. Deres vejrudsigt kommer fra deres egen vejrmodel, som regner i høj opløsning over Danmark og resten af Norden. Yr er Norges vejrtjeneste, drevet af Meteorologisk institutt og NRK, og bygger på de norske meteorologers egne beregninger. To forskellige modeller giver to bud på det samme vejr.",
  },
  {
    question: "Hvem har den bedste vejrudsigt, DMI eller Yr?",
    answer:
      "Ingen af dem rammer altid bedst. Begge er gode til de næste par døgn, og hvor præcise de er, afhænger af vejret og stedet. Det nyttigste er at se dem sammen: Er DMI og Yr enige, er udsigten sikker. Er de uenige, er vejret svært at forudsige, og så er det klogt at tage paraplyen med.",
  },
  {
    question: "Hvorfor viser DMI og Yr forskelligt vejr?",
    answer:
      "Modellerne starter fra lidt forskellige målinger, regner med forskellig opløsning og opdateres på forskellige tidspunkter. Især regn og byger er svære at placere præcist, så den ene kan vise regn, hvor den anden viser tørvejr. Her på siden er de dage markeret, hvor de to er uenige om temperaturen.",
  },
  {
    question: "Hvor ofte opdateres vejrudsigten?",
    answer:
      "Begge vejrtjenester opdaterer deres udsigt løbende, og siden henter nye tal hver time. DMI's vejrudsigt rækker 7 døgn frem, Yr's 9 døgn.",
  },
];

/**
 * What the page is, in words: an introduction naming the place, the common
 * questions about DMI versus Yr, and links to the other towns. Rendered on the
 * server, so it is in the HTML search engines read first, and useful to a
 * first-time visitor wondering why there are two forecasts.
 */
export function AboutSection({
  location,
  path,
}: {
  location: Location;
  /** This page's own URL, left out of the links to other places. */
  path: string;
}) {
  const others = KNOWN_LOCATIONS.filter((other) => placePath(other) !== path);
  return (
    <section
      aria-labelledby="about-heading"
      className="mt-8 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)] sm:p-6"
    >
      <h2
        id="about-heading"
        className="font-display text-2xl font-semibold text-ink"
      >
        Vejret i {location.name} fra DMI og Yr
      </h2>
      <p className="mt-2 max-w-3xl text-ink-muted">
        Her ser du vejrudsigten for {location.name} fra både DMI og Yr, side om
        side og time for time: temperatur, nedbør, vind og skyer for de kommende
        dage. Når to vejrtjenester er enige, kan du stole mere på vejret, og når
        de er uenige, kan du se det med det samme.
      </p>

      <div className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {FAQ.map(({ question, answer }) => (
          <div key={question}>
            <h3 className="font-display text-lg font-semibold text-ink">
              {question}
            </h3>
            <p className="mt-1 text-sm text-ink-muted">{answer}</p>
          </div>
        ))}
      </div>

      <nav aria-labelledby="other-places" className="mt-6">
        <h3
          id="other-places"
          className="text-xs font-semibold uppercase tracking-wider text-ink-faint"
        >
          Vejret i andre byer
        </h3>
        <ul className="mt-2 flex flex-wrap gap-2">
          {others.map((other) => (
            <li key={other.id}>
              <Link
                href={placePath(other)}
                className="inline-block rounded-full border border-line px-3 py-1.5 text-sm text-ink transition-colors hover:border-line-strong"
              >
                Vejret i {other.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}

/**
 * schema.org data for the page: the site, this page and the place it is
 * about, and the FAQ above.
 */
export function StructuredData({
  location,
  path,
  title,
  description,
}: {
  location: Location;
  /** The URL this page is indexed under. */
  path: string;
  title: string;
  description: string;
}) {
  const base = siteUrl();
  const url = new URL(path, base).toString();
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${base.origin}/#website`,
        name: SITE_NAME,
        url: `${base.origin}/`,
        inLanguage: "da-DK",
      },
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: title,
        description,
        inLanguage: "da-DK",
        isPartOf: { "@id": `${base.origin}/#website` },
        about: {
          "@type": "Place",
          name: location.name,
          geo: {
            "@type": "GeoCoordinates",
            latitude: location.lat,
            longitude: location.lon,
          },
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: FAQ.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON with "<" escaped, so a place name cannot close the tag
      dangerouslySetInnerHTML={{ __html: jsonForScript(data) }}
    />
  );
}

/** JSON safe to inline in a <script>: "<" can never start a closing tag. */
function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}
