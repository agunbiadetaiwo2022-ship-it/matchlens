
const NINJA_LEAGUES = [
  "epl",
  "laliga",
  "bundesliga",
  "seriea",
  "ligue1",
  "ucl",
  "uel",
  "uecl",
  "afcon",
  "mls"
];

const LEAGUE_NAMES = {
  epl: "Premier League",
  laliga: "La Liga",
  bundesliga: "Bundesliga",
  seriea: "Serie A",
  ligue1: "Ligue 1",
  ucl: "UEFA Champions League",
  uel: "UEFA Europa League",
  uecl: "UEFA Conference League",
  afcon: "Africa Cup of Nations",
  mls: "MLS"
};

function normalizeNinja(game) {
  const status = String(game.status || "scheduled").toLowerCase();

  let short = "NS";

  if (["live", "in_progress", "in progress"].includes(status)) {
    short = "LIVE";
  } else if (["finished", "final", "completed"].includes(status)) {
    short = "FT";
  } else if (["postponed"].includes(status)) {
    short = "PST";
  } else if (["cancelled", "canceled"].includes(status)) {
    short = "CANC";
  }

  return {
    fixture: {
      id: game.game_id,
      date: game.start_time,
      status: {
        short,
        long: status,
        elapsed: null
      },
      venue: {
        name: game.venue?.name || ""
      }
    },
    league: {
      id: game.league,
      name: LEAGUE_NAMES[game.league] || game.league,
      country: game.venue?.country || ""
    },
    teams: {
      home: {
        id: game.home_team?.team_id,
        name: game.home_team?.name || "Home",
        logo: null
      },
      away: {
        id: game.away_team?.team_id,
        name: game.away_team?.name || "Away",
        logo: null
      }
    },
    goals: {
      home: game.home_score ?? null,
      away: game.away_score ?? null
    },
    source: "API Ninjas"
  };
}

function matchKey(item) {
  const home = item.teams?.home?.name || "";
  const away = item.teams?.away?.name || "";
  const date = item.fixture?.date || "";

  return [
    date.slice(0, 10),
    home.toLowerCase().trim(),
    away.toLowerCase().trim()
  ].join("|");
}

export default async function handler(req, res) {
  const apiSportsKey = process.env.APISPORTS_KEY;
  const ninjaKey = process.env.NINJA_API_KEY;

  const lagosToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

  const date =
    typeof req.query.date === "string" && req.query.date.trim()
      ? req.query.date.trim()
      : lagosToday;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({
      error: "Date must use YYYY-MM-DD format."
    });
  }

  const tasks = [];

  if (apiSportsKey) {
    tasks.push(
      (async () => {
        const url = new URL(
          "https://v3.football.api-sports.io/fixtures"
        );

        url.searchParams.set("date", date);
        url.searchParams.set("timezone", "Africa/Lagos");

        const response = await fetch(url.toString(), {
          headers: {
            "x-apisports-key": apiSportsKey
          }
        });

        const data = await response.json();

        if (!response.ok || (
          data.errors && Object.keys(data.errors).length
        )) {
          throw new Error("API-Football request failed.");
        }

        return Array.isArray(data.response)
          ? data.response.map(item => ({
              ...item,
              source: "API-Football"
            }))
          : [];
      })()
    );
  }

  if (ninjaKey) {
    tasks.push(
      (async () => {
        const url = new URL(
          "https://api.api-ninjas.com/v1/soccermatches"
        );

        url.searchParams.set(
          "leagues",
          NINJA_LEAGUES.join(",")
        );

        url.searchParams.set("date", date);

        const response = await fetch(url.toString(), {
          headers: {
            "X-Api-Key": ninjaKey
          }
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error("API Ninjas request failed.");
        }

        return Array.isArray(data.fixtures)
          ? data.fixtures.map(normalizeNinja)
          : [];
      })()
    );
  }

  if (!tasks.length) {
    return res.status(500).json({
      error: "No football API keys are configured."
    });
  }

  const results = await Promise.allSettled(tasks);

  let apiFootballFixtures = [];
  let ninjaFixtures = [];
  const errors = [];

  let index = 0;

  if (apiSportsKey) {
    const result = results[index++];

    if (result.status === "fulfilled") {
      apiFootballFixtures = result.value;
    } else {
      errors.push("API-Football unavailable");
    }
  }

  if (ninjaKey) {
    const result = results[index++];

    if (result.status === "fulfilled") {
      ninjaFixtures = result.value;
    } else {
      errors.push("API Ninjas unavailable");
    }
  }

  if (
    apiFootballFixtures.length === 0 &&
    ninjaFixtures.length === 0 &&
    errors.length === tasks.length
  ) {
    return res.status(502).json({
      error: "Both football data providers failed.",
      details: errors
    });
  }

  const combined = [...apiFootballFixtures];
  const existing = new Set(combined.map(matchKey));

  for (const game of ninjaFixtures) {
    const key = matchKey(game);

    if (!existing.has(key)) {
      combined.push(game);
      existing.add(key);
    }
  }

  combined.sort((a, b) =>
    new Date(a.fixture?.date || 0) -
    new Date(b.fixture?.date || 0)
  );

  return res.status(200).json({
    date,
    results: combined,
    count: combined.length,
    providers: {
      apiFootball: apiFootballFixtures.length,
      apiNinjas: ninjaFixtures.length
    },
    errors
  });
}

