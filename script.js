// Mobile menu
const menuBtn = document.getElementById('menuBtn');
const navLinks = document.getElementById('navLinks');
menuBtn.addEventListener('click', () => navLinks.classList.toggle('open'));
navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => navLinks.classList.remove('open')));

// Reveal on scroll
const io = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('show'); io.unobserve(e.target); } });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// Pricing toggle
document.querySelectorAll('#billing button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#billing button').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
    const p = btn.dataset.p;
    document.querySelectorAll('[data-m]').forEach(el => { el.textContent = el.dataset[p]; });
  });
});

// Signup form
document.getElementById('ctaForm').addEventListener('submit', e => {
  e.preventDefault();
  e.target.hidden = true;
  document.getElementById('formMsg').hidden = false;
});

document.getElementById('yr').textContent = new Date().getFullYear();
