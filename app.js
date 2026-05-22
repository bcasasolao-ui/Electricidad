/* =============================================
   API ENERGÍA ELÉCTRICA — app.js
   ============================================= */

const API_BASE = 'https://sistemapagosenergia.azurewebsites.net';

/* ---- Estado global ---- */
const state = {
  token: null,
  rol: null,
  stats: { lecturas: 0, clientes: 0, pagosEf: 0, pagosBanco: 0 },
  activity: []
};

/* =============================================
   UTILIDADES — FETCH
   ============================================= */

async function apiFetch(endpoint, method = 'GET', body = null, auth = true) {
  const headers = { 'Content-Type': 'application/json' };
  // Solo agrega token si existe (no bloquea en modo prueba)
  if (auth && state.token) headers['Authorization'] = `Bearer ${state.token}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${endpoint}`, options);

  // Intentar parsear JSON; si falla devolver texto
  let data = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    data = await res.json().catch(() => null);
  } else {
    data = await res.text().catch(() => null);
  }

  return { ok: res.ok, status: res.status, data };
}

/* =============================================
   UTILIDADES — UI
   ============================================= */

/** Mostrar/ocultar spinner en botón */
function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.classList.toggle('loading', loading);
  btn.disabled = loading;
}

/** Mostrar alerta dentro de un card */
function showAlert(id, type, title, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `alert alert-${type} show`;
  const icon = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
  const iconEl = document.getElementById(`${id}-icon`);
  const titleEl = document.getElementById(`${id}-title`);
  const msgEl   = document.getElementById(`${id}-msg`);
  if (iconEl)  iconEl.textContent  = icon[type] || 'ℹ';
  if (titleEl) titleEl.textContent = title;
  if (msgEl)   msgEl.textContent   = msg;
}

/** Ocultar alerta */
function hideAlert(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('show');
}

