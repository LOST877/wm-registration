let currentRaceId = 1;

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
  const raceId = urlParams.get('race') || 1;
  const raceInput = document.querySelector('input[name="race_id"]');
  if (raceInput) raceInput.value = raceId;

  // Загрузка информации о гонке
  loadRaceInfo();

  // 3. Отправка формы
  const regForm = document.getElementById('regForm');
  const submitBtn = document.getElementById('submitBtn');

  regForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Валидация телефона — минимум 11 цифр (+7 + 10 цифр)
    const phoneInput = regForm.querySelector('[name="phone"]');
    const phoneDigits = phoneInput.value.replace(/\D/g, '');
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
      phone: phoneInput.value,
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
        showPopup('error', 'Ошибка', result.message);
      } else {
        showPopup(
          'error',
          'Ошибка',
          result.message || 'Не удалось отправить заявку.'
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
  async function loadRaceInfo() {
    try {
      const res = await fetch('api/race.php');
      const race = await res.json();

      if (!race.error) {
        currentRaceId = race.id;

        // Hero
        document.getElementById('hero-title').textContent =
          race.name.toUpperCase();

        // Дата
        const dateObj = new Date(race.date + 'T00:00:00');
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
        const day = dateObj.getUTCDate();
        const month = months[dateObj.getUTCMonth()];
        const year = dateObj.getUTCFullYear();
        document.getElementById(
          'about-date'
        ).innerHTML = `<strong>Дата:</strong> ${day} ${month} ${year}г.`;

        // Локация
        if (race.location) {
          let locationHtml = `<strong>Место:</strong> ${race.location}`;
          if (race.location_link) {
            locationHtml += `<br><a href="${race.location_link}" target="_blank" class="link">Смотреть координаты на карте</a>`;
          }
          document.getElementById('about-location').innerHTML = locationHtml;
        }

        // Карта
        if (race.iframe_html) {
          const mapContainer = document.getElementById('about-map');
          mapContainer.innerHTML = race.iframe_html;
        }

        // Описание
        if (race.description) {
          document.getElementById(
            'about-description'
          ).innerHTML = `<strong>Описание:</strong> ${race.description}`;
        }

        // Оплата
        if (race.payment_info) {
          document.getElementById(
            'about-payment'
          ).innerHTML = `<strong>Оплата:</strong> ${race.payment_info}`;
        }

        // Обновляем race_id
        const raceIdInput = document.querySelector('input[name="race_id"]');
        if (raceIdInput) raceIdInput.value = race.id;

        // Загружаем категории в форму
        loadCategories(race.id);

        // Загружаем участников для этой гонки
        loadParticipants(race.id);
      }
    } catch (err) {
      console.warn('Не удалось загрузить данные гонки:', err);
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
  document.querySelectorAll('input[data-phone-mask]').forEach((input) => {
    // При фокусе — сразу +7, если поле пустое
    input.addEventListener('focus', () => {
      const val = input.value.trim();
      if (val === '' || !val.startsWith('+7')) {
        input.value = '+7';
      }
    });

    // При потере фокуса — оставляем только цифры и +7 в начале
    input.addEventListener('blur', () => {
      const digits = input.value.replace(/\D/g, '');
      if (digits.startsWith('7') || digits.startsWith('8')) {
        input.value = '+7' + digits.slice(1, 11);
      } else if (digits.length > 0) {
        input.value = '+7' + digits.slice(2, 12);
      } else {
        input.value = '';
      }
      input.setSelectionRange(input.value.length, input.value.length);
    });

    // Ограничение ввода: только цифры, максимум 10 после +7
    input.addEventListener('input', (e) => {
      const val = input.value;
      const startPos = input.selectionStart;

      // Оставляем только цифры
      let digits = val.replace(/\D/g, '');

      // Если ввели буквы/символы, удаляем их
      if (digits !== val.replace(/[^\d+()\- ]/g, '')) {
        input.value = '+' + digits.slice(0, 11);
        input.setSelectionRange(startPos, startPos);
        return;
      }

      // Ограничиваем 10 цифрами после +7
      if (digits.length > 11) {
        input.value = '+7' + digits.slice(1, 11);
        input.setSelectionRange(input.value.length, input.value.length);
        return;
      }
    });
  });
});
