// =====================================================
// CONFIGURAZIONE BACKENDLESS
// =====================================================

const APPLICATION_ID = 'C2A5C327-CF80-4BB0-8017-010681F0481C';
const API_KEY         = 'B266000F-684B-4889-9174-2D1734001E08';

const USER_TABLE_NAME  = 'Users';
const ORDER_TABLE_NAME = 'Orders';

Backendless.initApp(APPLICATION_ID, API_KEY);

// =====================================================
// COSTANTI – STATI & RUOLI
// =====================================================

// Stati ordine (puoi rinominare se vuoi)
const STATUS = {
  WAREHOUSE:             'In Magazzino',
  WAITING_PHOTO:         'In attesa foto',
  WAITING_POST:          'In attesa post-produzione',
  COMPLETED:             'Completato',
  DELIVERED:             'Consegnato',
};

const STATUS_COLORS = {
  [STATUS.WAREHOUSE]:     'bg-slate-100 text-slate-700 border-slate-300',
  [STATUS.WAITING_PHOTO]: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  [STATUS.WAITING_POST]:  'bg-blue-100 text-blue-700 border-blue-300',
  [STATUS.COMPLETED]:     'bg-green-100 text-green-700 border-green-300',
  [STATUS.DELIVERED]:     'bg-emerald-100 text-emerald-700 border-emerald-300',
  DEFAULT:                'bg-gray-100 text-gray-600 border-gray-300',
};

// Ruoli
const ROLES = {
  ADMIN:        'Admin',
  PHOTOGRAPHER: 'Photographer',
  POST_PROD:    'PostProducer',
  WAREHOUSE:    'Warehouse',
  PARTNER:      'Partner',
  CUSTOMER:     'Customer',
};

// Tutti i campi dell’ordine (coerenti con Backendless)
const ORDER_FIELDS = [
  'productCode',
  'eanCode',
  'styleName',
  'styleGroup',
  'brand',
  'color',
  'size',
  'category',
  'gender',
  'shots',
  'quantity',
  's1Prog',
  's2Prog',
  'progOnModel',
  'stillShot',
  'onModelShot',
  'priority',
  's1Stylist',
  's2Stylist',
  'provenienza',
  'tipologia',
  'ordine',
  'dataOrdine',
  'entryDate',
  'exitDate',
  'collo',
  'dataReso',
  'ddt',
  'noteLogistica',
  'dataPresaPost',
  'dataConsegnaPost',
  'calendario',
  'postPresa',
];

// Config campi per etichette + tipo HTML base
const ORDER_FIELD_CONFIG = {
  productCode:   { label: 'Codice Articolo', type: 'text' },
  eanCode:       { label: 'Ean Code',        type: 'text' },
  styleName:     { label: 'Style Name',      type: 'text' },
  styleGroup:    { label: 'Style Group',     type: 'text' },
  brand:         { label: 'Brand',           type: 'text' },
  color:         { label: 'Colore',          type: 'text' },
  size:          { label: 'Taglia',          type: 'text' },
  category:      { label: 'Categoria',       type: 'text' },
  gender:        { label: 'Genere',          type: 'text' },
  shots:         { label: 'N. Scatti',       type: 'number' },
  quantity:      { label: 'Qta',             type: 'number' },
  s1Prog:        { label: 's1-Prog',         type: 'text' },
  s2Prog:        { label: 's2-Prog',         type: 'text' },
  progOnModel:   { label: 'Prog. on-m',      type: 'text' },
  stillShot:     { label: 'Scatto Still (S/N)',    type: 'text' },
  onModelShot:   { label: 'Scatto On Model (S/N)', type: 'text' },
  priority:      { label: 'Priorità',        type: 'text' },
  s1Stylist:     { label: 's1-Stylist',      type: 'text' },
  s2Stylist:     { label: 's2-Stylist',      type: 'text' },
  provenienza:   { label: 'Provenienza',     type: 'text' },
  tipologia:     { label: 'Tipologia',       type: 'text' },
  ordine:        { label: 'Ordine',          type: 'number' },
  dataOrdine:    { label: 'Data Ordine',     type: 'date' },
  entryDate:     { label: 'Entry Date',      type: 'date' },
  exitDate:      { label: 'Exit Date',       type: 'date' },
  collo:         { label: 'Collo',           type: 'number' },
  dataReso:      { label: 'Data Reso',       type: 'date' },
  ddt:           { label: 'DDT N.',          type: 'text' },
  noteLogistica: { label: 'Note Logistica',  type: 'textarea' },
  dataPresaPost:     { label: 'Data Presa in Carico Post', type: 'date' },
  dataConsegnaPost:  { label: 'Data Consegna Post',        type: 'date' },
  calendario:    { label: 'Calendario (S/N)', type: 'text' },
  postPresa:     { label: 'Post-presa in carico', type: 'text' },
};

// Campi che mostriamo nella sezione “Lavorazione Attuale”
const OPERATIONAL_FIELD_KEYS = [
  'shots',
  'quantity',
  's1Prog',
  's2Prog',
  'progOnModel',
  'stillShot',
  'onModelShot',
  'priority',
  's1Stylist',
  's2Stylist',
  'provenienza',
  'tipologia',
  'ordine',
  'dataOrdine',
  'entryDate',
  'exitDate',
  'collo',
  'dataReso',
  'ddt',
  'noteLogistica',
  'dataPresaPost',
  'dataConsegnaPost',
  'calendario',
  'postPresa',
];

// =====================================================
// STATO GLOBALE
// =====================================================

let currentUser = null;
let currentRole = null;
let currentEanInProcess = null; // { objectId, eanCode }
let currentAdminOrder = null;   // ordine in modifica per admin
let permissionsUser = null;     // utente in modifica permessi

// =====================================================
// UTILITY DOM
// =====================================================

function $(id) {
  return document.getElementById(id);
}

function show(el) {
  if (!el) return;
  el.classList.remove('hidden');
}

function hide(el) {
  if (!el) return;
  el.classList.add('hidden');
}

function showStatusMessage(id, msg, type = 'info') {
  const el = $(id);
  if (!el) return;

  el.textContent = msg;
  el.classList.remove('hidden', 'status-success', 'status-error', 'status-info');

  if (type === 'success') el.classList.add('status-success');
  else if (type === 'error') el.classList.add('status-error');
  else el.classList.add('status-info');
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[m]));
}

