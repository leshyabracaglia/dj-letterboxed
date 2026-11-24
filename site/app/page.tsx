import Image from "next/image";

import { Stamp } from "@/components/Stamp";
import { APP_STORE_URL, APP_URL, PRIVACY_URL, SUPPORT_URL, TERMS_URL } from "@/lib/links";

// Asked of every free app: kept as structured data for search results.
const FREE_ANSWER =
  "Yes, completely, and there are no ads. Logging nights, collecting stamps, checking in, lists, stats and following friends all cost nothing.";

const FAQ_DATA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Is BeatBox'd free?",
      acceptedAnswer: { "@type": "Answer", text: FREE_ANSWER },
    },
  ],
};

// Illustrative write-ups for "The record": a note on a DJ's set, or on the
// whole night, one on each kind of paper.
const WRITE_UPS = [
  {
    dj: "Mita Gami",
    meta: "Nowadays · Sun 02 Nov · Day",
    quote: "Stayed in one groove for two hours and it kept getting better somehow.",
    by: "sunrise_sam",
    tone: "dark",
  },
  {
    dj: "Eden Burns",
    meta: "Basement · Fri 31 Oct · Night",
    quote: "Couldn't tell where one track ended and the next started. Didn't want to.",
    by: "dee.mono",
    tone: "violet",
  },
  {
    dj: "The whole night",
    meta: "Public Records · Thu 13 Nov",
    quote: "Lost my friends at 2, found them by the bar at 5. Worth it.",
    by: "rj_digs",
    tone: "paper",
  },
];

// Illustrative passport stamps, taking turns through the app's five inks.
const PASSPORT = [
  { club: "Good Room", detail: "08 Nov 26", ink: "ring" },
  { club: "Nowadays", detail: "02 Nov 26 · Day", ink: "box" },
  { club: "Basement", detail: "31 Oct 26", ink: "seal" },
  { club: "Public Records", detail: "13 Nov 26", ink: "dashed" },
  { club: "Halle 4", detail: "Berlin · 19 Jul", ink: "violet" },
];

