
const API_FOOTBALL_URL = "https://v3.football.api-sports.io/fixtures";
const API_NINJAS_URL = "https://api.api-ninjas.com/v1/soccermatches";

const LEAGUES = [
  "epl", "laliga", "bundesliga", "seriea", "ligue1",
  "ucl", "uel", "mls", "championship", "leagueone",
  "leaguetwo", "scottishpremiership", "laliga2",
  "bundesliga2", "serieb", "ligue2", "eredivisie",
  "primeiraliga", "superlig", "belgianproleague",
  "greeksuperleague", "austrianbundesliga",
  "danishsuperliga", "allsvenskan", "eliteserien",
  "rpl", "uecl", "brasileirao", "libertadores",
  "sudamericana", "uslc", "saudiproleague", "csl",
  "isl", "aleague", "acl", "cafcl", "ligamx",
  "ligaprofesional", "j1league", "facup", "eflcup",
  "copadelrey", "dfbpokal", "coppaitalia",
  "coupedefrance", "usopencup", "leaguescup",
  "concacafcc", "clubworldcup", "wsl", "ligaf",
  "premiereligue", "aleaguewomen", "nsl",
  "uslsuperleague", "uwcl", "worldcup", "wcqeurope",
  "wcqsouthamerica", "wcqnorthamerica", "wcqasia",
  "wcqafrica", "nationsleague", "euro",
  "euroqualifying", "copaamerica", "afcon"
];

function getLagosDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function normalizeNinja(game) {
  return {
    ...game,
    fixture_id: game.game_id,
    provider: "API Ninjas",
    home_name: game.home_team?.name || "",
    away_name: game.away_team?.name || "",
    home_team_name: game.home_team?.name || "",
    away_team_name: game.away_team?.name || "",
    home_score: game.home_score ?? null,
    away_score: game.away_score ?? null,
    date: game.date,
    start_time: game.start_time,
    league: game.league,
    status: game.status || "scheduled"
  };
}

function normalizeFootball(game) {
  const fixture = game.fixture || {};
  const teams = game.teams || {};
  const goals = game.goals || {};
  const league = game.league || {};

  return {
    fixture_id: fixture.id,
    provider: "API-Football",
    game_id: String(fixture.id),
    league: league.name || "",
    league_id: league.id,
    sport: "soccer",
    date: fixture.date?.slice(0, 10),
    start_time: fixture.date,
    timestamp: fixture.timestamp,
    status: fixture.status?.short || "",
    home_name: teams.home?.name || "",
    away_name: teams.away?.name || "",
    home_team_name: teams.home?.name || "",
    away_team_name: teams.away?.name || "",
    home_score: goals.home ?? null,
    away_score: goals.away ?? null,
    venue: fixture.venue?.name || "",
    round: league.round || ""
  };
}

function matchKey(item) {
  if (item.game_id && item.provider === "API Ninjas") {
    return item.game_id;
  }

  return [
    item.date,
    (item.home_name || "").toLowerCase().trim(),
    (item.away_name || "").toLowerCase().trim()
  ].join("-");
}

async function getNinjaFixtures(date) {
  const key = process.env.API_NINJAS_KEY;

  if (!key) {
    throw new Error("API_NINJAS_KEY is missing");
  }

  const results = [];
  const errors = [];

  // Five simultaneous requests at a time.
  for (let i = 0; i < LEAGUES.length; i += 5) {
    const batch = LEAGUES.slice(i, i + 5);

    const responses = await Promise.all(
      batch.map(async (league) => {
        try {
          const url = new URL(API_NINJAS_URL);
          url.searchParams.set("league", league);
          url.searchParams.set("date", date);

          const response = await fetch(url, {
            headers: {
              "X-Api-Key": key
            }
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(
              data.error || `HTTP ${response.status}`
            );
          }

          if (!Array.isArray(data)) {
            throw new Error("Invalid API Ninjas response");
          }

          return data.map(normalizeNinja);
        } catch (error) {
          errors.push({
            provider: "API Ninjas",
            league,
            error: error.message
          });

          return [];
        }
      })
    );

    for (const group of responses) {
      results.push(...group);
    }
  }

  return { results, errors };
}

async function getFootballFixtures(date) {
  const key = process.env.APISPORTS_KEY;

  if (!key) {
    throw new Error("APISPORTS_KEY is missing");
  }

  const url = new URL(API_FOOTBALL_URL);

  url.searchParams.set("date", date);
  url.searchParams.set("timezone", "Africa/Lagos");

  const response = await fetch(url, {
    headers: {
      "x-apisports-key": key
    }
  });

  const data = await response.json();

  if (!response.ok || data.errors &&
      Object.keys(data.errors).length > 0) {
    throw new Error(
      JSON.stringify(data.errors || data.message || "API-Football failed")
    );
  }

  return (data.response || []).map(normalizeFootball);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const date = req.query.date || getLagosDate();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({
      error: "Invalid date. Use YYYY-MM-DD"
    });
  }

  const results = [];
  const errors = [];
  const providers = [];

  // API-Football
  try {
    const football = await getFootballFixtures(date);
    results.push(...football);
    providers.push("API-Football");
  } catch (error) {
    errors.push({
      provider: "API-Football",
      error: error.message
    });
  }

  // API Ninjas
  try {
    const ninja = await getNinjaFixtures(date);
    results.push(...ninja.results);
    errors.push(...ninja.errors);

    if (ninja.results.length > 0) {
      providers.push("API Ninjas");
    }
  } catch (error) {
    errors.push({
      provider: "API Ninjas",
      error: error.message
    });
  }

  // Remove duplicates
  const unique = new Map();

  for (const fixture of results) {
    const key = matchKey(fixture);

    if (!unique.has(key)) {
      unique.set(key, fixture);
    }
  }

  const finalResults = [...unique.values()].sort(
    (a, b) => {
      const timeA = new Date(
        a.start_time || a.date
      ).getTime();

      const timeB = new Date(
        b.start_time || b.date
      ).getTime();

      return timeA - timeB;
    }
  );

  return res.status(200).json({
    date,
    count: finalResults.length,
    results: finalResults,
    providers,
    errors
  });
}


