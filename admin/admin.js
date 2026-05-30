marked.use({
  gfm: true,
  breaks: true,
  renderer: { html() { return ''; } },
});

document.addEventListener('DOMContentLoaded', () => {
  // ── DOM refs ───────────────────────────────────────────────────────────
  const authSection     = document.getElementById('auth-section');
  const viewRaces       = document.getElementById('view-races');
  const viewDetail      = document.getElementById('view-detail');
  const loginForm       = document.getElementById('login-form');
  const authError       = document.getElementById('auth-error');

  const modal       = document.getElementById('participant-modal');
  const modalTitle  = document.getElementById('modal-title');
  const raceModal   = document.getElementById('race-modal');

  let racesData           = [];
  let allCategoriesData   = [];
  let currentParticipantId = null;
  let currentRaceId       = null;
  let activeFilter        = 'all';
  let searchQuery         = '';

  // ── Auth ───────────────────────────────────────────────────────────────
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.style.display = 'none';
    authError.textContent = '';

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    if (!username || !password) {
      authError.textContent = 'Заполните все поля';
      authError.style.display = 'block';
      return;
    }

    try {
      const res = await fetch('../api/admin/_auth.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username, password }),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        authSection.style.display = 'none';
        const whoEl = document.getElementById('admin-who');
        if (whoEl) whoEl.textContent = username;
        await fetchAdminData();
      } else {
        authError.textContent = result.error || 'Ошибка авторизации';
        authError.style.display = 'block';
      }
    } catch {
      authError.textContent = 'Сетевая ошибка. Проверьте подключение.';
      authError.style.display = 'block';
    }
  });

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    try {
      await fetch('../api/admin/_auth.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'action=logout',
      });
    } catch {}
    location.reload();
  });

  // ── Data loading ───────────────────────────────────────────────────────
  async function fetchAdminData(keepView) {
    try {
      const res = await fetch('../api/admin/dashboard.php');
      const result = await res.json();
      if (res.ok && result.success) {
        allCategoriesData = result.all_categories || [];
        racesData = result.races;
        updateRaceGrid();
        if (!keepView) navigateFromHash();
      } else if (res.status === 401) {
        showAuthForm();
      }
    } catch (err) {
      console.error('Data fetch error:', err);
    }
  }

  function showAuthForm() {
    authSection.style.display = 'flex';
    viewRaces.style.display = 'none';
    viewDetail.style.display = 'none';
  }

  // ── View routing ───────────────────────────────────────────────────────
  function showView(name, raceId) {
    viewRaces.style.display   = name === 'races'  ? '' : 'none';
    viewDetail.style.display  = name === 'detail' ? '' : 'none';
    authSection.style.display = 'none';

    if (name === 'races') {
      history.pushState(null, '', '#races');
    } else if (name === 'detail' && raceId) {
      history.pushState(null, '', `#race-${raceId}`);
      renderRaceDetail(raceId);
    }
  }

  function navigateFromHash() {
    const hash = location.hash;
    if (hash.startsWith('#race-')) {
      const id = parseInt(hash.slice(6), 10);
      if (racesData.find(r => r.id === id)) {
        showView('detail', id);
        return;
      }
    }
    showView('races');
  }

  window.addEventListener('popstate', () => navigateFromHash());

  // ── Race Grid ──────────────────────────────────────────────────────────
  function getRaceStatus(race) {
    if (race.is_finished == 1) return 'done';
    if (race.is_active == 1 && race.registration_open == 1) return 'open';
    if (race.is_active == 1 && race.registration_open == 0) return 'closed';
    return 'draft';
  }

  const STATUS_LABELS = {
    open:   'Открыта регистрация',
    closed: 'Регистрация закрыта',
    done:   'Завершена',
    draft:  'Не активна',
  };

  function matchesFilter(race) {
    const status = getRaceStatus(race);
    if (activeFilter === 'all')    return true;
    if (activeFilter === 'open')   return status === 'open';
    if (activeFilter === 'closed') return status === 'closed';
    if (activeFilter === 'done')   return status === 'done';
    return true;
  }

  function matchesSearch(race) {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (race.race_name || '').toLowerCase().includes(q) ||
           (race.location  || '').toLowerCase().includes(q);
  }

  function updateRaceGrid() {
    const grid = document.getElementById('race-grid');
    if (!grid) return;
    const filtered = racesData.filter(r => matchesFilter(r) && matchesSearch(r));
    grid.innerHTML = '';

    if (!filtered.length) {
      const msg = document.createElement('div');
      msg.className = 'empty-state';
      msg.textContent = 'Нет гонок по выбранным критериям';
      grid.appendChild(msg);
      return;
    }

    filtered.forEach(race => {
      const tile = buildTile(race);
      grid.appendChild(tile);
    });

    // Обновляем счётчик
    const titleEl = document.getElementById('races-page-title');
    if (titleEl) titleEl.textContent = `Гонки · ${racesData.length}`;
  }

  function buildTile(race) {
    const status = getRaceStatus(race);
    const tile = document.createElement('div');
    tile.className = `tile ${status === 'done' ? 'is-done' : ''} ${status === 'draft' ? 'is-draft' : ''}`.trim();
    tile.dataset.raceId = race.id;

    const dateText = formatShortDate(race.date);
    const paid  = race.participants.filter(p => p.is_paid == 1).length;
    const total = parseInt(race.participants_count, 10);

    tile.innerHTML = `
      <div class="tile-top">
        <span class="status ${status}">${STATUS_LABELS[status]}</span>
        <span class="when">${dateText}</span>
      </div>
      <h3 class="tile-name">${escapeHtml(race.race_name)}</h3>
      <p class="tile-where">${escapeHtml(race.location || '—')}</p>
      <div class="tile-reg">
        <span class="tile-num">${total}</span>
        <span class="tile-lbl">регистраций · ${paid} оплачено</span>
      </div>
      <div class="tile-cats">
        ${race.categories.map(c => `<span class="cat">${escapeHtml(c.category_name)}</span>`).join('')}
      </div>
    `;

    tile.addEventListener('click', () => showView('detail', race.id));
    return tile;
  }

  // Фильтры
  document.getElementById('race-filters')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter');
    if (!btn) return;
    activeFilter = btn.dataset.f;
    document.querySelectorAll('#race-filters .filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateRaceGrid();
  });

  // Поиск
  document.getElementById('race-search')?.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    updateRaceGrid();
  });

  // ── Race Detail ────────────────────────────────────────────────────────
  function renderRaceDetail(raceId) {
    currentRaceId = raceId;
    const race = racesData.find(r => r.id === raceId);
    if (!race) { showView('races'); return; }

    const container = document.getElementById('race-detail-content');
    container.innerHTML = '';

    const status = getRaceStatus(race);
    const total  = race.participants.length;
    const paid   = race.participants.filter(p => p.is_paid == 1).length;
    const revenue = race.participants
      .filter(p => p.is_paid == 1)
      .reduce((s, p) => s + (parseFloat(p.payment_amount) || 0), 0);
    const daysTo = daysUntil(race.date);

    // Подсчёт по категориям
    const catCounts = {};
    race.participants.forEach(p => {
      const cn = p.category_name || '—';
      catCounts[cn] = (catCounts[cn] || 0) + 1;
    });

    container.innerHTML = `
      <!-- Action bar -->
      <div class="rd-bar">
        <nav class="rd-crumbs">
          <a class="rd-back" href="#races">Гонки</a>
          <span class="rd-sep"> / </span>
          <b>${escapeHtml(race.race_name)}</b>
        </nav>
        <span class="rd-status ${status}">${STATUS_LABELS[status]}</span>
        <div class="rd-spacer"></div>
        <div class="rd-actions">
          <a class="rd-action" href="/?race_id=${race.id}" target="_blank" rel="noopener">На сайт</a>
          <button class="rd-action" data-export="${race.id}">Экспорт CSV</button>
          ${race.is_active != 1 && race.is_finished != 1
            ? `<button class="rd-action rd-action-danger" data-delete="${race.id}">Удалить</button>`
            : ''}
          <button class="rd-action rd-action-primary" data-edit="${race.id}">Редактировать</button>
        </div>
      </div>

      <!-- Hero: title + KPI -->
      <div class="rd-hero">
        <div class="rd-title">
          <h2>${escapeHtml(race.race_name)}</h2>
          <div class="rd-meta">
            <span><b>Дата</b> ${formatShortDate(race.date)}</span>
            ${race.location ? `<span class="rd-sep">·</span><span><b>Место</b> ${escapeHtml(race.location)}</span>` : ''}
          </div>
          <div class="rd-toggles">
            <label class="reg-toggle">
              <input type="checkbox" class="toggle-open" data-race-id="${race.id}" ${race.registration_open == 1 ? 'checked' : ''} />
              <span>Регистрация открыта</span>
            </label>
            <label class="reg-toggle">
              <input type="checkbox" class="toggle-active" data-race-id="${race.id}" ${race.is_active == 1 ? 'checked' : ''} />
              <span>Активная</span>
            </label>
            <label class="reg-toggle">
              <input type="checkbox" class="toggle-finished" data-race-id="${race.id}" ${race.is_finished == 1 ? 'checked' : ''} />
              <span>Завершена</span>
            </label>
          </div>
        </div>
        <div class="rd-kpis">
          <div class="kpi"><p class="kpi-label">Зарегистрировано</p><span class="kpi-val">${total}</span></div>
          <div class="kpi"><p class="kpi-label">Оплачено</p><span class="kpi-val">${paid}</span><span class="kpi-sub">${total > 0 ? Math.round(paid / total * 100) : 0}%</span></div>
          <div class="kpi"><p class="kpi-label">Сбор</p><span class="kpi-val kpi-accent">${Math.round(revenue)}</span><span class="kpi-sub">руб.</span></div>
          <div class="kpi"><p class="kpi-label">До старта</p><span class="kpi-val">${daysTo !== null ? daysTo : '—'}</span><span class="kpi-sub">${daysTo !== null ? 'дней' : ''}</span></div>
        </div>
      </div>

      <!-- Categories -->
      <div class="rd-cats">
        <h3 class="rd-h">Категории · ${race.categories.length}</h3>
        <div class="rd-cat-grid">
          ${race.categories.map(c => {
            const cnt = catCounts[c.category_name] || 0;
            return `<div class="rd-cat"><span class="rd-cat-name">${escapeHtml(c.category_name)}</span><span class="rd-cat-count">${cnt}<small>чел.</small></span></div>`;
          }).join('')}
        </div>
      </div>

      <!-- Participants table -->
      <div class="rd-participants">
        <h3 class="rd-h">Участники · ${total}</h3>
        <div class="admin-table-container">
          <table class="admin-table" id="detail-participants-table">
            <thead>
              <tr>
                <th>Действия</th>
                <th>Фамилия Имя</th>
                <th>Телефон</th>
                <th>Email</th>
                <th>Город</th>
                <th>Категория</th>
                <th>Оплата</th>
                <th>Сумма</th>
                <th>Дата рег.</th>
              </tr>
            </thead>
            <tbody id="detail-tbody"></tbody>
          </table>
        </div>
      </div>
    `;

    // Рендер таблицы участников
    renderDetailParticipants(race);

    // Биндинг действий
    container.querySelector('[data-back]')?.addEventListener('click', () => showView('races'));
    container.querySelector('.rd-back')?.addEventListener('click', (e) => {
      e.preventDefault(); showView('races');
    });

    container.querySelector(`[data-export="${race.id}"]`)?.addEventListener('click', () => {
      window.location.href = `../api/admin/export_csv.php?race_id=${race.id}`;
    });

    container.querySelector(`[data-edit="${race.id}"]`)?.addEventListener('click', () => {
      openRaceEditModal(race);
    });

    container.querySelector(`[data-delete="${race.id}"]`)?.addEventListener('click', async () => {
      const ok = confirm(
        `Удалить гонку «${race.race_name}»?\n\n` +
        `Все данные о гонке и её участниках будут безвозвратно удалены.\n\n` +
        `Это действие нельзя отменить.`
      );
      if (!ok) return;
      try {
        const res = await fetch('../api/admin/race_delete.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ race_id: race.id }),
          credentials: 'same-origin',
        });
        const result = await res.json();
        if (res.ok && result.success) {
          await fetchAdminData();
        } else {
          alert(result.error || 'Ошибка удаления');
        }
      } catch { alert('Сетевая ошибка'); }
    });

    // Тогглы
    container.querySelector('.toggle-open')?.addEventListener('change', async (e) => {
      await updateRaceField(race.id, 'registration_open', e.target.checked ? 1 : 0);
    });
    container.querySelector('.toggle-active')?.addEventListener('change', async (e) => {
      await updateRaceField(race.id, 'is_active', e.target.checked ? 1 : 0);
    });
    container.querySelector('.toggle-finished')?.addEventListener('change', async (e) => {
      await updateRaceField(race.id, 'is_finished', e.target.checked ? 1 : 0);
    });
  }

  function renderDetailParticipants(race) {
    const tbody = document.getElementById('detail-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!race.participants.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="9" class="no-data">Участников пока нет</td>`;
      tbody.appendChild(tr);
      return;
    }

    race.participants.forEach(p => {
      const tr = document.createElement('tr');
      const dateStr = p.created_at ? p.created_at.slice(0, 10) : '—';
      tr.innerHTML = `
        <td><button class="edit-btn" data-pid="${p.id}" data-rid="${race.id}">Изм.</button></td>
        <td>${escapeHtml(p.last_name)} ${escapeHtml(p.first_name)}</td>
        <td>${escapeHtml(p.phone || '—')}</td>
        <td>${escapeHtml(p.email || '—')}</td>
        <td>${escapeHtml(p.city || '—')}</td>
        <td>${escapeHtml(p.category_name || '—')}</td>
        <td><span class="paid-dot ${p.is_paid == 1 ? '' : 'unpaid'}"></span></td>
        <td>${p.payment_amount != null ? parseFloat(p.payment_amount).toFixed(0) + ' ₽' : '—'}</td>
        <td>${dateStr}</td>
      `;
      tr.querySelector('.edit-btn').addEventListener('click', () => {
        openParticipantEdit(p.id, race.id);
      });
      tbody.appendChild(tr);
    });
  }

  async function updateRaceField(raceId, field, value) {
    try {
      const res = await fetch('../api/admin/race_update.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: raceId, [field]: value }),
        credentials: 'same-origin',
      });
      const result = await res.json();
      if (res.ok && result.success) {
        const race = racesData.find(r => r.id === raceId);
        if (race) race[field] = value;
        updateRaceGrid();
      } else {
        alert(result.error || 'Ошибка обновления');
      }
    } catch {
      alert('Сетевая ошибка');
    }
  }

  // ── Participant Edit Modal ─────────────────────────────────────────────
  async function openParticipantEdit(participantId, raceId) {
    currentParticipantId = parseInt(participantId);
    currentRaceId = parseInt(raceId);

    try {
      const res = await fetch(`../api/admin/participant/get.php?id=${participantId}`, {
        credentials: 'same-origin',
      });
      if (!res.ok) { alert(`Ошибка сервера: ${res.status}`); return; }
      const result = await res.json();

      if (result.success) {
        const p = result.participant;
        document.getElementById('participant-id').value = p.id;
        document.getElementById('last-name').value   = p.last_name;
        document.getElementById('first-name').value  = p.first_name;
        document.getElementById('middle-name').value = p.middle_name || '';
        document.getElementById('birth-date').value  = p.birth_date || '';
        document.getElementById('phone').value        = p.phone || '';
        document.getElementById('email').value        = p.email || '';
        document.getElementById('city').value         = p.city || '';
        document.getElementById('team').value         = p.team || '';
        document.getElementById('is-paid').checked    = !!p.is_paid;
        document.getElementById('payment-amount').value = p.payment_amount || '';

        const sel = document.getElementById('category-id');
        sel.innerHTML = '<option value="">Выберите категорию</option>';
        result.categories.forEach(cat => {
          const opt = document.createElement('option');
          opt.value = cat.race_category_id;
          opt.textContent = cat.name;
          if (cat.race_category_id === p.race_category_id) opt.selected = true;
          sel.appendChild(opt);
        });

        modalTitle.textContent = `${p.last_name} ${p.first_name}`;
        modal.style.display = 'flex';
      } else {
        alert(result.error || 'Ошибка загрузки');
      }
    } catch {
      alert('Сетевая ошибка');
    }
  }

  function closeParticipantEdit() {
    modal.style.display = 'none';
    currentParticipantId = null;
  }

  document.querySelector('#participant-modal .close-btn')?.addEventListener('click', closeParticipantEdit);
  document.querySelector('#participant-modal .btn-cancel')?.addEventListener('click', closeParticipantEdit);
  modal?.addEventListener('click', e => { if (e.target === modal) closeParticipantEdit(); });

  document.getElementById('participant-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = {
      id:               parseInt(document.getElementById('participant-id').value),
      last_name:        document.getElementById('last-name').value.trim(),
      first_name:       document.getElementById('first-name').value.trim(),
      middle_name:      document.getElementById('middle-name').value.trim(),
      birth_date:       document.getElementById('birth-date').value || null,
      phone:            document.getElementById('phone').value.trim(),
      email:            document.getElementById('email').value.trim(),
      city:             document.getElementById('city').value.trim(),
      team:             document.getElementById('team').value.trim(),
      race_category_id: document.getElementById('category-id').value
        ? parseInt(document.getElementById('category-id').value) : null,
      is_paid:          document.getElementById('is-paid').checked ? '1' : '0',
      payment_amount:   document.getElementById('payment-amount').value,
      race_id:          currentRaceId,
    };

    if (!formData.race_category_id) { alert('Выберите категорию'); return; }

    try {
      const res = await fetch('../api/admin/participant/update.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'same-origin',
      });
      const result = await res.json();
      if (res.ok && result.success) {
        closeParticipantEdit();
        await fetchAdminData(true);
        if (currentRaceId) renderRaceDetail(currentRaceId);
      } else {
        alert(result.error || 'Ошибка обновления данных');
      }
    } catch {
      alert('Сетевая ошибка');
    }
  });

  // ── Race Edit Modal ────────────────────────────────────────────────────
  const raceCloseBtn  = document.getElementById('race-close-btn');
  const raceCancelBtn = document.getElementById('race-cancel-btn');
  const raceForm      = document.getElementById('race-form');
  const tplBannerImg  = document.getElementById('tpl-banner-img');
  const tplBannerEmpty = document.getElementById('tpl-banner-empty');

  function setBannerPreview(previewEl, filename, alt) {
    previewEl.innerHTML = '';
    if (filename) {
      const frag = tplBannerImg.content.cloneNode(true);
      const img = frag.querySelector('img');
      img.src = `../assets/races/${filename}`;
      img.alt = alt;
      previewEl.appendChild(frag);
    } else {
      previewEl.appendChild(tplBannerEmpty.content.cloneNode(true));
    }
  }

  function renderPaymentTiersList(tiers) {
    const container = document.getElementById('payment-tiers-list');
    if (!container) return;
    container.innerHTML = '';
    (tiers || []).forEach((tier, idx) => {
      const row = document.createElement('div');
      row.className = 'tier-row';
      row.innerHTML = `
        <input type="date" class="tier-date" value="${tier.date || ''}" />
        <input type="number" class="tier-amount" value="${tier.amount ?? ''}" min="0" step="1" placeholder="Сумма, руб." />
        <button type="button" class="btn-tier-remove" data-idx="${idx}">×</button>
      `;
      container.appendChild(row);
    });

    container.querySelectorAll('.btn-tier-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.tier-row').remove();
      });
    });
  }

  document.getElementById('add-tier-btn')?.addEventListener('click', () => {
    const container = document.getElementById('payment-tiers-list');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'tier-row';
    row.innerHTML = `
      <input type="date" class="tier-date" />
      <input type="number" class="tier-amount" min="0" step="1" placeholder="Сумма, руб." />
      <button type="button" class="btn-tier-remove">×</button>
    `;
    row.querySelector('.btn-tier-remove').addEventListener('click', () => row.remove());
    container.appendChild(row);
  });

  function collectPaymentTiers() {
    const rows = document.querySelectorAll('#payment-tiers-list .tier-row');
    const tiers = [];
    rows.forEach(row => {
      const date   = row.querySelector('.tier-date')?.value.trim();
      const amount = parseFloat(row.querySelector('.tier-amount')?.value);
      if (date && !isNaN(amount)) tiers.push({ date, amount });
    });
    tiers.sort((a, b) => a.date.localeCompare(b.date));
    return tiers;
  }

  function openRaceEditModal(race) {
    document.querySelectorAll('#race-form .md-preview').forEach(p => { p.style.display = 'none'; });
    document.querySelectorAll('#race-form textarea').forEach(t => { t.style.display = ''; });
    document.querySelectorAll('#race-form .md-preview-toggle').forEach(b => { b.textContent = 'Предпросмотр'; });

    document.getElementById('race-edit-id').value       = race.id;
    document.getElementById('race-name').value          = race.race_name || '';
    document.getElementById('race-date').value          = race.date ? race.date.replace(' ', 'T').slice(0, 16) : '';
    document.getElementById('race-location').value      = race.location || '';
    document.getElementById('race-location-link').value = race.location_link || '';
    document.getElementById('race-iframe').value        = race.iframe_html || '';
    document.getElementById('race-description').value   = race.description || '';
    document.getElementById('race-payment').value       = race.payment_info || '';
    document.getElementById('race-is-active').checked   = race.is_active == 1;

    renderPaymentTiersList(race.payment_tiers || []);

    setBannerPreview(document.getElementById('banner-desktop-preview'), race.banner_desktop, 'Desktop');
    setBannerPreview(document.getElementById('banner-mobile-preview'), race.banner_mobile, 'Mobile');

    document.getElementById('race-sponsors').value = prettyJson(race.sponsors_json);
    document.getElementById('race-contacts').value = prettyJson(race.contacts_json);

    ['upload-status-desktop', 'upload-status-mobile'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = ''; el.style.color = ''; }
    });
    ['race-banner-desktop', 'race-banner-mobile'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    renderRaceCategoryList(race.id);

    const addInput = document.getElementById('race-category-add-input');
    const addBtnEl = document.getElementById('race-category-add-btn');
    const statusEl = document.getElementById('race-category-status');
    if (addInput) addInput.value = '';
    if (statusEl) { statusEl.textContent = ''; statusEl.style.color = ''; }

    if (addBtnEl) {
      const newBtn = addBtnEl.cloneNode(true);
      addBtnEl.parentNode.replaceChild(newBtn, addBtnEl);
      newBtn.addEventListener('click', () => handleCatAdd(race.id));
    }
    if (addInput) {
      addInput.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); handleCatAdd(race.id); } };
    }

    raceModal.style.display = 'flex';
  }

  function closeRaceEditModal() { raceModal.style.display = 'none'; }

  raceCloseBtn?.addEventListener('click', closeRaceEditModal);
  raceCancelBtn?.addEventListener('click', closeRaceEditModal);
  raceModal?.addEventListener('click', e => { if (e.target === raceModal) closeRaceEditModal(); });

  // Создание гонки
  document.getElementById('create-race-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('create-race-btn');
    btn.disabled = true;
    try {
      const res = await fetch('../api/admin/race_create.php', { method: 'POST', credentials: 'same-origin' });
      const result = await res.json();
      if (res.ok && result.success) {
        await fetchAdminData(true);
        const newRace = racesData.find(r => r.id === result.id);
        if (newRace) openRaceEditModal(newRace);
      } else {
        alert(result.error || 'Ошибка создания гонки');
      }
    } catch { alert('Сетевая ошибка'); }
    finally { btn.disabled = false; }
  });

  // Баннеры
  function setupUploadBtn(btnId, inputId, type, statusId, previewId) {
    document.getElementById(btnId)?.addEventListener('click', async () => {
      const raceId  = parseInt(document.getElementById('race-edit-id').value);
      const fileEl  = document.getElementById(inputId);
      const statusEl = document.getElementById(statusId);
      if (!fileEl.files.length) { statusEl.textContent = 'Выберите файл'; statusEl.style.color = 'var(--wm-danger)'; return; }
      const fd = new FormData();
      fd.append('race_id', raceId); fd.append('type', type); fd.append('file', fileEl.files[0]);
      document.getElementById(btnId).disabled = true;
      statusEl.textContent = 'Загрузка...'; statusEl.style.color = 'var(--wm-text-muted)';
      try {
        const res = await fetch('../api/admin/race_upload.php', { method: 'POST', body: fd, credentials: 'same-origin' });
        const result = await res.json();
        if (res.ok && result.success) {
          statusEl.textContent = 'Загружено!'; statusEl.style.color = 'var(--wm-success)';
          setBannerPreview(document.getElementById(previewId), result.filename, 'banner');
          const race = racesData.find(r => r.id === raceId);
          if (race) { if (type === 'desktop') race.banner_desktop = result.filename; else race.banner_mobile = result.filename; }
          fileEl.value = '';
        } else {
          statusEl.textContent = result.error || 'Ошибка'; statusEl.style.color = 'var(--wm-danger)';
        }
      } catch { statusEl.textContent = 'Сетевая ошибка'; statusEl.style.color = 'var(--wm-danger)'; }
      finally { document.getElementById(btnId).disabled = false; }
    });
  }
  setupUploadBtn('upload-banner-desktop', 'race-banner-desktop', 'desktop', 'upload-status-desktop', 'banner-desktop-preview');
  setupUploadBtn('upload-banner-mobile',  'race-banner-mobile',  'mobile',  'upload-status-mobile',  'banner-mobile-preview');

  // Сохранение гонки
  raceForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tiersArr = collectPaymentTiers();
    const formData = {
      id:            parseInt(document.getElementById('race-edit-id').value),
      name:          document.getElementById('race-name').value.trim(),
      date:          document.getElementById('race-date').value || null,
      location:      document.getElementById('race-location').value.trim(),
      location_link: document.getElementById('race-location-link').value.trim(),
      iframe_html:   document.getElementById('race-iframe').value.trim(),
      description:   document.getElementById('race-description').value.trim(),
      payment_info:  document.getElementById('race-payment').value.trim(),
      payment_tiers: tiersArr.length ? JSON.stringify(tiersArr) : null,
      is_active:     document.getElementById('race-is-active').checked ? 1 : 0,
      sponsors_json: document.getElementById('race-sponsors').value.trim() || null,
      contacts_json: document.getElementById('race-contacts').value.trim() || null,
    };

    if (!formData.name) { alert('Название гонки не может быть пустым'); return; }

    try {
      const res = await fetch('../api/admin/race_update.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'same-origin',
      });
      const result = await res.json();
      if (res.ok && result.success) {
        const savedRaceId = formData.id;
        closeRaceEditModal();
        await fetchAdminData(true);
        renderRaceDetail(savedRaceId);
      } else {
        alert(result.error || 'Ошибка сохранения');
      }
    } catch { alert('Сетевая ошибка'); }
  });

  // ── Category Management ────────────────────────────────────────────────
  function renderRaceCategoryList(raceId) {
    const race = racesData.find(r => r.id === raceId);
    if (!race) return;
    const list = document.getElementById('race-category-edit-list');
    if (!list) return;
    const tpl = document.getElementById('tpl-race-category-item');

    list.innerHTML = '';
    race.categories.forEach((cat, idx) => {
      const frag = tpl.content.cloneNode(true);
      const item = frag.querySelector('.race-category-item');
      item.dataset.rcId = cat.race_category_id;
      item.querySelector('.cat-name').textContent = cat.category_name;

      const upBtn     = item.querySelector('.btn-cat-up');
      const downBtn   = item.querySelector('.btn-cat-down');
      const removeBtn = item.querySelector('.btn-cat-remove');
      upBtn.dataset.rcId    = cat.race_category_id;
      downBtn.dataset.rcId  = cat.race_category_id;
      removeBtn.dataset.rcId = cat.race_category_id;
      if (idx === 0) upBtn.disabled = true;
      if (idx === race.categories.length - 1) downBtn.disabled = true;

      // Заполняем поля деталей
      item.querySelector('.cat-age-from').value   = cat.age_from != null ? cat.age_from : '';
      item.querySelector('.cat-age-to').value     = cat.age_to   != null ? cat.age_to   : '';
      item.querySelector('.cat-distance').value   = cat.distance_km != null ? cat.distance_km : '';
      item.querySelector('.cat-laps').value        = cat.laps       != null ? cat.laps       : '';
      item.querySelector('.cat-elevation').value   = cat.elevation_m != null ? cat.elevation_m : '';
      item.querySelector('.cat-description').value = cat.description || '';

      // Кнопка сохранения деталей
      item.querySelector('.btn-cat-save-details').dataset.rcId = cat.race_category_id;
      item.querySelector('.btn-cat-save-details').addEventListener('click', async (e) => {
        await handleCatSaveDetails(raceId, cat.race_category_id, item);
      });

      list.appendChild(frag);
    });

    bindCategoryListHandlers(raceId);
  }

  async function handleCatSaveDetails(raceId, rcId, item) {
    const age_from    = item.querySelector('.cat-age-from').value;
    const age_to      = item.querySelector('.cat-age-to').value;
    const distance_km = item.querySelector('.cat-distance').value;
    const laps        = item.querySelector('.cat-laps').value;
    const elevation_m = item.querySelector('.cat-elevation').value;
    const description = item.querySelector('.cat-description').value.trim();
    const statusEl    = item.querySelector('.cat-save-status');
    statusEl.textContent = '';

    const payload = {
      action: 'update',
      race_category_id: rcId,
      age_from:    age_from    !== '' ? parseInt(age_from)       : null,
      age_to:      age_to      !== '' ? parseInt(age_to)         : null,
      distance_km: distance_km !== '' ? parseFloat(distance_km) : null,
      laps:        laps        !== '' ? parseInt(laps)           : null,
      elevation_m: elevation_m !== '' ? parseInt(elevation_m)   : null,
      description: description || null,
    };

    try {
      const res = await fetch('../api/admin/race_category.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin',
      });
      const result = await res.json();
      if (res.ok && result.success) {
        // Обновляем локальные данные
        const race = racesData.find(r => r.id === raceId);
        const cat = race?.categories.find(c => c.race_category_id === rcId);
        if (cat) {
          cat.age_from    = payload.age_from;
          cat.age_to      = payload.age_to;
          cat.distance_km = payload.distance_km;
          cat.laps        = payload.laps;
          cat.elevation_m = payload.elevation_m;
          cat.description = payload.description;
        }
        statusEl.textContent = '✓ Сохранено';
        statusEl.style.color = 'var(--wm-success)';
        setTimeout(() => { statusEl.textContent = ''; }, 2000);
      } else {
        statusEl.textContent = result.error || 'Ошибка';
        statusEl.style.color = 'var(--wm-danger)';
      }
    } catch {
      statusEl.textContent = 'Сетевая ошибка';
      statusEl.style.color = 'var(--wm-danger)';
    }
  }

  function bindCategoryListHandlers(raceId) {
    const list = document.getElementById('race-category-edit-list');
    if (!list) return;
    const newList = list.cloneNode(true);
    // Re-wire save-details buttons
    newList.querySelectorAll('.btn-cat-save-details').forEach(btn => {
      btn.addEventListener('click', async () => {
        await handleCatSaveDetails(raceId, parseInt(btn.dataset.rcId), btn.closest('.race-category-item'));
      });
    });
    list.parentNode.replaceChild(newList, list);

    newList.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn || btn.classList.contains('btn-cat-save-details')) return;
      const rcId = parseInt(btn.dataset.rcId, 10);
      if (btn.classList.contains('btn-cat-remove')) {
        const race = racesData.find(r => r.id === raceId);
        const catName = race?.categories.find(c => c.race_category_id === rcId)?.category_name || '';
        await handleCatRemove(raceId, rcId, catName);
      } else if (btn.classList.contains('btn-cat-up')) {
        await handleCatReorder(raceId, 'up', rcId);
      } else if (btn.classList.contains('btn-cat-down')) {
        await handleCatReorder(raceId, 'down', rcId);
      }
    });
  }

  async function handleCatAdd(raceId) {
    const input  = document.getElementById('race-category-add-input');
    const status = document.getElementById('race-category-status');
    const addBtn = document.getElementById('race-category-add-btn');
    const name = input.value.trim();
    if (!name) return;

    addBtn.disabled = true;
    status.textContent = ''; status.style.color = '';

    try {
      const res = await fetch('../api/admin/race_category.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', race_id: raceId, name }),
        credentials: 'same-origin',
      });
      const result = await res.json();
      if (res.ok && result.success) {
        const race = racesData.find(r => r.id === raceId);
        if (race) race.categories.push({
          id: result.category_id, category_name: result.category_name,
          race_category_id: result.race_category_id, sort_order: result.sort_order,
        });
        input.value = '';
        renderRaceCategoryList(raceId);
      } else {
        status.textContent = result.error || 'Ошибка'; status.style.color = 'var(--wm-danger)';
      }
    } catch { status.textContent = 'Сетевая ошибка'; status.style.color = 'var(--wm-danger)'; }
    finally { addBtn.disabled = false; }
  }

  async function handleCatRemove(raceId, rcId, catName) {
    const status = document.getElementById('race-category-status');
    async function doRemove(confirmed) {
      const res = await fetch('../api/admin/race_category.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', race_category_id: rcId, confirmed }),
        credentials: 'same-origin',
      });
      const result = await res.json();
      if (!res.ok) { status.textContent = result.error || 'Ошибка'; status.style.color = 'var(--wm-danger)'; return; }
      if (result.warn) {
        if (confirm(`Удалить «${catName}»?\n${result.affected_count} участников потеряют привязку.\nПродолжить?`))
          await doRemove(true);
        return;
      }
      if (result.success) {
        const race = racesData.find(r => r.id === raceId);
        if (race) race.categories = race.categories.filter(c => c.race_category_id !== rcId);
        renderRaceCategoryList(raceId);
      } else { status.textContent = result.error || 'Ошибка'; status.style.color = 'var(--wm-danger)'; }
    }
    try { await doRemove(false); } catch { status.textContent = 'Сетевая ошибка'; status.style.color = 'var(--wm-danger)'; }
  }

  async function handleCatReorder(raceId, direction, rcId) {
    const race = racesData.find(r => r.id === raceId);
    if (!race) return;
    const cats = race.categories;
    const idx  = cats.findIndex(c => c.race_category_id === rcId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= cats.length) return;
    [cats[idx], cats[swapIdx]] = [cats[swapIdx], cats[idx]];
    renderRaceCategoryList(raceId);
    try {
      const res = await fetch('../api/admin/race_category.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reorder', race_id: raceId, ordered_ids: cats.map(c => c.race_category_id) }),
        credentials: 'same-origin',
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        [cats[idx], cats[swapIdx]] = [cats[swapIdx], cats[idx]];
        renderRaceCategoryList(raceId);
      }
    } catch {
      [cats[idx], cats[swapIdx]] = [cats[swapIdx], cats[idx]];
      renderRaceCategoryList(raceId);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  function prettyJson(val) {
    if (!val) return '';
    try { return JSON.stringify(JSON.parse(val), null, 2); } catch { return val; }
  }

  function formatShortDate(dateStr) {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr.replace(' ', 'T'));
      return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return dateStr; }
  }

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    try {
      const race = new Date(dateStr.replace(' ', 'T'));
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const diff = Math.round((race - today) / 86400000);
      return diff;
    } catch { return null; }
  }

  initMarkdownEditor('race-description');
  initMarkdownEditor('race-payment');

  function initMarkdownEditor(id) {
    const textarea = document.getElementById(id);
    if (!textarea) return;
    const toolbar = document.createElement('div');
    toolbar.className = 'md-toolbar';
    const actions = [
      { label: 'Ж', title: 'Жирный', fn: () => wrapSelection(textarea, '**', '**') },
      { label: 'К', title: 'Курсив', fn: () => wrapSelection(textarea, '*', '*') },
      { label: 'H2', title: 'Заголовок', fn: () => prefixLines(textarea, '## ') },
      { label: '•', title: 'Список', fn: () => prefixLines(textarea, '- ') },
    ];
    actions.forEach(({ label, title, fn }) => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.textContent = label; btn.title = title;
      btn.className = 'md-toolbar-btn';
      btn.addEventListener('click', () => { fn(); textarea.focus(); });
      toolbar.appendChild(btn);
    });
    const previewBtn = document.createElement('button');
    previewBtn.type = 'button'; previewBtn.className = 'md-preview-toggle'; previewBtn.textContent = 'Предпросмотр';
    toolbar.appendChild(previewBtn);
    const preview = document.createElement('div');
    preview.className = 'md-preview'; preview.style.display = 'none';
    previewBtn.addEventListener('click', () => {
      if (preview.style.display === 'none') {
        preview.innerHTML = marked.parse(textarea.value || '');
        preview.style.display = ''; textarea.style.display = 'none'; previewBtn.textContent = 'Редактировать';
      } else {
        preview.style.display = 'none'; textarea.style.display = ''; previewBtn.textContent = 'Предпросмотр';
      }
    });
    textarea.parentNode.insertBefore(toolbar, textarea);
    textarea.parentNode.insertBefore(preview, textarea.nextSibling);
  }

  function wrapSelection(textarea, before, after) {
    const s = textarea.selectionStart, e = textarea.selectionEnd;
    const val = textarea.value;
    textarea.value = val.slice(0, s) + before + val.slice(s, e) + after + val.slice(e);
    textarea.setSelectionRange(s + before.length, e + before.length);
  }

  function prefixLines(textarea, prefix) {
    const s = textarea.selectionStart, e = textarea.selectionEnd;
    const chunk = textarea.value.slice(s, e);
    const prefixed = chunk.split('\n').map(l => prefix + l).join('\n');
    textarea.value = textarea.value.slice(0, s) + prefixed + textarea.value.slice(e);
    textarea.setSelectionRange(s, s + prefixed.length);
  }

  // ── Boot ───────────────────────────────────────────────────────────────
  fetchAdminData();
});
