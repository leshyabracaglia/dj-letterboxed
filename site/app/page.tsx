import Image from "next/image";

import { AppStoreButton } from "@/components/AppStoreButton";
import { HeroPhones } from "@/components/Phones";
import { Stamp } from "@/components/Stamp";
import { TornEdge } from "@/components/TornEdge";
import { APP_STORE_URL, PRIVACY_URL, SUPPORT_URL, TERMS_URL } from "@/lib/links";

const FEATURES = [
  {
    kicker: "01 · Log",
    title: "Log every night",
    body: "Add a night in a few taps: the club, the DJ, the date, and a note on how it felt. Add the songs you Shazamed or recognized along the way. Check in at a club and log the night later.",
  },
  {
    kicker: "02 · Passport",
    title: "Collect your passport",
    body: "Every club you visit earns a stamp, with the city, your first night and how many times you've been back. Watch it fill up across clubs and cities.",
  },
  {
    kicker: "03 · Share",
    title: "Share it with friends",
    body: "Follow your friends, see where they went out, and tag the people you danced with. Your profile shows your nights, your DJs and your passport.",
  },
];

// Illustrative passport entries for the section that shows one filling up.
const PASSPORT = [
  { city: "Brooklyn", club: "Halle 4", date: "8 Nov 2026", nights: "3 nights" },
  { city: "Berlin", club: "The Vault", date: "18 Oct 2026", nights: "1 night" },
  { city: "Brooklyn", club: "Outpost", date: "31 Oct 2026", nights: "5 nights" },
  { city: "London", club: "Room 9", date: "30 Aug 2026", nights: "2 nights" },
];

const FAQ = [
  {
    q: "Is it free?",
    a: "Yes. Logging nights, collecting stamps and following friends cost nothing.",
  },
  {
    q: "Do I need to rate the sets?",
    a: "No. It's a diary, not a scoreboard: the club, the DJ, the tracks and how the night felt.",
  },
  {
    q: "Who sees my passport?",
    a: "Your profile and passport are public, like the nights you log. Where you've checked in without logging a night only shows to your friends.",
  },
];

const FAQ_DATA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
};

const COLLAGE = [
  { src: "/photos/night-1.jpg", alt: "A DJ under purple lights", className: "collage-a" },
  { src: "/photos/night-4.jpg", alt: "A packed room in red light", className: "collage-b" },
  { src: "/photos/night-3.jpg", alt: "A DJ behind the decks", className: "collage-c" },
  { src: "/photos/night-2.jpg", alt: "A warehouse crowd at golden hour", className: "collage-d" },
];

export default function Home() {
  return (
    <>
      <header className="site-header wrap">
        <a className="brand" href="/" aria-label="BeatBox'd home">
          <Image src="/logo-mark.png" alt="" width={36} height={36} priority />
          <span>BeatBox&apos;d</span>
        </a>
        <nav aria-label="Sections" className="nav">
          <a href="#features">Features</a>
          <a href="#passport">Passport</a>
          <a href="#faq">FAQ</a>
        </nav>
        <a className="button-white button-small" href={APP_STORE_URL} rel="noopener">
          Get the app
        </a>
      </header>

      <main>
        <section className="hero wrap">
          <div className="hero-copy">
            <p className="kicker">The clubbing passport for music lovers</p>
            <h1>
              For people who go for the <mark>music.</mark>
            </h1>
            <p className="lede">
              Log the nights you danced, collect a stamp for every club you visit, and share where you went with
              friends.
            </p>
            <div className="hero-actions">
              <AppStoreButton />
              <a className="text-link" href="#features">
                See how it works
              </a>
            </div>
          </div>
          <HeroPhones />
        </section>

        <section id="features" className="wrap section" aria-labelledby="features-title">
          <h2 id="features-title">Your nights, kept.</h2>
          <div className="features">
            {FEATURES.map((f) => (
              <article key={f.title} className="panel feature">
                <p className="kicker lilac">{f.kicker}</p>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="wrap section tracks" aria-labelledby="tracks-title">
          <div className="tracks-copy">
            <p className="kicker">Songs · Sets · DJs</p>
            <h2 id="tracks-title">The tracks that got you.</h2>
            <p className="lede">
              Add the songs you Shazamed or recognized, then see who you&apos;ve caught most, who you saw most recently,
              and the sets you&apos;d go back for. Can&apos;t name one? Post it as an ID and let people who were there
              help.
            </p>
          </div>
          <div className="collage">
            {COLLAGE.map((photo) => (
              <figure key={photo.src} className={`collage-photo ${photo.className}`}>
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  width={360}
                  height={360}
                  sizes="(max-width: 720px) 45vw, 220px"
                />
                <span className="tape" />
              </figure>
            ))}
          </div>
        </section>

        <section id="passport" className="wrap section" aria-labelledby="passport-title">
          <div className="section-head">
            <h2 id="passport-title">A passport that fills up.</h2>
            <p className="kicker">17 clubs · 6 cities</p>
          </div>
          <div className="passport">
            {PASSPORT.map((stamp, i) => (
              <div key={stamp.club} className="entry" style={{ rotate: `${[-1.5, 1, -0.5, 1.5][i]}deg` }}>
                <div className="entry-inner">
                  <span className="entry-city">{stamp.city}</span>
                  <span className="entry-club">{stamp.club}</span>
                  <span className="entry-foot">
                    <span>{stamp.date}</span>
                    <span>{stamp.nights}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="wrap section" aria-labelledby="cta-title">
          <div className="cta">
            <div>
              <h2 id="cta-title">Where were you last night?</h2>
              <p>Start your passport. Free on iPhone.</p>
              <AppStoreButton />
            </div>
            <Stamp star ring="var(--violet)" size={180} rotate={10} label="" className="cta-stamp" />
            <TornEdge color="var(--violet)" />
          </div>
        </section>

        <section id="faq" className="wrap section faq" aria-labelledby="faq-title">
          <h2 id="faq-title" className="visually-hidden">
            Questions
          </h2>
          {FAQ.map(({ q, a }) => (
            <div key={q}>
              <h3>{q}</h3>
              <p>{a}</p>
            </div>
          ))}
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_DATA) }} />
        </section>
      </main>

      <footer className="site-footer">
        <div className="wrap footer-row">
          <span>BeatBox&apos;d · {new Date().getFullYear()}</span>
          <nav aria-label="Legal">
            <a href={TERMS_URL}>Terms</a>
            <a href={PRIVACY_URL}>Privacy</a>
            <a href={SUPPORT_URL}>Contact</a>
          </nav>
        </div>
      </footer>
    </>
  );
}
