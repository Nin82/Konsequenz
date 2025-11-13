// =====================================================
// CONFIGURAZIONE BACKENDLESS E COSTANTI
// =====================================================

const APPLICATION_ID = 'C2A5C327-CF80-4BB0-8017-010681F0481C';
const API_KEY        = 'B266000F-684B-4889-9174-2D1734001E08';

const USER_TABLE_NAME  = "Users";
const ORDER_TABLE_NAME = "Orders";

Backendless.initApp(APPLICATION_ID, API_KEY);

// Stati ordine (puoi rinominare i testi a tuo gusto)
const STATUS = {
  IMPORTED_WAREHOUSE: "In magazzino",
  WAITING_PHOTO:      "In attesa foto",
  IN_PHOTO_PROCESS:   "Fotografia in corso",
  WAITING_POST:       "In attesa post-produzione",
  IN_POST_PROCESS:    "Post-produzione in corso",
  WAITING_ADMIN:      "In approvazione",
  DELIVERED:          "Consegnato",
  COMPLETED:          "Completato",
  REJECTED:           "Rifiutato/Ritorna a foto"
};

const STATUS_COLORS = {
  [STATUS.IMPORTED_WAREHOUSE]: "bg-slate-100 text-slate-700 border-slate-300",
  [STATUS.WAITING_PHOTO]:      "bg-yellow-100 text-yellow-700 border-yellow-300",
  [STATUS.IN_PHOTO_PROCESS]:   "bg-amber-100 text-amber-700 border-amber-300",
  [STATUS.WAITING_POST]:       "bg-blue-100 text-blue-700 border-blue-300",
  [STATUS.IN_POST_PROCESS]:    "bg-indigo-100 text-indigo-700 border-indigo-300",
  [STATUS.WAITING_ADMIN]:      "bg-purple-100 text-purple-700 border-purple-300",
  [STATUS.DELIVERED]:          "bg-teal-100 text-teal-700 border-teal-300",
  [STATUS.COMPLETED]:          "bg-green-100 text-green-700 border-green-300",
  [STATUS.REJECTED]:           "bg-red-100 text-red-700 border-red-300",
  DEFAULT:                     "bg-gray-100 text-gray-600 border-gray-300"
};

// Ruoli
const ROLES = {
  ADMIN:         "Admin",
  WAREHOUSE:     "Warehouse",
  PHOTOGRAPHER:  "Photographer",
  POST_PRODUCER: "PostProducer",
  PARTNER:       "Partner"
};

// Definizione campi ordine (per form dinamici + permessi)
const ORDER_FIELDS = [
  { key: "productCode",     label: "Codice Articolo",             type: "text" },
  { key: "eanCode",         label: "Ean Code",                    type: "text" },
  { key: "styleName",       label: "Style Name",                  type: "text" },
  { key: "styleGroup",      label: "Style Group",                 type: "text" },
  { key: "brand",           label: "Brand",                       type: "text" },
  { key: "color",           label: "Colore",                      type: "text" },
  { key: "size",            label: "Taglia",                      type: "text" },
  { key: "category",        label: "Categoria",                   type: "text" },
  { key: "gender",          label: "Genere",                      type: "text" },

  { key: "shots",           label: "N. Scatti",                   type: "number" },
  { key: "quantity",        label: "Qta",                         type: "number" },
  { key: "s1Prog",          label: "s1-Prog",                     type: "text" },
  { key: "s2Prog",          label: "s2-Prog",                     type: "text" },
  { key: "progOnModel",     label: "Prog. on-m",                  type: "text" },

  { key: "stillShot",       label: "Scatto Still (S/N)",          type: "sn" },
  { key: "onModelShot",     label: "Scatto On Model (S/N)",       type: "sn" },

  { key: "priority",        label: "Priorità",                    type: "text" },
  { key: "s1Stylist",       label: "s1-Stylist",                  type: "text" },
  { key: "s2Stylist",       label: "s2-Stylist",                  type: "text" },

  { key: "provenienza",     label: "Provenienza",                 type: "text" },
  { key: "tipologia",       label: "Tipologia",                   type: "text" },
  { key: "ordine",          label: "Ordine",                      type: "text" },

  { key: "dataOrdine",      label: "Data ordine",                 type: "date" },
  { key: "entryDate",       label: "Entry Date",                  type: "date" },
  { key: "exitDate",        label: "Exit Date",                   type: "date" },
  { key: "collo",           label: "Collo",                       type: "text" },
  { key: "dataReso",        label: "Data Reso",                   type: "date" },

  { key: "ddt",             label: "DDT N.",                      type: "text" },
  { key: "noteLogistica",   label: "Note Logistica",              type: "textarea" },

  { key: "dataPresaPost",   label: "Data Presa in Carico Post",   type: "date" },
  { key: "dataConsegnaPost",label: "Data Consegna Post",          type: "date" },

  { key: "calendario",      label: "Calendario (S/N)",            type: "sn" },
  { key: "postPresa",       label: "Post-presa in carico",        type: "text" }
];

