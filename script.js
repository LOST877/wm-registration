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
  const raceId = urlParams.get('race') || urlParams.get('race_id'); // null → загрузить активную гонку

  // Прижимаем hero под фиксированный хедер по его реальной высоте
  const headerEl = document.querySelector('.header');
  const heroEl = document.querySelector('.hero');
  const scoreboardEl = document.getElementById('race-scoreboard');
  if (headerEl) {
    const h = headerEl.offsetHeight;
    if (heroEl) heroEl.style.marginTop = h + 'px';
    if (scoreboardEl) scoreboardEl.style.top = h + 'px';
  }

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

        renderAbout(race);

        // Обновляем race_id
        const raceIdInput = document.querySelector('input[name="race_id"]');
        if (raceIdInput) raceIdInput.value = race.id;

        // Переключатель гонок (вызываем здесь, чтобы знать реальный race.id)
        loadRaceSwitcher(race.id);

        // Применяем состояние гонки
        applyRaceState(race);

        // Per-race медиаконтент
        renderBanners(race);
        renderSponsors(race);
        renderContacts(race);

        if (race.is_finished == 1) {
          loadResults(race.id);
        } else {
          loadCategories(race.id);
          loadParticipants(race.id, !!(race.payment_info || (race.payment_tiers && race.payment_tiers.length)));
        }
      }
    } catch (err) {
      console.warn('Не удалось загрузить данные гонки:', err);
    }
  }

  const MONTHS = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
  ];

  function formatDate(dateStr) {
    const datePart = dateStr.split(' ')[0];
    const timePart = dateStr.split(' ')[1];
    const [year, monthIndex, day] = datePart.split('-').map(Number);
    const hm = timePart ? timePart.slice(0, 5) : '00:00';
    const timeStr = hm !== '00:00' ? `Старт в ${hm}` : '';
    return { text: `${day} ${MONTHS[monthIndex - 1]} ${year} г.`, sub: timeStr };
  }

  function getTodayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function getCurrentTier(tiers) {
    if (!Array.isArray(tiers) || !tiers.length) return null;
    const today = getTodayStr();
    return [...tiers].reverse().find(t => t.date <= today) ?? null;
  }

  function getUpcomingTiers(tiers) {
    if (!Array.isArray(tiers) || !tiers.length) return [];
    const today = getTodayStr();
    return tiers.filter(t => t.date > today);
  }

  function renderAbout(race) {
    // --- Факт: Дата ---
    if (race.date) {
      const { text, sub } = formatDate(race.date);
      document.getElementById('fact-date-v').textContent = text;
      document.getElementById('fact-date-sub').textContent = sub;
    }

    // --- Факт: Место ---
    if (race.location) {
      // Попробуем разбить «г. Воронеж, лес за СОК Олимпик» → город + детали
      const parts = race.location.split(',');
      document.getElementById('fact-location-v').textContent = parts[0].trim();
      document.getElementById('fact-location-sub').textContent =
        parts.slice(1).join(',').trim();
      const linkEl = document.getElementById('fact-location-link');
      if (race.location_link && /^https?:\/\//i.test(race.location_link)) {
        linkEl.href = race.location_link;
        linkEl.hidden = false;
      }
    }

    // --- Факт: Регистрация ---
    const regV = document.getElementById('fact-reg-v');
    if (race.registration_open == 1) {
      regV.textContent = 'Открыта';
      regV.style.color = 'var(--wm-success)';
    } else {
      regV.textContent = 'Закрыта';
      regV.style.color = 'var(--wm-danger)';
    }

    // --- Панель оплаты (payment_tiers) ---
    const tiers = race.payment_tiers || [];
    const currentTier = getCurrentTier(tiers);
    const upcoming = getUpcomingTiers(tiers);
    const payEl = document.getElementById('about-pay');
    if (currentTier) {
      document.getElementById('pay-amount').textContent = currentTier.amount;
      if (upcoming.length) {
        const untilEl = document.getElementById('pay-until');
        const [uy, um, ud] = upcoming[0].date.split('-').map(Number);
        untilEl.textContent = `до ${ud} ${MONTHS[um - 1]}`;
        untilEl.hidden = false;
        const metaEl = document.getElementById('pay-meta');
        metaEl.innerHTML = upcoming.map(t => {
          const [y, m, d] = t.date.split('-').map(Number);
          return `<span>С ${d} ${MONTHS[m - 1]}: <strong>${t.amount} руб.</strong></span>`;
        }).join('<br>');
      }
      payEl.hidden = false;
    } else if (tiers.length && upcoming.length) {
      // Тиры есть, но ни один ещё не наступил — показываем первый как «скоро»
      const first = upcoming[0];
      const [y, m, d] = first.date.split('-').map(Number);
      document.getElementById('pay-amount').textContent = first.amount;
      const metaEl = document.getElementById('pay-meta');
      metaEl.innerHTML = `С ${d} ${MONTHS[m - 1]} ${y} г.`;
      payEl.hidden = false;
    }

    // --- Оплата: пояснительный текст ---
    if (race.payment_info) {
      const infoEl = document.getElementById('pay-info');
      infoEl.innerHTML = `<strong>Оплата:</strong> ${race.payment_info}`;
      infoEl.hidden = false;
    }

    // --- Описание ---
    if (race.description && typeof marked !== 'undefined') {
      document.getElementById('about-description-content').innerHTML =
        marked.parse(race.description);
      document.getElementById('about-desc').hidden = false;
    }
  }

  function renderAboutCategories(categories) {
    const hasCatDetails = categories.some(c => c.age_from != null || c.description);
    const hasDistDetails = categories.some(c => c.distance_km != null);

    // --- Категории ---
    if (hasCatDetails) {
      const listEl = document.getElementById('cat-list-items');
      listEl.innerHTML = '';
      categories.forEach(c => {
        const row = document.createElement('div');
        row.className = 'cat-row';

        const whoEl = document.createElement('span');
        whoEl.className = 'who';
        whoEl.textContent = c.name;
        if (c.age_from != null || c.age_to != null) {
          const ageEl = document.createElement('small');
          ageEl.textContent = c.age_to != null
            ? `${c.age_from}–${c.age_to} лет`
            : `${c.age_from}+ лет`;
          whoEl.appendChild(ageEl);
        }

        const whatEl = document.createElement('span');
        whatEl.className = 'what';
        whatEl.textContent = c.description || '';

        row.appendChild(whoEl);
        row.appendChild(whatEl);
        listEl.appendChild(row);
      });
      document.getElementById('about-cats').hidden = false;
    }

    // --- Дистанции ---
    if (hasDistDetails) {
      const listEl = document.getElementById('dist-list-items');
      listEl.innerHTML = '';
      categories.forEach(c => {
        if (c.distance_km == null) return;
        const row = document.createElement('div');
        row.className = 'dist-row';

        const whoEl = document.createElement('span');
        whoEl.className = 'who';
        whoEl.textContent = c.name;

        const kmEl = document.createElement('span');
        kmEl.className = 'km';
        kmEl.innerHTML = `${c.distance_km}<small>км</small>`;

        const lapsEl = document.createElement('span');
        lapsEl.className = 'meta';
        lapsEl.textContent = c.laps != null ? `${c.laps} кр.` : '';

        const elevEl = document.createElement('span');
        elevEl.className = 'meta';
        elevEl.textContent = c.elevation_m != null ? `↑${c.elevation_m} м` : '';

        row.appendChild(whoEl);
        row.appendChild(kmEl);
        row.appendChild(lapsEl);
        row.appendChild(elevEl);
        listEl.appendChild(row);
      });
      document.getElementById('about-dist').hidden = false;
    }
  }

  function renderBanners(race) {
    const hero = document.querySelector('.hero');
    if (!hero) return;
    hero.dataset.bannerDesktop = race.banner_desktop || '';
    hero.dataset.bannerMobile  = race.banner_mobile  || '';
    const isMobile = window.innerWidth <= 768;
    const file = isMobile ? race.banner_mobile : race.banner_desktop;
    if (file) hero.style.backgroundImage = `url('assets/races/${encodeURIComponent(file)}')`;
  }

  let bannerResizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(bannerResizeTimer);
    bannerResizeTimer = setTimeout(() => {
      const hero = document.querySelector('.hero');
      if (!hero) return;
      const isMobile = window.innerWidth <= 768;
      const file = isMobile ? hero.dataset.bannerMobile : hero.dataset.bannerDesktop;
      if (file) hero.style.backgroundImage = `url('assets/races/${encodeURIComponent(file)}')`;
    }, 150);
  });

  function isSafeUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return /^https?:\/\//i.test(url.trim());
  }

  function renderSponsors(race) {
    const section = document.getElementById('sponsors');
    const container = document.getElementById('sponsor-logos');
    const navItem = document.getElementById('nav-sponsors-item');
    const hide = () => {
      if (section) section.style.display = 'none';
      if (navItem) navItem.style.display = 'none';
    };
    if (!section || !container) return;
    if (!race.sponsors_json) { hide(); return; }
    let sponsors;
    try { sponsors = JSON.parse(race.sponsors_json); } catch { hide(); return; }
    if (!Array.isArray(sponsors) || sponsors.length === 0) { hide(); return; }

    const tpl = document.getElementById('tpl-sponsor');
    container.innerHTML = '';
    sponsors.forEach((s) => {
      const frag = tpl.content.cloneNode(true);
      const div = frag.querySelector('.sponsor');
      if (isSafeUrl(s.url)) {
        const a = document.createElement('a');
        a.href = s.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = s.name || '';
        div.appendChild(a);
      } else {
        div.textContent = s.name || '';
      }
      container.appendChild(frag);
    });
    section.style.display = '';
    if (navItem) navItem.style.display = '';
  }

  function renderContacts(race) {
    const dynamic  = document.getElementById('contacts-dynamic');
    const fallback = document.getElementById('contacts-fallback');
    if (!dynamic) return;
    if (!race.contacts_json) return;
    let contacts;
    try { contacts = JSON.parse(race.contacts_json); } catch { return; }
    if (!Array.isArray(contacts) || contacts.length === 0) return;

    const tplGroup = document.getElementById('tpl-contact-group');
    const tplLink  = document.getElementById('tpl-contact-link');

    dynamic.innerHTML = '';
    contacts.forEach((item) => {
      if (item.role && Array.isArray(item.entries)) {
        const groupFrag = tplGroup.content.cloneNode(true);
        const div = groupFrag.querySelector('.socials');
        const h3 = div.querySelector('.contact-role');
        h3.textContent = item.role;
        h3.hidden = false;
        item.entries.forEach((entry) => {
          const label = [entry.name, entry.phone].filter(Boolean).join(' ');
          if (entry.phone) {
            const linkFrag = tplLink.content.cloneNode(true);
            const a = linkFrag.querySelector('a');
            a.href = `tel:${entry.phone.replace(/\s/g, '')}`;
            a.textContent = label;
            div.appendChild(a);
          } else {
            const span = document.createElement('span');
            span.textContent = label;
            div.appendChild(span);
          }
        });
        dynamic.appendChild(groupFrag);
      } else if (item.name !== undefined && item.link !== undefined) {
        // Формат {name, link} из редактора "Ссылки и ресурсы"
        const div = document.createElement('div');
        div.className = 'socials';
        const linkFrag = tplLink.content.cloneNode(true);
        const a = linkFrag.querySelector('a');
        a.href = isSafeUrl(item.link) ? item.link : '#';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = item.name;
        div.appendChild(a);
        dynamic.appendChild(div);
      } else {
        // legacy single-key format: {"Текст": "url"}
        const linkKey = Object.keys(item).find((k) => k !== 'role' && k !== 'entries');
        if (linkKey && typeof item[linkKey] === 'string') {
          const div = document.createElement('div');
          div.className = 'socials';
          const linkFrag = tplLink.content.cloneNode(true);
          const a = linkFrag.querySelector('a');
          a.href = isSafeUrl(item[linkKey]) ? item[linkKey] : '#';
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.textContent = linkKey;
          div.appendChild(a);
          dynamic.appendChild(div);
        }
      }
    });
    if (fallback) fallback.style.display = 'none';
  }

  async function loadRaceSwitcher(currentId) {
    const scoreboard = document.getElementById('race-scoreboard');
    if (!scoreboard) return;
    try {
      const res = await fetch('api/races.php');
      const races = await res.json();
      if (!Array.isArray(races) || races.length < 2) return;

      const activeId = currentId ? parseInt(currentId, 10) : null;
      const rail = scoreboard.querySelector('.sb-rail');
      rail.innerHTML = '';

      races.forEach((r) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sc-item' + (r.id === activeId ? ' active' : '');
        btn.innerHTML = `
          <span class="sc-stage">${r.stage || ''}</span>
          <span class="sc-name">${r.name}</span>
          <span class="sc-foot">
            <span class="sc-date">${r.date_label || ''}</span>
            <span class="sc-status st-${r.status}">
              <span class="sb-dot dot-${r.status}"></span>${r.status_label || ''}
            </span>
          </span>`;
        btn.addEventListener('click', () => {
          location.href = `?race=${encodeURIComponent(r.id)}`;
        });
        rail.appendChild(btn);
      });

      scoreboard.style.display = '';
    } catch (err) {
      console.warn('Не удалось загрузить список гонок:', err);
    }
  }

  // Вспомогательная функция загрузки категорий
  async function loadCategories(raceId) {
    const select = document.querySelector('select[name="race_category_id"]');
    if (!select) return;

    select.innerHTML = '';
    const loadingOpt = document.createElement('option');
    loadingOpt.disabled = true;
    loadingOpt.textContent = 'Загрузка категорий...';
    select.appendChild(loadingOpt);

    try {
      const res = await fetch(`api/categories.php?race_id=${raceId}`);
      const categories = await res.json();

      select.innerHTML = '';
      if (!categories.length) {
        const opt = document.createElement('option');
        opt.disabled = true;
        opt.textContent = 'Нет доступных категорий';
        select.appendChild(opt);
        return;
      }

      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.disabled = true;
      defaultOpt.selected = true;
      defaultOpt.textContent = 'Выберите категорию...';
      select.appendChild(defaultOpt);

      categories.forEach((cat) => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.name;
        select.appendChild(opt);
      });

      renderAboutCategories(categories);
    } catch (err) {
      console.error(err);
      select.innerHTML = '';
      const opt = document.createElement('option');
      opt.disabled = true;
      opt.textContent = 'Ошибка загрузки категорий';
      select.appendChild(opt);
    }
  }

  // Вспомогательная функция создания строки-статуса в таблице
  function makeStatusRow(colSpan, className, text) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = colSpan;
    td.className = className;
    td.textContent = text;
    tr.appendChild(td);
    return tr;
  }

  // Вспомогательная функция загрузки участников
  async function loadParticipants(raceId, showPayment) {
    const tbody = document.getElementById('participants-tbody');
    const thPayment = document.getElementById('th-payment');
    if (!tbody) return;

    const cols = showPayment ? 5 : 4;
    if (thPayment) thPayment.style.display = showPayment ? '' : 'none';

    tbody.innerHTML = '';
    tbody.appendChild(makeStatusRow(cols, 'loading', 'Загрузка участников...'));

    try {
      const res = await fetch(`api/participants.php?race_id=${raceId}`);
      const participants = await res.json();

      tbody.innerHTML = '';
      if (!participants || !participants.length) {
        tbody.appendChild(makeStatusRow(cols, 'no-data', 'Список участников пока пуст'));
        return;
      }

      const tpl = document.getElementById('tpl-participant-row');
      participants.forEach((part) => {
        const frag = tpl.content.cloneNode(true);
        const row = frag.querySelector('tr');
        row.querySelector('.td-name').textContent =
          `${part.last_name} ${part.first_name}`;
        row.querySelector('.td-team').textContent = part.team || '-';
        row.querySelector('.td-city').textContent = part.city || '-';
        row.querySelector('.td-category').textContent = part.category || '-';
        const tdPayment = row.querySelector('.td-payment');
        if (showPayment) {
          tdPayment.textContent = part.is_paid ? '🟢' : '🔴';
          tdPayment.style.display = '';
        }
        tbody.appendChild(frag);
      });
    } catch (err) {
      console.error('Ошибка загрузки участников:', err);
      tbody.innerHTML = '';
      tbody.appendChild(makeStatusRow(cols, 'error', 'Ошибка загрузки списка участников'));
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
        tbody.innerHTML = '';
        tbody.appendChild(makeStatusRow(10, 'no-data', 'Результаты пока не опубликованы'));
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

        // Заголовки
        theadRow.innerHTML = '';
        const headerTexts = ['Место', 'Номер', 'Участник', 'Год', 'Город'];
        if (isAbsolut) headerTexts.push('Категория');
        for (let i = 1; i <= lapCount; i++) headerTexts.push(`Круг ${i}`);
        headerTexts.forEach((text) => {
          const th = document.createElement('th');
          th.textContent = text;
          theadRow.appendChild(th);
        });

        tbody.innerHTML = '';
        if (!rows.length) {
          const colspan = (isAbsolut ? 6 : 5) + lapCount;
          tbody.appendChild(makeStatusRow(colspan, 'no-data', 'Нет данных для этой категории'));
          return;
        }

        rows.forEach((r, idx) => {
          const place = isAbsolut ? r.place : idx + 1;
          const name = [r.last_name, r.first_name].filter(Boolean).join(' ');
          const tr = document.createElement('tr');

          const cellValues = [place, r.bib_number ?? '-', name, r.birth_year ?? '-', r.city ?? '-'];
          if (isAbsolut) cellValues.push(r.category ?? '-');
          for (let i = 0; i < lapCount; i++) cellValues.push(r.laps[i] ?? '-');

          cellValues.forEach((val) => {
            const td = document.createElement('td');
            td.textContent = val;
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
          tr.addEventListener('click', () => {
            const already = tr.classList.contains('selected');
            tbody.querySelectorAll('tr.selected').forEach((el) => el.classList.remove('selected'));
            if (!already) tr.classList.add('selected');
          });
        });
      }

      function buildTabs() {
        const tpl = document.getElementById('tpl-category-tab');
        tabsContainer.innerHTML = '';
        tabs.forEach((t) => {
          const frag = tpl.content.cloneNode(true);
          const btn = frag.querySelector('.category-tab');
          btn.textContent = t;
          btn.dataset.cat = t;
          if (t === activeFilter) btn.classList.add('active');
          btn.addEventListener('click', () => {
            activeFilter = btn.dataset.cat;
            tabsContainer.querySelectorAll('.category-tab').forEach((b) => {
              b.classList.toggle('active', b.dataset.cat === activeFilter);
            });
            renderTable();
          });
          tabsContainer.appendChild(frag);
        });
      }

      buildTabs();
      renderTable();
    } catch (err) {
      console.error('Ошибка загрузки результатов:', err);
      tbody.innerHTML = '';
      tbody.appendChild(makeStatusRow(10, 'error', 'Ошибка загрузки результатов'));
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

    popupTitle.textContent = title;
    popupText.textContent = text;

    const icons = { success: '✅', error: '❌', warning: '⚠️' };
    popupIcon.textContent = icons[type] || '☁️';

    popupConfirmBtn.onclick = closePopup;
    popupCloseBtn.onclick = closePopup;

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

});