function showToast(message, type = 'info') {
  const box = document.createElement('div');
  box.textContent = message;
  box.className = `
    fixed bottom-4 right-4 px-4 py-2 rounded shadow-lg text-white z-50
    ${type === 'success' ? 'bg-green-600' :
      type === 'error' ? 'bg-red-600' :
      'bg-blue-600'}
  `;
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3500);
}

// =====================================================
// AUTENTICAZIONE
// =====================================================

function showLoginArea(message = '') {
  show($('login-area'));
  hide($('worker-dashboard'));
  hide($('admin-dashboard'));

  $('worker-name').textContent = 'Ospite';
  $('worker-role').textContent = 'Non Loggato';

  const status = $('login-status');
  if (message) {
    status.textContent = message;
    status.classList.remove('hidden');
  } else {
    status.classList.add('hidden');
  }
}

function handleStandardLogin(email, password) {
  if (!email || !password) {
    showLoginArea('Per favore, inserisci email e password.');
    return;
  }

  $('login-status').textContent = 'Accesso in corso...';
  $('login-status').classList.remove('hidden');

  Backendless.UserService.login(email, password, true)
    .then(user => handleLoginSuccess(user))
    .catch(err => {
      console.error('Errore di login:', err);
      showLoginArea('Accesso Fallito: ' + (err.message || 'Errore di sistema.'));
    });
}

function handleLogout() {
  Backendless.UserService.logout()
    .then(() => {
      currentUser = null;
      currentRole = null;
      currentEanInProcess = null;
      showLoginArea('Logout avvenuto con successo.');
    })
    .catch(err => {
      console.error('Errore di logout:', err);
      showLoginArea('Errore durante il logout. Riprova.');
    });
}

function handlePasswordRecovery() {
  const email = $('user-email').value;
  if (!email) {
    showLoginArea('Per recuperare la password, inserisci l’email nel campo apposito.');
    return;
  }

  Backendless.UserService.restorePassword(email)
    .then(() => {
      showLoginArea(`Email di recupero inviata a ${email}.`);
    })
    .catch(err => {
      console.error('Errore recupero password:', err);
      showLoginArea(`Errore di recupero password: ${err.message}`);
    });
}

function getRoleFromUser(user) {
  if (user.role) return Promise.resolve(user.role);

  const qb = Backendless.DataQueryBuilder.create()
    .setProperties(['objectId', 'role'])
    .setWhereClause(`objectId = '${user.objectId}'`);

  return Backendless.Data.of(USER_TABLE_NAME).find(qb)
    .then(res => {
      if (res && res.length > 0) return res[0].role || 'Nessun Ruolo';
      return 'Nessun Ruolo';
    })
    .catch(err => {
      console.error('Errore recupero ruolo:', err);
      return 'Nessun Ruolo';
    });
}

async function handleLoginSuccess(user) {
  currentUser = user;

  try {
    const role = await getRoleFromUser(user);
    currentRole = role;

    $('worker-name').textContent = user.name || user.email;
    $('worker-role').textContent = currentRole || 'Nessun Ruolo';

    hide($('login-area'));

    if (currentRole === ROLES.ADMIN) {
      show($('admin-dashboard'));
      hide($('worker-dashboard'));

      loadUsersAndRoles();
      await loadAllOrdersForAdmin();
      await loadAdminDashboard();
    } else {
      hide($('admin-dashboard'));
      show($('worker-dashboard'));

      $('worker-role-display-queue').textContent = currentRole || '';

      await loadOrdersForUser(currentRole);
    }
  } catch (err) {
    console.error('Errore critico nella gestione del ruolo:', err);
    showLoginArea('Errore nella verifica del ruolo: ' + (err.message || ''));
    handleLogout();
  }
}

// =====================================================
// GESTIONE UTENTI (ADMIN)
// =====================================================

function handleUserCreation() {
  const email = $('new-user-email').value.trim();
  const password = $('new-user-password').value;
  const role = $('new-user-role').value;

  if (!email || !password || !role) {
    showStatusMessage('user-creation-status',
      'Per favore, compila tutti i campi per il nuovo utente.',
      'error');
    return;
  }

  Backendless.UserService.register({ email, password })
    .then(newUser => {
      const userUpdate = {
        objectId: newUser.objectId,
        role,
        visibleFields: ORDER_FIELDS.slice(), // di default vede tutto
        editableFields: [],                 // di default non modifica nulla (ci pensa Admin)
      };
      return Backendless.Data.of(USER_TABLE_NAME).save(userUpdate);
    })
    .then(() => {
      showStatusMessage('user-creation-status',
        `Utente ${email} creato con ruolo ${role}.`,
        'success');

      $('new-user-email').value = '';
      $('new-user-password').value = '';
      $('new-user-role').value = '';

      loadUsersAndRoles();
    })
    .catch(err => {
      console.error('Errore creazione utente:', err);
      showStatusMessage('user-creation-status',
        `Creazione Utente Fallita: ${err.message}`,
        'error');
    });
}

function loadUsersAndRoles() {
  const loadingEl = $('loading-users');
  loadingEl.textContent = 'Caricamento lista utenti...';
  loadingEl.style.display = 'block';

  const qb = Backendless.DataQueryBuilder.create()
    .setProperties(['objectId', 'email', 'role', 'visibleFields', 'editableFields'])
    .setPageSize(100);

  Backendless.Data.of(USER_TABLE_NAME).find(qb)
    .then(users => {
      renderUsersTable(users);
    })
    .catch(err => {
      console.error('ERRORE in loadUsersAndRoles:', err);
      loadingEl.textContent = 'Errore caricamento utenti: ' + (err.message || '');
      loadingEl.style.color = '#dc2626';
    });
}

