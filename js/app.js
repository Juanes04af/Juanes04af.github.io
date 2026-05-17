// ── INIT ─────────────────────────────────────────────────────
const currentUser = JSON.parse(sessionStorage.getItem('el_current'));
if (!currentUser) window.location.href = 'index.html';

document.getElementById('sb-name').textContent = currentUser.name;

let map = null;
let selectedStation = null;
let pendingCancelCode = null;

// ── STORAGE HELPERS ───────────────────────────────────────────
function getReservations() {
  return JSON.parse(localStorage.getItem('el_reservations') || '[]');
}

function saveReservations(data) {
  localStorage.setItem('el_reservations', JSON.stringify(data));
}

function genCode() {
  const all = getReservations();
  let code;
  do {
    code = String(Math.floor(1000 + Math.random() * 9000));
  } while (all.find(r => r.code === code));
  return code;
}

// ── NAVIGATION ────────────────────────────────────────────────
function goTo(section) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('sec-' + section).classList.add('active');
  document.querySelector('[data-section="' + section + '"]').classList.add('active');

  if (section === 'reserva' && !map) initMap();
  if (section === 'historial') renderHistory();
  if (section === 'perfil') renderProfile();

  closeSidebar(); // cierra el drawer en móvil al navegar
}

function logout() {
  sessionStorage.removeItem('el_current');
  window.location.href = 'index.html';
}

// ── SIDEBAR MÓVIL ─────────────────────────────────────────────
function toggleSidebar() {
  const isOpen = document.getElementById('sidebar').classList.contains('open');
  isOpen ? closeSidebar() : openSidebar();
}