// Config tabella per ruoli worker
const ROLE_CONFIG = {
  [ROLES.ADMIN]: {
    filter: "",
    columns: ["productCode", "eanCode", "brand", "color", "size", "status"],
  },

  [ROLES.WAREHOUSE]: {
    // vede TUTTO
    filter: "",
    columns: ["productCode", "eanCode", "brand", "color", "size", "status", "ordine", "provenienza", "tipologia"]
  },

  [ROLES.PHOTOGRAPHER]: {
    filter: `status = '${STATUS.WAITING_PHOTO}' OR status = '${STATUS.IN_PHOTO_PROCESS}'`,
    columns: ["productCode", "eanCode", "brand", "color", "size", "status"]
  },

  [ROLES.POST_PRODUCER]: {
    filter: `status = '${STATUS.WAITING_POST}' OR status = '${STATUS.IN_POST_PROCESS}'`,
    columns: ["productCode", "eanCode", "brand", "color", "size", "status"]
  },

  [ROLES.PARTNER]: {
    filter: "", // verrà raffinato poi
    columns: ["productCode", "eanCode", "brand", "color", "size", "status"]
  }
};

// Variabili globali
let currentUser = null;
let currentRole = null;
let currentEanInProcess = null;   // { objectId, eanCode }
let currentAdminOrder = null;     // ordine aperto in admin-edit
let currentPermissionsUserId = null; // utente aperto nel modal permessi

// =====================================================
// UTILITY UI
// =====================================================

function showLoginArea(message = "") {
  document.getElementById('login-area').style.display = 'block';
  document.getElementById('worker-dashboard').style.display = 'none';
  document.getElementById('admin-dashboard').style.display = 'none';

  document.getElementById('worker-name').textContent = 'Ospite';
  document.getElementById('worker-role').textContent = 'Non Loggato';

  const status = document.getElementById('login-status');
  status.textContent = message;
  status.style.display = message ? 'block' : 'none';
}

function showStatusMessage(elementId, message, isSuccess = true) {
  const el = document.getElementById(elementId);
  if (!el) return;

  el.textContent = message;
  el.style.display = 'block';
  el.classList.remove('status-error', 'status-success', 'status-info');

  if (isSuccess === true) el.classList.add('status-success');
  else if (isSuccess === false) el.classList.add('status-error');
  else el.classList.add('status-info');
}

function showToast(message, type = 'info') {
  const box = document.createElement('div');
  box.textContent = message;
  box.className =
    `fixed bottom-4 right-4 px-4 py-2 rounded shadow-lg text-white z-50
     ${type === 'success' ? 'bg-green-600' :
        type === 'error' ? 'bg-red-600' :
        'bg-blue-600'}`;
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3500);
}

// =====================================================
// AUTENTICAZIONE
// =====================================================

function handleStandardLogin(email, password) {
  if (!email || !password) {
    showStatusMessage('login-status', 'Per favore inserisci email e password.', false);
    return;
  }

  showStatusMessage('login-status', 'Accesso in corso...', null);

  Backendless.UserService.login(email, password, true)
    .then(user => handleLoginSuccess(user))
    .catch(err => {
      console.error("Errore login:", err);
      showStatusMessage('login-status', `Accesso fallito: ${err.message || 'Credenziali non valide'}`, false);
    });
}

function handleLogout() {
  Backendless.UserService.logout()
    .then(() => {
      currentUser = null;
      currentRole = null;
      currentEanInProcess = null;
      showLoginArea("Logout avvenuto con successo.");
    })
    .catch(err => {
      console.error("Errore logout:", err);
      showLoginArea("Errore durante il logout.");
    });
}

function handlePasswordRecovery() {
  const email = document.getElementById('user-email').value.trim();
  if (!email) {
    showStatusMessage('login-status', 'Inserisci l’email per il recupero password.', false);
    return;
  }

  Backendless.UserService.restorePassword(email)
    .then(() => {
      showStatusMessage('login-status', `Email di recupero inviata a ${email}.`, true);
    })
    .catch(err => {
      console.error("Errore recupero password:", err);
      showStatusMessage('login-status', `Errore recupero password: ${err.message}`, false);
    });
}

async function getRoleAndPermissionsFromUser(user) {
  // se ha già i campi, li usiamo direttamente
  if (user.role || user.editableFields) return user;

  const qb = Backendless.DataQueryBuilder.create()
    .setWhereClause(`objectId = '${user.objectId}'`)
    .setProperties(["objectId", "role", "editableFields"]);

  const res = await Backendless.Data.of(USER_TABLE_NAME).find(qb);
  if (res && res[0]) {
    user.role = res[0].role;
    user.editableFields = res[0].editableFields || [];
  }
  return user;
}

async function handleLoginSuccess(user) {
  try {
    user = await getRoleAndPermissionsFromUser(user);

    currentUser = user;
    currentRole = user.role || null;

    const displayName = user.name || user.email;
    document.getElementById('worker-name').textContent = displayName || 'Utente';
    document.getElementById('worker-role').textContent = currentRole || 'Nessun Ruolo';

    document.getElementById('login-area').style.display = 'none';

    if (currentRole === ROLES.ADMIN) {
      document.getElementById('admin-dashboard').style.display = 'block';
      document.getElementById('worker-dashboard').style.display = 'none';

      initAdminToggles();
      loadUsersAndRoles();
      loadAllOrdersForAdmin();
      loadAdminDashboard();
    } else if (currentRole) {
      // Worker generico (Magazzino, Fotografo, Post, Partner)
      document.getElementById('admin-dashboard').style.display = 'none';
      document.getElementById('worker-dashboard').style.display = 'block';

      const roleLabelEl = document.getElementById('worker-role-display-queue');
      if (roleLabelEl) roleLabelEl.textContent = currentRole;

      loadOrdersForUser(currentRole);
    } else {
      showLoginArea("Ruolo non definito per questo utente.");
      handleLogout();
    }
  } catch (err) {
    console.error("Errore critico durante gestione login:", err);
    showLoginArea("Errore nella gestione del ruolo.");
  }
}