function renderUsersTable(users) {
  const tbody = document.querySelector('#users-table tbody');
  const loadingEl = $('loading-users');
  tbody.innerHTML = '';

  if (!users || users.length === 0) {
    loadingEl.textContent = 'Nessun utente trovato.';
    loadingEl.style.display = 'block';
    return;
  }

  loadingEl.style.display = 'none';

  users.forEach(user => {
    // non mostriamo la riga dell’admin corrente
    if (currentUser && user.objectId === currentUser.objectId) return;

    const tr = document.createElement('tr');

    const emailTd = tr.insertCell();
    emailTd.textContent = user.email;

    const roleTd = tr.insertCell();
    roleTd.textContent = user.role || 'Nessun Ruolo';

    const actionsTd = tr.insertCell();
    actionsTd.classList.add('space-x-2', 'py-2');

    // select ruolo
    const roleSelect = document.createElement('select');
    roleSelect.className = 'border rounded p-1 text-sm mr-2';
    Object.values(ROLES).forEach(r => {
      const opt = document.createElement('option');
      opt.value = r;
      opt.textContent = r;
      if (user.role === r) opt.selected = true;
      roleSelect.appendChild(opt);
    });

    const saveRoleBtn = document.createElement('button');
    saveRoleBtn.textContent = 'Salva Ruolo';
    saveRoleBtn.className = 'btn-success text-xs py-1 px-2 mr-1';
    saveRoleBtn.onclick = () => updateRole(user.objectId, roleSelect.value);

    const permBtn = document.createElement('button');
    permBtn.textContent = 'Permessi';
    permBtn.className = 'btn-primary text-xs py-1 px-2 mr-1';
    permBtn.onclick = () => openPermissionsModal(user);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Elimina';
    deleteBtn.className = 'btn-danger text-xs py-1 px-2';
    deleteBtn.onclick = () => deleteUser(user.objectId, user.email);

    actionsTd.appendChild(roleSelect);
    actionsTd.appendChild(saveRoleBtn);
    actionsTd.appendChild(permBtn);
    actionsTd.appendChild(deleteBtn);

    tbody.appendChild(tr);
  });
}

function updateRole(userId, newRole) {
  if (userId === (currentUser && currentUser.objectId)) {
    showToast('Non puoi modificare il tuo stesso ruolo qui.', 'error');
    return;
  }

  Backendless.Data.of(USER_TABLE_NAME).save({
    objectId: userId,
    role: newRole
  })
    .then(() => {
      showToast('Ruolo aggiornato con successo.', 'success');
      loadUsersAndRoles();
    })
    .catch(err => {
      console.error('Errore updateRole:', err);
      showToast('Errore aggiornando il ruolo: ' + (err.message || ''), 'error');
    });
}

function deleteUser(userId, email) {
  if (!confirm(`Sei sicuro di voler eliminare l’utente ${email}?`)) return;

  Backendless.Data.of(USER_TABLE_NAME).remove({ objectId: userId })
    .then(() => {
      showToast(`Utente ${email} eliminato.`, 'success');
      loadUsersAndRoles();
    })
    .catch(err => {
      console.error('Errore deleteUser:', err);
      showToast('Errore eliminando utente: ' + (err.message || ''), 'error');
    });
}

// =====================================================
// MODALE PERMESSI (visibleFields / editableFields)
// =====================================================

