
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
  "euroqualifying", "copaamerica", "afcon",
  "asiancup", "goldcup", "concacafnationsleague",
  "friendlies", "womensworldcup", "womenseuro"
];

export default async function handler(req, res) {
  const apiKey = process.env.NINJA_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "NINJA_API_KEY is missing."
    });
  }

  const requested = req.query.leagues
    ? String(req.query.leagues).split(",")
    : [String(req.query.league || "epl")];

  const selected = [
    ...new Set(requested.map(x => x.trim().toLowerCase()))
  ];

  if (
    selected.length === 0 ||
    selected.length > 10 ||
    selected.some(x => !LEAGUES.includes(x))
  ) {
    return res.status(400).json({
      error: "Choose 1 to 10 supported competitions per request.",
      max_competitions: 10,
      supported_competitions: LEAGUES
    });
  }

  const date = req.query.date
    ? String(req.query.date)
    : null;

  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({
      error: "Date must use YYYY-MM-DD format."
    });
  }

  const fixtures = [];
  const errors = [];

  try {
    // Process in small batches to avoid overwhelming the provider.
    for (let i = 0; i < selected.length; i += 5) {
      const batch = selected.slice(i, i + 5);

      const results = await Promise.all(
        batch.map(async league => {
          const url = new URL(
            "https://api.api-ninjas.com/v1/soccermatches"
          );

          url.searchParams.set("league", league);

          if (date) {
            url.searchParams.set("date", date);
          }

          const response = await fetch(url.toString(), {
            headers: {
              "X-Api-Key": apiKey
            }
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(
              `Provider returned HTTP ${response.status}`
            );
          }

          if (!Array.isArray(data)) {
            throw new Error("Unexpected provider response.");
          }

          return { league, data };
        }).map(p =>
          p.then(
            value => ({ success: true, value }),
            error => ({ success: false, error })
          )
        )
      );

      for (const result of results) {
        if (result.success) {
          fixtures.push(...result.value.data);
        } else {
          errors.push({
            error: result.error.message
          });
        }
      }
    }

    if (fixtures.length === 0 && errors.length > 0) {
      return res.status(502).json({
        error: "All competition requests failed.",
        errors
      });
    }

    return res.status(200).json({
      provider: "API Ninjas",
      competitions_requested: selected,
      competitions_count: selected.length,
      count: fixtures.length,
      fixtures,
      errors
    });

  } catch (error) {
    return res.status(502).json({
      error: "Could not reach API Ninjas.",
      details: error.message
    });
  }
      }
                
