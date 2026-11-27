
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

    const apiUrl = new URL(
      "https://v3.football.api-sports.io/fixtures"
    );

    apiUrl.searchParams.set("team", team);
    apiUrl.searchParams.set("from", formatDate(fromDate));
    apiUrl.searchParams.set("to", formatDate(today));
    apiUrl.searchParams.set("timezone", "Africa/Lagos");

    const response = await fetch(apiUrl.toString(), {
      method: "GET",
      headers: {
        "x-apisports-key": apiKey
      }
    });

    const rawBody = await response.text();

    let data;

    try {
      data = JSON.parse(rawBody);
    } catch {
      console.error("[team-form] Invalid API response:", rawBody);

      return res.status(502).json({
        error: "Football provider returned an invalid response."
      });
    }

    if (!response.ok || Object.keys(data.errors || {}).length > 0) {
      console.error("[team-form] API-Football error:", {
        status: response.status,
        errors: data.errors,
        team
      });

      return res.status(502).json({
        error: "API-Football request failed.",
        providerStatus: response.status,
        details: data.errors || null
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
      results: completed,
      count: completed.length,
      provider: "API-Football",
      dateRange: {
        from: formatDate(fromDate),
        to: formatDate(today)
      }
    });

  } catch (error) {
    console.error("[team-form] Server error:", error);

    return res.status(500).json({
      error: "Team Form server error.",
      detail: error.message
    });
  }
}