// Controllo sessione all’avvio
window.addEventListener('load', () => {
  Backendless.UserService.isValidLogin()
    .then(isValid => {
      if (!isValid) {
        showLoginArea();
        return null;
      }
      return Backendless.UserService.getCurrentUser();
    })
    .then(user => {
      if (user && user.objectId) {
        handleLoginSuccess(user);
      } else {
        showLoginArea();
      }
    })
    .catch(err => {
      console.error("Errore inizializzazione sessione:", err);
      showLoginArea();
    });
});

// =====================================================
// ADMIN – TOGGLE SEZIONI
// =====================================================

function initAdminToggles() {
  const toggleUsers   = document.getElementById('toggle-users-card');
  const toggleImport  = document.getElementById('toggle-import-card');
  const toggleStats   = document.getElementById('toggle-stats-card');
  const usersCard     = document.getElementById('card-users');
  const importCard    = document.getElementById('card-import');
  const statsSection  = document.getElementById('admin-stats-section');

  // utenti
  if (toggleUsers && usersCard) {
    const saved = localStorage.getItem('showUsersCard');
    if (saved !== null) toggleUsers.checked = saved === 'true';
    usersCard.style.display = toggleUsers.checked ? 'block' : 'none';

    toggleUsers.addEventListener('change', () => {
      usersCard.style.display = toggleUsers.checked ? 'block' : 'none';
      localStorage.setItem('showUsersCard', toggleUsers.checked);
    });
  }

  // import
  if (toggleImport && importCard) {
    const saved = localStorage.getItem('showImportCard');
    if (saved !== null) toggleImport.checked = saved === 'true';
    importCard.style.display = toggleImport.checked ? 'block' : 'none';

    toggleImport.addEventListener('change', () => {
      importCard.style.display = toggleImport.checked ? 'block' : 'none';
      localStorage.setItem('showImportCard', toggleImport.checked);
    });
  }

  // stats
  if (toggleStats && statsSection) {
    const saved = localStorage.getItem('showStatsSection');
    if (saved !== null) toggleStats.checked = saved === 'true';
    statsSection.style.display = toggleStats.checked ? 'block' : 'none';

    toggleStats.addEventListener('change', () => {
      statsSection.style.display = toggleStats.checked ? 'block' : 'none';
      localStorage.setItem('showStatsSection', toggleStats.checked);
    });
  }
}

// =====================================================
// ADMIN – GESTIONE UTENTI + PERMESSI
// =====================================================

function renderUsersTable(users) {
  const tbody = document.querySelector('#users-table tbody');
  const loadingEl = document.getElementById('loading-users');
  if (!tbody || !loadingEl) return;

  tbody.innerHTML = '';

  if (!users || users.length === 0) {
    loadingEl.textContent = "Nessun utente trovato.";
    loadingEl.style.display = 'block';
    return;
  }

  loadingEl.style.display = 'none';

  users.forEach(user => {
    // non mostrare se stesso come riga eliminabile
    const row = tbody.insertRow();

    row.insertCell().textContent = user.email;

    const roleCell = row.insertCell();
    roleCell.textContent = user.role || 'Nessun Ruolo';

    const actionsCell = row.insertCell();
    actionsCell.classList.add('space-x-2', 'py-2');

    // select ruolo
    const roleSelect = document.createElement('select');
    roleSelect.className = 'border rounded px-2 py-1 text-sm mr-2';
    Object.values(ROLES).forEach(r => {
      const opt = document.createElement('option');
      opt.value = r;
      opt.textContent = r;
      if (user.role === r) opt.selected = true;
      roleSelect.appendChild(opt);
    });

    const btnSaveRole = document.createElement('button');
    btnSaveRole.textContent = 'Salva Ruolo';
    btnSaveRole.className = 'btn-success text-xs py-1 px-2 mr-1';
    btnSaveRole.onclick = () => updateRole(user.objectId, roleSelect.value);

    const btnPerms = document.createElement('button');
    btnPerms.textContent = 'Permessi';
    btnPerms.className = 'btn-primary text-xs py-1 px-2 mr-1';
    btnPerms.onclick = () => openPermissionsModal(user);

    const btnDelete = document.createElement('button');
    btnDelete.textContent = 'Elimina';
    btnDelete.className = 'btn-danger text-xs py-1 px-2';
    btnDelete.onclick = () => deleteUser(user.objectId, user.email);

    actionsCell.appendChild(roleSelect);
    actionsCell.appendChild(btnSaveRole);
    actionsCell.appendChild(btnPerms);
    actionsCell.appendChild(btnDelete);
  });
}

function loadUsersAndRoles() {
  const loadingEl = document.getElementById('loading-users');
  if (loadingEl) {
    loadingEl.textContent = "Caricamento lista utenti...";
    loadingEl.style.display = 'block';
  }

  const qb = Backendless.DataQueryBuilder.create()
    .setProperties(["objectId", "email", "role", "editableFields"])
    .setPageSize(100);

  Backendless.Data.of(USER_TABLE_NAME).find(qb)
    .then(users => renderUsersTable(users))
    .catch(err => {
      console.error("Errore loadUsersAndRoles:", err);
      if (loadingEl) {
        loadingEl.textContent = `Errore nel caricamento utenti: ${err.message}`;
        loadingEl.style.color = '#b91c1c';
      }
    });
}

