document.getElementById('year').textContent = new Date().getFullYear();

const header = document.querySelector('.top');
const floatWa = document.querySelector('.float-wa');
const hero = document.querySelector('.hero');
const onScroll = () => {
  const past = window.scrollY > hero.offsetHeight - 90;
  header.classList.toggle('solid', past);
  floatWa.classList.toggle('on', window.scrollY > hero.offsetHeight * 0.8);
};
addEventListener('scroll', onScroll, { passive: true });
onScroll();

const menuBtn = document.getElementById('menuBtn');
const nav = document.getElementById('nav');
const setMenu = (open) => {
  nav.classList.toggle('open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  if (open) header.classList.add('solid'); else onScroll();
};
menuBtn.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));

document.getElementById('enquiry').addEventListener('submit', (e) => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(e.currentTarget));
  const line = (k, v) => (v ? `${k}: ${v}` : null);
  const text = [
    'Hello Breeze, I need cooling for an event.',
    '',
    line('Name', d.name),
    line('Phone', d.phone),
    line('Event', d.event),
    line('Venue', d.location),
    line('Dates', [d.from, d.to].filter(Boolean).join(' to ')),
    line('Covered area', d.area && `${d.area} sq ft`),
    line('Guests', d.guests),
    line('Structure', d.structure),
    line('Notes', d.notes),
  ].filter((l) => l !== null).join('\n');
  const url = `https://wa.me/919319373572?text=${encodeURIComponent(text)}`;
  if (/Android|iPhone|iPad/i.test(navigator.userAgent)) location.href = url;
  else window.open(url, '_blank', 'noopener');
});
