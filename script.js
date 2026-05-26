let currentRaceId = 1;

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

marked.use({
  gfm: true,
  breaks: true,
  renderer: { html() { return ''; } },
});

document.addEventListener('DOMContentLoaded', () => {
  // 1. Мобильное меню (бургер)
  const mobileBtn = document.getElementById('mobile-btn');
  const navList = document.querySelector('.nav-list');

  mobileBtn.addEventListener('click', () => {
    navList.classList.toggle('active');
  });

  // Закрытие меню при клике на ссылку на мобилке
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', () => {
      navList.classList.remove('active');
    });
  });

  // 2. Подстановка race_id и загрузка информации о гонке
  const urlParams = new URLSearchParams(window.location.search);
  const raceId = urlParams.get('race'); // null → загрузить активную гонку

  // Загрузка информации о гонке
  loadRaceInfo(raceId);

  // 3. Отправка формы
  const regForm = document.getElementById('regForm');
  const submitBtn = document.getElementById('submitBtn');

  regForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Валидация телефона — минимум 11 цифр (+7 + 10 цифр)
    const phoneInput = regForm.querySelector('[name="phone"]');
    const phoneDigits = phoneInput.dataset.digits.replace(/\D/g, '');
    if (phoneDigits.length < 11) {
      showPopup(
        'error',
        'Ошибка',
        'Номер телефона должен содержать 10 цифр (формат +7 XXX XXX XX XX).'
      );
      phoneInput.focus();
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Отправка...';
    }

    const lastName = formatName(
      regForm.querySelector('[name="lastName"]').value
    );
    const firstName = formatName(
      regForm.querySelector('[name="firstName"]').value
    );
    const middleName =
      formatName(regForm.querySelector('[name="middleName"]').value) || null;
    const city = formatName(regForm.querySelector('[name="city"]').value);

    const formData = {
      lastName,
      firstName,
      middleName,
      birthDate: regForm.querySelector('[name="birthDate"]').value,
      city,
      phone: phoneDigits,
      email: regForm.querySelector('[name="email"]').value,
      team: regForm.querySelector('[name="team"]').value || null,
      race_category_id: regForm.querySelector('[name="race_category_id"]')
        .value,
      race_id: currentRaceId,
    };

    try {
      const response = await fetch('api/register.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'ОТПРАВИТЬ ЗАЯВКУ';
      }

      if (response.ok) {
        showPopup('success', 'Спасибо!', 'Ваша заявка успешно отправлена.');
        regForm.reset();
        loadParticipants(currentRaceId);
      } else if (response.status === 409) {
        showPopup('error', 'Ошибка', result.error);
      } else {
        showPopup(
          'error',
          'Ошибка',
          result.error || 'Не удалось отправить заявку.'
        );
      }
    } catch (error) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'ОТПРАВИТЬ ЗАЯВКУ';
      }
      showPopup(
        'error',
        'Сетевая ошибка',
        'Проверьте подключение и попробуйте позже.'
      );
      console.error('Ошибка отправки:', error);
    }
  });

  // 4. Подсветка активного пункта меню при скролле
  const sections = document.querySelectorAll('section');
  const navLinks = document.querySelectorAll('.nav-link');

  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach((section) => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.clientHeight;
      if (pageYOffset >= sectionTop - 100) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach((link) => {
      link.classList.remove('active');
      if (link.getAttribute('href').includes(current)) {
        link.classList.add('active');
      }
    });
  });

  // Функция загрузки данных гонки из API
  async function loadRaceInfo(raceId) {
    try {
      const url = raceId ? `api/race.php?race_id=${raceId}` : 'api/race.php';
      const res = await fetch(url);
      const race = await res.json();

      if (!race.error) {
        currentRaceId = race.id;

        // Hero
        document.getElementById('hero-title').textContent =
          race.name.toUpperCase();

        // Дата
        const months = [
          'января',
          'февраля',
          'марта',
          'апреля',
          'мая',
          'июня',
          'июля',
          'августа',
          'сентября',
          'октября',
          'ноября',
          'декабря',
        ];
        const datePart = race.date.split(' ')[0];
        const timePart = race.date.split(' ')[1];
        const [year, monthIndex, day] = datePart.split('-').map(Number);
        const month = months[monthIndex - 1];
        const hm = timePart ? timePart.slice(0, 5) : '00:00';
        const timeStr = hm !== '00:00' ? `, начало в ${hm}` : '';
        document.getElementById(
          'about-date'
        ).innerHTML = `<strong>Дата:</strong> ${day} ${month} ${year}г.${timeStr}`;

        // Локация
        if (race.location) {
          const locationEl = document.getElementById('about-location');
          locationEl.innerHTML = `<strong>Место:</strong> ${escapeHtml(race.location)}`;
          if (race.location_link) {
            const a = document.createElement('a');
            a.href = race.location_link;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.className = 'link';
            a.textContent = 'Смотреть координаты на карте';
            if (a.protocol === 'https:' || a.protocol === 'http:') {
              locationEl.appendChild(document.createElement('br'));
              locationEl.appendChild(a);
            }
          }
        }

        // Карта
        if (race.iframe_html) {
          const mapContainer = document.getElementById('about-map');
          mapContainer.innerHTML = race.iframe_html;
        }

        // Описание
        if (race.description) {
          document.getElementById('about-description').innerHTML =
            `<strong>Описание:</strong><div class="md-content">${marked.parse(race.description)}</div>`;
        }

        // Оплата
        if (race.payment_info) {
          document.getElementById('about-payment').innerHTML =
            `<strong>Оплата:</strong><div class="md-content">${marked.parse(race.payment_info)}</div>`;
        }

        // Обновляем race_id
        const raceIdInput = document.querySelector('input[name="race_id"]');
        if (raceIdInput) raceIdInput.value = race.id;

        // Переключатель гонок (вызываем здесь, чтобы знать реальный race.id)
        loadRaceSwitcher(race.id);

        // Применяем состояние гонки
        applyRaceState(race);

        if (race.is_finished == 1) {
          loadResults(race.id);
        } else {
          loadCategories(race.id);
          loadParticipants(race.id);
        }
      }
    } catch (err) {
      console.warn('Не удалось загрузить данные гонки:', err);
    }
  }

  async function loadRaceSwitcher(currentId) {
    const switcher = document.getElementById('race-switcher');
    if (!switcher) return;
    try {
      const res = await fetch('api/races.php');
      const races = await res.json();
      if (!Array.isArray(races) || races.length < 2) return;

      const activeId = currentId ? parseInt(currentId, 10) : null;
      switcher.innerHTML = races
        .map((r) => {
          const year = r.date ? r.date.split('-')[0] : '';
          const label = year ? `${escapeHtml(r.name)} ${escapeHtml(year)}` : escapeHtml(r.name);
          const isActive = r.id === activeId;
          const href = `?race=${encodeURIComponent(r.id)}`;
          return `<a href="${href}" class="race-tab${isActive ? ' active' : ''}">${label}</a>`;
        })
        .join('');
      switcher.style.display = '';
    } catch (err) {
      console.warn('Не удалось загрузить список гонок:', err);
    }
  }

  // Вспомогательная функция загрузки категорий
  async function loadCategories(raceId) {
    const select = document.querySelector('select[name="race_category_id"]');
    if (!select) return;

    select.innerHTML =
      '<option value="" disabled>Загрузка категорий...</option>';

    try {
      const res = await fetch(`api/categories.php?race_id=${raceId}`);
      const categories = await res.json();

      if (!categories.length) {
        select.innerHTML =
          '<option value="" disabled>Нет доступных категорий</option>';
        return;
      }

      select.innerHTML =
        '<option value="" disabled selected>Выберите категорию...</option>';
      categories.forEach((cat) => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.name;
        select.appendChild(opt);
      });
    } catch (err) {
      console.error(err);
      select.innerHTML =
        '<option value="" disabled>Ошибка загрузки категорий</option>';
    }
  }

  // Вспомогательная функция загрузки участников
  async function loadParticipants(raceId) {
    const tbody = document.getElementById('participants-tbody');
    if (!tbody) return;

    tbody.innerHTML =
      '<tr><td colspan="4" class="loading">Загрузка участников...</td></tr>';

    try {
      const res = await fetch(`api/participants.php?race_id=${raceId}`);
      const participants = await res.json();

      if (!participants || !participants.length) {
        tbody.innerHTML =
          '<tr><td colspan="4" class="no-data">Список участников пока пуст</td></tr>';
        return;
      }

      tbody.innerHTML = '';
      participants.forEach((part) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${part.last_name} ${part.first_name}</td>
          <td>${part.team || '-'}</td>
          <td>${part.city || '-'}</td>
          <td>${part.category}</td>
          <td>${part.is_paid ? '🟢' : '🔴'}</td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error('Ошибка загрузки участников:', err);
      tbody.innerHTML =
        '<tr><td colspan="4" class="error">Ошибка загрузки списка участников</td></tr>';
    }
  }

  function applyRaceState(race) {
    const regStatus = document.getElementById('hero-reg-status');
    const regBtn = document.getElementById('hero-reg-btn');
    const navRegLink = document.getElementById('nav-reg-link');
    const regSection = document.getElementById('registration');
    const participantsSection = document.getElementById('participants');
    const resultsSection = document.getElementById('results');

    if (race.is_finished == 1) {
      regStatus.textContent = 'ГОНКА ЗАВЕРШЕНА';
      regBtn.textContent = 'РЕЗУЛЬТАТЫ';
      regBtn.href = '#results';
      if (navRegLink) {
        navRegLink.textContent = 'Результаты';
        navRegLink.href = '#results';
      }
      if (regSection) regSection.style.display = 'none';
      if (participantsSection) participantsSection.style.display = 'none';
      if (resultsSection) resultsSection.style.display = 'block';
    } else if (race.registration_open != 1) {
      regStatus.textContent = 'РЕГИСТРАЦИЯ ЗАКРЫТА';
      regBtn.textContent = 'СПИСОК УЧАСТНИКОВ';
      regBtn.href = '#participants';
      if (navRegLink) {
        navRegLink.textContent = 'Участники';
        navRegLink.href = '#participants';
      }
      if (regSection) regSection.style.display = 'none';
    }
  }

  async function loadResults(raceId) {
    const tbody = document.getElementById('results-tbody');
    const tabsContainer = document.getElementById('results-categories');
    const theadRow = document.getElementById('results-thead-row');
    if (!tbody || !tabsContainer || !theadRow) return;

    try {
      const res = await fetch(`api/results.php?race_id=${raceId}`);
      const data = await res.json();

      if (!data.success || !data.results.length) {
        tbody.innerHTML = '<tr><td colspan="10" class="no-data">Результаты пока не опубликованы</td></tr>';
        return;
      }

      const results = data.results;

      const seenCats = new Set();
      const categories = [];
      results.forEach((r) => {
        if (r.category && !seenCats.has(r.category)) {
          seenCats.add(r.category);
          categories.push(r.category);
        }
      });

      const tabs = ['Абсолют', ...categories];
      let activeFilter = 'Абсолют';

      function getLapCount(rows) {
        if (!rows.length) return 0;
        return rows[0].laps ? rows[0].laps.length : 0;
      }

      function renderTable() {
        const isAbsolut = activeFilter === 'Абсолют';
        const rows = isAbsolut
          ? results
          : results.filter((r) => r.category === activeFilter);

        const lapCount = getLapCount(rows);

        let ths = '<th>Место</th><th>Номер</th><th>Участник</th><th>Год</th><th>Город</th>';
        if (isAbsolut) ths += '<th>Категория</th>';
        for (let i = 1; i <= lapCount; i++) ths += `<th>Круг ${i}</th>`;
        theadRow.innerHTML = ths;

        tbody.innerHTML = '';
        if (!rows.length) {
          const colspan = (isAbsolut ? 6 : 5) + lapCount;
          tbody.innerHTML = `<tr><td colspan="${colspan}" class="no-data">Нет данных для этой категории</td></tr>`;
          return;
        }

        rows.forEach((r, idx) => {
          const place = isAbsolut ? r.place : idx + 1;
          const name = [r.last_name, r.first_name].filter(Boolean).join(' ');
          const tr = document.createElement('tr');

          let cells = `<td>${place}</td><td>${r.bib_number ?? '-'}</td>`;
          cells += `<td>${name}</td>`;
          cells += `<td>${r.birth_year ?? '-'}</td>`;
          cells += `<td>${r.city ?? '-'}</td>`;
          if (isAbsolut) cells += `<td>${r.category ?? '-'}</td>`;
          for (let i = 0; i < lapCount; i++) {
            cells += `<td>${r.laps[i] ?? '-'}</td>`;
          }
          tr.innerHTML = cells;
          tbody.appendChild(tr);
          tr.addEventListener('click', () => {
            const already = tr.classList.contains('selected');
            tbody.querySelectorAll('tr.selected').forEach(el => el.classList.remove('selected'));
            if (!already) tr.classList.add('selected');
          });
        });
      }

      function buildTabs() {
        tabsContainer.innerHTML = tabs
          .map(
            (t) =>
              `<button class="category-tab${t === activeFilter ? ' active' : ''}" data-cat="${t}">${t}</button>`
          )
          .join('');
        tabsContainer.querySelectorAll('.category-tab').forEach((btn) => {
          btn.addEventListener('click', () => {
            activeFilter = btn.dataset.cat;
            buildTabs();
            renderTable();
          });
        });
      }

      buildTabs();
      renderTable();
    } catch (err) {
      console.error('Ошибка загрузки результатов:', err);
      tbody.innerHTML = '<tr><td colspan="10" class="error">Ошибка загрузки результатов</td></tr>';
    }
  }

  // Вспомогательная функция форматирования ФИО
  function formatName(name) {
    if (!name) return '';
    return name
      .toLowerCase()
      .replace(/(?:^|[\s-'])([а-яёa-z])/gi, (_, c) => c.toUpperCase());
  }

  // ===== ПОПАПЫ (MODALS) ===== //
  // Создаем попап один раз
  if (!document.getElementById('popup-overlay')) {
    const popupHTML = `
      <div id="popup-overlay" class="popup-overlay">
        <div class="popup-container">
          <button id="popup-close" class="popup-close" aria-label="Закрыть">&times;</button>
          <span id="popup-icon" class="popup-icon">☁️</span>
          <h3 id="popup-title" class="popup-title"></h3>
          <p id="popup-text" class="popup-text"></p>
          <div id="popup-actions" class="popup-actions">
            <button id="popup-confirm-btn" class="btn btn-primary">OK</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', popupHTML);
  }

  const popupOverlay = document.getElementById('popup-overlay');
  const popupTitle = document.getElementById('popup-title');
  const popupText = document.getElementById('popup-text');
  const popupIcon = document.getElementById('popup-icon');
  const popupCloseBtn = document.getElementById('popup-close');
  const popupConfirmBtn = document.getElementById('popup-confirm-btn');

  // Закрытие попапа
  function closePopup() {
    popupOverlay.classList.remove(
      'active',
      'popup-success',
      'popup-error',
      'popup-warning'
    );
  }

  // Показ попапа
  window.showPopup = function (type, title, text) {
    popupOverlay.classList.add('active', `popup-${type}`);

    // Установка контента
    popupTitle.textContent = title;
    popupText.textContent = text;

    // Иконки
    const icons = { success: '✅', error: '❌', warning: '⚠️' };
    popupIcon.textContent = icons[type] || '☁️';

    // Кнопка OK
    popupConfirmBtn.onclick = closePopup;
    popupCloseBtn.onclick = closePopup;

    // Закрытие по клику вне окна
    popupOverlay.onclick = (e) => {
      if (e.target === popupOverlay) closePopup();
    };
  };

  // Форматирование телефона по шаблону +7 (XXX) XXX-XX-XX
  const phoneInput = document.querySelector('input[data-phone-mask]');
  if (phoneInput) {
    const mask = IMask(phoneInput, {
      mask: '+{7}(000)000-00-00',
      lazy: false,
      placeholderChar: '_',
    });

    phoneInput.addEventListener(
      'input',
      (e) => (phoneInput.dataset.digits = mask.unmaskedValue)
    );
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
});
