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

  // 2. Имитация отправки формы
  const regForm = document.getElementById('regForm');

  regForm.addEventListener('submit', (e) => {
    e.preventDefault(); // Останавливаем стандартную перезагрузку страницы

    // В будущем здесь будет код отправки данных в базу данных

    // Показываем уведомление
    alert('Спасибо! Ваша заявка успешно отправлена.');
    regForm.reset(); // Очищаем форму
  });

  // 3. Подсветка активного пункта меню при скролле
  const sections = document.querySelectorAll('section');
  const navLinks = document.querySelectorAll('.nav-link');

  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.clientHeight;
      // Если прокрутили до секции
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
});