const POINTS = [
  {
    title: "Every DJ gets a page",
    body: "The tracks people loved, where they're seen most, and the best things said about their sets.",
  },
  {
    title: "No editors",
    body: "Every DJ, club and party page is built from what people log. Nothing is paid placement.",
  },
  { title: "Free. No ads.", body: "Nothing to buy and nothing sponsored in your feed." },
];

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 1.5v9l7.5-4.5z" fill="currentColor" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 22s7-6.6 7-12.2A7 7 0 0 0 5 9.8C5 15.4 12 22 12 22Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="12" cy="9.8" r="2.4" fill="currentColor" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="2" width="12" height="20" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M10.5 18h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function Home() {
  return (
    <>
      <header className="site-header wrap">
        <a className="brand" href="/" aria-label="BeatBox'd home">
          <Image src="/logo-mark.png" alt="" width={44} height={44} priority />
          <span>BeatBox&apos;d</span>
        </a>
        <nav aria-label="Sections" className="nav">
          <a href="#record">The record</a>
          <a href="#ids">Track IDs</a>
          <a href="#passport">Passport</a>
        </nav>
        <a className="pill pill-white" href={APP_STORE_URL} rel="noopener">
          Get the app
        </a>
      </header>

      <main>
        <section className="hero wrap">
          <div className="hero-copy">
            <p className="kicker">Write about DJ sets · Free on iPhone</p>
            <h1>You had to be there.</h1>
            <p className="lede">Log the nights you go out. Write about the sets you saw and the tracks you heard.</p>
            <div className="hero-actions">
              <a className="pill pill-violet" href={APP_STORE_URL} rel="noopener">
                <PhoneIcon />
                Download on the App Store
              </a>
              <p className="fine">
                Or use it on the web at <a href={APP_URL}>{APP_URL.replace(/^https?:\/\//, "")}</a>
              </p>
            </div>
          </div>
          <div className="hero-card-wrap" aria-hidden="true">
            <div className="hero-card">
              <p className="label lilac">Sat 08 Nov · Night</p>
              <p className="hero-dj">Mira</p>
              <p className="hero-venue">The Ruins, Queens</p>
              <p className="hero-quote">
                &ldquo;Hours of slow, hypnotic grooves. She never rushed a single build.&rdquo;
              </p>
              <p className="hero-by">
                <span className="avatar">M</span>
                maya.k · 3 tracks · 2 friends tagged
              </p>
              <p className="hero-foot label">
                <span>No. 0417</span>
                <span>Verified</span>
              </p>
              <Stamp
                lines={["NOV", "8"]}
                rim="LOGGED · BEATBOXD · LOGGED · BEATBOXD · "
                label=""
                size={92}
                rotate={-8}
                className="hero-stamp"
              />
            </div>
          </div>
        </section>

        <section className="band band-paper" aria-labelledby="four-am-title">
          <div className="wrap band-row">
            <h2 id="four-am-title">What happened at 4am?</h2>
            <p>Write-ups from people who were there. No star ratings, no ranking DJs.</p>
          </div>
        </section>

        <section id="record" className="wrap section" aria-labelledby="record-title">
          <div className="section-head">
            <div>
              <p className="kicker">The record</p>
              <h2 id="record-title">Write about the set.</h2>
            </div>
            <p className="aside">
              A line about the whole night, or a note on each DJ you saw. Write as much or as little as you want.
            </p>
          </div>
          <div className="write-ups" aria-hidden="true">
            {WRITE_UPS.map((w) => (
              <article key={w.by} className={`write-up write-up-${w.tone}`}>
                <div>
                  <p className="label">{w.meta}</p>
                  <p className="write-up-dj">{w.dj}</p>
                </div>
                <p className="write-up-quote">&ldquo;{w.quote}&rdquo;</p>
                <p className="write-up-by">{w.by}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="ids" className="wrap section split" aria-labelledby="ids-title">
          <div className="split-copy">
            <p className="kicker">Tracks · IDs</p>
            <h2 id="ids-title">Track IDs</h2>
            <p className="lede">
              Add the tracks you remember from a set. If you don&apos;t know one, post it as an ID with a short clip and
              other people can suggest what it is.
            </p>
          </div>
          <div className="id-demo" aria-hidden="true">
            <div className="id-row">
              <span className="id-badge">ID</span>
              <div className="id-text">
                <p className="label">ID · Around 3:40</p>
                <p className="id-note">&ldquo;The one with the vocal that kept coming back.&rdquo;</p>
              </div>
              <span className="play">
                <PlayIcon />
              </span>
            </div>
            <div className="id-suggestion">
              <div>
                <p className="id-who">rj_digs suggested</p>
                <p className="id-track">[Track title] · [Artist]</p>
              </div>
              <Stamp lines={["ID'D"]} rim="NAMED · BEATBOXD · " label="" size={64} rotate={-8} />
            </div>
          </div>
        </section>

        <section className="band band-violet" aria-labelledby="profile-title">
          <div className="wrap split">
            <div className="profile-demo" aria-hidden="true">
              <div className="tile">
                <p className="label lilac">Seen most</p>
                <p className="tile-big">Dixon ×7</p>
              </div>
              <div className="tile">
                <p className="label lilac">This year</p>
                <p className="tile-big">31 nights</p>
              </div>
              <div className="tile tile-paper tile-wide">
                <p className="label violet">A list by you</p>
                <p className="tile-big">Best closing sets of 2026</p>
                <p className="tile-meta">8 nights</p>
              </div>
            </div>
            <div className="split-copy">
              <p className="kicker kicker-light">Profile · Lists</p>
              <h2 id="profile-title">Your profile</h2>
              <p className="lede lede-light">
                Every DJ you&apos;ve seen, how often, and what you wrote. Make lists of sets. Follow friends and people
                whose write-ups you like.
              </p>
            </div>
          </div>
        </section>

        <section id="passport" className="wrap section" aria-labelledby="passport-title">
          <div className="section-head">
            <div>
              <p className="kicker">Passport · Check in</p>
              <h2 id="passport-title">Passport</h2>
            </div>
            <p className="aside">
              Each club you go to gets a stamp. Check in on the night to verify it and see which friends are there. Only
              friends can see your check-ins.
            </p>
          </div>
          <div className="passport" aria-hidden="true">
            {PASSPORT.map((s) => (
              <div key={s.club} className={`pstamp pstamp-${s.ink}`}>
                <span className="pstamp-club">{s.club}</span>
                <span className="pstamp-detail">{s.detail}</span>
              </div>
            ))}
            <p className="passport-count">
              17 clubs
              <span>6 cities</span>
            </p>
          </div>
          <p className="checked-in">
            <PinIcon />
            <span>
              You checked in at <b>Good Room</b>. Jo and Priya are here too.
            </span>
          </p>
        </section>

        <section className="points" aria-label="What makes it different">
          <div className="wrap points-row">
            {POINTS.map((p) => (
              <div key={p.title}>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </div>
            ))}
          </div>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_DATA) }} />
        </section>

        <section className="wrap cta" aria-labelledby="cta-title">
          <h2 id="cta-title">Where were you last night?</h2>
          <a className="pill pill-violet" href={APP_STORE_URL} rel="noopener">
            Free on iPhone
          </a>
        </section>
      </main>

      <footer className="wrap site-footer">
        <span>BeatBox&apos;d · Made in Brooklyn</span>
        <nav aria-label="Legal">
          <a href={PRIVACY_URL}>Privacy</a>
          <a href={TERMS_URL}>Terms</a>
          <a href={SUPPORT_URL}>Contact</a>
        </nav>
      </footer>
    </>
  );
}
