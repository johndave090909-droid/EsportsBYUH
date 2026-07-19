// Starter content for the site — mirrors the original static pages.
// Loaded automatically in demo mode, or via "Load sample content" in the
// admin panel's Site Settings section.

// Neutral starter settings used by "Clear content (start fresh)" — real club
// branding, no mock tournament data.
export const FRESH = {
  site: {
    ticker: [],
    facebookUrl: "https://www.facebook.com/",
    discordUrl: "#",
    registerUrl: "/matches#register",
    footerText: "SEASIDER ESPORTS · BYU–Hawaii Esports Club · Laie, HI"
  },
  home: {
    kicker: "BYU–HAWAII · LAIE, HAWAII",
    heroTitle: "Seasider",
    heroAccent: "Esports",
    heroText: "The official esports club of BYU–Hawaii. Tournaments, weeklies, and game nights — all Seasiders welcome.",
    heroImage: "",
    countdownEnabled: false,
    countdownTarget: "",
    games: [
      { name: "Valorant", image: "" },
      { name: "League of Legends", image: "" },
      { name: "Counter-Strike 2", image: "" },
      { name: "Smash Ultimate", image: "" },
      { name: "Dota 2", image: "" },
      { name: "Honor of Kings", image: "" }
    ]
  },
  matchespage: {
    kicker: "SEASIDER ESPORTS",
    lede: "Schedule, results, bracket, and standings for club tournaments.",
    regTitle: "Join Seasider Esports",
    regText: "Free for all BYU–Hawaii students.",
    regBtn: "SIGN UP"
  },
  bracket: {
    title: "",
    game: "",
    note: "",
    rounds: [
      { name: "SEMIFINALS", matches: [{ a: "", as: "", b: "", bs: "" }, { a: "", as: "", b: "", bs: "" }] },
      { name: "GRAND FINAL", matches: [{ a: "", as: "", b: "", bs: "" }] }
    ]
  }
};