function updateRole(userId, newRole) {
  if (!userId) return;
  const obj = { objectId: userId, role: newRole };
  Backendless.Data.of(USER_TABLE_NAME).save(obj)
    .then(() => {
      showToast("Ruolo aggiornato correttamente.", "success");
      loadUsersAndRoles();
    })
    .catch(err => {
      console.error("Errore updateRole:", err);
      showToast("Errore aggiornamento ruolo.", "error");
    });
}

function deleteUser(userId, email) {
  if (!confirm(`Eliminare l'utente ${email}?`)) return;
  Backendless.Data.of(USER_TABLE_NAME).remove({ objectId: userId })
    .then(() => {
      showToast(`Utente ${email} eliminato.`, "success");
      loadUsersAndRoles();
    })
    .catch(err => {
      console.error("Errore deleteUser:", err);
      showToast("Errore eliminazione utente.", "error");
    });
}

function buildEditableFieldsCheckboxes(container, selected = []) {
  container.innerHTML = "";
  ORDER_FIELDS.forEach(f => {
    const id = `perm-${f.key}`;
    const wrapper = document.createElement('label');
    wrapper.className = "flex items-center gap-2 text-xs md:text-sm";

    const cb = document.createElement('input');
    cb.type = "checkbox";
    cb.id = id;
    cb.value = f.key;
    if (selected.includes(f.key)) cb.checked = true;

    const span = document.createElement('span');
    span.textContent = f.label;

    wrapper.appendChild(cb);
    wrapper.appendChild(span);
    container.appendChild(wrapper);
  });
}

function handleUserCreation() {
  const email = document.getElementById('new-user-email').value.trim();
  const password = document.getElementById('new-user-password').value;
  const role = document.getElementById('new-user-role').value;
  const statusEl = document.getElementById('user-creation-status');
  const editableSection = document.getElementById('editable-fields-section');
  const editableContainer = document.getElementById('editable-fields-container');

  if (!email || !password || !role) {
    showStatusMessage('user-creation-status', "Compila tutti i campi per il nuovo utente.", false);
    return;
  }

  // recupera campi selezionati (se non admin)
  let editableFields = [];
  if (role !== ROLES.ADMIN && editableSection && editableContainer) {
    const cbs = editableContainer.querySelectorAll('input[type="checkbox"]');
    cbs.forEach(cb => {
      if (cb.checked) editableFields.push(cb.value);
    });
  }

  showStatusMessage('user-creation-status', "Creazione utente in corso...", null);

  Backendless.UserService.register({ email, password })
    .then(newUser => {
      const updateObj = {
        objectId: newUser.objectId,
        role: role,
        editableFields: editableFields
      };
      return Backendless.Data.of(USER_TABLE_NAME).save(updateObj);
    })
    .then(() => {
      showStatusMessage('user-creation-status', `Utente ${email} creato con ruolo ${role}.`, true);
      document.getElementById('new-user-email').value = '';
      document.getElementById('new-user-password').value = '';
      document.getElementById('new-user-role').value = '';
      if (editableSection) editableSection.classList.add('hidden');
      loadUsersAndRoles();
    })
    .catch(err => {
      console.error("Errore creazione utente:", err);
      showStatusMessage('user-creation-status', `Errore creazione: ${err.message}`, false);
    });
}

// mostra / nasconde sezione permessi mentre si crea l’utente
document.addEventListener('change', e => {
  if (e.target && e.target.id === 'new-user-role') {
    const role = e.target.value;
    const section = document.getElementById('editable-fields-section');
    const container = document.getElementById('editable-fields-container');
    if (!section || !container) return;

    if (role && role !== ROLES.ADMIN) {
      section.classList.remove('hidden');
      buildEditableFieldsCheckboxes(container, []);
    } else {
      section.classList.add('hidden');
      container.innerHTML = '';
    }
  }
});

// ---- MODALE PERMESSI ----