function openPermissionsModal(user) {
  permissionsUser = user;
  const modal = $('permissions-modal');
  const list = $('permissions-list');
  list.innerHTML = '';

  const visible = Array.isArray(user.visibleFields) ? user.visibleFields : ORDER_FIELDS.slice();
  const editable = Array.isArray(user.editableFields) ? user.editableFields : [];

  ORDER_FIELDS.forEach(field => {
    const cfg = ORDER_FIELD_CONFIG[field] || { label: field };
    const row = document.createElement('div');
    row.className = 'flex items-center justify-between border-b py-1';

    const labelSpan = document.createElement('span');
    labelSpan.textContent = cfg.label;
    labelSpan.className = 'text-sm text-gray-800';

    const controls = document.createElement('div');
    controls.className = 'flex items-center gap-3';

    const visId = `perm-visible-${field}`;
    const editId = `perm-edit-${field}`;

    const visLabel = document.createElement('label');
    visLabel.className = 'flex items-center gap-1 text-xs';
    visLabel.innerHTML = `
      <input type="checkbox" id="${visId}" ${visible.includes(field) ? 'checked' : ''} />
      <span>Visibile</span>
    `;

    const editLabel = document.createElement('label');
    editLabel.className = 'flex items-center gap-1 text-xs';
    editLabel.innerHTML = `
      <input type="checkbox" id="${editId}" ${editable.includes(field) ? 'checked' : ''} />
      <span>Modificabile</span>
    `;

    controls.appendChild(visLabel);
    controls.appendChild(editLabel);

    row.appendChild(labelSpan);
    row.appendChild(controls);

    list.appendChild(row);
  });

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closePermissionsModal() {
  const modal = $('permissions-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  permissionsUser = null;
}

function saveUserPermissions() {
  if (!permissionsUser) return;

  const visibleFields = [];
  const editableFields = [];

  ORDER_FIELDS.forEach(field => {
    const vis = $(`perm-visible-${field}`);
    const edit = $(`perm-edit-${field}`);

    if (vis && vis.checked) visibleFields.push(field);
    if (edit && edit.checked) editableFields.push(field);
  });

  Backendless.Data.of(USER_TABLE_NAME).save({
    objectId: permissionsUser.objectId,
    visibleFields,
    editableFields,
  })
    .then(() => {
      showToast('Permessi aggiornati.', 'success');
      closePermissionsModal();
      loadUsersAndRoles();
    })
    .catch(err => {
      console.error('Errore salvataggio permessi:', err);
      showToast('Errore salvataggio permessi: ' + (err.message || ''), 'error');
    });
}

// =====================================================
// PERMESSI SU CAMPi (FORM EAN + FORM ADMIN)
// =====================================================

function applyFieldPermissions(containerId) {
  const container = $(containerId);
  if (!container) return;

  // Admin vede e modifica tutto
  if (currentRole === ROLES.ADMIN) {
    container.querySelectorAll('[data-field]').forEach(el => {
      el.disabled = false;
      el.closest('.field-wrapper')?.classList.remove('opacity-50');
      el.closest('.field-wrapper')?.classList.remove('hidden');
    });
    return;
  }

  const userVisible = Array.isArray(currentUser?.visibleFields)
    ? currentUser.visibleFields
    : ORDER_FIELDS.slice();
  const userEditable = Array.isArray(currentUser?.editableFields)
    ? currentUser.editableFields
    : [];

  container.querySelectorAll('[data-field]').forEach(el => {
    const field = el.dataset.field;
    const wrapper = el.closest('.field-wrapper') || el;

    // VISIBILITÀ
    if (!userVisible.includes(field)) {
      wrapper.classList.add('hidden');
      return;
    } else {
      wrapper.classList.remove('hidden');
    }

    // MODIFICABILITÀ
    if (!userEditable.includes(field)) {
      el.disabled = true;
      wrapper.classList.add('opacity-50');
    } else {
      el.disabled = false;
      wrapper.classList.remove('opacity-50');
    }
  });
}

// =====================================================
// IMPORT EXCEL (ADMIN)
// =====================================================

async function handleFileUpload() {
  const fileInput   = $('excel-file-input');
  const statusEl    = $('import-status');
  const logEl       = $('import-log');
  const progressBar = $('import-progress-bar');
  const progressTxt = $('import-progress-text');

  logEl.textContent = '';
  logEl.style.display = 'none';

  if (!fileInput.files || fileInput.files.length === 0) {
    statusEl.textContent = 'Seleziona un file Excel prima di procedere.';
    statusEl.className = 'status-message bg-red-100 text-red-700 p-2 rounded';
    statusEl.classList.remove('hidden');
    return;
  }

  const provenienzaVal = $('admin-provenienza').value.trim();
  const tipologiaVal   = $('admin-tipologia').value.trim();
  const ordineVal      = $('admin-ordine').value.trim();
  const dataOrdineVal  = $('admin-data-ordine').value;

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = async e => {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData  = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (!jsonData || jsonData.length === 0) {
      statusEl.textContent = 'File Excel vuoto o non leggibile.';
      statusEl.className = 'status-message bg-red-100 text-red-700 p-2 rounded';
      statusEl.classList.remove('hidden');
      return;
    }

    statusEl.textContent = `Inizio importazione di ${jsonData.length} ordini...`;
    statusEl.className = 'status-message bg-blue-100 text-blue-700 p-2 rounded';
    statusEl.classList.remove('hidden');

    const total = jsonData.length;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const productCode = row['Codice Articolo'] || '';

      if (!productCode) {
        failCount++;
        continue;
      }

      try {
        // nessun controllo duplicati qui per semplicità
        const orderObj = {
          productCode,
          eanCode:     row['Ean Code']   || '',
          styleName:   row['Style Name'] || '',
          styleGroup:  row['Style Group']|| '',
          brand:       row['Brand']      || '',
          color:       row['Colore']     || '',
          size:        row['Taglia']     || '',
          category:    row['Categoria']  || '',
          gender:      row['Genere']     || '',
          provenienza: provenienzaVal,
          tipologia:   tipologiaVal,
          ordine:      ordineVal || row['Ordine'] || '',
          dataOrdine:  dataOrdineVal || row['Data Ordine'] || '',
          status:      STATUS.WAREHOUSE, // dopo import → magazzino
          lastUpdated: new Date(),
        };

        await Backendless.Data.of(ORDER_TABLE_NAME).save(orderObj);
        successCount++;
      } catch (err) {
        console.error('Errore import ordine:', err);
        failCount++;
      }

      const progress = Math.round(((i + 1) / total) * 100);
      progressBar.style.width = progress + '%';
      progressTxt.textContent = `Importazione in corso... ${progress}%`;
    }

    statusEl.textContent = `Importazione completata: ${successCount} successi, ${failCount} errori.`;
    statusEl.className = failCount === 0
      ? 'status-message bg-green-100 text-green-700 p-2 rounded'
      : 'status-message bg-yellow-100 text-yellow-700 p-2 rounded';
    statusEl.classList.remove('hidden');

    fileInput.value = '';

    if (typeof loadAllOrdersForAdmin === 'function') {
      loadAllOrdersForAdmin();
    }
  };

  reader.readAsArrayBuffer(file);
}

// =====================================================
// DASHBOARD ADMIN – LISTA ORDINI + RIEPILOGO
// =====================================================

async function loadAllOrdersForAdmin() {
  const loadingEl = $('loading-admin-orders');
  const table     = $('admin-orders-table');
  const tbody     = table.querySelector('tbody');
  const headerRow = $('admin-orders-header-row');
  const filterRow = $('admin-orders-filter-row');

  loadingEl.textContent = 'Caricamento ordini in corso...';
  loadingEl.style.display = 'block';
  tbody.innerHTML = '';
  headerRow.innerHTML = '';
  filterRow.innerHTML = '';

  try {
    const orders = await Backendless.Data.of(ORDER_TABLE_NAME).find({
      sortBy: ['lastUpdated DESC'],
      pageSize: 200,
    });

    if (!orders || orders.length === 0) {
      loadingEl.textContent = 'Nessun ordine trovato.';
      return;
    }

    // intestazioni
    ORDER_FIELDS.concat(['status', 'driveLinks']).forEach(field => {
      const cfg = ORDER_FIELD_CONFIG[field] || { label: field };
      const th  = document.createElement('th');
      th.className = 'px-2 py-1 text-xs';
      th.textContent = field === 'status' ? 'Stato' :
                       field === 'driveLinks' ? 'Link Foto' :
                       cfg.label;
      headerRow.appendChild(th);

      const fth = document.createElement('th');
      fth.className = 'px-1 py-1';
      if (field !== 'driveLinks') {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'w-full border rounded px-1 py-0.5 text-xs';
        input.dataset.field = field;
        fth.appendChild(input);
      }
      filterRow.appendChild(fth);
    });

    // colonna azioni
    const thActions = document.createElement('th');
    thActions.textContent = 'Azioni';
    thActions.className = 'px-2 py-1 text-xs';
    headerRow.appendChild(thActions);
    filterRow.appendChild(document.createElement('th'));

    // funzione render corpo
    function renderBody(list) {
      tbody.innerHTML = '';
      list.forEach(order => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-100';

        ORDER_FIELDS.concat(['status', 'driveLinks']).forEach(field => {
          const td = document.createElement('td');
          td.className = 'px-2 py-1 text-xs';

          if (field === 'status') {
            const st = order.status || '';
            const colorClass = STATUS_COLORS[st] || STATUS_COLORS.DEFAULT;
            td.innerHTML = `<span class="px-2 py-0.5 rounded border text-xs ${colorClass}">${escapeHTML(st)}</span>`;
          } else if (field === 'driveLinks') {
            if (Array.isArray(order.driveLinks) && order.driveLinks.length > 0) {
              td.innerHTML = order.driveLinks.map(raw => {
                const link = escapeHTML(raw.trim());
                return `<a href="${link}" target="_blank" class="text-blue-600 underline block truncate max-w-xs hover:text-blue-800">${link}</a>`;
              }).join('');
            } else {
              td.innerHTML = '<span class="text-gray-400 italic">Nessun link</span>';
            }
          } else {
            let v = order[field];
            if (v == null) v = '';
            td.textContent = v;
          }
          tr.appendChild(td);
        });

        const tdActions = document.createElement('td');
        tdActions.className = 'px-2 py-1 text-xs space-x-1 whitespace-nowrap';

        const editBtn = document.createElement('button');
        editBtn.textContent = 'Modifica';
        editBtn.className = 'btn-primary text-xs px-2 py-1';
        editBtn.onclick = () => handleAdminEdit(order);

        const assignBtn = document.createElement('button');
        assignBtn.textContent = 'Assegna';
        assignBtn.className = 'btn-secondary text-xs px-2 py-1';
        assignBtn.onclick = () => openAssignModal(order);

        tdActions.appendChild(editBtn);
        tdActions.appendChild(assignBtn);

        tr.appendChild(tdActions);
        tbody.appendChild(tr);
      });
    }

    // filtri
    const allOrders = orders.slice();
    renderBody(allOrders);

    filterRow.querySelectorAll('input[data-field]').forEach(input => {
      input.addEventListener('input', () => {
        const filters = {};
        filterRow.querySelectorAll('input[data-field]').forEach(inp => {
          if (inp.value.trim()) {
            filters[inp.dataset.field] = inp.value.trim().toLowerCase();
          }
        });
        const filtered = allOrders.filter(o =>
          Object.entries(filters).every(([f, val]) => {
            const raw = o[f];
            const text = raw == null ? '' : String(raw).toLowerCase();
            return text.includes(val);
          })
        );
        renderBody(filtered);
      });
    });

    loadingEl.style.display = 'none';
  } catch (err) {
    console.error('Errore loadAllOrdersForAdmin:', err);
    loadingEl.textContent = 'Errore durante il caricamento ordini.';
    loadingEl.style.color = '#b91c1c';
  }
}

