(function () {
  const state = { packs: [], profile: null, inventory: [], catalog: [], showcase: [], singleCardPrice: 0 };

  const $ = (id) => document.getElementById(id);
  const formatCoins = (coins) => `${(Number(coins || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GC`;
  const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));

  async function request(url, options) {
    const response = await fetch(url, { credentials: 'same-origin', ...options });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Request failed');
    return data;
  }

  async function loadSingleCardSettings() {
    const data = await request('/api/ygo/single/settings');
    state.singleCardPrice = Number(data.discounted_single_card_price_coins || data.single_card_price_coins || 0);
    const pill = $('single-card-price');
    if (pill) pill.textContent = `Price: ${formatCoins(state.singleCardPrice)}${Number(data.active_discount_percent || 0) > 0 ? ` (-${Number(data.active_discount_percent)}% event)` : ''}`;
  }

  function setTabs() {
    document.querySelectorAll('#ygo-tabs .tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#ygo-tabs .tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
        document.querySelectorAll('.ygo-panel').forEach((panel) => panel.classList.toggle('active', panel.id === `panel-${btn.dataset.tab}`));
      });
    });
  }

  function renderProfile() {
    const strip = $('ygo-profile-strip');
    const summary = $('inventory-summary');
    if (!state.profile) return;
    const stats = state.profile.stats;
    const html = [
      `<span class="mini-pill">Wallet: ${formatCoins(state.profile.wallet_balance)}</span>`,
      `<span class="mini-pill">Packs opened: ${stats.packs_opened}</span>`,
      `<span class="mini-pill">Collection value: ${formatCoins(stats.collection_value_coins)}</span>`,
      `<span class="mini-pill">Streak: ${stats.current_streak_days} day(s)</span>`
    ].join('');
    strip.innerHTML = html;
    summary.innerHTML = [
      `<span class="mini-pill">Cards owned: ${stats.cards_owned}</span>`,
      `<span class="mini-pill">Sell-back total: ${formatCoins(stats.sell_back_value_coins)}</span>`,
      `<span class="mini-pill">Ghost pulls: ${stats.ghost_pulls}</span>`
    ].join('');
  }

  function renderPacks() {
    $('pack-grid').innerHTML = state.packs.map((pack) => `
      <article class="pack-card">
        <img class="pack-cover" src="${escapeHtml(pack.cover_image_url)}" alt="${escapeHtml(pack.set_name)} cover" />
        <div class="action-row" style="justify-content:space-between;margin-top:12px">
          <span class="rarity-pill">${escapeHtml(pack.set_name)}</span>
          <span class="mini-pill">${pack.card_count} cards in pool</span>
        </div>
        <p style="margin:12px 0 8px">${escapeHtml(pack.description)}</p>
        <div class="price-line">${formatCoins(pack.discounted_pack_price_coins ?? pack.pack_price_coins)} per pack${Number(pack.active_discount_percent || 0) > 0 ? ` <span class="mini-pill">-${Number(pack.active_discount_percent)}%</span>` : ''}</div>
        <div class="foil-text">Guaranteed <strong>Rare</strong> every pack. Extra slots can upgrade into Super, Ultra, Ultimate, Secret, or Ghost Rare pulls.</div>
        <div class="pack-odds">
          ${pack.rarity_odds.map((odds) => `<div class="odds-row"><span>${escapeHtml(odds.label)}${odds.guaranteed ? ' slot' : ''}</span><strong>${odds.guaranteed ? 'Guaranteed' : `${odds.chance_percent}%`}</strong></div>`).join('')}
        </div>
        <div class="action-row">
          <button type="button" class="btn btn-primary open-pack-btn" data-pack="${escapeHtml(pack.slug)}">Open pack</button>
          <span class="mini-pill">YGOPRODeck set: ${escapeHtml(pack.ygoprodeck_set_id || 'custom')}</span>
        </div>
      </article>
    `).join('');

    document.querySelectorAll('.open-pack-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          const data = await request('/api/ygo/open', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pack_slug: button.dataset.pack }) });
          state.profile = data.profile;
          await Promise.all([loadInventory(), loadCatalog()]);
          renderProfile();
          renderInventory();
          renderCatalog();
          renderMissions();
          renderOpenResults(data);
          if (window.refreshGamblingWallet) window.refreshGamblingWallet();
        } catch (error) {
          alert(error.message);
        } finally {
          button.disabled = false;
        }
      });
    });
  }

  function rarityClass(code) { return `result-card ${code || 'common'}`; }

  function renderOpenResults(data) {
    $('open-modal-title').textContent = `${data.pack.set_name} results`;
    const bonus = $('open-bonus');
    if (data.bonus_coins_awarded > 0 || (data.achievements_unlocked || []).length) {
      bonus.classList.remove('hidden');
      bonus.innerHTML = `Bonus earned: <strong>${formatCoins(data.bonus_coins_awarded || 0)}</strong>${data.achievements_unlocked?.length ? ` · Achievement(s): ${data.achievements_unlocked.map((item) => escapeHtml(item.title)).join(', ')}` : ''}`;
    } else {
      bonus.classList.add('hidden');
      bonus.innerHTML = '';
    }
    $('open-results').innerHTML = data.pulls.map((card) => `
      <article class="${rarityClass(card.rarity_code)}">
        <img class="card-art" src="${escapeHtml(card.image_url)}" alt="${escapeHtml(card.card_name)}" />
        <div class="action-row" style="justify-content:space-between;margin:10px 0 8px">
          <span class="rarity-pill">${escapeHtml(card.rarity_label)}</span>
          <span class="mini-pill">${formatCoins(card.estimated_price_coins)}</span>
        </div>
        <h4 style="margin:0 0 8px">${escapeHtml(card.card_name)}</h4>
        <div class="foil-text">${escapeHtml(card.foil_label)}</div>
        <div class="detail-list">
          <div class="detail-row"><span>Type</span><strong>${escapeHtml(card.card_type || '—')}</strong></div>
          <div class="detail-row"><span>ATK / DEF</span><strong>${card.attack_points || 0} / ${card.defense_points || 0}</strong></div>
          <div class="detail-row"><span>Sell back</span><strong>${formatCoins(card.sell_back_coins)}</strong></div>
        </div>
      </article>
    `).join('');
    $('open-modal').classList.add('open');
  }

  function renderInventory() {
    const showcaseByCard = new Map((state.showcase || []).map((item) => [Number(item.inventory_id), Number(item.slot)]));
    $('inventory-grid').innerHTML = state.inventory.map((card) => {
      const assignedSlot = showcaseByCard.get(Number(card.id));
      return `
      <article class="ygo-card">
        <img class="card-art" src="${escapeHtml(card.image_url)}" alt="${escapeHtml(card.card_name)}" />
        <div class="action-row" style="justify-content:space-between;margin:10px 0 8px">
          <span class="rarity-pill">${escapeHtml(card.rarity_code.replace(/^./, (m) => m.toUpperCase()))}</span>
          <span class="mini-pill">${formatCoins(card.estimated_price_coins)}</span>
        </div>
        <h4 style="margin:0 0 8px">${escapeHtml(card.card_name)}</h4>
        <div class="foil-text">${escapeHtml(card.foil_label)}</div>
        <div class="detail-list">
          <div class="detail-row"><span>Pack</span><strong>${escapeHtml(card.pack_slug)}</strong></div>
          <div class="detail-row"><span>Sell back</span><strong>${formatCoins(card.sell_back_coins)}</strong></div>
        </div>
        <div class="action-row" style="align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <label class="mini-pill" style="display:flex;align-items:center;gap:8px">
            <span>🖤 Favorite slot</span>
            <select class="form-input" data-showcase-select="${card.id}" style="max-width:90px">
              <option value="">Pick</option>
              <option value="0" ${assignedSlot === 0 ? 'selected' : ''}>1</option>
              <option value="1" ${assignedSlot === 1 ? 'selected' : ''}>2</option>
              <option value="2" ${assignedSlot === 2 ? 'selected' : ''}>3</option>
              <option value="3" ${assignedSlot === 3 ? 'selected' : ''}>4</option>
              <option value="4" ${assignedSlot === 4 ? 'selected' : ''}>5</option>
            </select>
          </label>
          <div class="action-row">
            <button type="button" class="btn" data-showcase-clear="${card.id}">Clear favorite</button>
            <button type="button" class="btn sell-card-btn" data-id="${card.id}">Sell back</button>
          </div>
        </div>
      </article>
    `; }).join('') || '<p class="muted">No cards yet. Open a pack to start your binder.</p>';

    document.querySelectorAll('[data-showcase-select]').forEach((select) => {
      select.addEventListener('change', async () => {
        if (select.value === '') return;
        select.disabled = true;
        try {
          await request('/api/ygo/showcase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slot: Number(select.value), inventory_id: Number(select.dataset.showcaseSelect) }) });
          await loadInventory();
          renderInventory();
        } catch (error) {
          alert(error.message);
        } finally {
          select.disabled = false;
        }
      });
    });

    document.querySelectorAll('[data-showcase-clear]').forEach((button) => {
      button.addEventListener('click', async () => {
        const cardId = Number(button.dataset.showcaseClear);
        const active = (state.showcase || []).find((item) => Number(item.inventory_id) === cardId);
        if (!active) return;
        button.disabled = true;
        try {
          await request('/api/ygo/showcase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slot: Number(active.slot), inventory_id: 0 }) });
          await loadInventory();
          renderInventory();
        } catch (error) {
          alert(error.message);
        } finally {
          button.disabled = false;
        }
      });
    });

    document.querySelectorAll('.sell-card-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!confirm('Sell this card back for Grev Coins?')) return;
        button.disabled = true;
        try {
          const data = await request('/api/ygo/sell', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inventory_id: Number(button.dataset.id) }) });
          state.profile = data.profile;
          await loadInventory();
          renderProfile();
          renderInventory();
          renderMissions();
          if (window.refreshGamblingWallet) window.refreshGamblingWallet();
        } catch (error) {
          alert(error.message);
        } finally {
          button.disabled = false;
        }
      });
    });
  }

  function renderCatalog() {
    const packFilter = $('catalog-pack-filter');
    const previousPack = packFilter.value;
    const previousRarity = $('catalog-rarity-filter').value;
    packFilter.innerHTML = '<option value="">All packs</option>' + state.packs.map((pack) => `<option value="${escapeHtml(pack.slug)}">${escapeHtml(pack.set_name)}</option>`).join('');
    if ([...packFilter.options].some((option) => option.value === previousPack)) packFilter.value = previousPack;
    const selectedPack = packFilter.value;
    const selectedRarity = previousRarity;
    const cards = state.catalog.filter((card) => (!selectedPack || card.pack_slug === selectedPack) && (!selectedRarity || card.rarity_code === selectedRarity));
    $('catalog-grid').innerHTML = cards.map((card) => `
      <article class="ygo-card">
        <img class="card-art" src="${escapeHtml(card.image_url)}" alt="${escapeHtml(card.card_name)}" />
        <div class="action-row" style="justify-content:space-between;margin:10px 0 8px">
          <span class="rarity-pill">${escapeHtml(card.rarity_label)}</span>
          <span class="mini-pill">${formatCoins(card.estimated_price_coins)}</span>
        </div>
        <h4 style="margin:0 0 8px">${escapeHtml(card.card_name)}</h4>
        <div class="foil-text">${escapeHtml(card.foil_label)}</div>
        <div class="detail-list">
          <div class="detail-row"><span>Sell back</span><strong>${formatCoins(card.sell_back_coins)}</strong></div>
          <div class="detail-row"><span>Type</span><strong>${escapeHtml(card.card_type || '—')}</strong></div>
          <div class="detail-row"><span>Price note</span><strong>${escapeHtml(card.external_price_note || 'Fallback estimate')}</strong></div>
        </div>
        <div class="action-row"><a class="btn" target="_blank" rel="noreferrer" href="${escapeHtml(card.source_url || 'https://ygoprodeck.com')}">Source</a></div>
      </article>
    `).join('');
  }

  function renderMissions() {
    if (!state.profile) return;
    $('mission-grid').innerHTML = state.profile.missions.map((mission) => {
      const percent = Math.max(0, Math.min(100, (mission.progress / mission.target) * 100));
      return `
        <article class="mission-card">
          <h3 style="margin:0 0 8px">${escapeHtml(mission.title)}</h3>
          <p class="foil-text">${escapeHtml(mission.description)}</p>
          <div class="detail-row"><span>Reward</span><strong>${formatCoins(mission.reward_coins)}</strong></div>
          <div class="detail-row"><span>Progress</span><strong>${mission.progress}/${mission.target}</strong></div>
          <div class="progress"><span style="width:${percent}%"></span></div>
        </article>`;
    }).join('');
    $('achievement-grid').innerHTML = state.profile.achievements.map((achievement) => {
      const percent = Math.max(0, Math.min(100, (achievement.current_value / achievement.target_value) * 100));
      return `
        <article class="achievement-card">
          <h3 style="margin:0 0 8px">${escapeHtml(achievement.title)}</h3>
          <p class="foil-text">${escapeHtml(achievement.description)}</p>
          <div class="detail-row"><span>Reward</span><strong>${formatCoins(achievement.reward_coins)}</strong></div>
          <div class="detail-row"><span>Status</span><strong>${achievement.completed ? 'Claimed' : `${achievement.current_value}/${achievement.target_value}`}</strong></div>
          <div class="progress"><span style="width:${percent}%"></span></div>
        </article>`;
    }).join('');
  }

  async function loadInventory() {
    const data = await request('/api/ygo/inventory');
    state.inventory = data.inventory || [];
    state.showcase = data.showcase || [];
  }

  async function loadCatalog() {
    const data = await request('/api/ygo/catalog');
    state.catalog = data.cards || [];
  }

  async function boot() {
    setTabs();
    $('close-open-modal').addEventListener('click', () => $('open-modal').classList.remove('open'));
    $('open-single-card')?.addEventListener('click', async () => {
      const button = $('open-single-card');
      button.disabled = true;
      try {
        const data = await request('/api/ygo/single/open', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        state.profile = data.profile;
        await Promise.all([loadInventory(), loadCatalog(), loadSingleCardSettings()]);
        renderProfile();
        renderInventory();
        renderCatalog();
        renderMissions();
        renderOpenResults({
          pack: { set_name: 'Single-card opener' },
          bonus_coins_awarded: 0,
          achievements_unlocked: [],
          pulls: [data.pull]
        });
      } catch (error) {
        alert(error.message);
      } finally {
        button.disabled = false;
      }
    });
    $('catalog-pack-filter').addEventListener('change', renderCatalog);
    $('catalog-rarity-filter').addEventListener('change', renderCatalog);
    try {
      const [packsData, profileData] = await Promise.all([request('/api/ygo/packs'), request('/api/ygo/profile'), loadSingleCardSettings()]);
      state.packs = packsData.packs || [];
      state.profile = profileData.profile;
      await Promise.all([loadInventory(), loadCatalog()]);
      renderProfile();
      renderPacks();
      renderInventory();
      renderCatalog();
      renderMissions();
    } catch (error) {
      $('pack-grid').innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`;
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
