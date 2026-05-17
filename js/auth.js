// ── AUTH HELPERS ──────────────────────────────────────────────

function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.getElementById('form-' + tab).classList.add('active');
}

function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 4000);
}

function login() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value.trim();

  if (!email || !password) return showError('login-error', 'Por favor ingresa tu correo y contraseña.');

  const users = JSON.parse(localStorage.getItem('el_users') || '[]');
  const user  = users.find(u => u.email === email && u.password === password);

  if (!user) return showError('login-error', 'Correo o contraseña incorrectos.');

  sessionStorage.setItem('el_current', JSON.stringify({ name: user.name, email: user.email }));
  window.location.href = 'dashboard.html';
}

function register() {
  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value.trim();

  if (!name || !email || !password) return showError('register-error', 'Completa todos los campos.');
  if (password.length < 6) return showError('register-error', 'La contraseña debe tener al menos 6 caracteres.');
  if (!/\S+@\S+\.\S+/.test(email)) return showError('register-error', 'Ingresa un correo válido.');

  let users = JSON.parse(localStorage.getItem('el_users') || '[]');
  if (users.find(u => u.email === email)) return showError('register-error', 'Este correo ya está registrado.');

  users.push({ name, email, password });
  localStorage.setItem('el_users', JSON.stringify(users));

  // Auto-login after register
  sessionStorage.setItem('el_current', JSON.stringify({ name, email }));
  window.location.href = 'dashboard.html';
}

// Support Enter key
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const active = document.querySelector('.auth-form.active');
  if (!active) return;
  active.id === 'form-login' ? login() : register();
});

// Redirect if already logged in
if (sessionStorage.getItem('el_current')) {
  window.location.href = 'dashboard.html';
}
