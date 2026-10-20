import {
  formatDayNight,
  formatStampDate,
  formatTimeAgo,
  parseDateInputValue,
  plural,
  toDateInputValue,
} from "./format";

describe("plural", () => {
  it("uses the singular for one", () => expect(plural(1, "night")).toBe("1 night"));
  it("uses the plural otherwise", () => {
    expect(plural(0, "night")).toBe("0 nights");
    expect(plural(3, "night")).toBe("3 nights");
  });
});

describe("formatStampDate", () => {
  it("is the month over the local day", () => {
    const [month, day] = formatStampDate(new Date(2026, 8, 4, 12).toISOString());
    expect(month).toMatch(/sep/i);
    expect(day).toBe("4");
  });
});

describe("date input values", () => {
  it("formats the local calendar day, not the UTC one", () => {
    // 11pm local: toISOString() would roll this over to the next day west of UTC.
    expect(toDateInputValue(new Date(2026, 8, 14, 23, 30))).toBe("2026-09-14");
  });

  it("round-trips", () => {
    const date = parseDateInputValue("2026-01-05");
    expect(date && toDateInputValue(date)).toBe("2026-01-05");
  });

  it("rejects anything that isn't YYYY-MM-DD", () => {
    expect(parseDateInputValue("14/09/2026")).toBeNull();
    expect(parseDateInputValue("")).toBeNull();
  });
});

describe("formatDayNight", () => {
  it("names day into night", () => expect(formatDayNight({ isDay: true, isNight: true })).toBe("Day into night"));
  it("names a day", () => expect(formatDayNight({ isDay: true, isNight: false })).toBe("Day"));
  it("treats neither as night", () => expect(formatDayNight({ isDay: false, isNight: false })).toBe("Night"));
});

describe("formatTimeAgo", () => {
  const now = new Date("2026-10-15T12:00:00Z").getTime();
  const ago = (ms: number) => new Date(now - ms).toISOString();
  const MINUTE = 60_000;

  beforeEach(() => jest.spyOn(Date, "now").mockReturnValue(now));
  afterEach(() => jest.restoreAllMocks());

  it("counts up through minutes, hours, days and weeks", () => {
    expect(formatTimeAgo(ago(30 * 1000))).toBe("now");
    expect(formatTimeAgo(ago(5 * MINUTE))).toBe("5m");
    expect(formatTimeAgo(ago(3 * 60 * MINUTE))).toBe("3h");
    expect(formatTimeAgo(ago(2 * 24 * 60 * MINUTE))).toBe("2d");
    expect(formatTimeAgo(ago(14 * 24 * 60 * MINUTE))).toBe("2w");
  });

  it("falls back to the date after five weeks", () => {
    const iso = ago(40 * 24 * 60 * MINUTE);
    expect(formatTimeAgo(iso)).toBe(new Date(iso).toLocaleDateString());
  });
});
