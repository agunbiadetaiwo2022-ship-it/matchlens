const dateField = document.querySelector("#match-date");
const list = document.querySelector("#match-list");
const statusLine = document.querySelector("#match-status");
const competitionFilter = document.querySelector("#competition-filter");
let allFixtures = [];

function lagosDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

function populateCompetitionFilter(items) {
  const current = competitionFilter.value || "all";
  const competitions = [...new Set(items.map(item => item.league?.name).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  competitionFilter.innerHTML = '<option value="all">All competitions</option>' +
    competitions.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join("");
  competitionFilter.value = competitions.includes(current) ? current : "all";
}

function render(items) {
  if (!items.length) {
    list.innerHTML = '<div class="empty-state">No fixtures match this competition for the selected date.</div>';
    return;
  }
  list.innerHTML = items.map(item => {
    const fixture = item.fixture || {};
    const teams = item.teams || {};
    const goals = item.goals || {};
    const status = fixture.status || {};
    const home = teams.home || {};
    const away = teams.away || {};
    const score = goals.home === null && goals.away === null
      ? "VS" : `${goals.home ?? "-"} – ${goals.away ?? "-"}`;
    const time = status.short === "NS"
      ? new Date(fixture.date).toLocaleTimeString("en-NG", {
          hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos"
        })
      : (status.elapsed ? `${status.elapsed}'` : (status.long || status.short || "Scheduled"));
    return `<article class="match-card">
      <div class="match-meta"><span>${esc(item.league?.name || "Competition")}</span><span>${esc(time)}</span></div>
      <div class="match-teams">
        <div class="team team-column">
          <div class="team-identity"><img src="${esc(home.logo || "")}" alt=""><span>${esc(home.name || "Home")}</span></div>
          <button class="form-button" data-team-id="${esc(home.id)}" data-team-name="${esc(home.name)}">Last 5 matches</button>
        </div>
        <strong class="match-score">${esc(score)}</strong>
        <div class="team team-column away">
          <div class="team-identity"><img src="${esc(away.logo || "")}" alt=""><span>${esc(away.name || "Away")}</span></div>
          <button class="form-button" data-team-id="${esc(away.id)}" data-team-name="${esc(away.name)}">Last 5 matches</button>
        </div>
      </div>
      <div class="match-meta"><span>${esc(fixture.venue?.name || "")}</span><span>${esc(status.long || "")}</span></div>
      <div class="form-panel" hidden></div>
    </article>`;
  }).join("");
}

function applyCompetitionFilter() {
  const selected = competitionFilter.value;
  const filtered = selected === "all"
    ? allFixtures
    : allFixtures.filter(item => item.league?.name === selected);
  render(filtered);
  const label = selected === "all" ? "all competitions" : selected;
  statusLine.textContent = `${filtered.length} fixtures · ${label} · Data from API-Football`;
}

async function showTeamForm(button) {
  const card = button.closest(".match-card");
  const panel = card.querySelector(".form-panel");
  const teamId = button.dataset.teamId;
  const teamName = button.dataset.teamName || "Team";
  if (!teamId || !/^\d+$/.test(teamId)) {
    panel.hidden = false;
    panel.textContent = "Team information is unavailable for this fixture.";
    return;
  }
  if (!panel.hidden && panel.dataset.teamId === teamId) {
    panel.hidden = true;
    return;
  }
  card.querySelectorAll(".form-button").forEach(item => item.classList.remove("active"));
  button.classList.add("active");
  panel.hidden = false;
  panel.dataset.teamId = teamId;
  panel.innerHTML = `<p class="form-loading">Loading ${esc(teamName)}'s recent results…</p>`;
  try {
    const response = await fetch(`/api/team-form?team=${encodeURIComponent(teamId)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load recent results.");
    const games = Array.isArray(data.results) ? data.results : [];
    if (!games.length) {
      panel.innerHTML = `<strong>${esc(teamName)} · Last 5 matches</strong><p class="muted">No recent completed matches were returned for this team.</p>`;
      return;
    }
    const rows = games.map(game => {
      const fixture = game.fixture || {};
      const teams = game.teams || {};
      const goals = game.goals || {};
      const isHome = Number(teams.home?.id) === Number(teamId);
      const opponent = isHome ? teams.away : teams.home;
      const scored = isHome ? goals.home : goals.away;
      const conceded = isHome ? goals.away : goals.home;
      let outcome = "D";
      if (scored > conceded) outcome = "W";
      if (scored < conceded) outcome = "L";
      const date = fixture.date ? new Date(fixture.date).toLocaleDateString("en-NG", {
        day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Lagos"
      }) : "";
      return `<div class="form-result">
        <span class="form-badge ${outcome.toLowerCase()}">${outcome}</span>
        <span class="form-opponent">${isHome ? "vs" : "@"} ${esc(opponent?.name || "Opponent")}</span>
        <strong>${esc(scored)} - ${esc(conceded)}</strong>
        <small>${esc(date)}</small>
      </div>`;
    }).join("");
    const wins = games.filter(game => {
      const isHome = Number(game.teams?.home?.id) === Number(teamId);
      return isHome ? game.goals?.home > game.goals?.away : game.goals?.away > game.goals?.home;
    }).length;
    const draws = games.filter(game => game.goals?.home === game.goals?.away).length;
    const losses = games.length - wins - draws;
    panel.innerHTML = `<div class="form-heading"><strong>${esc(teamName)} · Last ${games.length} completed matches</strong><span class="form-summary">${wins}W · ${draws}D · ${losses}L</span></div>${rows}<p class="form-footnote">Recent results across competitions, where available. W = win, D = draw, L = loss.</p>`;
  } catch (error) {
    panel.innerHTML = `<strong>${esc(teamName)} · Recent form</strong><p class="muted">${esc(error.message)} Check API-Football plan coverage or try again later.</p>`;
  }
}

async function loadMatches() {
  const date = dateField.value || lagosDate();
  statusLine.textContent = "Loading fixtures…";
  list.innerHTML = "";
  try {
    const response = await fetch(`/api/fixtures?date=${encodeURIComponent(date)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "API request failed");
    allFixtures = Array.isArray(data.results) ? data.results : [];
    populateCompetitionFilter(allFixtures);
    applyCompetitionFilter();
    if (!allFixtures.length) statusLine.textContent = "0 fixtures · Data from API-Football";
  } catch (error) {
    statusLine.textContent = "Fixtures could not be loaded.";
    list.innerHTML = `<div class="empty-state">${esc(error.message)}<br>Check the API key and your API-Football plan.</div>`;
  }
}

list.addEventListener("click", event => {
  const button = event.target.closest(".form-button");
  if (button) showTeamForm(button);
});
dateField.value = lagosDate();
document.querySelector("#load-matches").addEventListener("click", loadMatches);
competitionFilter.addEventListener("change", applyCompetitionFilter);
loadMatches();
