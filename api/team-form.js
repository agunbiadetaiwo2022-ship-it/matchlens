export default async function handler(req, res) {
  const apiKey = process.env.APISPORTS_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "Missing APISPORTS_KEY environment variable."
    });
  }

  const team = String(req.query.team || "").trim();

  if (!/^\d+$/.test(team)) {
    return res.status(400).json({
      error: "A numeric team ID is required."
    });
  }

  try {
    const apiUrl = new URL(
      "https://v3.football.api-sports.io/fixtures"
    );

    apiUrl.searchParams.set("team", team);
    apiUrl.searchParams.set("last", "5");
    apiUrl.searchParams.set("timezone", "Africa/Lagos");

    const response = await fetch(apiUrl.toString(), {
      method: "GET",
      headers: {
        "x-apisports-key": apiKey
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status
