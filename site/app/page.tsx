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

// Asked of every free app: kept as the one FAQ (and its structured data,
// for search results).
const FREE = {
  q: "Is BeatBox'd free?",
  a: "Yes, completely, and there are no ads. Logging nights, collecting stamps, checking in, lists, stats and following friends all cost nothing.",
};

const FAQ_DATA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [{ "@type": "Question", name: FREE.q, acceptedAnswer: { "@type": "Answer", text: FREE.a } }],
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
          <a href="#check-in">Check in</a>
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

        <section id="check-in" className="wrap section split" aria-labelledby="check-in-title">
          <div className="split-copy">
            <p className="kicker">Check in · Friends</p>
            <h2 id="check-in-title">Check in. See who&apos;s here.</h2>
            <p className="lede">
              Tap Check in when you get to the club. The club goes in your passport, the night you log gets a verified
              mark, and if a friend checked in at the same place, you&apos;ll both get a heads-up that the other&apos;s
              here too. Didn&apos;t log it? Your friends still see you were out.
            </p>
            <p className="fine">Where you check in only shows to friends: people you follow who follow you back.</p>
          </div>
          <div className="checkin-demo" aria-hidden="true">
            <div className="panel checkin-card">
              <p className="mini-label lilac">Sat 08 Nov · Checked in</p>
              <p className="checkin-who">You were at</p>
              <p className="checkin-venue">Good Room</p>
              <p className="checkin-city">Brooklyn</p>
              <Stamp
                lines={["NOV", "08"]}
                rim="CHECKED IN · CHECKED IN · "
                label=""
                size={84}
                rotate={8}
                className="checkin-stamp"
              />
              <TornEdge color="rgba(14, 11, 12, 0.92)" />
            </div>
            <div className="toast">
              <Image src="/photos/night-3.jpg" alt="" width={40} height={40} />
              <p>
                <b>@carla</b> is at Good Room too
              </p>
            </div>
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

        <section className="wrap section split split-flip" aria-labelledby="profile-title">
          <div className="split-copy">
            <p className="kicker">Profile · Lists · Stats</p>
            <h2 id="profile-title">Your nights, in numbers.</h2>
            <p className="lede">
              Your profile keeps count for you: nights out, DJs you&apos;ve caught (and who you&apos;ve seen most),
              clubs and cities. Make lists of the nights and sets that belong together, like best closers or sunrise
              sets, and pin the three clubs you love.
            </p>
          </div>
          <div className="profile-demo" aria-hidden="true">
            <div className="profile-stats">
              {[
                ["48", "nights"],
                ["31", "DJs"],
                ["17", "clubs"],
                ["6", "cities"],
              ].map(([n, label]) => (
                <span key={label}>
                  <b>{n}</b>
                  {label}
                </span>
              ))}
            </div>
            <div className="panel profile-row">
              <p className="mini-label lilac">Seen most</p>
              <p className="profile-big">Dixon ×7</p>
            </div>
            <div className="panel profile-row profile-list">
              <Image src="/photos/night-1.jpg" alt="" width={48} height={48} />
              <div>
                <p className="profile-big">Best closing sets of 2026</p>
                <p className="mini-label">8 entries</p>
              </div>
            </div>
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

        <section id="free" className="wrap section" aria-labelledby="free-title">
          <div className="free">
            <h2 id="free-title">
              Free. <mark>No ads.</mark>
            </h2>
            <p className="lede">{FREE.a}</p>
          </div>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_DATA) }} />
        </section>

        <section className="wrap section section-last" aria-labelledby="cta-title">
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
