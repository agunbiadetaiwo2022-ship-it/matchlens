
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const apiKey = process.env.APISPORTS_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Football API key is not configured."
      });
    }

    const team = String(req.query?.team || "").trim();
    const season = Number(req.query?.season) || 2026;

    if (!/^\d+$/.test(team) || !Number.isInteger(season)) {
      return res.status(400).json({
        error: "Valid team ID and season are required."
      });
    }

    const today = new Date();
    const fromDate = new Date(today);
    fromDate.setDate(fromDate.getDate() - 120);

    const formatDate = date =>
      date.toISOString().split("T")[0];

    const apiUrl = new URL(
      "https://v3.football.api-sports.io/fixtures"
    );

    apiUrl.searchParams.set("team", team);
    apiUrl.searchParams.set("season", String(season));
    apiUrl.searchParams.set("from", formatDate(fromDate));
    apiUrl.searchParams.set("to", formatDate(today));
    apiUrl.searchParams.set("timezone", "Africa/Lagos");

    const response = await fetch(apiUrl.toString(), {
      headers: {
        "x-apisports-key": apiKey
      }
    });

    const rawBody = await response.text();
    const data = JSON.parse(rawBody);

    if (!response.ok || Object.keys(data.errors || {}).length) {
      console.error("[team-form] Provider error:", data.errors);

      return res.status(502).json({
        error: "API-Football request failed.",
        providerStatus: response.status,
        details: data.errors || null
      });
    }

    const completed = (
      Array.isArray(data.response) ? data.response : []
    )
      .filter(match => {
        const status = match.fixture?.status?.short;
        const competition = match.league?.name || "";

        return (
          ["FT", "AET", "PEN"].includes(status) &&
          !/friendly/i.test(competition)
        );
      })
      .sort((a, b) =>
        new Date(b.fixture.date) - new Date(a.fixture.date)
      )
      .slice(0, 5);

    return res.status(200).json({
      team: Number(team),
      season,
      results: completed,
      count: completed.length,
      provider: "API-Football",
      competitions: [
        ...new Set(completed.map(match => match.league?.name))
      ]
    });

  } catch (error) {
    console.error("[team-form] Error:", error);

    return res.status(500).json({
      error: "Team Form server error.",
      detail: error.message
    });
  }
  }
      
