let currentRaceId = 1;

document.addEventListener('DOMContentLoaded', () => {
  // 1. Мобильное меню (бургер)
  const mobileBtn = document.getElementById('mobile-btn');
  const navList = document.querySelector('.nav-list');

  mobileBtn.addEventListener('click', () => {
    navList.classList.toggle('active');
  });

  // Закрытие меню при клике на ссылку на мобилке
  document.querySelectorAll('.nav-link').forEach(link => {
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

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Отправка...';
    }

    const lastName = formatName(regForm.querySelector('[name="lastName"]').value);
    const firstName = formatName(regForm.querySelector('[name="firstName"]').value);
    const middleName = formatName(regForm.querySelector('[name="middleName"]').value) || null;
    const city = formatName(regForm.querySelector('[name="city"]').value);

    const formData = {
      lastName,
      firstName,
      middleName,
      birthDate: regForm.querySelector('[name="birthDate"]').value,
      city,
      phone: regForm.querySelector('[name="phone"]').value,
      email: regForm.querySelector('[name="email"]').value,
      team: regForm.querySelector('[name="team"]').value || null,
      race_category_id: regForm.querySelector('[name="race_category_id"]').value,
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
        alert('Спасибо! Ваша заявка успешно отправлена.');
        regForm.reset();
      } else if (response.status === 409) {
        alert(`Ошибка: ${result.message}`);
      } else {
        alert(`Ошибка: ${result.message || 'Не удалось отправить заявку.'}`);
      }
    } catch (error) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'ОТПРАВИТЬ ЗАЯВКУ';
      }
      alert('Сетевая ошибка. Проверьте подключение и попробуйте позже.');
      console.error('Ошибка отправки:', error);
    }
  });

  // 4. Подсветка активного пункта меню при скролле
  const sections = document.querySelectorAll('section');
  const navLinks = document.querySelectorAll('.nav-link');

  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.clientHeight;
      if (pageYOffset >= (sectionTop - 100)) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
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
        document.getElementById('hero-title').textContent = race.name.toUpperCase();

        // Дата
        const dateObj = new Date(race.date + 'T00:00:00');
        const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
          'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
        const day = dateObj.getUTCDate();
        const month = months[dateObj.getUTCMonth()];
        const year = dateObj.getUTCFullYear();
        document.getElementById('about-date').innerHTML =
          `<strong>Дата:</strong> ${day} ${month} ${year}г.`;

        // Локация
        if (race.location) {
          let locationHtml = `<strong>Место:</strong> ${race.location}`;
          if (race.location_link) {
            locationHtml += `<br><a href="${race.location_link}" target="_blank" class="link">Смотреть координаты на карте</a>`;
          }
          document.getElementById('about-location').innerHTML = locationHtml;
        }

        // Описание
        if (race.description) {
          document.getElementById('about-description').innerHTML =
            `<strong>Описание:</strong> ${race.description}`;
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

    select.innerHTML = '<option value="" disabled>Загрузка категорий...</option>';

    try {
      const res = await fetch(`api/categories.php?race_id=${raceId}`);
      const categories = await res.json();

      if (!categories.length) {
        select.innerHTML = '<option value="" disabled>Нет доступных категорий</option>';
        return;
      }

      select.innerHTML = '<option value="" disabled selected>Выберите категорию...</option>';
      categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.name;
        select.appendChild(opt);
      });

    } catch (err) {
      console.error(err);
      select.innerHTML = '<option value="" disabled>Ошибка загрузки категорий</option>';
    }
  }

  // Вспомогательная функция загрузки участников
  async function loadParticipants(raceId) {
    const tbody = document.getElementById('participants-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" class="loading">Загрузка участников...</td></tr>';

    try {
      const res = await fetch(`api/participants.php?race_id=${raceId}`);
      const participants = await res.json();

      if (!participants || !participants.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="no-data">Список участников пока пуст</td></tr>';
        return;
      }

      tbody.innerHTML = '';
      participants.forEach(part => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${part.name}</td>
          <td>${part.team || '-'}</td>
          <td>${part.city || '-'}</td>
          <td>${part.category}</td>
          <td>${part.is_paid ? '🟢' : '🔴'}</td>
        `;
        tbody.appendChild(tr);
      });

    } catch (err) {
      console.error('Ошибка загрузки участников:', err);
      tbody.innerHTML = '<tr><td colspan="4" class="error">Ошибка загрузки списка участников</td></tr>';
    }
  }

  // Вспомогательная функция форматирования ФИО
  function formatName(name) {
    if (!name) return '';
    return name
      .toLowerCase()
      .replace(/(?:^|\s|-|')(\w)/g, (_, c) => c.toUpperCase());
  }
});