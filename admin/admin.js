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
    if (!races.length) {
      racesContainer.innerHTML =
        '<div class="empty-state">Нет запланированных гонок</div>';
      return;
    }

    racesContainer.innerHTML = races
      .map((race) => {
        // Если нет участников
        if (!race.participants.length) {
          return `
                <section class="race-card">
                    <div class="race-header">
                        <h3>${escapeHtml(race.race_name)}</h3>
                        <small>${new Date(race.date).toLocaleDateString(
                          'ru-RU',
                          {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          }
                        )}</small>
                        <label class="reg-toggle">
                          <input type="checkbox" class="reg-open-checkbox"
                                 data-race-id="${race.id}"
                                 ${race.registration_open == 1 ? 'checked' : ''}>
                          Регистрация открыта
                        </label>
                        <label class="reg-toggle">
                          <input type="checkbox" class="race-finished-checkbox"
                                 data-race-id="${race.id}"
                                 ${race.is_finished == 1 ? 'checked' : ''}>
                          Гонка завершена
                        </label>
                    </div>
                    <div class="race-info">
                        📍 ${escapeHtml(race.location)} |
                        👥 ${race.participants_count} участников
                        ${
                          race.payment_info
                            ? `<br><strong>Оплата:</strong> ${escapeHtml(
                                race.payment_info
                              )}`
                            : ''
                        }
                    </div>
                    <div class="results-import">
                        <label>Результаты (CSV):</label>
                        <input type="file" class="csv-file-input" accept=".csv" data-race-id="${race.id}">
                        <button class="import-csv-btn" data-race-id="${race.id}">Загрузить</button>
                        <span class="import-status"></span>
                    </div>
                    <div class="category-list">
                        ${race.categories
                          .map(
                            (c) =>
                              `<span class="category-tag">${escapeHtml(
                                c.category_name
                              )}</span>`
                          )
                          .join('')}
                    </div>
                    <div class="table-container">
                        <table>
                            <tr><td class="empty-state">Нет зарегистрированных участников</td></tr>
                        </table>
                    </div>
                </section>
            `;
        }

        const firstParticipant = race.participants[0];
        const columns = Object.keys(firstParticipant).filter(
          (key) => key !== 'id'
        );

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

        return `
            <section class="race-card">
                <div class="race-header">
                    <h3>${escapeHtml(race.race_name)}</h3>
                    <small>${new Date(race.date).toLocaleDateString('ru-RU', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}</small>
                    <label class="reg-toggle">
                      <input type="checkbox" class="reg-open-checkbox"
                             data-race-id="${race.id}"
                             ${race.registration_open == 1 ? 'checked' : ''}>
                      Регистрация открыта
                    </label>
                    <label class="reg-toggle">
                      <input type="checkbox" class="race-finished-checkbox"
                             data-race-id="${race.id}"
                             ${race.is_finished == 1 ? 'checked' : ''}>
                      Гонка завершена
                    </label>
                </div>
                <div class="race-info">
                    📍 ${escapeHtml(race.location)} |
                    👥 ${race.participants_count} участников
                    ${
                      race.payment_info
                        ? `<br><strong>Оплата:</strong> ${escapeHtml(
                            race.payment_info
                          )}`
                        : ''
                    }
                </div>
                <div class="results-import">
                    <label>Результаты (CSV):</label>
                    <input type="file" class="csv-file-input" accept=".csv" data-race-id="${race.id}">
                    <button class="import-csv-btn" data-race-id="${race.id}">Загрузить</button>
                    <span class="import-status"></span>
                </div>
                <div class="category-list">
                    ${race.categories
                      .map(
                        (c) =>
                          `<span class="category-tag">${escapeHtml(
                            c.category_name
                          )}</span>`
                      )
                      .join('')}
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Действия</th>
                                ${columns
                                  .map(
                                    (col) =>
                                      `<th>${escapeHtml(
                                        headers[col] || col
                                      )}</th>`
                                  )
                                  .join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${race.participants
                              .map(
                                (p, idx) => `
                                <tr>
                                    <td>
                                        <button class="edit-participant-btn" 
                                                data-participant-id="${p.id}"
                                                data-race-id="${race.id}"
                                                style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--primary);">
                                            ✎
                                        </button>
                                    </td>
                                    ${columns
                                      .map(
                                        (col) =>
                                          `<td>${escapeHtml(
                                            p[col] || '-'
                                          )}</td>`
                                      )
                                      .join('')}
                                </tr>
                            `
                              )
                              .join('')}
                        </tbody>
                    </table>
                </div>
            </section>
        `;
      })
      .join('');

    // Вешаем обработчики на чекбоксы «Регистрация открыта»
    document.querySelectorAll('.reg-open-checkbox').forEach((checkbox) => {
      checkbox.addEventListener('change', async () => {
        const raceId = parseInt(checkbox.dataset.raceId);
        const newValue = checkbox.checked ? 1 : 0;
        checkbox.disabled = true;
        try {
          const response = await fetch('../api/admin/race_update.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: raceId, registration_open: newValue }),
            credentials: 'same-origin',
          });
          const result = await response.json();
          if (!response.ok || !result.success) {
            checkbox.checked = !checkbox.checked;
            alert(result.error || 'Ошибка обновления');
          }
        } catch (err) {
          checkbox.checked = !checkbox.checked;
          alert('Сетевая ошибка. Проверьте подключение.');
        } finally {
          checkbox.disabled = false;
        }
      });
    });

    // Вешаем обработчики на чекбоксы «Гонка завершена»
    document.querySelectorAll('.race-finished-checkbox').forEach((checkbox) => {
      checkbox.addEventListener('change', async () => {
        const raceId = parseInt(checkbox.dataset.raceId);
        const newValue = checkbox.checked ? 1 : 0;
        checkbox.disabled = true;
        try {
          const response = await fetch('../api/admin/race_update.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: raceId, is_finished: newValue }),
            credentials: 'same-origin',
          });
          const result = await response.json();
          if (!response.ok || !result.success) {
            checkbox.checked = !checkbox.checked;
            alert(result.error || 'Ошибка обновления');
          }
        } catch (err) {
          checkbox.checked = !checkbox.checked;
          alert('Сетевая ошибка. Проверьте подключение.');
        } finally {
          checkbox.disabled = false;
        }
      });
    });

    // Вешаем обработчики на кнопки импорта CSV
    document.querySelectorAll('.import-csv-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const raceId = parseInt(btn.dataset.raceId);
        const container = btn.closest('.results-import');
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

        btn.disabled = true;
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
          btn.disabled = false;
        }
      });
    });

    // Вешаем обработчики на кнопки редактирования
    document.querySelectorAll('.edit-participant-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const participantId = btn.dataset.participantId;
        const raceId = btn.dataset.raceId;
        await openParticipantEdit(participantId, raceId);
      });
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
        categorySelect.innerHTML =
          '<option value="">Выберите категорию</option>';
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
});

// Добавляем CSS-анимацию динамически
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(-20px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
document.head.appendChild(style);


