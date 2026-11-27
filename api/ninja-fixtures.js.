
export default async function handler(req, res) {
  const apiKey = process.env.NINJA_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "NINJA_API_KEY is missing."
    });
  }

  const league = req.query.league || "epl";
  const date = req.query.date;

  const allowed = [
    "epl", "laliga", "bundesliga", "seriea",
    "ligue1", "ucl", "uel", "uecl", "afcon",
    "brasileirao", "eredivisie", "primeiraliga",
    "saudiproleague", "mls", "championship"
  ];

  if (!allowed.includes(league)) {
    return res.status(400).json({
      error: "Unsupported competition."
    });
  }

  try {
    const url = new URL(
      "https://api.api-ninjas.com/v1/soccermatches"
    );

    url.searchParams.set("league", league);

    if (date) url.searchParams.set("date", date);

    const response = await fetch(url, {
      headers: { "X-Api-Key": apiKey }
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "API Ninjas request failed.",
        details: data
      });
    }

    return res.status(200).json({
      provider: "API Ninjas",
      league,
      count: Array.isArray(data) ? data.length : 0,
      fixtures: data
    });

  } catch (error) {
    return res.status(502).json({
      error: "Could not reach API Ninjas."
    });
  }
}