export const SEED = {
  settings: {
    site: {
      ticker: [
        "REGISTRATION OPEN — SEASIDER CUP SPRING INVITATIONAL",
        "VALORANT FINALS · FRI 7PM · GCB 101",
        "SMASH WEEKLY EVERY WEDNESDAY",
        "NEW: HONOR OF KINGS LADDER"
      ],
      facebookUrl: "https://www.facebook.com/",
      discordUrl: "#",
      registerUrl: "/matches#register",
      footerText: "SEASIDER ESPORTS · BYU–Hawaii Esports Club · Laie, HI"
    },
    home: {
      kicker: "SPRING 2026 · LAIE, HAWAII",
      heroTitle: "Seasider Cup",
      heroAccent: "Spring Invitational",
      heroText: "Six titles, one campus. BYU–Hawaii's biggest student tournament of the semester — open to all Seasiders, from ranked grinders to first-timers.",
      heroImage: "",
      countdownEnabled: true,
      countdownTarget: "2026-08-21T18:00",
      games: [
        { name: "Valorant", image: "" },
        { name: "League of Legends", image: "" },
        { name: "Counter-Strike 2", image: "" },
        { name: "Smash Ultimate", image: "" },
        { name: "Dota 2", image: "" },
        { name: "Honor of Kings", image: "" }
      ]
    },
    matchespage: {
      kicker: "SEASIDER CUP · SPRING INVITATIONAL",
      lede: "Schedule, results, bracket, and standings for the current tournament. Want in? Register your team before Aug 20.",
      regTitle: "Register for the Spring Invitational",
      regText: "Free for all BYU–Hawaii students. Solo sign-ups get matched to a team.",
      regBtn: "SIGN UP NOW"
    },
    bracket: {
      title: "VALORANT — SPRING INVITATIONAL · 8 TEAMS · SINGLE ELIMINATION",
      game: "VALORANT",
      note: "3 points per win · Valorant division, Spring 2026",
      rounds: [
        { name: "QUARTERFINALS", matches: [
          { a: "Reef Sharks", as: "2", b: "Coconut Clutch", bs: "0", when: "2026-08-14T19:00", where: "GCB 101" },
          { a: "Night Marchers", as: "2", b: "Island Kings", bs: "1", when: "2026-08-14T20:30", where: "GCB 101" },
          { a: "Tide Breakers", as: "2", b: "Mana Five", bs: "0", when: "2026-08-15T19:00", where: "GCB 101" },
          { a: "Lava Lions", as: "2", b: "Iosepa Five", bs: "1", when: "2026-08-15T20:30", where: "GCB 101" }
        ] },
        { name: "SEMIFINALS", matches: [
          { a: "Reef Sharks", as: "", b: "Night Marchers", bs: "", when: "2026-08-21T19:00", where: "GCB 101" },
          { a: "Tide Breakers", as: "", b: "Lava Lions", bs: "", when: "2026-08-21T20:30", where: "GCB 101" }
        ] },
        { name: "GRAND FINAL", matches: [
          { a: "", as: "", b: "", bs: "", when: "2026-08-28T19:00", where: "Aloha Center" }
        ] }
      ]
    }
  },

  // The matches collection is no longer displayed anywhere — schedule,
  // results, and standings all derive from the bracket setting above.
  matches: [],

  // Hall of fame: one entry per tournament win; the newest entry per game is
  // that game's "Reigning Champions" card on the home page.
  champions: [
    { id: "c1", game: "VALORANT", title: "Fall Cup 2025", champion: "Reef Sharks", runnerUp: "Night Marchers", score: "3–2", dateLabel: "Fall 2025", date: "2025-11-21", image: "" },
    { id: "c2", game: "SMASH ULTIMATE", title: "Fall Cup 2025 — Smash Bracket", champion: "K. Fonoti", runnerUp: "M. Tanaka", score: "3–1", dateLabel: "Fall 2025", date: "2025-11-22", image: "" },
    { id: "c3", game: "DOTA 2", title: "Summer Tournament 2025", champion: "Mana Five", runnerUp: "Iosepa Five", score: "2–1", dateLabel: "Summer 2025", date: "2025-07-18", image: "" }
  ],

  news: [
    { id: "n1", title: "Spring Invitational registration is open", tag: "TOURNAMENT", date: "2026-08-14", pinned: true, linkText: "REGISTER NOW", linkUrl: "/matches#register",
      body: "The Seasider Cup Spring Invitational runs Aug 21–28 across all six club titles. Free for all BYU–Hawaii students — enter as a full team or sign up solo and we'll place you. Registration closes Aug 20 at midnight." },
    { id: "n2", title: "New practice room hours in GCB", tag: "FACILITIES", date: "2026-08-10", pinned: false, linkText: "", linkUrl: "",
      body: "The LAN room in GCB is now open Mon–Fri, 4–10 PM for club members. Twelve PCs, two console stations, and a booking sheet on the door — first come, first served during open hours." },
    { id: "n3", title: "Fall Cup recap: Reef Sharks take Valorant", tag: "RESULTS", date: "2026-08-02", pinned: false, linkText: "", linkUrl: "",
      body: "Reef Sharks closed out Night Marchers 3–2 in a five-map thriller. Full VODs are on the Videos page and finals-night photos are up in the gallery." },
    { id: "n4", title: "Honor of Kings ladder launches", tag: "NEW TITLE", date: "2026-07-28", pinned: false, linkText: "", linkUrl: "",
      body: "By popular demand, a mobile division joins the club. The ladder runs weekly through the semester — matches are online, finals are in person." },
    { id: "n5", title: "Weekly Smash night moves to Wednesdays", tag: "CLUB", date: "2026-07-21", pinned: false, linkText: "", linkUrl: "",
      body: "Smash Ultimate weeklies now run Wednesdays at 6:30 PM in the Aloha Center. Setups provided; bring your own controller if you have one." },
    { id: "n6", title: "Fall semester officer applications", tag: "CLUB", date: "2026-07-14", pinned: false, linkText: "", linkUrl: "",
      body: "Want to help run broadcasts, brackets, or socials? Officer applications for Fall are open until Jul 31 — message us on Discord or Facebook." }
  ],

  photos: [
    { id: "p1", caption: "Fall Cup Finals", dateLabel: "Aug 14", size: "big", image: "", order: 1 },
    { id: "p2", caption: "Reef Sharks", dateLabel: "Aug 14", size: "std", image: "", order: 2 },
    { id: "p3", caption: "Broadcast", dateLabel: "Aug 14", size: "std", image: "", order: 3 },
    { id: "p4", caption: "Smash Weekly", dateLabel: "Aug 12", size: "std", image: "", order: 4 },
    { id: "p5", caption: "Fall Cup", dateLabel: "Aug 14", size: "std", image: "", order: 5 },
    { id: "p6", caption: "GCB LAN Room", dateLabel: "Aug 10", size: "wide", image: "", order: 6 },
    { id: "p7", caption: "Night Marchers", dateLabel: "Aug 9", size: "std", image: "", order: 7 },
    { id: "p8", caption: "Game Night", dateLabel: "Aug 7", size: "std", image: "", order: 8 },
    { id: "p9", caption: "Spring Kickoff", dateLabel: "Aug 3", size: "wide", image: "", order: 9 }
  ],

  videos: [
    { id: "v1", title: "Grand Finals: Reef Sharks vs Night Marchers", tag: "VALORANT · FALL CUP", url: "https://www.facebook.com/", duration: "1:48:22", dateLabel: "Aug 14", featured: true, thumb: "",
      description: "Five maps, overtime on Ascent, and a packed GCB 101. The full broadcast with caster commentary." },
    { id: "v2", title: "Top 10 plays — Fall Cup week 4", tag: "HIGHLIGHTS", url: "https://www.facebook.com/", duration: "6:41", dateLabel: "Aug 9", featured: false, thumb: "", description: "" },
    { id: "v3", title: "Iosepa Five vs Mana Five — full VOD", tag: "LEAGUE OF LEGENDS", url: "https://www.facebook.com/", duration: "52:18", dateLabel: "Aug 13", featured: false, thumb: "", description: "" },
    { id: "v4", title: "Lava Lions clutch on Mirage — semifinal", tag: "CS2", url: "https://www.facebook.com/", duration: "44:05", dateLabel: "Aug 12", featured: false, thumb: "", description: "" },
    { id: "v5", title: "Weekly #11 top 8 bracket", tag: "SMASH ULTIMATE", url: "https://www.facebook.com/", duration: "1:12:30", dateLabel: "Aug 12", featured: false, thumb: "", description: "" },
    { id: "v6", title: "Inside the new practice room tour", tag: "CLUB LIFE", url: "https://www.facebook.com/", duration: "4:22", dateLabel: "Aug 8", featured: false, thumb: "", description: "" },
    { id: "v7", title: "Island Kings ladder run — week 2", tag: "HONOR OF KINGS", url: "https://www.facebook.com/", duration: "38:47", dateLabel: "Aug 6", featured: false, thumb: "", description: "" }
  ]
};
