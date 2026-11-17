import Image from "next/image";

import { Stamp } from "./Stamp";
import { TornEdge } from "./TornEdge";

// Illustrations of the app's screens, drawn in HTML so they stay crisp and
// light. Decorative: the page says everything they show in words.

function TabBar({ active }: { active: "feed" | "profile" }) {
  return (
    <div className="phone-tabs">
      <span className={active === "feed" ? "on" : ""}>Feed</span>
      <span>Browse</span>
      <span className="phone-plus">+</span>
      <span className={active === "profile" ? "on" : ""}>Profile</span>
    </div>
  );
}

/** The feed: a violet night card with a taped photo, a dark one under it. */
export function FeedPhone() {
  return (
    <div className="phone" aria-hidden="true">
      <span className="tape phone-tape" />
      <div className="phone-screen">
        <p className="phone-brand">BeatBox&apos;d</p>
        <div className="mini-card mini-violet">
          <div className="mini-row">
            <div>
              <p className="mini-label">Sat 08 Nov · Night</p>
              <p className="mini-name">Kaia</p>
              <p className="mini-where">Sunrise session @ Halle 4</p>
            </div>
            <div className="mini-photo">
              <Image src="/photos/night-2.jpg" alt="" width={56} height={56} />
              <span className="tape mini-photo-tape" />
            </div>
          </div>
          <p className="mini-text">Four hours, ambient to acid. Nobody wanted to leave.</p>
          <TornEdge color="var(--violet)" />
        </div>
        <div className="mini-card mini-dark">
          <div className="mini-row">
            <div>
              <p className="mini-label lilac">Fri 31 Oct</p>
              <p className="mini-name mini-name-sm">Orin b2b Sefa</p>
            </div>
            <div className="mini-photo">
              <Image src="/photos/night-4.jpg" alt="" width={44} height={44} />
            </div>
          </div>
          <TornEdge color="var(--panel)" />
        </div>
      </div>
      <TabBar active="feed" />
    </div>
  );
}

/** A profile: photo, handle on violet, counts and passport stamps. */
export function ProfilePhone() {
  return (
    <div className="phone phone-back" aria-hidden="true">
      <span className="tape phone-tape" />
      <div className="phone-screen">
        <p className="mini-label">CH 04 · Profile</p>
        <div className="mini-profile">
          <div className="mini-photo mini-avatar">
            <Image src="/photos/night-3.jpg" alt="" width={48} height={48} />
          </div>
          <div>
            <p className="mini-handle">@leshya</p>
            <p className="mini-meta">Brooklyn · Joined Nov 2026</p>
            <p className="mini-meta">
              <b>128</b> followers <b>96</b> following
            </p>
          </div>
        </div>
        <div className="mini-stats">
          <span>
            <b>48</b>nights
          </span>
          <span>
            <b>31</b>DJs
          </span>
          <span>
            <b>17</b>clubs
          </span>
        </div>
        <p className="mini-label">Passport · 17 clubs · 6 cities</p>
        <div className="mini-passport">
          {[
            ["Brooklyn", "Halle 4", "8 Nov 2026"],
            ["Berlin", "The Vault", "18 Oct 2026"],
          ].map(([city, club, date]) => (
            <div key={club} className="entry entry-mini">
              <div className="entry-inner">
                <span className="entry-city">{city}</span>
                <span className="entry-club">{club}</span>
                <span className="entry-foot">
                  <span>{date}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <TabBar active="profile" />
    </div>
  );
}

/** The two phones overlapping, with a night's stamp pressed over them. */
export function HeroPhones() {
  return (
    <div className="hero-phones">
      <FeedPhone />
      <ProfilePhone />
      <Stamp lines={["NOV", "08"]} label="" size={120} rotate={-8} className="hero-stamp" />
    </div>
  );
}
