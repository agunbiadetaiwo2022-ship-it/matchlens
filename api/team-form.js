export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    const apiKey = process.env.APISPORTS_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Football API key is not configured."
      });
    }

    const team = String(req.query?.team || "").trim();

    if (!/^\d+$/.test(team)) {
      return res.status(400).json({
        error: "A valid numeric team ID is required."
      });
    }

    const today = new Date();
    const fromDate = new Date(today);

    fromDate.setDate(fromDate.getDate() - 120);

    const formatDate = date =>
      date.toISOString().split("T")[0];

    const currentSeason = today.getFullYear();

    const apiUrl = new URL(
      "https://v3.football.api-sports.io/fixtures"
    );

    apiUrl.searchParams.set("team", team);
    apiUrl.searchParams.set("season", String(currentSeason));
    apiUrl.searchParams.set("from", formatDate(fromDate));
    apiUrl.searchParams.set("to", formatDate(today));
    apiUrl.searchParams.set("timezone", "Africa/Lagos");

    const response = await fetch(apiUrl.toString(), {
      method: "GET",
      headers: {
        "x-apisports-key": apiKey,
        "Accept": "application/json"
      }
    });

    const rawBody = await response.text();

    let data;

    try {
      data = JSON.parse(rawBody);
    } catch {
      return res.status(502).json({
        error: "Football provider returned an invalid response."
      });
    }

    if (!response.ok) {
      return res.status(502).json({
        error: "Football provider returned an error.",
        providerStatus: response.status,
        details: data.errors || null
      });
    }

    if (
      data.errors &&
      Object.keys(data.errors).length > 0
    ) {
      return res.status(502).json({
        error: "API-Football reported an issue.",
        details: data.errors
      });
    }

    const completed = (
      Array.isArray(data.response) ? data.response : []
    )
      .filter(match =>
        ["FT", "AET", "PEN"].includes(
          match.fixture?.status?.short
        )
      )
      .sort((a, b) =>
        new Date(b.fixture.date) -
        new Date(a.fixture.date)
      )
      .slice(0, 5);

    return res.status(200).json({
      team: Number(team),
      season: currentSeason,
      results: completed,
      count: completed.length,
      provider: "API-Football"
    });

  } catch (error) {
    console.error("[team-form] Error:", error);

    return res.status(500).json({
      error: "Team Form server error.",
      detail: error.message
    });
  }
        }