async function loadAdminDashboard() {
  const container = $('admin-stats');
  const chartEl   = $('admin-stats-chart');
  container.innerHTML = '';

  try {
    const orders = await Backendless.Data.of(ORDER_TABLE_NAME).find();

    const counts = {};
    orders.forEach(o => {
      const st = o.status || 'Sconosciuto';
      counts[st] = (counts[st] || 0) + 1;
    });

    Object.entries(counts).forEach(([status, count]) => {
      const color = STATUS_COLORS[status] || STATUS_COLORS.DEFAULT;
      const div = document.createElement('div');
      div.className = `p-4 border rounded-lg text-center ${color}`;
      div.innerHTML = `
        <p class="font-semibold text-sm">${status}</p>
        <p class="text-2xl font-bold">${count}</p>
      `;
      container.appendChild(div);
    });

    if (window.Chart && chartEl) {
      const ctx = chartEl.getContext('2d');
      const labels = Object.keys(counts);
      const data   = Object.values(counts);

      if (window._adminChart) window._adminChart.destroy();

      window._adminChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Numero ordini',
            data,
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, precision: 0 } }
        }
      });
    }
  } catch (err) {
    console.error('Errore dashboard admin:', err);
  }
}

// =====================================================
// MODIFICA ORDINE – ADMIN
// =====================================================

function handleAdminEdit(order) {
  if (!order) {
    showToast('Impossibile aprire il dettaglio.', 'error');
    return;
  }

  currentAdminOrder = order;

  // Nascondo la tabella principale
  const ordersCard = $('orders-admin-card');
  if (ordersCard) hide(ordersCard);

  const card = $('admin-order-edit-card');
  const fieldsContainer = $('admin-order-fields');
  if (!card || !fieldsContainer) {
    console.error('admin-order-edit-card o admin-order-fields mancanti');
    return;
  }

  $('admin-ean-display').textContent = order.eanCode || order.productCode || '';

  fieldsContainer.innerHTML = '';

  ORDER_FIELDS.forEach(field => {
    const cfg = ORDER_FIELD_CONFIG[field] || { label: field, type: 'text' };
    const wrapper = document.createElement('div');
    wrapper.className = 'field-wrapper flex flex-col';

    const label = document.createElement('label');
    label.className = 'text-sm font-medium text-gray-700 mb-1';
    label.textContent = cfg.label;

    let input;
    if (cfg.type === 'textarea') {
      input = document.createElement('textarea');
      input.rows = 2;
    } else {
      input = document.createElement('input');
      input.type = cfg.type;
    }
    input.id = `admin-field-${field}`;
    input.dataset.field = field;
    input.className = 'border rounded-md p-2 text-sm';
    input.value = order[field] || '';

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    fieldsContainer.appendChild(wrapper);
  });

  card.classList.remove('hidden');

  applyFieldPermissions('admin-order-edit-card');
}

function cancelAdminOrderEdit() {
  const card = $('admin-order-edit-card');
  if (card) {
    card.classList.add('hidden');
  }
  const ordersCard = $('orders-admin-card');
  if (ordersCard) {
    ordersCard.classList.remove('hidden');
  }
  currentAdminOrder = null;
}

async function saveAdminOrderUpdates() {
  if (!currentAdminOrder || !currentAdminOrder.objectId) {
    showStatusMessage('admin-update-feedback', 'Nessun ordine selezionato.', 'error');
    return;
  }

  const updated = {
    objectId: currentAdminOrder.objectId,
  };

  ORDER_FIELDS.forEach(field => {
    const input = $(`admin-field-${field}`);
    if (!input) return;

    let value = input.value;
    if (input.type === 'date' && value) {
      value = new Date(value).toISOString();
    }
    updated[field] = value;
  });

  updated.lastUpdated = new Date();

  try {
    await Backendless.Data.of(ORDER_TABLE_NAME).save(updated);
    showStatusMessage('admin-update-feedback', 'Aggiornamenti salvati.', 'success');
    await loadAllOrdersForAdmin();
    cancelAdminOrderEdit();
  } catch (err) {
    console.error('Errore salvataggio admin:', err);
    showStatusMessage('admin-update-feedback', 'Errore durante il salvataggio.', 'error');
  }
}

