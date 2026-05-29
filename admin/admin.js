marked.use({
  gfm: true,
  breaks: true,
  renderer: { html() { return ''; } },
});

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const authSection = document.getElementById('auth-section');
  const dashboardSection = document.getElementById('dashboard-section');
  const authError = document.getElementById('auth-error');
  const racesContainer = document.getElementById('races-container');

  // Элементы модального окна
  const modal = document.getElementById('participant-modal');
  const modalTitle = document.getElementById('modal-title');
  const closeBtn = document.querySelector('.close-btn');
  const cancelBtn = document.querySelector('.btn-cancel');
  const saveBtn = document.querySelector('.btn-save');

  let currentParticipantId = null;
  let currentRaceId = null;
  let racesData = [];
  let allCategoriesData = [];

  // Проверка авторизации при загрузке
  fetchAdminData();

  // Форма авторизации
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

    const formData = new URLSearchParams({ username, password });

    try {
      const response = await fetch('../api/admin/_auth.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        authSection.style.display = 'none';
        dashboardSection.style.display = 'block';
        fetchAdminData();
      } else {
        authError.textContent = result.error || 'Ошибка авторизации';
        authError.style.display = 'block';
      }
    } catch (err) {
      authError.textContent = 'Сетевая ошибка. Проверьте подключение.';
      authError.style.display = 'block';
    }
  });

  // Получение данных админа
  async function fetchAdminData() {
    try {
      const response = await fetch('../api/admin/dashboard.php');
      const result = await response.json();

      if (response.ok && result.success) {
        allCategoriesData = result.all_categories || [];
        renderRaces(result.races);
      } else if (response.status === 401) {
        dashboardSection.style.display = 'none';
        authSection.style.display = 'flex';
      }
    } catch (err) {
      console.error('Data fetch error:', err);
      if (dashboardSection.style.display !== 'none') {
        alert('Ошибка загрузки данных. Обновите страницу.');
      }
    }
  }

  // Отрисовка гонок
  function renderRaces(races) {
    racesData = races;
    racesContainer.innerHTML = '';

    if (!races.length) {
      const div = document.createElement('div');
      div.className = 'empty-state';
      div.textContent = 'Нет запланированных гонок';
      racesContainer.appendChild(div);
      return;
    }

    const tplCard = document.getElementById('tpl-race-card');
    const tplCatTag = document.getElementById('tpl-category-tag');
    const tplTh = document.getElementById('tpl-table-th');
    const tplRow = document.getElementById('tpl-participant-row-admin');

    const headers = {
      payment_amount: 'Сумма оплаты',
      is_paid: 'Оплата',
      last_name: 'Фамилия',
      first_name: 'Имя',
      middle_name: 'Отчество',
      birth_date: 'Дата рождения',
      phone: 'Телефон',
      email: 'Email',
      city: 'Город',
      team: 'Команда',
      category_name: 'Категория',
      created_at: 'Дата реги',
    };

    races.forEach((race) => {
      const frag = tplCard.content.cloneNode(true);
      const card = frag.querySelector('.race-card');

      card.querySelector('.rc-name').textContent = race.race_name;
      card.querySelector('.rc-date').textContent = formatRaceDate(race.date);
      card.querySelector('.rc-location').textContent = race.location;
      card.querySelector('.rc-count').textContent = race.participants_count;

      if (race.payment_info) {
        card.querySelector('.rc-payment-text').textContent = race.payment_info;
        card.querySelector('.rc-payment-block').hidden = false;
      }

      // Чекбоксы
      const activeChk = card.querySelector('.race-active-checkbox');
      const openChk = card.querySelector('.reg-open-checkbox');
      const finishedChk = card.querySelector('.race-finished-checkbox');
      activeChk.dataset.raceId = race.id;
      openChk.dataset.raceId = race.id;
      finishedChk.dataset.raceId = race.id;
      activeChk.checked = race.is_active == 1;
      openChk.checked = race.registration_open == 1;
      finishedChk.checked = race.is_finished == 1;

      // Кнопки
      const editBtn = card.querySelector('.edit-race-btn');
      const deleteBtn = card.querySelector('.delete-race-btn');
      const exportBtn = card.querySelector('.export-csv-btn');
      const importBtn = card.querySelector('.import-csv-btn');
      const csvInput = card.querySelector('.csv-file-input');
      editBtn.dataset.raceId = race.id;
      deleteBtn.dataset.raceId = race.id;
      exportBtn.dataset.raceId = race.id;
      importBtn.dataset.raceId = race.id;
      csvInput.dataset.raceId = race.id;

      if (race.participants.length) {
        exportBtn.hidden = false;
      }

      // Теги категорий
      const catList = card.querySelector('.category-list');
      race.categories.forEach((c) => {
        const tagFrag = tplCatTag.content.cloneNode(true);
        tagFrag.querySelector('.category-tag').textContent = c.category_name;
        catList.appendChild(tagFrag);
      });

      // Таблица участников
      const theadRow = card.querySelector('.rc-thead-row');
      const tbody = card.querySelector('.rc-tbody');

      if (!race.participants.length) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.className = 'empty-state';
        td.textContent = 'Нет зарегистрированных участников';
        tr.appendChild(td);
        tbody.appendChild(tr);
      } else {
        const columns = Object.keys(race.participants[0]).filter((k) => k !== 'id');

        const thActionFrag = tplTh.content.cloneNode(true);
        thActionFrag.querySelector('th').textContent = 'Действия';
        theadRow.appendChild(thActionFrag);

        columns.forEach((col) => {
          const thFrag = tplTh.content.cloneNode(true);
          thFrag.querySelector('th').textContent = headers[col] || col;
          theadRow.appendChild(thFrag);
        });

        race.participants.forEach((p) => {
          const rowFrag = tplRow.content.cloneNode(true);
          const tr = rowFrag.querySelector('tr');
          const editPartBtn = tr.querySelector('.edit-participant-btn');
          editPartBtn.dataset.participantId = p.id;
          editPartBtn.dataset.raceId = race.id;

          columns.forEach((col) => {
            const td = document.createElement('td');
            td.textContent = p[col] || '-';
            tr.appendChild(td);
          });

          editPartBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await openParticipantEdit(editPartBtn.dataset.participantId, editPartBtn.dataset.raceId);
          });

          tbody.appendChild(rowFrag);
        });
      }

      // Обработчики событий карточки
      openChk.addEventListener('change', async () => {
        const raceId = parseInt(openChk.dataset.raceId);
        const newValue = openChk.checked ? 1 : 0;
        openChk.disabled = true;
        try {
          const response = await fetch('../api/admin/race_update.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: raceId, registration_open: newValue }),
            credentials: 'same-origin',
          });
          const result = await response.json();
          if (!response.ok || !result.success) {
            openChk.checked = !openChk.checked;
            alert(result.error || 'Ошибка обновления');
          }
        } catch (err) {
          openChk.checked = !openChk.checked;
          alert('Сетевая ошибка. Проверьте подключение.');
        } finally {
          openChk.disabled = false;
        }
      });

      finishedChk.addEventListener('change', async () => {
        const raceId = parseInt(finishedChk.dataset.raceId);
        const newValue = finishedChk.checked ? 1 : 0;
        finishedChk.disabled = true;
        try {
          const response = await fetch('../api/admin/race_update.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: raceId, is_finished: newValue }),
            credentials: 'same-origin',
          });
          const result = await response.json();
          if (!response.ok || !result.success) {
            finishedChk.checked = !finishedChk.checked;
            alert(result.error || 'Ошибка обновления');
          }
        } catch (err) {
          finishedChk.checked = !finishedChk.checked;
          alert('Сетевая ошибка. Проверьте подключение.');
        } finally {
          finishedChk.disabled = false;
        }
      });

      importBtn.addEventListener('click', async () => {
        const raceId = parseInt(importBtn.dataset.raceId);
        const container = importBtn.closest('.results-import');
        const fileInput = container.querySelector('.csv-file-input');
        const statusEl = container.querySelector('.import-status');

        if (!fileInput.files.length) {
          statusEl.textContent = 'Выберите файл';
          statusEl.style.color = 'var(--danger)';
          return;
        }

        const formData = new FormData();
        formData.append('race_id', raceId);
        formData.append('file', fileInput.files[0]);

        importBtn.disabled = true;
        statusEl.textContent = 'Загрузка...';
        statusEl.style.color = 'var(--text-secondary)';

        try {
          const response = await fetch('../api/admin/results_import.php', {
            method: 'POST',
            body: formData,
            credentials: 'same-origin',
          });
          const result = await response.json();
          if (response.ok && result.success) {
            statusEl.textContent = `Импортировано: ${result.imported} строк`;
            statusEl.style.color = 'green';
            fileInput.value = '';
          } else {
            statusEl.textContent = result.error || 'Ошибка импорта';
            statusEl.style.color = 'var(--danger)';
          }
        } catch (err) {
          statusEl.textContent = 'Сетевая ошибка';
          statusEl.style.color = 'var(--danger)';
        } finally {
          importBtn.disabled = false;
        }
      });

      exportBtn.addEventListener('click', () => {
        window.location.href = `../api/admin/export_csv.php?race_id=${parseInt(exportBtn.dataset.raceId)}`;
      });

      editBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const raceId = parseInt(editBtn.dataset.raceId);
        const race = racesData.find((r) => r.id === raceId);
        if (race) openRaceEditModal(race);
      });

      activeChk.addEventListener('change', async () => {
        const raceId = parseInt(activeChk.dataset.raceId);
        const newValue = activeChk.checked ? 1 : 0;
        activeChk.disabled = true;
        try {
          const response = await fetch('../api/admin/race_update.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: raceId, is_active: newValue }),
            credentials: 'same-origin',
          });
          const result = await response.json();
          if (!response.ok || !result.success) {
            activeChk.checked = !activeChk.checked;
            alert(result.error || 'Ошибка обновления');
          } else {
            fetchAdminData();
          }
        } catch (err) {
          activeChk.checked = !activeChk.checked;
          alert('Сетевая ошибка. Проверьте подключение.');
        } finally {
          activeChk.disabled = false;
        }
      });

      deleteBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const raceId = parseInt(deleteBtn.dataset.raceId);
        const raceName = deleteBtn.closest('.race-card').querySelector('.rc-name').textContent;
        if (!confirm(`Удалить гонку "${raceName}" и все связанные данные (категории, участников)?\n\nЭто действие нельзя отменить.`)) return;
        deleteBtn.disabled = true;
        try {
          const response = await fetch('../api/admin/race_delete.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ race_id: raceId }),
            credentials: 'same-origin',
          });
          const result = await response.json();
          if (response.ok && result.success) {
            fetchAdminData();
          } else {
            alert(result.error || 'Ошибка удаления');
          }
        } catch (err) {
          alert('Сетевая ошибка. Проверьте подключение.');
        } finally {
          deleteBtn.disabled = false;
        }
      });

      racesContainer.appendChild(frag);
    });
  }

  // Открытие модального окна редактирования
  async function openParticipantEdit(participantId, raceId) {
    currentParticipantId = parseInt(participantId);
    currentRaceId = parseInt(raceId);

    try {
      const response = await fetch(
        `../api/admin/participant/get.php?id=${participantId}`,
        {
          credentials: 'same-origin',
        }
      );

      if (!response.ok) {
        alert(`Ошибка сервера: ${response.status} ${response.statusText}`);
        return;
      }

      const result = await response.json();

      if (result.success) {
        const p = result.participant;

        // Заполняем форму
        document.getElementById('participant-id').value = p.id;
        document.getElementById('last-name').value = p.last_name;
        document.getElementById('first-name').value = p.first_name;
        document.getElementById('middle-name').value = p.middle_name || '';
        document.getElementById('birth-date').value = p.birth_date || '';
        document.getElementById('phone').value = p.phone || '';
        document.getElementById('email').value = p.email || '';
        document.getElementById('city').value = p.city || '';
        document.getElementById('team').value = p.team || '';
        document.getElementById('is-paid').checked = !!p.is_paid;
        document.getElementById('payment-amount').value = p.payment_amount || '';

        // Заполняем select категорий
        const categorySelect = document.getElementById('category-id');
        categorySelect.innerHTML = '';
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = 'Выберите категорию';
        categorySelect.appendChild(defaultOpt);
        result.categories.forEach((cat) => {
          const option = document.createElement('option');
          option.value = cat.id;
          option.textContent = cat.name;
          if (cat.id === p.category_id) {
            option.selected = true;
          }
          categorySelect.appendChild(option);
        });

        // Показываем попап
        modalTitle.textContent = `Редактирование: ${p.last_name} ${p.first_name}`;
        modal.style.display = 'flex';
        modal.style.animation = 'slideIn 0.3s ease';
      } else {
        alert(result.error || 'Ошибка загрузки данных участника');
      }
    } catch (err) {
      console.error('Get participant error:', err);
      alert('Сетевая ошибка. Проверьте подключение.');
    }
  }

  // Закрытие модального окна
  function closeParticipantEdit() {
    modal.style.display = 'none';
    modal.style.animation = 'none';
    currentParticipantId = null;
  }

  // Обработчики закрытия
  if (closeBtn) {
    closeBtn.addEventListener('click', closeParticipantEdit);
  }
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeParticipantEdit);
  }
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeParticipantEdit();
  });

  // Сохранение
  if (saveBtn && document.getElementById('participant-form')) {
    document
      .getElementById('participant-form')
      .addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = {
          id: parseInt(document.getElementById('participant-id').value),
          last_name: document.getElementById('last-name').value.trim(),
          first_name: document.getElementById('first-name').value.trim(),
          middle_name: document.getElementById('middle-name').value.trim(),
          birth_date: document.getElementById('birth-date').value || null,
          phone: document.getElementById('phone').value.trim(),
          email: document.getElementById('email').value.trim(),
          city: document.getElementById('city').value.trim(),
          team: document.getElementById('team').value.trim(),
          race_category_id: document.getElementById('category-id').value
            ? parseInt(document.getElementById('category-id').value)
            : null,
          is_paid: document.getElementById('is-paid').checked ? '1' : '0',
          payment_amount: document.getElementById('payment-amount').value,
          race_id: currentRaceId,
        };

        if (!formData.race_category_id) {
          alert('Выберите категорию');
          return;
        }

        try {
          const response = await fetch('../api/admin/participant/update.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
            credentials: 'same-origin',
          });

          const result = await response.json();

          if (response.ok && result.success) {
            alert('Данные успешно обновлены');
            closeParticipantEdit();
            fetchAdminData();
          } else {
            alert(result.error || 'Ошибка обновления данных');
          }
        } catch (err) {
          console.error('Update participant error:', err);
          alert('Сетевая ошибка. Проверьте подключение.');
        }
      });
  }

  // HTML-экранирование
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Markdown-редактор
  function initMarkdownEditor(id) {
    const textarea = document.getElementById(id);
    if (!textarea) return;

    const toolbar = document.createElement('div');
    toolbar.className = 'md-toolbar';

    const actions = [
      { label: 'Ж',        title: 'Жирный',                fn: () => wrapSelection(textarea, '**', '**') },
      { label: 'К',        title: 'Курсив',                 fn: () => wrapSelection(textarea, '*', '*') },
      { label: 'H2',       title: 'Заголовок',              fn: () => prefixLines(textarea, '## ') },
      { label: '•',        title: 'Маркированный список',   fn: () => prefixLines(textarea, '- ') },
      { label: '1.',       title: 'Нумерованный список',    fn: () => prefixLines(textarea, '1. ') },
    ];

    actions.forEach(({ label, title, fn }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'md-btn';
      btn.textContent = label;
      btn.title = title;
      btn.addEventListener('click', () => { fn(); textarea.focus(); });
      toolbar.appendChild(btn);
    });

    const previewBtn = document.createElement('button');
    previewBtn.type = 'button';
    previewBtn.className = 'md-btn md-preview-toggle';
    previewBtn.textContent = 'Предпросмотр';
    toolbar.appendChild(previewBtn);

    const preview = document.createElement('div');
    preview.className = 'md-preview';
    preview.style.display = 'none';

    previewBtn.addEventListener('click', () => {
      const showingPreview = preview.style.display !== 'none';
      if (showingPreview) {
        preview.style.display = 'none';
        textarea.style.display = '';
        previewBtn.textContent = 'Предпросмотр';
      } else {
        preview.innerHTML = marked.parse(textarea.value || '');
        preview.style.display = 'block';
        textarea.style.display = 'none';
        previewBtn.textContent = 'Редактировать';
      }
    });

    textarea.parentNode.insertBefore(toolbar, textarea);
    textarea.insertAdjacentElement('afterend', preview);
  }

  function wrapSelection(textarea, before, after) {
    const s = textarea.selectionStart;
    const e = textarea.selectionEnd;
    const selected = textarea.value.substring(s, e) || 'текст';
    textarea.value =
      textarea.value.substring(0, s) + before + selected + after + textarea.value.substring(e);
    textarea.selectionStart = s + before.length;
    textarea.selectionEnd = s + before.length + selected.length;
  }

  function prefixLines(textarea, prefix) {
    const s = textarea.selectionStart;
    const e = textarea.selectionEnd;
    const val = textarea.value;
    const lineStart = val.lastIndexOf('\n', s - 1) + 1;
    const chunk = val.substring(lineStart, e);
    const prefixed = chunk.split('\n').map((l) => prefix + l).join('\n');
    textarea.value = val.substring(0, lineStart) + prefixed + val.substring(e);
    textarea.selectionStart = lineStart + prefix.length;
    textarea.selectionEnd = lineStart + prefixed.length;
  }

  initMarkdownEditor('race-description');
  initMarkdownEditor('race-payment');

  function formatRaceDate(dateStr) {
    const d = new Date(dateStr.replace(' ', 'T'));
    const datePart = d.toLocaleDateString('ru-RU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const h = d.getHours();
    const m = d.getMinutes();
    if (h !== 0 || m !== 0) {
      return `${datePart}, ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    return datePart;
  }

  // ── Управление категориями гонки ──────────────────────────────────────

  function renderRaceCategoryList(raceId) {
    const race = racesData.find((r) => r.id === raceId);
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
      const upBtn = item.querySelector('.btn-cat-up');
      const downBtn = item.querySelector('.btn-cat-down');
      const removeBtn = item.querySelector('.btn-cat-remove');
      upBtn.dataset.rcId = cat.race_category_id;
      downBtn.dataset.rcId = cat.race_category_id;
      removeBtn.dataset.rcId = cat.race_category_id;
      if (idx === 0) upBtn.disabled = true;
      if (idx === race.categories.length - 1) downBtn.disabled = true;
      list.appendChild(frag);
    });

    bindCategoryListHandlers(raceId);
  }

  function renderRaceCardCategories(raceId) {
    const race = racesData.find((r) => r.id === raceId);
    if (!race) return;
    const editBtn = document.querySelector(`.edit-race-btn[data-race-id="${raceId}"]`);
    const catList = editBtn?.closest('.race-card')?.querySelector('.category-list');
    if (!catList) return;

    const tpl = document.getElementById('tpl-category-tag');
    catList.innerHTML = '';
    race.categories.forEach((c) => {
      const frag = tpl.content.cloneNode(true);
      frag.querySelector('.category-tag').textContent = c.category_name;
      catList.appendChild(frag);
    });
  }

  function bindCategoryListHandlers(raceId) {
    const list = document.getElementById('race-category-edit-list');
    if (!list) return;
    const newList = list.cloneNode(true);
    list.parentNode.replaceChild(newList, list);

    newList.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const rcId = parseInt(btn.dataset.rcId, 10);
      if (btn.classList.contains('btn-cat-remove')) {
        const race = racesData.find((r) => r.id === raceId);
        const catName = race?.categories.find((c) => c.race_category_id === rcId)?.category_name || '';
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
    status.textContent = '';
    status.style.color = '';

    try {
      const res = await fetch('../api/admin/race_category.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', race_id: raceId, name }),
        credentials: 'same-origin',
      });
      const result = await res.json();

      if (res.ok && result.success) {
        const race = racesData.find((r) => r.id === raceId);
        if (race) {
          race.categories.push({
            id:                result.category_id,
            category_name:     result.category_name,
            race_category_id:  result.race_category_id,
            sort_order:        result.sort_order,
          });
        }
        input.value = '';
        renderRaceCategoryList(raceId);
        renderRaceCardCategories(raceId);
      } else {
        status.textContent = result.error || 'Ошибка';
        status.style.color = 'var(--danger)';
      }
    } catch (err) {
      status.textContent = 'Сетевая ошибка';
      status.style.color = 'var(--danger)';
    } finally {
      addBtn.disabled = false;
    }
  }

  async function handleCatRemove(raceId, rcId, catName) {
    const status = document.getElementById('race-category-status');

    async function doRemove(confirmed) {
      try {
        const res = await fetch('../api/admin/race_category.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'remove', race_category_id: rcId, confirmed }),
          credentials: 'same-origin',
        });
        const result = await res.json();

        if (!res.ok) {
          status.textContent = result.error || 'Ошибка удаления';
          status.style.color = 'var(--danger)';
          return;
        }

        if (result.warn) {
          const ok = confirm(
            `Удалить категорию «${catName}»?\n\n` +
            `${result.affected_count} участник(ов) потеряют привязку к категории ` +
            `(их регистрации сохранятся).\n\nПродолжить?`
          );
          if (ok) await doRemove(true);
          return;
        }

        if (result.success) {
          const race = racesData.find((r) => r.id === raceId);
          if (race) {
            race.categories = race.categories.filter((c) => c.race_category_id !== rcId);
          }
          renderRaceCategoryList(raceId);
          renderRaceCardCategories(raceId);
        } else {
          status.textContent = result.error || 'Ошибка удаления';
          status.style.color = 'var(--danger)';
        }
      } catch (err) {
        status.textContent = 'Сетевая ошибка';
        status.style.color = 'var(--danger)';
      }
    }

    await doRemove(false);
  }

  async function handleCatReorder(raceId, direction, rcId) {
    const race = racesData.find((r) => r.id === raceId);
    if (!race) return;

    const cats = race.categories;
    const idx  = cats.findIndex((c) => c.race_category_id === rcId);
    if (idx < 0) return;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= cats.length) return;

    [cats[idx], cats[swapIdx]] = [cats[swapIdx], cats[idx]];
    renderRaceCategoryList(raceId);
    renderRaceCardCategories(raceId);

    const orderedIds = cats.map((c) => c.race_category_id);
    try {
      const res = await fetch('../api/admin/race_category.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reorder', race_id: raceId, ordered_ids: orderedIds }),
        credentials: 'same-origin',
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        [cats[idx], cats[swapIdx]] = [cats[swapIdx], cats[idx]];
        renderRaceCategoryList(raceId);
        renderRaceCardCategories(raceId);
      }
    } catch (err) {
      [cats[idx], cats[swapIdx]] = [cats[swapIdx], cats[idx]];
      renderRaceCategoryList(raceId);
      renderRaceCardCategories(raceId);
    }
  }

  // ── Редактирование гонки ───────────────────────────────────────────────
  const raceModal = document.getElementById('race-modal');
  const raceCloseBtn = document.getElementById('race-close-btn');
  const raceCancelBtn = document.getElementById('race-cancel-btn');
  const raceForm = document.getElementById('race-form');

  const tplBannerImg   = document.getElementById('tpl-banner-img');
  const tplBannerEmpty = document.getElementById('tpl-banner-empty');

  function setBannerPreview(previewEl, filename, altText) {
    previewEl.innerHTML = '';
    if (filename) {
      const frag = tplBannerImg.content.cloneNode(true);
      const img = frag.querySelector('img');
      img.src = `../assets/races/${filename}`;
      img.alt = altText;
      previewEl.appendChild(frag);
    } else {
      previewEl.appendChild(tplBannerEmpty.content.cloneNode(true));
    }
  }

  function openRaceEditModal(race) {
    // Сбросить предпросмотры
    document.querySelectorAll('#race-form .md-preview').forEach((p) => { p.style.display = 'none'; });
    document.querySelectorAll('#race-form textarea').forEach((t) => { t.style.display = ''; });
    document.querySelectorAll('#race-form .md-preview-toggle').forEach((b) => { b.textContent = 'Предпросмотр'; });

    document.getElementById('race-edit-id').value = race.id;
    document.getElementById('race-name').value = race.race_name || '';
    document.getElementById('race-date').value = race.date
      ? race.date.replace(' ', 'T').slice(0, 16)
      : '';
    document.getElementById('race-location').value = race.location || '';
    document.getElementById('race-location-link').value = race.location_link || '';
    document.getElementById('race-iframe').value = race.iframe_html || '';
    document.getElementById('race-description').value = race.description || '';
    document.getElementById('race-payment').value = race.payment_info || '';

    document.getElementById('race-is-active').checked = race.is_active == 1;

    setBannerPreview(document.getElementById('banner-desktop-preview'), race.banner_desktop, 'Desktop banner');
    setBannerPreview(document.getElementById('banner-mobile-preview'), race.banner_mobile, 'Mobile banner');

    document.getElementById('race-sponsors').value = prettyJson(race.sponsors_json);
    document.getElementById('race-contacts').value = prettyJson(race.contacts_json);

    // Сбросить статусы загрузки и файл-инпуты
    ['upload-status-desktop', 'upload-status-mobile'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) { el.textContent = ''; el.style.color = ''; }
    });
    ['race-banner-desktop', 'race-banner-mobile'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    // Секция категорий
    renderRaceCategoryList(race.id);

    const addInput  = document.getElementById('race-category-add-input');
    const addBtnEl  = document.getElementById('race-category-add-btn');
    const statusEl  = document.getElementById('race-category-status');
    if (addInput)  { addInput.value = ''; }
    if (statusEl)  { statusEl.textContent = ''; statusEl.style.color = ''; }

    // Клонируем кнопку чтобы снять обработчики предыдущего открытия
    if (addBtnEl) {
      const newBtn = addBtnEl.cloneNode(true);
      addBtnEl.parentNode.replaceChild(newBtn, addBtnEl);
      newBtn.addEventListener('click', () => handleCatAdd(race.id));
    }
    if (addInput) {
      addInput.onkeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); handleCatAdd(race.id); }
      };
    }

    raceModal.style.display = 'flex';
  }

  function prettyJson(val) {
    if (!val) return '';
    try { return JSON.stringify(JSON.parse(val), null, 2); } catch { return val; }
  }

  function closeRaceEditModal() {
    raceModal.style.display = 'none';
  }

  if (raceCloseBtn) raceCloseBtn.addEventListener('click', closeRaceEditModal);
  if (raceCancelBtn) raceCancelBtn.addEventListener('click', closeRaceEditModal);
  if (raceModal) {
    raceModal.addEventListener('click', (e) => {
      if (e.target === raceModal) closeRaceEditModal();
    });
  }

  // Создание новой гонки
  const createRaceBtn = document.getElementById('create-race-btn');
  if (createRaceBtn) {
    createRaceBtn.addEventListener('click', async () => {
      createRaceBtn.disabled = true;
      try {
        const response = await fetch('../api/admin/race_create.php', {
          method: 'POST',
          credentials: 'same-origin',
        });
        const result = await response.json();
        if (response.ok && result.success) {
          await fetchAdminData();
          const newRace = racesData.find((r) => r.id === result.id);
          if (newRace) openRaceEditModal(newRace);
        } else {
          alert(result.error || 'Ошибка создания гонки');
        }
      } catch (err) {
        alert('Сетевая ошибка. Проверьте подключение.');
      } finally {
        createRaceBtn.disabled = false;
      }
    });
  }

  // Загрузка баннеров
  function setupUploadBtn(btnId, inputId, type, statusId, previewId) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const raceId = parseInt(document.getElementById('race-edit-id').value);
      const fileInput = document.getElementById(inputId);
      const statusEl = document.getElementById(statusId);
      if (!fileInput.files.length) {
        statusEl.textContent = 'Выберите файл';
        statusEl.style.color = 'var(--danger)';
        return;
      }
      const fd = new FormData();
      fd.append('race_id', raceId);
      fd.append('type', type);
      fd.append('file', fileInput.files[0]);
      btn.disabled = true;
      statusEl.textContent = 'Загрузка...';
      statusEl.style.color = 'var(--text-secondary)';
      try {
        const response = await fetch('../api/admin/race_upload.php', {
          method: 'POST',
          body: fd,
          credentials: 'same-origin',
        });
        const result = await response.json();
        if (response.ok && result.success) {
          statusEl.textContent = 'Загружено!';
          statusEl.style.color = 'green';
          const preview = document.getElementById(previewId);
          preview.innerHTML = '';
          const frag = tplBannerImg.content.cloneNode(true);
          const img = frag.querySelector('img');
          img.src = `../${result.url}`;
          img.alt = 'banner';
          preview.appendChild(frag);
          const race = racesData.find((r) => r.id === raceId);
          if (race) {
            if (type === 'desktop') race.banner_desktop = result.filename;
            else race.banner_mobile = result.filename;
          }
          fileInput.value = '';
        } else {
          statusEl.textContent = result.error || 'Ошибка загрузки';
          statusEl.style.color = 'var(--danger)';
        }
      } catch (err) {
        statusEl.textContent = 'Сетевая ошибка';
        statusEl.style.color = 'var(--danger)';
      } finally {
        btn.disabled = false;
      }
    });
  }

  setupUploadBtn('upload-banner-desktop', 'race-banner-desktop', 'desktop', 'upload-status-desktop', 'banner-desktop-preview');
  setupUploadBtn('upload-banner-mobile',  'race-banner-mobile',  'mobile',  'upload-status-mobile',  'banner-mobile-preview');

  if (raceForm) {
    raceForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const sponsorsVal = document.getElementById('race-sponsors').value.trim();
      const contactsVal = document.getElementById('race-contacts').value.trim();
      const formData = {
        id: parseInt(document.getElementById('race-edit-id').value),
        name: document.getElementById('race-name').value.trim(),
        date: document.getElementById('race-date').value || null,
        location: document.getElementById('race-location').value.trim(),
        location_link: document.getElementById('race-location-link').value.trim(),
        iframe_html: document.getElementById('race-iframe').value.trim(),
        description: document.getElementById('race-description').value.trim(),
        payment_info: document.getElementById('race-payment').value.trim(),
        is_active: document.getElementById('race-is-active').checked ? 1 : 0,
        sponsors_json: sponsorsVal || null,
        contacts_json: contactsVal || null,
      };

      if (!formData.name) {
        alert('Название гонки не может быть пустым');
        return;
      }

      try {
        const response = await fetch('../api/admin/race_update.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
          credentials: 'same-origin',
        });
        const result = await response.json();
        if (response.ok && result.success) {
          closeRaceEditModal();
          fetchAdminData();
        } else {
          alert(result.error || 'Ошибка сохранения');
        }
      } catch (err) {
        console.error('Race update error:', err);
        alert('Сетевая ошибка. Проверьте подключение.');
      }
    });
  }
});
