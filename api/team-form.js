export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      error: "Method not allowed. Use GET."
    });
  }

  try {
    const apiKey = process.env.APISPORTS_KEY;

    if (!apiKey) {
      console.error("[team-form] Missing APISPORTS_KEY");

      return res.status(500).json({
        error: "Football API key is not configured."
      });
    }

    let team = "";

    if (req.query && req.query.team !== undefined) {
      team = String(req.query.team).trim();
    } else {
      const requestUrl = new URL(
        req.url || "/",
        "https://matchlens.local"
      );

      team = String(
        requestUrl.searchParams.get("team") || ""
      ).trim();
    }

    if (!/^\d+$/.test(team)) {
      return res.status(400).json({
        error: "A numeric team ID is required."
      });
    }

    const apiUrl = new URL(
      "https://v3.football.api-sports.io/fixtures"
    );

    apiUrl.searchParams.set("team", team);
    apiUrl.searchParams.set("last", "5");
    apiUrl.searchParams.set("timezone", "Africa/Lagos");

    const upstream = await fetch(apiUrl.toString(), {
      method: "GET",
      headers: {
        "x-apisports-key": apiKey,
        "Accept": "application/json"
      }
    });

    const rawBody = await upstream.text();

    let data;

    try {
      data = JSON.parse(rawBody);
    } catch (error) {
      console.error(
        "[team-form] Invalid provider response:",
        rawBody.slice(0, 300)
      );

      return res.status(502).json({
        error: "Football provider returned an unreadable response.",
        providerStatus: upstream.status
      });
    }

    if (!upstream.ok) {
      console.error(
        "[team-form] Provider HTTP error:",
        upstream.status,
        data.errors
      );

      return res.status(502).json({
        error: "Football provider returned an error.",
        providerStatus: upstream.status,
        details: data.errors || null
      });
    }

    if (
      data.errors &&
      Object.keys(data.errors).length > 0
    ) {
      console.error(
        "[team-form] API-Football errors:",
        data.errors
      );

      return res.status(502).json({
        error: "API-Football reported an issue.",
        details: data.errors
      });
    }

    const fixtures = Array.isArray(data.response)
      ? data.response
      : [];

    const completed = fixtures
      .filter(item =>
        item &&
        item.fixture &&
        item.fixture.status &&
        ["FT", "AET", "PEN"].includes(
          item.fixture.status.short
        )
      )
      .sort((a, b) =>
        new Date(b.fixture.date).getTime() -
        new Date(a.fixture.date).getTime()
      )
      .slice(0, 5);

    return res.status(200).json({
      team: Number(team),
      results: completed,
      count: completed.length,
      provider: "API-Football"
    });

  } catch (error) {
    console.error(
      "[team-form] Unexpected error:",
      error
    );

    return res.status(500).json({
      error: "Team Form service encountered a server error.",
      detail: error && error.message
        ? error.message
        : "Unknown server error"
    });
  }
        }