function openPermissionsModal(user) {
  if (!user || !user.objectId) return;
  currentPermissionsUserId = user.objectId;

  const modal = document.getElementById('permissions-modal');
  const list = document.getElementById('permissions-list');
  if (!modal || !list) return;

  const selected = Array.isArray(user.editableFields) ? user.editableFields : [];
  buildEditableFieldsCheckboxes(list, selected);

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closePermissionsModal() {
  const modal = document.getElementById('permissions-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  currentPermissionsUserId = null;
}

function saveUserPermissions() {
  if (!currentPermissionsUserId) return;

  const list = document.getElementById('permissions-list');
  if (!list) return;

  const cbs = list.querySelectorAll('input[type="checkbox"]');
  const editableFields = [];
  cbs.forEach(cb => {
    if (cb.checked) editableFields.push(cb.value);
  });

  const obj = {
    objectId: currentPermissionsUserId,
    editableFields: editableFields
  };

  Backendless.Data.of(USER_TABLE_NAME).save(obj)
    .then(() => {
      showToast("Permessi aggiornati.", "success");
      closePermissionsModal();
      loadUsersAndRoles();
    })
    .catch(err => {
      console.error("Errore salvataggio permessi:", err);
      showToast("Errore salvataggio permessi.", "error");
    });
}

// =====================================================
// ADMIN – IMPORT ORDINI
// =====================================================

async function handleFileUpload() {
  const fileInput = document.getElementById('excel-file-input');
  const statusEl = document.getElementById('import-status');
  const logEl = document.getElementById('import-log');
  const progressBar = document.getElementById('import-progress-bar');
  const progressText = document.getElementById('import-progress-text');

  if (!fileInput.files || fileInput.files.length === 0) {
    showStatusMessage('import-status', "Seleziona un file Excel.", false);
    return;
  }

  const provenienzaVal = document.getElementById('admin-provenienza').value.trim();
  const tipologiaVal  = document.getElementById('admin-tipologia').value.trim();
  const ordineVal     = document.getElementById('admin-ordine').value.trim();
  const dataOrdineVal = document.getElementById('admin-data-ordine').value;

  logEl.textContent = "";
  logEl.style.display = 'none';

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = async (e) => {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const ws = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

    if (!rows || rows.length === 0) {
      showStatusMessage('import-status', "File vuoto o non leggibile.", false);
      return;
    }

    let successCount = 0;
    let failCount = 0;

    showStatusMessage('import-status', `Inizio importazione di ${rows.length} righe...`, null);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const productCode = row["Codice Articolo"] || "";
      if (!productCode) {
        failCount++;
        continue;
      }

      // controllo duplicati per productCode
      const qb = Backendless.DataQueryBuilder.create()
        .setWhereClause(`productCode = '${productCode}'`);
      const dup = await Backendless.Data.of(ORDER_TABLE_NAME).find(qb);
      if (dup && dup.length > 0) {
        logEl.style.display = 'block';
        logEl.textContent += `❌ Duplicato: ${productCode}\n`;
        failCount++;
      } else {
        const order = {
          productCode,
          eanCode:     row["Ean Code"]    || "",
          styleName:   row["Style Name"]  || "",
          styleGroup:  row["Style Group"] || "",
          brand:       row["Brand"]       || "",
          color:       row["Colore"]      || "",
          size:        row["Taglia"]      || "",
          category:    row["Categoria"]   || "",
          gender:      row["Genere"]      || "",

          provenienza: provenienzaVal,
          tipologia:   tipologiaVal,
          ordine:      ordineVal,
          dataOrdine:  dataOrdineVal || row["Data Ordine"] || null,

          status:      STATUS.IMPORTED_WAREHOUSE, // 👉 va al Magazzino
          lastUpdated: new Date()
        };

        try {
          await Backendless.Data.of(ORDER_TABLE_NAME).save(order);
          successCount++;
        } catch (err) {
          console.error("Errore salvataggio ordine:", err);
          failCount++;
        }
      }

      const progress = Math.round(((i + 1) / rows.length) * 100);
      if (progressBar) progressBar.style.width = progress + '%';
      if (progressText) progressText.textContent = `Importazione ${progress}%...`;
    }

    if (progressText) progressText.textContent = "Importazione completata.";

    const ok = failCount === 0;
    showStatusMessage(
      'import-status',
      `Completata: ${successCount} ok, ${failCount} errori.`,
      ok
    );

    fileInput.value = "";
    loadAllOrdersForAdmin();
  };

  reader.readAsArrayBuffer(file);
}

// =====================================================
// ADMIN – LISTA ORDINI + MODIFICA
// =====================================================

async function loadAllOrdersForAdmin() {
  const loadingEl = document.getElementById('loading-admin-orders');
  const table = document.getElementById('admin-orders-table');
  if (!table || !loadingEl) return;

  const tbody = table.querySelector('tbody');
  tbody.innerHTML = "";
  loadingEl.textContent = "Caricamento ordini in corso...";
  loadingEl.style.display = 'block';

  try {
    const qb = Backendless.DataQueryBuilder.create()
      .setPageSize(100)
      .setSortBy(["lastUpdated DESC"]);

    const orders = await Backendless.Data.of(ORDER_TABLE_NAME).find(qb);

    if (!orders || orders.length === 0) {
      loadingEl.textContent = "Nessun ordine trovato.";
      return;
    }

    loadingEl.style.display = 'none';

    orders.forEach(order => {
      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td class="px-4 py-2">${order.productCode || ''}</td>
        <td class="px-4 py-2">${order.eanCode || ''}</td>
        <td class="px-4 py-2">${order.brand || ''}</td>
        <td class="px-4 py-2">${order.color || ''}</td>
        <td class="px-4 py-2">${order.size || ''}</td>
        <td class="px-4 py-2">
          ${
            Array.isArray(order.driveLinks) && order.driveLinks.length > 0
              ? order.driveLinks.map(link =>
                  `<a href="${link}" target="_blank"
                      class="text-blue-600 underline block truncate max-w-xs hover:text-blue-800">
                    ${link}
                 </a>`
                ).join('')
              : '<span class="text-gray-400 italic">Nessun link</span>'
          }
        </td>
        <td class="px-4 py-2 space-x-2">
          <button class="btn-primary px-3 py-1 text-sm"
                  data-oid="${order.objectId}">
            Modifica
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('button[data-oid]').forEach(btn => {
      btn.addEventListener('click', () => {
        const oid = btn.getAttribute('data-oid');
        const order = orders.find(o => o.objectId === oid);
        if (!order) {
          showToast("Impossibile aprire il dettaglio.", "error");
        } else {
          handleAdminEdit(order);
        }
      });
    });
  } catch (err) {
    console.error("Errore loadAllOrdersForAdmin:", err);
    loadingEl.textContent = "Errore nel caricamento ordini.";
    loadingEl.style.color = '#b91c1c';
  }
}

function buildOrderFormFields(container, order, prefix) {
  container.innerHTML = "";
  ORDER_FIELDS.forEach(field => {
    const wrapper = document.createElement('div');
    wrapper.className = "flex flex-col";

    const label = document.createElement('label');
    label.className = "text-sm font-medium text-gray-700 mb-1";
    label.textContent = field.label;

    let input;
    const id = `${prefix}${field.key}`;
    const value = order[field.key] || '';

    if (field.type === "textarea") {
      input = document.createElement('textarea');
      input.className = "border rounded-md p-2";
      input.rows = 2;
    } else if (field.type === "date") {
      input = document.createElement('input');
      input.type = "date";
      input.className = "border rounded-md p-2";
      if (value) {
        const d = new Date(value);
        if (!isNaN(d.getTime())) {
          input.value = d.toISOString().slice(0, 10);
        }
      }
    } else if (field.type === "number") {
      input = document.createElement('input');
      input.type = "number";
      input.className = "border rounded-md p-2";
      input.value = value;
    } else if (field.type === "sn") {
      input = document.createElement('select');
      input.className = "border rounded-md p-2";
      const optEmpty = new Option("Seleziona", "");
      const optS = new Option("S", "S");
      const optN = new Option("N", "N");
      input.appendChild(optEmpty);
      input.appendChild(optS);
      input.appendChild(optN);
      input.value = value || "";
    } else {
      input = document.createElement('input');
      input.type = "text";
      input.className = "border rounded-md p-2";
      input.value = value;
    }

    input.id = id;
    input.dataset.fieldKey = field.key;

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    container.appendChild(wrapper);
  });
}

// Admin: apre card modifica completa
function handleAdminEdit(order) {
  if (!order) return;

  const listCard = document.getElementById('orders-admin-card');
  const editCard = document.getElementById('admin-order-edit-card');
  const eanLabel = document.getElementById('admin-ean-display');
  const fieldsContainer = document.getElementById('admin-order-fields');

  if (!editCard || !fieldsContainer) {
    console.error("admin-order-edit-card o admin-order-fields mancanti nell'HTML");
    return;
  }

  if (listCard) listCard.classList.add('hidden');
  editCard.classList.remove('hidden');

  if (eanLabel) eanLabel.textContent = order.eanCode || order.productCode || '';

  buildOrderFormFields(fieldsContainer, order, "admin-field-");
  applyFieldPermissions("admin-order-edit-card");

  currentAdminOrder = order;
}

async function saveAdminOrderUpdates() {
  if (!currentAdminOrder || !currentAdminOrder.objectId) {
    showToast("Nessun ordine selezionato.", "error");
    return;
  }

  const obj = { objectId: currentAdminOrder.objectId };

  ORDER_FIELDS.forEach(field => {
    const el = document.getElementById(`admin-field-${field.key}`);
    if (!el) return;

    if (el.disabled) return; // rispetto permessi

    let val = el.value;

    if (field.type === "date" && val) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) val = d.toISOString();
    }

    obj[field.key] = val;
  });

  obj.lastUpdated = new Date();

  try {
    await Backendless.Data.of(ORDER_TABLE_NAME).save(obj);
    showToast("Ordine aggiornato con successo.", "success");
    currentAdminOrder = null;
    const editCard = document.getElementById('admin-order-edit-card');
    const listCard = document.getElementById('orders-admin-card');
    if (editCard) editCard.classList.add('hidden');
    if (listCard) listCard.classList.remove('hidden');
    loadAllOrdersForAdmin();
  } catch (err) {
    console.error("Errore salvataggio ordine admin:", err);
    showToast("Errore durante il salvataggio.", "error");
  }
}

function cancelAdminOrderEdit() {
  currentAdminOrder = null;
  const editCard = document.getElementById('admin-order-edit-card');
  const listCard = document.getElementById('orders-admin-card');
  if (editCard) editCard.classList.add('hidden');
  if (listCard) listCard.classList.remove('hidden');
}

// =====================================================
// PERMESSI SU CAMPI (worker + admin)
// =====================================================

function applyFieldPermissions(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!currentUser) return;

  // Admin vede tutto editabile
  if (currentRole === ROLES.ADMIN) {
    container.querySelectorAll('input, textarea, select').forEach(el => {
      el.disabled = false;
      el.classList.remove('opacity-50');
    });
    return;
  }

  const editableFields = Array.isArray(currentUser.editableFields)
    ? currentUser.editableFields
    : [];

  container.querySelectorAll('[data-field-key]').forEach(el => {
    const key = el.dataset.fieldKey;
    const canEdit = editableFields.includes(key);
    el.disabled = !canEdit;
    el.classList.toggle('opacity-50', !canEdit);
  });
}