// =====================================================
// ASSEGNAZIONE ORDINE (ADMIN → UTENTE)
// =====================================================

let assignOrder = null;

function openAssignModal(order) {
  assignOrder = order;
  $('assign-ean-display').textContent =
    (order.eanCode || order.productCode || '') + ' – Stato: ' + (order.status || '');
  const modal = $('assign-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');

  // carica utenti possibili (tutti tranne Admin)
  const select = $('assign-user-select');
  select.innerHTML = '';

  const qb = Backendless.DataQueryBuilder.create()
    .setProperties(['objectId', 'email', 'role'])
    .setPageSize(100);

  Backendless.Data.of(USER_TABLE_NAME).find(qb)
    .then(users => {
      users
        .filter(u => u.role && u.role !== ROLES.ADMIN)
        .forEach(u => {
          const opt = document.createElement('option');
          opt.value = u.objectId;
          opt.textContent = `${u.email} (${u.role})`;
          select.appendChild(opt);
        });
    })
    .catch(err => {
      console.error('Errore caricamento utenti per assegnazione:', err);
      showToast('Errore caricando utenti per assegnazione.', 'error');
    });
}

function closeAssignModal() {
  const modal = $('assign-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  assignOrder = null;
}

async function confirmOrderAssignment() {
  if (!assignOrder) return;

  const userId = $('assign-user-select').value;
  if (!userId) {
    showToast('Seleziona un utente.', 'error');
    return;
  }

  try {
    const user = await Backendless.Data.of(USER_TABLE_NAME).findById(userId);
    if (!user || !user.role) {
      showToast('Utente non valido.', 'error');
      return;
    }

    const data = { objectId: assignOrder.objectId, lastUpdated: new Date() };

    // logica base: setta stato in base al ruolo
    switch (user.role) {
      case ROLES.WAREHOUSE:
        data.status = STATUS.WAREHOUSE;
        data.assignedToWarehouseId = user.objectId;
        break;
      case ROLES.PHOTOGRAPHER:
        data.status = STATUS.WAITING_PHOTO;
        data.assignedToPhotographerId = user.objectId;
        break;
      case ROLES.POST_PROD:
        data.status = STATUS.WAITING_POST;
        data.assignedToPostProducerId = user.objectId;
        break;
      case ROLES.PARTNER:
        data.assignedToPartnerId = user.objectId;
        break;
      default:
        break;
    }

    await Backendless.Data.of(ORDER_TABLE_NAME).save(data);
    showToast('Ordine assegnato.', 'success');
    closeAssignModal();
    loadAllOrdersForAdmin();
  } catch (err) {
    console.error('Errore assegnazione:', err);
    showToast('Errore durante l’assegnazione.', 'error');
  }
}

// =====================================================
// WORKER – LISTA ORDINI PER RUOLO
// =====================================================

async function loadOrdersForUser(role) {
  const loadingEl = $('loading-orders');
  const table     = $('orders-table');
  const tbody     = table.querySelector('tbody');
  const headerRow = $('orders-header-row');
  const filterRow = $('orders-filter-row');

  loadingEl.textContent = 'Caricamento ordini in corso...';
  loadingEl.style.display = 'block';
  tbody.innerHTML = '';
  headerRow.innerHTML = '';
  filterRow.innerHTML = '';

  let whereClause = '';

  switch (role) {
    case ROLES.PHOTOGRAPHER:
      whereClause = `status = '${STATUS.WAITING_PHOTO}' OR assignedToPhotographerId = '${currentUser.objectId}'`;
      break;
    case ROLES.POST_PROD:
      whereClause = `status = '${STATUS.WAITING_POST}' OR assignedToPostProducerId = '${currentUser.objectId}'`;
      break;
    case ROLES.WAREHOUSE:
      whereClause = `status = '${STATUS.WAREHOUSE}'`;
      break;
    case ROLES.PARTNER:
      whereClause = `assignedToPartnerId = '${currentUser.objectId}'`;
      break;
    case ROLES.CUSTOMER:
      whereClause = ''; // per ora vede tutti – si può restringere dopo
      break;
    default:
      whereClause = '';
  }

  const qb = Backendless.DataQueryBuilder.create()
    .setPageSize(100)
    .setSortBy(['lastUpdated DESC']);

  if (whereClause) qb.setWhereClause(whereClause);

  try {
    const orders = await Backendless.Data.of(ORDER_TABLE_NAME).find(qb);

    if (!orders || orders.length === 0) {
      loadingEl.textContent = 'Nessun ordine disponibile.';
      return;
    }

    // colonne visibili per questo utente
    let visibleCols = Array.isArray(currentUser?.visibleFields) && currentUser.visibleFields.length > 0
      ? currentUser.visibleFields
      : ['productCode', 'eanCode', 'brand', 'color', 'size', 'status'];

    // aggressivo: se status non incluso, aggiungilo
    if (!visibleCols.includes('status')) visibleCols.push('status');

    // intestazioni + filtri
    visibleCols.forEach(field => {
      const cfg = ORDER_FIELD_CONFIG[field] || { label: field };
      const th  = document.createElement('th');
      th.className = 'px-2 py-1 text-xs';
      th.textContent = field === 'status' ? 'Stato' : cfg.label;
      headerRow.appendChild(th);

      const fth = document.createElement('th');
      fth.className = 'px-1 py-1';
      if (field !== 'status') {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'w-full border rounded px-1 py-0.5 text-xs';
        input.dataset.field = field;
        fth.appendChild(input);
      }
      filterRow.appendChild(fth);
    });

    const thActions = document.createElement('th');
    thActions.textContent = 'Azioni';
    thActions.className = 'px-2 py-1 text-xs';
    headerRow.appendChild(thActions);
    filterRow.appendChild(document.createElement('th'));

    // render corpo
    function renderBody(list) {
      tbody.innerHTML = '';
      list.forEach(order => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-100';

        visibleCols.forEach(field => {
          const td = document.createElement('td');
          td.className = 'px-2 py-1 text-xs';

          if (field === 'status') {
            const st = order.status || '';
            const colorClass = STATUS_COLORS[st] || STATUS_COLORS.DEFAULT;
            td.innerHTML = `<span class="px-2 py-0.5 rounded border text-xs ${colorClass}">${escapeHTML(st)}</span>`;
          } else {
            let v = order[field];
            if (v == null) v = '';
            td.textContent = v;
          }

          tr.appendChild(td);
        });

        const tdActions = document.createElement('td');
        tdActions.className = 'px-2 py-1 text-xs';

        const btn = document.createElement('button');
        btn.textContent = 'Apri dettaglio';
        btn.className = 'btn-success text-xs px-2 py-1';
        btn.onclick = () => openWorkerOrderEditor(order.objectId);

        tdActions.appendChild(btn);
        tr.appendChild(tdActions);

        tbody.appendChild(tr);
      });
    }

    const allOrders = orders.slice();
    renderBody(allOrders);

    filterRow.querySelectorAll('input[data-field]').forEach(input => {
      input.addEventListener('input', () => {
        const filters = {};
        filterRow.querySelectorAll('input[data-field]').forEach(inp => {
          if (inp.value.trim()) {
            filters[inp.dataset.field] = inp.value.trim().toLowerCase();
          }
        });

        const filtered = allOrders.filter(o =>
          Object.entries(filters).every(([f, val]) => {
            const raw = o[f];
            const text = raw == null ? '' : String(raw).toLowerCase();
            return text.includes(val);
          })
        );
        renderBody(filtered);
      });
    });

    loadingEl.style.display = 'none';
  } catch (err) {
    console.error('Errore loadOrdersForUser:', err);
    tbody.innerHTML = '';
    loadingEl.textContent = 'Errore durante il caricamento ordini.';
    loadingEl.style.color = '#b91c1c';
  }
}

