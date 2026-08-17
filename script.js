document.getElementById('year').textContent = new Date().getFullYear();

const form = document.getElementById('quoteForm');
const note = document.getElementById('formNote');

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  console.log('Breeze enquiry:', data);
  note.textContent = 'Enquiry captured in the demo. Next step: connect this form to n8n / Google Sheets / CRM.';
  note.style.color = '#0b74bd';
});
