const newsListEl = document.getElementById('news-list');
const communityRankingsListEl = document.getElementById('community-rankings-list');
const bigEventsListEl = document.getElementById('big-events-list');
const ukCsListEl = document.getElementById('uk-cs-list');
const matchesListEl = document.getElementById('matches-list');
const tier2ListEl = document.getElementById('tier2-list');
const resultsListEl = document.getElementById('results-list');
const egwTeamsListEl = document.getElementById('egw-teams-list');
const liquipediaTeamsListEl = document.getElementById('liquipedia-teams-list');
const refreshTimeEl = document.getElementById('refresh-time');
const statusEl = document.getElementById('hltv-status');

function renderList(targetEl, items, fallbackText) {
  targetEl.innerHTML = '';

  if (!Array.isArray(items) || items.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-text';
    li.textContent = fallbackText;
    targetEl.appendChild(li);
    return;
  }

  for (const item of items) {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = item.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const title = document.createElement('div');
    title.textContent = item.title || 'Open item';
    link.appendChild(title);

    if (item?.logos?.team1 || item?.logos?.team2) {
      const logos = document.createElement('div');
      logos.className = 'match-logo-row';
      if (item?.logos?.team1) {
        const img = document.createElement('img');
        img.src = item.logos.team1;
        img.alt = `${item?.teams?.team1 || 'Team 1'} logo`;
        img.className = 'team-logo';
        logos.appendChild(img);
      }
      if (item?.logos?.team2) {
        const img = document.createElement('img');
        img.src = item.logos.team2;
        img.alt = `${item?.teams?.team2 || 'Team 2'} logo`;
        img.className = 'team-logo';
        logos.appendChild(img);
      }
      link.appendChild(logos);
    }

    if (item?.start_date || item?.end_date) {
      const meta = document.createElement('small');
      meta.className = 'feed-meta';
      const start = formatDate(item.start_date);
      const end = formatDate(item.end_date);
      meta.textContent = `Starts: ${start} · Ends: ${end}`;
      link.appendChild(meta);
    }

    li.appendChild(link);
    targetEl.appendChild(li);
  }
}

function renderRankings(targetEl, items, fallbackText) {
  targetEl.innerHTML = '';
  if (!Array.isArray(items) || items.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-text';
    li.textContent = fallbackText;
    targetEl.appendChild(li);
    return;
  }

  for (const item of items) {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'ranking-link';
    const rank = document.createElement('span');
    rank.className = 'rank-badge';
    rank.textContent = `#${Number(item?.rank || 0)}`;
    const profileImage = document.createElement('img');
    profileImage.className = 'ranking-avatar';
    profileImage.src = item?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item?.title || 'Player')}&background=0f172a&color=ffffff&size=64`;
    profileImage.alt = `${item?.title || 'Player'} profile picture`;
    link.href = item.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.appendChild(rank);
    link.appendChild(profileImage);
    link.appendChild(document.createTextNode(item.title || 'Unknown team'));
    li.appendChild(link);
    targetEl.appendChild(li);
  }
}

function writeRefreshTime(isoString) {
  if (!isoString) {
    refreshTimeEl.textContent = 'Unknown';
    return;
  }

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    refreshTimeEl.textContent = 'Unknown';
    return;
  }

  refreshTimeEl.textContent = date.toLocaleString();
}

function formatDate(value) {
  if (!value) return 'TBC';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'TBC';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function loadHltvOverview() {
  statusEl.textContent = 'Loading';

  try {
    const response = await fetch('/api/hltv/overview', {
      method: 'GET',
      credentials: 'omit'
    });

    const data = await response.json();

    renderRankings(communityRankingsListEl, data?.sections?.community_rankings, 'No community rankings available right now.');
    renderList(newsListEl, data?.sections?.news, 'No HLTV news available right now.');
    renderList(bigEventsListEl, data?.sections?.big_events, 'No S tier events found right now.');
    renderList(ukCsListEl, data?.sections?.uk_cs_main_games, 'No UK CS matches found right now.');
    renderList(matchesListEl, data?.sections?.upcoming_matches, 'No upcoming matches found right now.');
    renderList(tier2ListEl, data?.sections?.tier2_matches, 'No tier 2 games found right now.');
    renderList(resultsListEl, data?.sections?.latest_results, 'No results available right now.');
    renderList(egwTeamsListEl, data?.sections?.egamersworld_teams, 'No EGamersWorld team feed available.');
    renderList(liquipediaTeamsListEl, data?.sections?.liquipedia_teams, 'No Liquipedia team feed available.');

    writeRefreshTime(data?.fetched_at);

    if (response.ok && data?.success) {
      statusEl.textContent = 'Live';
      return;
    }

    statusEl.textContent = 'Partial';
  } catch (error) {
    renderRankings(communityRankingsListEl, [], 'Could not connect to community ranking feeds.');
    renderList(newsListEl, [], 'Could not connect to HLTV feed.');
    renderList(bigEventsListEl, [], 'Could not connect to events feed.');
    renderList(ukCsListEl, [], 'Could not connect to UKIC feed.');
    renderList(matchesListEl, [], 'Could not connect to HLTV feed.');
    renderList(tier2ListEl, [], 'Could not connect to tier 2 feed.');
    renderList(resultsListEl, [], 'Could not connect to HLTV feed.');
    renderList(egwTeamsListEl, [], 'Could not connect to EGamersWorld feed.');
    renderList(liquipediaTeamsListEl, [], 'Could not connect to Liquipedia feed.');
    refreshTimeEl.textContent = 'Unavailable';
    statusEl.textContent = 'Offline';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadHltvOverview();
});