// =====================================================
// WORKER – APERTURA DETTAGLIO DA TABELLA
// =====================================================

async function openWorkerOrderEditor(orderId) {
  try {
    const order = await Backendless.Data.of(ORDER_TABLE_NAME).findById(orderId);
    if (!order) {
      showToast('Ordine non trovato.', 'error');
      return;
    }

    populateOperationalArea(order);
  } catch (err) {
    console.error('Errore openWorkerOrderEditor:', err);
    showToast('Errore aprendo il dettaglio.', 'error');
  }
}

// =====================================================
// WORKER – LAVORAZIONE ATTUALE (CONFIRMA EAN)
// =====================================================

async function confirmEanInput() {
  const ean = $('ean-input').value.trim();
  const scanStatus = $('scan-status');
  const actionsArea = $('ean-actions-area');
  const photoArea   = $('photo-upload-area');

  if (!ean) {
    scanStatus.textContent = 'Inserisci un codice EAN o Codice Articolo.';
    scanStatus.className = 'status-message status-error';
    scanStatus.classList.remove('hidden');
    hide(actionsArea);
    hide(photoArea);
    return;
  }

  try {
    scanStatus.textContent = 'Verifica in corso...';
    scanStatus.className = 'status-message status-info';
    scanStatus.classList.remove('hidden');

    const qb = Backendless.DataQueryBuilder.create()
      .setWhereClause(`eanCode = '${ean}' OR productCode = '${ean}'`)
      .setPageSize(1);

    const orders = await Backendless.Data.of(ORDER_TABLE_NAME).find(qb);

    if (!orders || orders.length === 0) {
      scanStatus.textContent = `❌ Codice ${ean} non trovato in Backendless.`;
      scanStatus.className = 'status-message status-error';
      hide(actionsArea);
      hide(photoArea);
      return;
    }

    const order = orders[0];
    scanStatus.textContent = `✅ Codice ${ean} trovato.`;
    scanStatus.className = 'status-message status-success';

    populateOperationalArea(order);
  } catch (err) {
    console.error('Errore conferma EAN:', err);
    scanStatus.textContent = 'Errore durante la verifica EAN.';
    scanStatus.className = 'status-message status-error';
    hide($('ean-actions-area'));
    hide($('photo-upload-area'));
  }
}

// =====================================================
// POPOLAMENTO MASCHERA OPERATIVA (COMMON)
// =====================================================

function populateOperationalArea(order) {
  const actionsArea = $('ean-actions-area');
  const photoArea   = $('photo-upload-area');
  const fieldsContainer = $('operational-fields');

  if (!actionsArea || !fieldsContainer) return;

  currentEanInProcess = {
    objectId: order.objectId,
    ean: order.eanCode || order.productCode || '',
  };

  $('current-ean-display').textContent = currentEanInProcess.ean;
  $('current-ean-display-upload').textContent = currentEanInProcess.ean;

  // Pulisci campi
  fieldsContainer.innerHTML = '';

  OPERATIONAL_FIELD_KEYS.forEach(field => {
    const cfg = ORDER_FIELD_CONFIG[field] || { label: field, type: 'text' };

    const wrapper = document.createElement('div');
    wrapper.className = 'field-wrapper flex flex-col';

    const label = document.createElement('label');
    label.className = 'text-sm font-medium text-gray-700 mb-1';
    label.textContent = cfg.label;

    let input;
    if (cfg.type === 'textarea') {
      input = document.createElement('textarea');
      input.rows = 2;
    } else {
      input = document.createElement('input');
      input.type = cfg.type;
    }
    input.id = `field-${field}`;
    input.dataset.field = field;
    input.className = 'border rounded-md p-2 text-sm';
    input.value = order[field] || '';

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    fieldsContainer.appendChild(wrapper);
  });

  // Gestione area link foto (solo fotografo)
  if (currentRole === ROLES.PHOTOGRAPHER) {
    show(photoArea);
    const linksText = Array.isArray(order.driveLinks)
      ? order.driveLinks.join('\n')
      : '';
    $('photo-drive-links').value = linksText;
  } else {
    hide(photoArea);
    $('photo-drive-links').value = '';
  }

  // bottone "Segna come consegnato" (per ora lo mostro a Partner + Admin)
  const btnDelivered = $('mark-delivered-btn');
  if (currentRole === ROLES.PARTNER || currentRole === ROLES.ADMIN) {
    show(btnDelivered);
  } else {
    hide(btnDelivered);
  }

  // Applica permessi
  applyFieldPermissions('ean-actions-area');

  // mostra la card
  show(actionsArea);
}

