export default async function handler(req, res) {
const apiKey = process.env.APISPORTS_KEY;

if (!apiKey) {
return res.status(500).json({
error: "Missing APISPORTS_KEY environment variable."
});
}

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

try {
const apiUrl = new URL(
"https://v3.football.api-sports.io/fixtures"
);

apiUrl.searchParams.set("date", date);
apiUrl.searchParams.set("timezone", "Africa/Lagos");

const response = await fetch(apiUrl.toString(), {
  method: "GET",
  headers: {
    "x-apisports-key": apiKey
  }
});

const data = await response.json();

if (!response.ok) {
  return res.status(response.status).json({
    error: "Football data provider returned an error.",
    details: data
  });
}

if (data.errors && Object.keys(data.errors).length > 0) {
  return res.status(502).json({
    error: "API-Football reported an issue.",
    details: data.errors
  });
}

return res.status(200).json({
  date,
  results: Array.isArray(data.response) ? data.response : [],
  count: Array.isArray(data.response) ? data.response.length : 0,
  provider: "API-Football"
});

} catch (error) {
return res.status(502).json({
error: "Could not reach the football data provider."
});
}
} 
