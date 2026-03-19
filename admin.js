document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const authSection = document.getElementById('auth-section');
  const dashboardSection = document.getElementById('dashboard-section');
  const authError = document.getElementById('auth-error');
  const racesContainer = document.getElementById('races-container');

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
      const response = await fetch('api/admin/_auth.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
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
      const response = await fetch('api/admin/dashboard.php');
      const result = await response.json();

      if (response.ok && result.success) {
        renderRaces(result.races);
      } else if (response.status === 401) {
        dashboardSection.style.display = 'none';
        authSection.style.display = 'block';
      }
    } catch (err) {
      console.error('Data fetch error:', err);
      if (dashboardSection.style.display !== 'none') {
        alert('Ошибка загрузки данных. Обновите страницу.');
      }
    }
  }

  // Отрисовка гонок
  // Отрисовка гонок
  function renderRaces(races) {
    if (!races.length) {
      racesContainer.innerHTML = '<div class="empty-state">Нет запланированных гонок</div>';
      return;
    }

    racesContainer.innerHTML = races.map(race => {
      // Если нет участников
      if (!race.participants.length) {
        return `
                <section class="race-card">
                    <div class="race-header">
                        <h3>${escapeHtml(race.race_name)}</h3>
                        <small>${new Date(race.date).toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</small>
                    </div>
                    <div class="race-info">
                        📍 ${escapeHtml(race.location)} | 
                        👥 ${race.participants_count} участников
                    </div>
                    <div class="category-list">
                        ${race.categories.map(c => `<span class="category-tag">${escapeHtml(c.category_name)}</span>`).join('')}
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
      const columns = Object.keys(firstParticipant).filter(key => key !== 'id');

      const headers = {
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
        created_at: 'Дата реги'
      };

      return `
            <section class="race-card">
                <div class="race-header">
                    <h3>${escapeHtml(race.race_name)}</h3>
                    <small>${new Date(race.date).toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</small>
                </div>
                <div class="race-info">
                    📍 ${escapeHtml(race.location)} | 
                    👥 ${race.participants_count} участников
                </div>
                <div class="category-list">
                    ${race.categories.map(c => `<span class="category-tag">${escapeHtml(c.category_name)}</span>`).join('')}
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                ${columns.map(col => `<th>${escapeHtml(headers[col] || col)}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${race.participants.map((p, idx) => `
                                <tr>
                                    ${columns.map(col => `<td>${escapeHtml(p[col] || '-')}</td>`).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </section>
        `;
    }).join('');
  }

  // HTML-экранирование
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
});