// =====================================================
// SALVATAGGIO MODIFICHE WORKER (INCLUSA DRIVE LINKS)
// =====================================================

async function saveEanUpdates() {
  const statusEl = $('update-status');

  if (!currentEanInProcess || !currentEanInProcess.objectId) {
    statusEl.textContent = 'Errore: nessun ordine in modifica.';
    statusEl.className = 'status-message status-error';
    statusEl.classList.remove('hidden');
    return;
  }

  const orderId = currentEanInProcess.objectId;

  try {
    let order = await Backendless.Data.of(ORDER_TABLE_NAME).findById(orderId);
    if (!order) {
      statusEl.textContent = '❌ Ordine non trovato.';
      statusEl.className = 'status-message status-error';
      statusEl.classList.remove('hidden');
      return;
    }

    // Aggiorno campi operativi (solo se NON disabilitati)
    OPERATIONAL_FIELD_KEYS.forEach(field => {
      const el = $(`field-${field}`);
      if (!el || el.disabled) return;

      let value = el.value;
      if (el.type === 'date' && value) {
        value = new Date(value).toISOString();
      }
      order[field] = value;
    });

    // Drive links per fotografo
    if (currentRole === ROLES.PHOTOGRAPHER) {
      const rawLinks = $('photo-drive-links').value.trim();
      const driveLinks = rawLinks
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);

      order.driveLinks = driveLinks;
      // se ha messo almeno un link → passa a post-produzione
      if (driveLinks.length > 0) {
        order.status = STATUS.WAITING_POST;
      }
    }

    // PostProducer che conferma → completato
    if (currentRole === ROLES.POST_PROD) {
      order.status = STATUS.COMPLETED;
    }

    order.lastUpdated = new Date();

    await Backendless.Data.of(ORDER_TABLE_NAME).save(order);

    statusEl.textContent = '✔ Modifiche salvate con successo.';
    statusEl.className = 'status-message status-success';
    statusEl.classList.remove('hidden');

    setTimeout(() => {
      resetEanActionState(false);
      loadOrdersForUser(currentRole);
    }, 700);

  } catch (err) {
    console.error('Errore salvataggio EAN:', err);
    statusEl.textContent = '❌ Errore durante il salvataggio.';
    statusEl.className = 'status-message status-error';
    statusEl.classList.remove('hidden');
  }
}

// =====================================================
// WORKER – SEGNA COME CONSEGNATO
// =====================================================

async function markOrderDeliveredFromWorker() {
  if (!currentEanInProcess || !currentEanInProcess.objectId) return;

  if (!confirm('Vuoi segnare questo ordine come CONSEGNATO?')) return;

  try {
    await Backendless.Data.of(ORDER_TABLE_NAME).save({
      objectId: currentEanInProcess.objectId,
      status: STATUS.DELIVERED,
      lastUpdated: new Date(),
    });

    showToast('Ordine segnato come consegnato.', 'success');
    resetEanActionState(false);
    loadOrdersForUser(currentRole);
  } catch (err) {
    console.error('Errore segna consegnato:', err);
    showToast('Errore durante il cambio stato a consegnato.', 'error');
  }
}

// =====================================================
// RESET MASCHERA EAN
// =====================================================

function resetEanActionState(showMsg) {
  hide($('ean-actions-area'));
  hide($('photo-upload-area'));

  $('ean-input').value = '';
  $('photo-drive-links').value = '';
  $('scan-status').textContent = '';
  $('scan-status').classList.add('hidden');

  $('update-status').textContent = '';
  $('update-status').classList.add('hidden');

  currentEanInProcess = null;

  if (showMsg) {
    showToast('Operazione annullata.', 'info');
  }
}

// =====================================================
// TOGGLE CARDS ADMIN (LOCALSTORAGE)
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
  const toggleUsers  = $('toggle-users-card');
  const toggleImport = $('toggle-import-card');
  const toggleStats  = $('toggle-stats-card');

  const usersCard    = $('card-users');
  const importCard   = $('card-import');
  const statsSection = $('admin-stats-section');

  if (toggleUsers && usersCard) {
    const saved = localStorage.getItem('showUsersCard');
    if (saved !== null) {
      toggleUsers.checked = saved === 'true';
      usersCard.style.display = toggleUsers.checked ? 'block' : 'none';
    }
    toggleUsers.addEventListener('change', () => {
      usersCard.style.display = toggleUsers.checked ? 'block' : 'none';
      localStorage.setItem('showUsersCard', String(toggleUsers.checked));
    });
  }

  if (toggleImport && importCard) {
    const saved = localStorage.getItem('showImportCard');
    if (saved !== null) {
      toggleImport.checked = saved === 'true';
      importCard.style.display = toggleImport.checked ? 'block' : 'none';
    }
    toggleImport.addEventListener('change', () => {
      importCard.style.display = toggleImport.checked ? 'block' : 'none';
      localStorage.setItem('showImportCard', String(toggleImport.checked));
    });
  }

  if (toggleStats && statsSection) {
    const saved = localStorage.getItem('showStatsSection');
    if (saved !== null) {
      toggleStats.checked = saved === 'true';
      statsSection.style.display = toggleStats.checked ? 'block' : 'none';
    }
    toggleStats.addEventListener('change', () => {
      statsSection.style.display = toggleStats.checked ? 'block' : 'none';
      localStorage.setItem('showStatsSection', String(toggleStats.checked));
    });
  }
});

// =====================================================
// INIZIALIZZAZIONE SESSIONE
// =====================================================

window.onload = function() {
  Backendless.UserService.isValidLogin()
    .then(isValid => {
      if (isValid) {
        return Backendless.UserService.getCurrentUser();
      } else {
        showLoginArea();
        return null;
      }
    })
    .then(user => {
      if (user && user.objectId) {
        handleLoginSuccess(user);
      } else {
        showLoginArea();
      }
    })
    .catch(err => {
      console.error('Errore init sessione:', err);
      showLoginArea();
    });
};