// =====================================================
// WORKER – LISTA ORDINI PER RUOLO
// =====================================================

async function loadOrdersForUser(role) {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG[ROLES.ADMIN];
  const loadingEl = document.getElementById('loading-orders');
  const table = document.getElementById('orders-table');
  if (!table || !loadingEl) return;

  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');

  loadingEl.textContent = "Caricamento ordini in corso...";
  loadingEl.style.display = 'block';
  tbody.innerHTML = "";
  table.classList.add('hidden');

  try {
    const qb = Backendless.DataQueryBuilder.create()
      .setPageSize(100)
      .setSortBy(["lastUpdated DESC"]);

    if (config.filter) qb.setWhereClause(config.filter);

    const orders = await Backendless.Data.of(ORDER_TABLE_NAME).find(qb);

    if (!orders || orders.length === 0) {
      loadingEl.textContent = "Nessun ordine disponibile.";
      return;
    }

    // intestazioni dinamiche
    thead.innerHTML = `
      <tr>
        ${config.columns.map(col => `<th class="px-4 py-2 capitalize">${col}</th>`).join('')}
        <th class="px-4 py-2">Azioni</th>
      </tr>
    `;

    orders.forEach(order => {
      const tr = document.createElement('tr');

      const colsHtml = config.columns.map(col => {
        if (col === 'status') {
          const color = STATUS_COLORS[order.status] || STATUS_COLORS.DEFAULT;
          return `<td class="px-4 py-2">
                    <span class="px-2 py-1 inline-block border rounded text-xs ${color}">
                      ${order.status || ''}
                    </span>
                  </td>`;
        }
        return `<td class="px-4 py-2">${order[col] || ''}</td>`;
      }).join('');

      tr.innerHTML = `
        ${colsHtml}
        <td class="px-4 py-2">
          <button class="btn-primary px-3 py-1 text-sm"
                  onclick="openWorkerOrderEditor('${order.objectId}')">
            Apri Modifica
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });

    loadingEl.style.display = 'none';
    table.classList.remove('hidden');
  } catch (err) {
    console.error("Errore loadOrdersForUser:", err);
    loadingEl.textContent = "Errore durante il caricamento ordini.";
    loadingEl.style.color = '#b91c1c';
  }
}

// apre pannello EAN per un ordine già in lista
async function openWorkerOrderEditor(orderId) {
  if (!orderId) return;
  try {
    const order = await Backendless.Data.of(ORDER_TABLE_NAME).findById(orderId);
    if (!order) {
      showToast("Ordine non trovato.", "error");
      return;
    }
    openWorkerEanPanel(order);
  } catch (err) {
    console.error("Errore openWorkerOrderEditor:", err);
    showToast("Impossibile aprire il dettaglio.", "error");
  }
}

// =====================================================
// WORKER – FLUSSO EAN + SALVATAGGIO
// =====================================================

async function confirmEanInput() {
  const eanInput = document.getElementById('ean-input').value.trim();
  const scanStatus = document.getElementById('scan-status');

  if (!eanInput) {
    scanStatus.textContent = "Inserisci un codice EAN o un Codice Articolo.";
    scanStatus.className = "status-message status-error";
    scanStatus.classList.remove("hidden");
    return;
  }

  try {
    scanStatus.textContent = "Verifica in corso...";
    scanStatus.className = "status-message status-info";
    scanStatus.classList.remove("hidden");

    const qb = Backendless.DataQueryBuilder.create()
      .setWhereClause(`eanCode='${eanInput}' OR productCode='${eanInput}'`)
      .setPageSize(1);

    const res = await Backendless.Data.of(ORDER_TABLE_NAME).find(qb);
    if (!res || res.length === 0) {
      scanStatus.textContent = `❌ Codice ${eanInput} non trovato.`;
      scanStatus.className = "status-message status-error";
      return;
    }

    const order = res[0];
    scanStatus.textContent = `✅ Codice ${eanInput} trovato.`;
    scanStatus.className = "status-message status-success";

    openWorkerEanPanel(order);
  } catch (err) {
    console.error("Errore confirmEanInput:", err);
    scanStatus.textContent = "Errore durante la verifica EAN.";
    scanStatus.className = "status-message status-error";
  }
}

// apre pannello worker con tutti i campi + link
function openWorkerEanPanel(order) {
  const actionsArea = document.getElementById('ean-actions-area');
  const eanDisplay  = document.getElementById('current-ean-display');
  const uploadArea  = document.getElementById('photo-upload-area');
  const uploadEan   = document.getElementById('current-ean-display-upload');
  const linksArea   = document.getElementById('photo-drive-links');
  const container   = document.getElementById('operational-fields');

  if (!actionsArea || !container) return;

  actionsArea.classList.remove('hidden');
  if (eanDisplay) eanDisplay.textContent = order.eanCode || order.productCode || '';
  if (uploadArea) {
    if (currentRole === ROLES.PHOTOGRAPHER) {
      uploadArea.classList.remove('hidden');
      if (uploadEan) uploadEan.textContent = order.eanCode || order.productCode || '';
      if (linksArea) {
        // mostra eventuali link esistenti
        if (Array.isArray(order.driveLinks)) {
          linksArea.value = order.driveLinks.join('\n');
        } else {
          linksArea.value = '';
        }
      }
    } else {
      uploadArea.classList.add('hidden');
    }
  }

  buildOrderFormFields(container, order, "worker-field-");
  applyFieldPermissions("ean-actions-area");

  currentEanInProcess = {
    objectId: order.objectId,
    eanCode:  order.eanCode || order.productCode || ''
  };
}

async function saveEanUpdates() {
  const statusEl = document.getElementById("update-status");

  if (!currentEanInProcess || !currentEanInProcess.objectId) {
    if (statusEl) {
      statusEl.textContent = "Nessun ordine in modifica.";
      statusEl.className = "status-message status-error";
      statusEl.classList.remove("hidden");
    }
    return;
  }

  const id = currentEanInProcess.objectId;

  try {
    let order = await Backendless.Data.of(ORDER_TABLE_NAME).findById(id);
    if (!order) {
      if (statusEl) {
        statusEl.textContent = "Ordine non trovato.";
        statusEl.className = "status-message status-error";
        statusEl.classList.remove("hidden");
      }
      return;
    }

    ORDER_FIELDS.forEach(field => {
      const el = document.getElementById(`worker-field-${field.key}`);
      if (!el || el.disabled) return;

      let val = el.value;

      if (field.type === "date" && val) {
        const d = new Date(val);
        if (!isNaN(d.getTime())) val = d.toISOString();
      }

      order[field.key] = val;
    });

    // LINK DRIVE
    if (currentRole === ROLES.PHOTOGRAPHER) {
      const raw = document.getElementById('photo-drive-links')?.value.trim() || "";
      const links = raw
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);
      if (links.length > 0) {
        order.driveLinks = links;
        // flusso: fotografo → in attesa post
        order.status = STATUS.WAITING_POST;
      }
    }

    order.lastUpdated = new Date();

    await Backendless.Data.of(ORDER_TABLE_NAME).save(order);

    if (statusEl) {
      statusEl.textContent = "✔ Modifiche salvate con successo.";
      statusEl.className = "status-message status-success";
      statusEl.classList.remove("hidden");
    }

    setTimeout(() => {
      resetEanActionState(false);
      loadOrdersForUser(currentRole);
    }, 700);
  } catch (err) {
    console.error("Errore salvataggio EAN:", err);
    if (statusEl) {
      statusEl.textContent = "Errore durante il salvataggio.";
      statusEl.className = "status-message status-error";
      statusEl.classList.remove("hidden");
    }
  }
}

function resetEanActionState(showInfo = false) {
  const actionsArea = document.getElementById('ean-actions-area');
  const uploadArea  = document.getElementById('photo-upload-area');
  const scanStatus  = document.getElementById('scan-status');
  const updateStatus= document.getElementById('update-status');
  const linksArea   = document.getElementById('photo-drive-links');
  const container   = document.getElementById('operational-fields');
  const eanInput    = document.getElementById('ean-input');

  if (actionsArea) actionsArea.classList.add('hidden');
  if (uploadArea)  uploadArea.classList.add('hidden');
  if (linksArea)   linksArea.value = '';
  if (container)   container.innerHTML = '';
  if (eanInput)    eanInput.value = '';

  currentEanInProcess = null;

  if (scanStatus) scanStatus.classList.add('hidden');
  if (updateStatus) updateStatus.classList.add('hidden');

  if (showInfo) showToast("Operazione annullata.", "info");
}

async function markOrderDeliveredFromWorker() {
  if (!currentEanInProcess || !currentEanInProcess.objectId) {
    showToast("Nessun ordine selezionato.", "error");
    return;
  }
  if (!confirm("Segnare questo ordine come consegnato?")) return;

  try {
    await Backendless.Data.of(ORDER_TABLE_NAME).save({
      objectId: currentEanInProcess.objectId,
      status: STATUS.DELIVERED,
      lastUpdated: new Date()
    });
    showToast("Ordine segnato come consegnato.", "success");
    resetEanActionState(false);
    loadOrdersForUser(currentRole);
  } catch (err) {
    console.error("Errore markOrderDelivered:", err);
    showToast("Errore durante l'aggiornamento stato.", "error");
  }
}

// =====================================================
// ADMIN – DASHBOARD STATS
// =====================================================

async function loadAdminDashboard() {
  const container = document.getElementById('admin-stats');
  const chartEl = document.getElementById('admin-stats-chart');
  if (!container || !chartEl) return;

  container.innerHTML = "";

  try {
    const orders = await Backendless.Data.of(ORDER_TABLE_NAME).find();
    const counts = {};
    orders.forEach(o => {
      const st = o.status || "Sconosciuto";
      counts[st] = (counts[st] || 0) + 1;
    });

    Object.entries(counts).forEach(([status, count]) => {
      const color = STATUS_COLORS[status] || STATUS_COLORS.DEFAULT;
      const div = document.createElement('div');
      div.className = `p-4 border rounded-lg text-center ${color}`;
      div.innerHTML = `
        <p class="font-semibold">${status}</p>
        <p class="text-2xl font-bold">${count}</p>
      `;
      container.appendChild(div);
    });

    if (window.Chart) {
      const labels = Object.keys(counts);
      const data = Object.values(counts);

      if (window._adminChart) window._adminChart.destroy();

      const ctx = chartEl.getContext('2d');
      window._adminChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: "Numero ordini",
            data
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true } }
        }
      });
    }
  } catch (err) {
    console.error("Errore loadAdminDashboard:", err);
  }
}

// =====================================================
// ASSEGNAZIONE ORDINE (modal base – da completare in seguito se serve)
// =====================================================

function closeAssignModal() {
  const modal = document.getElementById('assign-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function confirmOrderAssignment() {
  // placeholder: logica assegnazione verrà definita in dettaglio
  showToast("Assegnazione da completare (logica a parte).", "info");
  closeAssignModal();
  }
