const newsListEl = document.getElementById('news-list');
const bigEventsListEl = document.getElementById('big-events-list');
const ukCsListEl = document.getElementById('uk-cs-list');
const matchesListEl = document.getElementById('matches-list');
const tier2ListEl = document.getElementById('tier2-list');
const resultsListEl = document.getElementById('results-list');
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
    link.textContent = item.title || 'Open item';
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

async function loadHltvOverview() {
  statusEl.textContent = 'Loading';

  try {
    const response = await fetch('/api/hltv/overview', {
      method: 'GET',
      credentials: 'omit'
    });

    const data = await response.json();

    renderList(newsListEl, data?.sections?.news, 'No HLTV news available right now.');
    renderList(bigEventsListEl, data?.sections?.big_events, 'No S tier events found right now.');
    renderList(ukCsListEl, data?.sections?.uk_cs_main_games, 'No UK CS matches found right now.');
    renderList(matchesListEl, data?.sections?.upcoming_matches, 'No upcoming matches found right now.');
    renderList(tier2ListEl, data?.sections?.tier2_matches, 'No tier 2 games found right now.');
    renderList(resultsListEl, data?.sections?.latest_results, 'No results available right now.');

    writeRefreshTime(data?.fetched_at);

    if (response.ok && data?.success) {
      statusEl.textContent = 'Live';
      return;
    }

    statusEl.textContent = 'Partial';
  } catch (error) {
    renderList(newsListEl, [], 'Could not connect to HLTV feed.');
    renderList(bigEventsListEl, [], 'Could not connect to events feed.');
    renderList(ukCsListEl, [], 'Could not connect to UKIC feed.');
    renderList(matchesListEl, [], 'Could not connect to HLTV feed.');
    renderList(tier2ListEl, [], 'Could not connect to tier 2 feed.');
    renderList(resultsListEl, [], 'Could not connect to HLTV feed.');
    refreshTimeEl.textContent = 'Unavailable';
    statusEl.textContent = 'Offline';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadHltvOverview();
});