/** Toast flotante */
function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const t = document.createElement('div');
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span>${icons[type] || '✓'}</span> ${msg}`;
  container.appendChild(t);
  setTimeout(() => {
    t.classList.add('toast-out');
    t.addEventListener('animationend', () => t.remove());
  }, 3200);
}

/** Reset de formulario y alerta */
function resetForm(formId, alertId) {
  const form = document.getElementById(formId);
  if (form) form.reset();
  if (alertId) hideAlert(alertId);
}

/** Agregar entrada al log de actividad */
function logActivity(icon, text) {
  state.activity.unshift({ icon, text, time: new Date().toLocaleTimeString() });
  renderActivity();
}

function renderActivity() {
  const log = document.getElementById('activity-log');
  if (!log) return;
  if (state.activity.length === 0) {
    log.innerHTML = `<p style="text-align:center;padding:20px 0;color:var(--c-text-3);">No hay actividad registrada aún.</p>`;
    return;
  }
  log.innerHTML = state.activity.slice(0, 8).map(a => `
    <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--c-border);">
      <span style="font-size:18px;">${a.icon}</span>
      <span style="flex:1;font-size:.85rem;">${a.text}</span>
      <span style="font-size:.75rem;color:var(--c-text-3);white-space:nowrap;">${a.time}</span>
    </div>
  `).join('');
}

/** Actualizar contadores del dashboard */
function updateStats() {
  document.getElementById('stat-lecturas').textContent    = state.stats.lecturas;
  document.getElementById('stat-clientes').textContent    = state.stats.clientes;
  document.getElementById('stat-pagos-ef').textContent    = state.stats.pagosEf;
  document.getElementById('stat-pagos-banco').textContent = state.stats.pagosBanco;
}

/* =============================================
   NAVEGACIÓN
   ============================================= */

const viewTitles = {
  'view-inicio':        'Inicio',
  'view-lectura':       'Registrar Lectura',
  'view-cliente':       'Crear Cliente',
  'view-pago-efectivo': 'Pago en Efectivo',
  'view-consulta':      'Consultar Deuda',
  'view-pago-banco':    'Pago Banco'
};

function navigateTo(viewId) {
  // Vistas
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(viewId);
  if (target) target.classList.add('active');

  // Nav items
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.view === viewId);
  });

  // Título topbar
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = viewTitles[viewId] || '';

  // Cerrar sidebar en móvil
  closeSidebar();
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}

/* =============================================
   AUTH — LOGIN / LOGOUT
   ============================================= */

/* =============================================
   MODO PRUEBA — SALTAR LOGIN
   ============================================= */

document.getElementById('btn-skip-login').addEventListener('click', () => {
  state.token = null; // sin token real
  state.rol   = 'Prueba';
  initDashboard('demo');

  // Mostrar banner de aviso en el dashboard
  const banner = document.createElement('div');
  banner.id = 'demo-banner';
  banner.style.cssText = `
    background: #fffbeb;
    border: 1.5px solid #fde68a;
    color: #92400e;
    font-size: .8rem;
    font-weight: 600;
    padding: 8px 16px;
    text-align: center;
    position: sticky;
    top: 60px;
    z-index: 49;
  `;
  banner.innerHTML = '⚠ Modo prueba — Sin token de autenticación. Las peticiones al backend pueden fallar con 401.';
  document.querySelector('.main-content').insertBefore(
    banner,
    document.querySelector('.page-body')
  );
});

/* =============================================
   AUTH — LOGIN / LOGOUT
   ============================================= */

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert('login-alert');
  setLoading('login-btn', true);

  const credencial = document.getElementById('login-credencial').value.trim();
  const password   = document.getElementById('login-password').value;

  const { ok, data } = await apiFetch('/api/Auth/login', 'POST',
    { credencial, password }, false
  );

  setLoading('login-btn', false);

  if (ok && data && data.token) {
    state.token = data.token;
    state.rol   = data.rol || 'Usuario';
    initDashboard(credencial);
  } else {
    const msg = (data && (data.detail || data.title)) || 'Credenciales incorrectas.';
    document.getElementById('login-alert-msg').textContent = msg;
    document.getElementById('login-alert').classList.add('show');
  }
});

function initDashboard(credencial) {
  // Ocultar login, mostrar app
  document.getElementById('login-page').style.display  = 'none';
  document.getElementById('app-layout').style.display  = 'flex';

  // Datos de usuario en UI
  const initials = credencial.slice(0, 2).toUpperCase();
  document.getElementById('user-avatar').textContent     = initials;
  document.getElementById('user-name-label').textContent = credencial;
  document.getElementById('user-rol-label').textContent  = state.rol;

  navigateTo('view-inicio');
  toast(`Bienvenido, ${credencial}`, 'success');
}

document.getElementById('btn-logout').addEventListener('click', () => {
  state.token = null;
  state.rol   = null;
  state.stats = { lecturas: 0, clientes: 0, pagosEf: 0, pagosBanco: 0 };
  state.activity = [];
  document.getElementById('login-page').style.display  = '';
  document.getElementById('app-layout').style.display  = 'none';
  document.getElementById('login-form').reset();
  hideAlert('login-alert');
  // Quitar banner demo si existe
  const banner = document.getElementById('demo-banner');
  if (banner) banner.remove();
});

/* =============================================
   AGENCIA LOCAL — REGISTRAR LECTURA
   ============================================= */

document.getElementById('form-lectura').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert('alert-lectura');
  setLoading('btn-lectura', true);

  const numeroContador = document.getElementById('lectura-contador').value.trim();
  const kilovatios     = parseInt(document.getElementById('lectura-kw').value);

  const { ok, data } = await apiFetch('/api/Energia/Agencia/lectura', 'POST',
    { numeroContador, kilovatios }
  );

  setLoading('btn-lectura', false);

  if (ok) {
    showAlert('alert-lectura', 'success',
      'Lectura registrada',
      `Contador ${numeroContador} — ${kilovatios.toLocaleString()} kW registrados correctamente.`
    );
    state.stats.lecturas++;
    updateStats();
    logActivity('📟', `Lectura registrada — Contador: ${numeroContador}, ${kilovatios.toLocaleString()} kW`);
    document.getElementById('form-lectura').reset();
    toast('Lectura registrada correctamente', 'success');
  } else {
    const msg = extraerError(data, 'No se pudo registrar la lectura.');
    showAlert('alert-lectura', 'error', 'Error al registrar', msg);
    toast('Error al registrar lectura', 'error');
  }
});

/* =============================================
   AGENCIA LOCAL — CREAR CLIENTE
   ============================================= */

document.getElementById('form-cliente').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert('alert-cliente');
  setLoading('btn-cliente', true);

  const body = {
    dpi:               document.getElementById('cliente-dpi').value.trim(),
    nombre:            document.getElementById('cliente-nombre').value.trim(),
    apellido:          document.getElementById('cliente-apellido').value.trim(),
    correo:            document.getElementById('cliente-correo').value.trim(),
    direccionInmueble: document.getElementById('cliente-direccion').value.trim()
  };

  const { ok, status, data } = await apiFetch('/api/Energia/Agencia/cliente', 'POST', body);

  setLoading('btn-cliente', false);

  if (ok || status === 201) {
    showAlert('alert-cliente', 'success',
      'Cliente creado exitosamente',
      `${body.nombre} ${body.apellido} ha sido registrado en el sistema.`
    );
    state.stats.clientes++;
    updateStats();
    logActivity('👤', `Cliente creado — ${body.nombre} ${body.apellido} (DPI: ${body.dpi})`);
    document.getElementById('form-cliente').reset();
    toast('Cliente creado correctamente', 'success');
  } else {
    const msg = extraerError(data, 'No se pudo crear el cliente.');
    showAlert('alert-cliente', 'error', 'Error al crear cliente', msg);
    toast('Error al crear cliente', 'error');
  }
});

/* =============================================
   AGENCIA LOCAL — PAGO EN EFECTIVO
   ============================================= */

document.getElementById('form-pago-ef').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert('alert-pago-ef');
  setLoading('btn-pago-ef', true);

  const numeroContador = document.getElementById('pagoef-contador').value.trim();
  const montoRecibido  = parseFloat(document.getElementById('pagoef-monto').value);

  const { ok, data } = await apiFetch('/api/Energia/Agencia/pago-efectivo', 'POST',
    { numeroContador, montoRecibido }
  );

  setLoading('btn-pago-ef', false);

  if (ok) {
    showAlert('alert-pago-ef', 'success',
      'Pago registrado',
      `Pago de Q ${montoRecibido.toFixed(2)} para contador ${numeroContador} procesado.`
    );
    state.stats.pagosEf++;
    updateStats();
    logActivity('💵', `Pago efectivo — Contador: ${numeroContador}, Q ${montoRecibido.toFixed(2)}`);
    document.getElementById('form-pago-ef').reset();
    toast('Pago en efectivo registrado', 'success');
  } else {
    const msg = extraerError(data, 'No se pudo procesar el pago.');
    showAlert('alert-pago-ef', 'error', 'Error en el pago', msg);
    toast('Error al registrar pago', 'error');
  }
});

/* =============================================
   BANCO — CONSULTAR DEUDA
   ============================================= */

document.getElementById('form-consulta').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert('alert-consulta');
  document.getElementById('result-consulta').classList.remove('show');
  setLoading('btn-consulta', true);

  const numeroContador = document.getElementById('consulta-contador').value.trim();

  const { ok, data } = await apiFetch(
    `/api/Energia/Banco/consultar/${encodeURIComponent(numeroContador)}`,
    'GET', null
  );

  setLoading('btn-consulta', false);

  if (ok && data) {
    const saldo = parseFloat(data.saldoPendiente) || 0;
    document.getElementById('result-contador-num').textContent = data.numeroContador || numeroContador;
    document.getElementById('result-saldo').textContent        = `Q ${saldo.toFixed(2)}`;

    const badge = document.getElementById('result-badge');
    if (saldo > 0) {
      badge.className = 'result-badge badge-debt';
      badge.textContent = '⚠ Con deuda pendiente';
    } else {
      badge.className = 'result-badge badge-clear';
      badge.textContent = '✓ Sin deuda';
    }

    document.getElementById('result-consulta').classList.add('show');
    logActivity('🔍', `Consulta deuda — Contador: ${numeroContador}, Saldo: Q ${saldo.toFixed(2)}`);
    toast('Consulta realizada correctamente', 'success');
  } else {
    const msg = extraerError(data, 'No se encontró el contador.');
    showAlert('alert-consulta', 'error', 'Error en la consulta', msg);
    toast('Error al consultar', 'error');
  }
});

function resetConsulta() {
  resetForm('form-consulta', 'alert-consulta');
  document.getElementById('result-consulta').classList.remove('show');
}

/* =============================================
   BANCO — PAGO DESDE BANCO
   ============================================= */

document.getElementById('form-pago-banco').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert('alert-pago-banco');
  setLoading('btn-pago-banco', true);

  const numeroContador = document.getElementById('pagobanco-contador').value.trim();
  const monto          = parseFloat(document.getElementById('pagobanco-monto').value);

  const { ok, data } = await apiFetch('/api/Energia/Banco/pagar', 'POST',
    { numeroContador, monto }
  );

  setLoading('btn-pago-banco', false);

  if (ok) {
    showAlert('alert-pago-banco', 'success',
      'Pago bancario enviado',
      `Notificación de Q ${monto.toFixed(2)} para contador ${numeroContador} enviada correctamente.`
    );
    state.stats.pagosBanco++;
    updateStats();
    logActivity('🏦', `Pago banco — Contador: ${numeroContador}, Q ${monto.toFixed(2)}`);
    document.getElementById('form-pago-banco').reset();
    toast('Pago bancario procesado', 'success');
  } else {
    const msg = extraerError(data, 'No se pudo procesar el pago bancario.');
    showAlert('alert-pago-banco', 'error', 'Error en el pago', msg);
    toast('Error al procesar pago bancario', 'error');
  }
});

/* =============================================
   HELPER — EXTRAER MENSAJE DE ERROR
   ============================================= */

function extraerError(data, fallback) {
  if (!data) return fallback;
  if (typeof data === 'string') return data || fallback;
  return data.detail || data.title || data.message || fallback;
}

/* =============================================
   EVENTOS DE NAVEGACIÓN
   ============================================= */

// Nav sidebar
document.querySelectorAll('.nav-item[data-view]').forEach(item => {
  item.addEventListener('click', () => navigateTo(item.dataset.view));
});

// Botones de acceso rápido (inicio)
document.querySelectorAll('button[data-view]').forEach(btn => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.view));
});

// Menú hamburguesa móvil
document.getElementById('menu-toggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('overlay').classList.add('show');
});

document.getElementById('overlay').addEventListener('click', closeSidebar);