function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ── MAP ───────────────────────────────────────────────────────
function initMap() {
  map = L.map('map').setView([4.6500, -74.0800], 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 18
  }).addTo(map);

  const greenIcon = L.divIcon({
    className: '',
    html: `<div style="
      background:#00e676; width:14px; height:14px; border-radius:50%;
      border:3px solid #fff; box-shadow:0 0 0 2px #00e676, 0 2px 6px rgba(0,0,0,0.5);">
    </div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10]
  });

  stationsData.forEach(station => {
    const marker = L.marker([station.lat, station.lng], { icon: greenIcon }).addTo(map);

    const popupContent = `
      <div class="popup-name">${station.name}</div>
      <div class="popup-addr">📍 ${station.address}</div>
      <span class="popup-net">${station.network}</span>
      <div class="popup-info">⚡ ${station.power} &nbsp;·&nbsp; ${station.quantity} cargador${station.quantity > 1 ? 'es' : ''}</div>
      <div class="popup-info">🔌 ${station.connectors.join(', ')}</div>
      <button class="popup-btn" onclick="selectStation(${stationsData.indexOf(station)})">Reservar aquí</button>
    `;

    marker.bindPopup(popupContent, { maxWidth: 240 });
  });
}

function selectStation(index) {
  selectedStation = stationsData[index];
  map.closePopup();

  document.getElementById('res-station-name').textContent = selectedStation.name;

  const sel = document.getElementById('res-connector');
  sel.innerHTML = '';
  selectedStation.connectors.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  });

  // Set min date to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('res-date').min = today;
  document.getElementById('res-date').value = today;

  const panel = document.getElementById('res-panel');
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeResPanel() {
  document.getElementById('res-panel').style.display = 'none';
  selectedStation = null;
}

// ── RESERVA ───────────────────────────────────────────────────
function makeReservation() {
  if (!selectedStation) return;

  const connector = document.getElementById('res-connector').value;
  const date      = document.getElementById('res-date').value;
  const time      = document.getElementById('res-time').value;
  const duration  = parseInt(document.getElementById('res-duration').value);

  if (!date) return showToast('⚠️', 'Campo requerido', 'Selecciona una fecha.');
  if (!time) return showToast('⚠️', 'Campo requerido', 'Selecciona una hora.');
  if (!duration || duration < 10) return showToast('⚠️', 'Campo requerido', 'Ingresa una duración mínima de 10 minutos.');

  // Check availability: detecta traslape de rangos horarios
  // Dos reservas se chocan si: inicio_nueva < fin_existente Y fin_nueva > inicio_existente
  const reservations = getReservations();

  const toMinutes = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const newStart  = toMinutes(time);
  const newEnd    = newStart + duration;

  const conflict = reservations.find(r => {
    if (r.stationName !== selectedStation.name) return false;
    if (r.connector   !== connector)            return false;
    if (r.date        !== date)                 return false;
    if (r.status      !== 'pendiente')          return false;
    const exStart = toMinutes(r.time);
    const exEnd   = exStart + parseInt(r.duration);
    return newStart < exEnd && newEnd > exStart;   // solapamiento real
  });

  if (conflict) {
    const exStart = toMinutes(conflict.time);
    const exEnd   = exStart + parseInt(conflict.duration);
    const fmtMin  = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
    showToast('❌', 'Horario no disponible',
      `Este conector está ocupado de ${fmtMin(exStart)} a ${fmtMin(exEnd)}.`);
    return;
  }

  const code = genCode();

  reservations.push({
    code,
    userEmail:   currentUser.email,
    stationName: selectedStation.name,
    network:     selectedStation.network,
    address:     selectedStation.address,
    connector,
    date,
    time,
    duration,
    status: 'pendiente',
    createdAt: new Date().toISOString()
  });

  saveReservations(reservations);

  closeResPanel();
  showToast(`¡Reserva confirmada!`, `Tu código de acceso es: ${code}`);
}

// ── HISTORY ───────────────────────────────────────────────────
function renderHistory() {
  const list = document.getElementById('history-list');
  const all  = getReservations();
  const mine = all.filter(r => r.userEmail === currentUser.email)
                  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (!mine.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <p>Aún no tienes reservas.<br>Selecciona una electrolinera en el mapa para comenzar.</p>
      </div>`;
    return;
  }

  list.innerHTML = mine.map(r => {
    const statusClass = `status-${r.status}`;
    const statusLabel = r.status === 'pendiente' ? 'Pendiente' : r.status === 'hecha' ? 'Realizada' : 'Cancelada';
    const dateStr = formatDate(r.date);

    return `
    <div class="reservation-card" id="card-${r.code}">
      <div class="reservation-card-header" onclick="toggleCard('${r.code}')">
        <span class="res-code">${r.code}</span>
        <div class="res-meta">
          <div class="res-station-name">${r.stationName}</div>
          <div class="res-datetime">${dateStr} a las ${r.time} · ${r.duration} min</div>
        </div>
        <span class="status-badge ${statusClass}">${statusLabel}</span>
        <span class="res-chevron">▼</span>
      </div>
      <div class="reservation-card-body">
        <div class="res-detail-grid">
          <div class="res-detail-item">
            <label>Red / Operador</label>
            <span>${r.network || '—'}</span>
          </div>
          <div class="res-detail-item">
            <label>Dirección</label>
            <span>${r.address}</span>
          </div>
          <div class="res-detail-item">
            <label>Conector</label>
            <span>${r.connector}</span>
          </div>
          <div class="res-detail-item">
            <label>Duración</label>
            <span>${r.duration} minutos</span>
          </div>
          <div class="res-detail-item">
            <label>Fecha</label>
            <span>${dateStr}</span>
          </div>
          <div class="res-detail-item">
            <label>Hora</label>
            <span>${r.time}</span>
          </div>
        </div>
        ${r.status === 'pendiente' ? `<button class="btn-cancel" onclick="askCancel('${r.code}')">Cancelar reserva</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function toggleCard(code) {
  const card = document.getElementById('card-' + code);
  card.classList.toggle('open');
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${parseInt(d)} ${months[parseInt(m)-1]} ${y}`;
}

// ── CANCEL ────────────────────────────────────────────────────
function askCancel(code) {
  pendingCancelCode = code;
  document.getElementById('cancel-modal').classList.add('open');
}

function closeModal() {
  pendingCancelCode = null;
  document.getElementById('cancel-modal').classList.remove('open');
}

function confirmCancel() {
  if (!pendingCancelCode) return;
  const all   = getReservations();
  const index = all.findIndex(r => r.code === pendingCancelCode);
  if (index > -1) {
    all[index].status = 'cancelada';
    saveReservations(all);
    renderHistory();
    showToast('Reserva cancelada', 'El espacio ha sido liberado.');
  }
  closeModal();
}

// ── INICIAR CARGA ─────────────────────────────────────────────
function startCharge() {
  const code = document.getElementById('charge-code').value.trim();
  const resultEl = document.getElementById('charge-result');

  if (code.length !== 4) {
    showChargeResult('error', 'Código inválido', 'El código debe tener exactamente 4 dígitos.');
    return;
  }

  const all = getReservations();
  const res = all.find(r => r.code === code);

  if (!res || res.status === 'cancelada') {
    showChargeResult('error', 'Reserva no encontrada', 'Este código no existe o la reserva fue cancelada.');
    return;
  }

  if (res.status === 'hecha') {
    showChargeResult('warning',  'Carga ya realizada', 'Esta sesión de carga ya fue completada anteriormente.');
    return;
  }

  const today   = new Date().toISOString().split('T')[0];
  const resDate = res.date;

  if (resDate === today) {
    const idx = all.indexOf(res);
    all[idx].status = 'hecha';
    saveReservations(all);
    showChargeResult('success',  '¡Carga iniciada!', `Estación: ${res.stationName} · Conector: ${res.connector} · ${res.duration} min`);
  } else if (resDate > today) {
    showChargeResult('info',  'Reserva a futuro', `Tu reserva está programada para el ${formatDate(resDate)} a las ${res.time}.`);
  } else {
    showChargeResult('error',  'Reserva vencida', `La fecha de tu reserva (${formatDate(resDate)}) ya pasó.`);
  }
}

function showChargeResult(type, icon, title, sub) {
  document.getElementById('cr-icon').textContent  = icon;
  document.getElementById('cr-title').textContent = title;
  document.getElementById('cr-sub').textContent   = sub;
  const el = document.getElementById('charge-result');
  el.className = 'charge-result ' + type;
  el.style.display = 'block';
}

// ── PROFILE ───────────────────────────────────────────────────
function renderProfile() {
  document.getElementById('prof-name').textContent  = currentUser.name;
  document.getElementById('prof-email').textContent = currentUser.email;

  const mine  = getReservations().filter(r => r.userEmail === currentUser.email);
  const done  = mine.filter(r => r.status === 'hecha').length;

  document.getElementById('prof-total').textContent = mine.length;
  document.getElementById('prof-done').textContent  = done;
}

// ── PAGOS ─────────────────────────────────────────────────────
function alertAddPayment() {
  showToast('Demo sin pago real', 'Esta es una demo sin fines de lucro. No se permiten nuevos métodos de pago.');
}

// ── TOAST ─────────────────────────────────────────────────────
let toastTimer;
function showToast(icon, title, body) {
  document.getElementById('toast-icon').textContent  = icon;
  document.getElementById('toast-title').textContent = title;
  document.getElementById('toast-body').textContent  = body;
  const toast = document.getElementById('toast');
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 4000);
}

// Close modal on backdrop click
document.getElementById('cancel-modal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// ── START ─────────────────────────────────────────────────────
goTo('reserva');