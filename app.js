// =====================================================
// CONFIGURAZIONE BACKENDLESS E COSTANTI
// =====================================================
const APPLICATION_ID = 'C2A5C327-CF80-4BB0-8017-010681F0481C';
const API_KEY         = 'B266000F-684B-4889-9174-2D1734001E08';

const USER_TABLE_NAME  = "Users";
const ORDER_TABLE_NAME = "Orders";

// Stati ordine
const STATUS_WAITING_PHOTO = "In attesa foto";
const STATUS = {
  WAITING_PHOTO: STATUS_WAITING_PHOTO,
  IN_PHOTO_PROCESS: "Fotografia in corso",
  WAITING_POST_PRODUCTION: "In attesa post-produzione",
  IN_POST_PROCESS: "Post-produzione in corso",
  COMPLETED: "Completato",
  REJECTED: "Rifiutato/Ritorna a foto"
};

// Colori stati per dashboard
const STATUS_COLORS = {
  [STATUS.WAITING_PHOTO]:          "bg-yellow-100 text-yellow-700 border-yellow-300",
  [STATUS.WAITING_POST_PRODUCTION]:"bg-blue-100 text-blue-700 border-blue-300",
  [STATUS.IN_POST_PROCESS]:        "bg-amber-100 text-amber-700 border-amber-300",
  "In approvazione":               "bg-purple-100 text-purple-700 border-purple-300",
  [STATUS.COMPLETED]:              "bg-green-100 text-green-700 border-green-300",
  [STATUS.REJECTED]:               "bg-red-100 text-red-700 border-red-300",
  DEFAULT:                         "bg-gray-100 text-gray-600 border-gray-300"
};

// Ruoli
const ROLES = {
  ADMIN:         "Admin",
  PHOTOGRAPHER:  "Photographer",
  POST_PRODUCER: "PostProducer"
};

// Definizione campi ordine (usata per maschera worker + admin)
const ORDER_FIELDS = [
  { key: "productCode",     label: "Codice Articolo",             type: "text" },
  { key: "eanCode",         label: "EAN Code",                    type: "text" },
  { key: "styleName",       label: "Style Name",                  type: "text" },
  { key: "styleGroup",      label: "Style Group",                 type: "text" },
  { key: "brand",           label: "Brand",                       type: "text" },
  { key: "color",           label: "Colore",                      type: "text" },
  { key: "size",            label: "Taglia",                      type: "text" },
  { key: "category",        label: "Categoria",                   type: "text" },
  { key: "gender",          label: "Genere",                      type: "text" },
  { key: "shots",           label: "N. Scatti",                   type: "number" },
  { key: "quantity",        label: "Qta",                         type: "number" },
  { key: "s1Prog",          label: "S1-Prog",                     type: "text" },
  { key: "s2Prog",          label: "S2-Prog",                     type: "text" },
  { key: "progOnModel",     label: "Prog. on-m",                  type: "text" },
  { key: "stillShot",       label: "Scatto Still (S/N)",          type: "sn" },
  { key: "onModelShot",     label: "Scatto On Model (S/N)",       type: "sn" },
  { key: "priority",        label: "PrioritÃ ",                    type: "text" },
  { key: "s1Stylist",       label: "S1-Stylist",                  type: "text" },
  { key: "s2Stylist",       label: "S2-Stylist",                  type: "text" },
  { key: "provenienza",     label: "Provenienza",                 type: "text" },
  { key: "tipologia",       label: "Tipologia",                   type: "text" },
  { key: "ordine",          label: "Numero Ordine",              type: "text" },
  { key: "dataOrdine",      label: "Data Ordine",                type: "date" },
  { key: "entryDate",       label: "Entry Date",                 type: "date" },
  { key: "exitDate",        label: "Exit Date",                  type: "date" },
  { key: "collo",           label: "Collo",                      type: "text" },
  { key: "dataReso",        label: "Data Reso",                  type: "date" },
  { key: "ddt",             label: "DDT N.",                     type: "text" },
  { key: "noteLogistica",   label: "Note Logistica",             type: "textarea" },
  { key: "dataPresaPost",   label: "Data Presa in Carico Post",  type: "date" },
  { key: "dataConsegnaPost",label: "Data Consegna Post",         type: "date" },
  { key: "calendario",      label: "Calendario",                 type: "sn" },
  { key: "postPresa",       label: "Post-presa in carico",       type: "text" }
];

// Config per lista ordini worker
const ROLE_CONFIG = {
  [ROLES.ADMIN]: {
    filter: "",
    columns: ["productCode", "eanCode", "brand", "color", "size", "status", "driveLinks"],
    actions: order => `
      <button class="btn-primary px-3 py-1 text-sm" data-oid="${order.objectId}">
        Modifica
      </button>`
  },
  [ROLES.PHOTOGRAPHER]: {
    filter: `status = '${STATUS.WAITING_PHOTO}'`,
    columns: ["productCode", "eanCode", "brand", "color", "size", "status", "driveLinks"],
    actions: order => `
  <button class="btn-primary px-3 py-1 text-sm"
          onclick="openWorkerOrderEditor('${order.objectId}')">
    Modifica 
  </button>`
  },
  [ROLES.POST_PRODUCER]: {
    filter: `status = '${STATUS.WAITING_POST_PRODUCTION}'`,
    columns: ["productCode", "eanCode", "brand", "color", "size", "status", "driveLinks"],
    actions: order => `
      <button class="btn-primary px-3 py-1 text-sm"
              onclick="updateOrderStatus('${order.objectId}', '${STATUS.COMPLETED}', 'Ordine completato con successo âœ…')">
        Segna come completato
      </button>`
  }
};

// Ruolo extra opzionale (Quality Checker)
ROLE_CONFIG.QUALITY_CHECKER = {
  filter: `status = 'In approvazione'`,
  columns: ["productCode", "eanCode", "brand", "status", "driveLinks"],
  actions: order => `
    <button class="btn-success px-3 py-1 text-sm mr-2"
            onclick="updateOrderStatus('${order.objectId}', 'Approvato', 'Ordine approvato âœ…')">
      Approva
    </button>
    <button class="btn-danger px-3 py-1 text-sm"
            onclick="updateOrderStatus('${order.objectId}', 'Respinto', 'Ordine respinto âŒ')">
      Rifiuta
    </button>`
};

// Variabili globali
let currentUser = null;
let currentRole = null;
let currentEanInProcess = null;
let currentAdminOrder = null;
let permissionsTargetUser = null; // per modale permessi
let _adminChart = null;

// Inizializza Backendless
Backendless.initApp(APPLICATION_ID, API_KEY);
console.log("Backendless inizializzato.");


// =====================================================
// UTILITY GENERALI
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

  const scanStatus = document.getElementById('scan-status');
  if (scanStatus) scanStatus.textContent = '';

  const photoUploadArea = document.getElementById('photo-upload-area');
  if (photoUploadArea) photoUploadArea.style.display = 'none';
}

function showStatusMessage(elementId, message, isSuccess = true) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.style.display = 'block';
  if (isSuccess) {
    el.classList.remove('text-red-600', 'bg-red-100');
    el.classList.add('text-green-600', 'bg-green-100');
  } else {
    el.classList.remove('text-green-600', 'bg-green-100');
    el.classList.add('text-red-600', 'bg-red-100');
  }
}

function showToast(message, type = 'info') {
  const box = document.createElement('div');
  box.textContent = message;
  box.className =
    `fixed bottom-4 right-4 px-4 py-2 rounded shadow-lg text-white z-50 text-sm
    ${type === 'success' ? 'bg-green-600' :
      type === 'error' ? 'bg-red-600' :
      'bg-slate-700'}`;
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3500);
}

function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"']/g, match => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[match]));
}

function formatDateForInput(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === "number") {
    return new Date(val).toISOString().slice(0, 10);
  }
  if (typeof val === "string") {
    // se stringa tipo "yyyy-MM-dd..." la uso
    const isoMatch = val.match(/^\d{4}-\d{2}-\d{2}/);
    if (isoMatch) return isoMatch[0];
  }
  return "";
}

function parseValueFromInput(type, value) {
  if (value === "" || value == null) return null;
  switch (type) {
    case "number":
      return isNaN(Number(value)) ? null : Number(value);
    case "date":
      return value; // salvo come stringa "yyyy-MM-dd"
    case "sn":
      return value; // "S" o "N"
    default:
      return value;
  }
}

// =====================================================
// AUTENTICAZIONE
// =====================================================
function handleStandardLogin(email, password) {
  if (!email || !password) {
    showLoginArea("Per favore, inserisci email e password.");
    return;
  }

  const statusEl = document.getElementById('login-status');
  statusEl.textContent = "Accesso in corso...";
  statusEl.style.display = "block";

  Backendless.UserService.login(email, password, true)
    .then(user => {
      handleLoginSuccess(user);
    })
    .catch(error => {
      console.error("Errore di Login:", error);
      const message = error.message || "Credenziali non valide o errore di sistema.";
      showLoginArea("Accesso Fallito: " + message);
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
    .catch(error => {
      console.error("Errore di Logout:", error);
      showLoginArea("Errore durante il logout. Riprova.");
    });
}

function handlePasswordRecovery() {
  const email = document.getElementById('user-email').value;
  if (!email) {
    showLoginArea("Per recuperare la password, inserisci l'email nel campo apposito.");
    return;
  }

  Backendless.UserService.restorePassword(email)
    .then(() => {
      showLoginArea(`Email di recupero inviata a ${email}. Controlla la tua casella di posta.`);
    })
    .catch(error => {
      console.error("Errore di recupero password:", error);
      showLoginArea(`Errore di recupero password: ${error.message}`);
    });
}

function getRoleFromUser(user) {
  if (user.role) {
    return Promise.resolve(user.role);
  }
  const qb = Backendless.DataQueryBuilder.create()
    .setProperties(["objectId", "role", "editableFields"])
    .setWhereClause(`objectId = '${user.objectId}'`);
  return Backendless.Data.of(USER_TABLE_NAME).find(qb)
    .then(result => {
      if (result && result.length > 0) {
        const u = result[0];
        if (u.editableFields) user.editableFields = u.editableFields;
        return u.role || 'Nessun Ruolo';
      }
      return 'Nessun Ruolo';
    })
    .catch(error => {
      console.error("Errore nel recupero del ruolo:", error);
      return 'Nessun Ruolo';
    });
}

async function handleLoginSuccess(user) {
  currentUser = user;

  getRoleFromUser(user)
    .then(async role => {
      currentRole = role;

      const displayName = user.name || user.email;
      document.getElementById('worker-name').textContent = displayName;
      document.getElementById('worker-role').textContent = currentRole;

      document.getElementById('login-area').style.display = 'none';

      if (currentRole === ROLES.ADMIN) {
        document.getElementById('admin-dashboard').style.display = 'block';
        document.getElementById('worker-dashboard').style.display = 'none';

        loadUsersAndRoles();
        await loadAllOrdersForAdmin();
        await loadAdminDashboard();
      } else if (currentRole === ROLES.PHOTOGRAPHER || currentRole === ROLES.POST_PRODUCER) {
        document.getElementById('admin-dashboard').style.display = 'none';
        document.getElementById('worker-dashboard').style.display = 'block';
        // Mostra il ruolo nella tabella coda
        const roleSpan = document.getElementById('worker-role-display-queue');
        if (roleSpan) roleSpan.textContent = currentRole;
        loadOrdersForUser(currentRole);
      } else {
        showLoginArea("Ruolo utente non autorizzato o non definito.");
        handleLogout();
      }
    })
    .catch(error => {
      console.error("Errore critico durante la gestione del ruolo:", error);
      showLoginArea(`Errore nella verifica del ruolo: ${error.message}`);
      handleLogout();
    });
}

// =====================================================
// GESTIONE UTENTI (ADMIN)
// =====================================================
function renderUsersTable(users) {
  const tableBody = document.querySelector('#users-table tbody');
  const loadingUsersEl = document.getElementById('loading-users');
  if (!tableBody) return;

  tableBody.innerHTML = '';
  if (!users || users.length === 0) {
    loadingUsersEl.textContent = "Nessun utente trovato (a parte te, Admin).";
    loadingUsersEl.style.display = 'block';
    return;
  }

  loadingUsersEl.style.display = 'none';

  users.forEach(user => {
    if (currentUser && user.objectId === currentUser.objectId) return;

    const row = tableBody.insertRow();
    row.insertCell().textContent = user.email;

    const currentRoleCell = row.insertCell();
    currentRoleCell.textContent = user.role || 'Nessun Ruolo';

    const actionCell = row.insertCell();
    actionCell.classList.add('action-cell');

    const roleSelect = document.createElement('select');
    roleSelect.className = 'w-1/2 p-2 border border-gray-300 rounded-md text-sm';
    Object.values(ROLES).forEach(role => {
      const option = document.createElement('option');
      option.value = role;
      option.textContent = role;
      if (user.role === role) option.selected = true;
      roleSelect.appendChild(option);
    });

    const saveButton = document.createElement('button');
    saveButton.textContent = 'Salva Ruolo';
    saveButton.className = 'btn-success text-xs py-1 px-2 mr-2';
    saveButton.onclick = () => updateRole(user.objectId, roleSelect.value);

    const permButton = document.createElement('button');
    permButton.textContent = 'Permessi';
    permButton.className = 'btn-secondary text-xs py-1 px-2 mr-2';
    permButton.onclick = () => openPermissionsModal(user);

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Elimina';
    deleteButton.className = 'btn-danger text-xs py-1 px-2';
    deleteButton.onclick = () => deleteUser(user.objectId, user.email);

    actionCell.appendChild(roleSelect);
    actionCell.appendChild(saveButton);
    actionCell.appendChild(permButton);
    actionCell.appendChild(deleteButton);
  });
}

function loadUsersAndRoles() {
  const loadingUsersEl = document.getElementById('loading-users');
  loadingUsersEl.textContent = "Caricamento lista utenti...";
  loadingUsersEl.style.display = 'block';

  const qb = Backendless.DataQueryBuilder.create()
    .setProperties(["objectId", "email", "role", "editableFields"])
    .setPageSize(100);

  Backendless.Data.of(USER_TABLE_NAME).find(qb)
    .then(users => {
      renderUsersTable(users);
    })
    .catch(error => {
      console.error("ERRORE CRITICO in loadUsersAndRoles (Find):", error);
      loadingUsersEl.textContent =
        `ERRORE: Impossibile caricare gli utenti. (Errore: ${error.message}).`;
      loadingUsersEl.style.color = '#dc2626';
    });
}

function updateRole(userId, newRole) {
  if (currentUser && userId === currentUser.objectId) {
    showStatusMessage('user-creation-status', 'Non puoi modificare il tuo ruolo tramite questo pannello.', false);
    return;
  }

  const userUpdate = { objectId: userId, role: newRole };
  Backendless.Data.of(USER_TABLE_NAME).save(userUpdate)
    .then(() => {
      showStatusMessage('user-creation-status', `Ruolo dell'utente aggiornato a ${newRole} con successo.`, true);
      loadUsersAndRoles();
    })
    .catch(error => {
      showStatusMessage('user-creation-status', `Errore nell'aggiornamento del ruolo: ${error.message}`, false);
      console.error("Errore aggiornamento ruolo:", error);
    });
}

function deleteUser(userId, email) {
  if (!confirm(`Sei sicuro di voler eliminare l'utente ${email}?`)) return;
  Backendless.Data.of(USER_TABLE_NAME).remove({ objectId: userId })
    .then(() => {
      showStatusMessage('user-creation-status', `Utente ${email} eliminato con successo.`, true);
      loadUsersAndRoles();
    })
    .catch(error => {
      showStatusMessage('user-creation-status', `Errore nell'eliminazione dell'utente: ${error.message}`, false);
      console.error("Errore eliminazione utente:", error);
    });
}

// Creazione nuovo utente con campi modificabili
function handleUserCreation() {
  const email = document.getElementById('new-user-email').value.trim();
  const password = document.getElementById('new-user-password').value;
  const role = document.getElementById('new-user-role').value;
  if (!email || !password || !role) {
    showStatusMessage('user-creation-status', 'Per favore, compila tutti i campi per il nuovo utente.', false);
    return;
  }

  // raccoglie i campi selezionati
  const editableFields = [];
  document.querySelectorAll('#editable-fields-container input[type="checkbox"]:checked')
    .forEach(cb => editableFields.push(cb.value));

  Backendless.UserService.register({ email, password })
    .then(newUser => {
      const userUpdate = {
        objectId: newUser.objectId,
        role,
        editableFields
      };
      return Backendless.Data.of(USER_TABLE_NAME).save(userUpdate);
    })
    .then(() => {
      showStatusMessage('user-creation-status',
        `Utente ${email} creato e ruolo ${role} assegnato con successo.`, true);
      document.getElementById('new-user-email').value = '';
      document.getElementById('new-user-password').value = '';
      document.getElementById('new-user-role').value = '';
      // deseleziona i checkbox
      document.querySelectorAll('#editable-fields-container input[type="checkbox"]').forEach(cb => cb.checked = false);
      loadUsersAndRoles();
    })
    .catch(error => {
      console.error("Errore creazione utente:", error);
      showStatusMessage('user-creation-status', `Creazione Utente Fallita: ${error.message}`, false);
    });
}

// =====================================================
// PERMESSI CAMPI (ADMIN â†’ definisce editableFields)
// =====================================================
function populateEditableFieldsCheckboxes() {
  const container = document.getElementById('editable-fields-container');
  if (!container) return;
  container.innerHTML = '';
  ORDER_FIELDS.forEach(f => {
    const div = document.createElement('div');
    div.className = "flex items-center gap-2";
    div.innerHTML = `
      <input type="checkbox" id="editable-${f.key}" value="${f.key}" class="rounded border-gray-300">
      <label for="editable-${f.key}" class="text-sm text-gray-700">${f.label}</label>
    `;
    container.appendChild(div);
  });
}

function openPermissionsModal(user) {
  currentEditingUser = user;

  const modal = document.getElementById("permissions-modal");
  modal.classList.remove("hidden");

  const list = document.getElementById("permissions-list");
  list.innerHTML = "";

  const saved = Array.isArray(user.editableFields) ? user.editableFields : [];

  Object.entries(OPERATIONAL_FIELDS).forEach(([key, label]) => {
    const id = `perm-${key}`;
    const checked = saved.includes(key) ? "checked" : "";

    list.innerHTML += `
      <label class="flex items-center gap-2 text-sm">
        <input type="checkbox" id="${id}" value="${key}" ${checked}>
        <span>${label}</span>
      </label>
    `;
  });
}

function closePermissionsModal() {
  const modal = document.getElementById('permissions-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  permissionsTargetUser = null;
}

async function saveUserPermissions() {
  try {
    if (!currentEditingUser) {
      showToast("❌ Nessun utente selezionato.", "error");
      return;
    }

    // Preleva tutte le checkbox selezionate
    const selected = [];
    document.querySelectorAll("#permissions-list input[type='checkbox']").forEach(cb => {
      if (cb.checked) selected.push(cb.value);
    });

    // Aggiorna il record utente
    const updatedUser = {
      objectId: currentEditingUser.objectId,
      editableFields: selected
    };

    await Backendless.Data.of(USER_TABLE_NAME).save(updatedUser);

    showToast("✅ Permessi aggiornati con successo!", "success");

    closePermissionsModal();

    // Ricarica lista utenti
    loadUsersAndRoles();

  } catch (err) {
    console.error("Errore salvataggio permessi:", err);
    showToast("❌ Errore durante il salvataggio permessi.", "error");
  }
}


/**
 * Abilita/disabilita i campi di un contenitore in base ai permessi dell'utente corrente.
 * - Admin: tutto abilitato
 * - Altri ruoli: solo campi presenti in currentUser.editableFields
 */
function applyFieldPermissions(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const isAdmin = currentRole === ROLES.ADMIN;
  const allowed = Array.isArray(currentUser?.editableFields) ? currentUser.editableFields : [];

  ORDER_FIELDS.forEach(f => {
    const sel = [
      `#admin-order-edit-card #admin-field-${f.key}`,
      `#ean-actions-area #field-${f.key}`
    ];
    sel.forEach(selector => {
      const input = container.querySelector(selector);
      if (!input) return;
      if (isAdmin) {
        input.disabled = false;
        input.classList.remove('opacity-50', 'cursor-not-allowed');
      } else {
        const canEdit = allowed.includes(f.key);
        input.disabled = !canEdit;
        input.classList.toggle('opacity-50', !canEdit);
        input.classList.toggle('cursor-not-allowed', !canEdit);
      }
    });
  });
}


// =====================================================
// IMPORTAZIONE ORDINI (ADMIN)
// =====================================================
async function handleFileUpload() {
  const fileInput   = document.getElementById('excel-file-input');
  const statusEl    = document.getElementById('import-status');
  const logEl       = document.getElementById('import-log');
  const progressBar = document.getElementById('import-progress-bar');

  logEl.textContent = '';
  logEl.style.display = 'none';

  if (!fileInput.files || fileInput.files.length === 0) {
    statusEl.textContent = "Seleziona un file Excel prima di procedere.";
    statusEl.className = 'status-message bg-red-100 text-red-700 p-2 rounded';
    statusEl.style.display = 'block';
    return;
  }

  const provenienzaVal = document.getElementById('admin-provenienza').value.trim();
  const tipologiaVal   = document.getElementById('admin-tipologia').value.trim();
  const ordineVal      = document.getElementById('admin-ordine').value.trim();
  const dataOrdineVal  = document.getElementById('admin-data-ordine').value;

  const file   = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = async function(e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData  = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

    if (!jsonData || jsonData.length === 0) {
      statusEl.textContent = "File Excel vuoto o non leggibile.";
      statusEl.className = 'status-message bg-red-100 text-red-700 p-2 rounded';
      statusEl.style.display = 'block';
      return;
    }

    statusEl.textContent = `Inizio importazione di ${jsonData.length} ordini...`;
    statusEl.className   = 'status-message bg-blue-100 text-blue-700 p-2 rounded';
    statusEl.style.display = 'block';

    const total = jsonData.length;
    let successCount = 0;
    let failCount    = 0;

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const productCode = row["Codice Articolo"] || "";

      if (!productCode) {
        failCount++;
        continue;
      }

      // Controllo duplicati per productCode
      const query = Backendless.DataQueryBuilder.create()
        .setWhereClause(`productCode='${productCode}'`);
      const duplicates = await Backendless.Data.of(ORDER_TABLE_NAME).find(query);

      if (duplicates.length > 0) {
        logEl.style.display = 'block';
        logEl.textContent += `âŒ Codice duplicato trovato: ${productCode}\n`;
        failCount++;
        const progress = Math.round(((i + 1) / total) * 100);
        if (progressBar) progressBar.style.width = progress + "%";
        continue;
      }

      const orderObj = {
        productCode,
        eanCode:    row["Ean Code"]   || "",
        styleName:  row["Style Name"] || "",
        styleGroup: row["Style Group"]|| "",
        brand:      row["Brand"]      || "",
        color:      row["Colore"]     || "",
        size:       row["Taglia"]     || "",
        category:   row["Categoria"]  || "",
        gender:     row["Genere"]     || "",
        provenienza: provenienzaVal,
        tipologia:   tipologiaVal,
        ordine:      ordineVal,
        dataOrdine:  dataOrdineVal || row["Data Ordine"] || "",
        status:      STATUS_WAITING_PHOTO,
        assignedToPhotographerId: "",
        assignedToPostProducerId: "",
        lastUpdated: new Date()
      };

      try {
        await Backendless.Data.of(ORDER_TABLE_NAME).save(orderObj);
        successCount++;
      } catch (err) {
        console.error("Errore import ordine:", err);
        failCount++;
      }

      const progress = Math.round(((i + 1) / total) * 100);
      if (progressBar) progressBar.style.width = progress + "%";
    }

    statusEl.textContent =
      `Importazione completata: ${successCount} successi, ${failCount} errori.`;
    statusEl.className = failCount === 0
      ? 'status-message bg-green-100 text-green-700 p-2 rounded'
      : 'status-message bg-yellow-100 text-yellow-700 p-2 rounded';

    fileInput.value = "";

    if (typeof loadAllOrdersForAdmin === 'function') {
      loadAllOrdersForAdmin();
    }
  };

  reader.readAsArrayBuffer(file);
}


// =====================================================
// ADMIN â€“ LISTA ORDINI + MODIFICA COMPLETA
// =====================================================
async function loadAllOrdersForAdmin() {
  const loadingEl = document.getElementById('loading-admin-orders');
  const table     = document.getElementById('admin-orders-table');
  if (!table) return;
  const tbody     = table.querySelector('tbody');

  loadingEl.textContent   = "Caricamento ordini in corso...";
  loadingEl.style.display = "block";
  loadingEl.style.color   = "#111";
  tbody.innerHTML         = "";
  table.classList.add('hidden');

  try {
    const orders = await Backendless.Data.of(ORDER_TABLE_NAME).find({
      sortBy: ['lastUpdated DESC'],
      pageSize: 100
    });

    if (!orders || orders.length === 0) {
      loadingEl.textContent = "Nessun ordine trovato.";
      table.classList.add('hidden');
      return;
    }

    orders.forEach(order => {
      const tr = document.createElement('tr');
      tr.classList.add('hover:bg-gray-100');
      tr.dataset.objectid = order.objectId;

      tr.innerHTML = `
        <td class="px-4 py-2">${order.productCode || ''}</td>
        <td class="px-4 py-2">${order.eanCode     || ''}</td>
        <td class="px-4 py-2">${order.brand       || ''}</td>
        <td class="px-4 py-2">${order.color       || ''}</td>
        <td class="px-4 py-2">${order.size        || ''}</td>
        <td class="px-4 py-2">
          ${
            Array.isArray(order.driveLinks) && order.driveLinks.length > 0
              ? order.driveLinks.map(raw => {
                  const link = escapeHTML(String(raw).trim());
                  return `<a href="${link}" target="_blank"
                             class="text-blue-600 underline block truncate max-w-xs hover:text-blue-800">
                             ${link}</a>`;
                }).join('')
              : '<span class="text-gray-400 italic">Nessun link</span>'
          }
        </td>
        <td class="px-4 py-2 space-x-2">
          <button class="btn-primary px-3 py-1 text-sm" data-oid="${order.objectId}">
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
        if (order) handleAdminEdit(order);
      });
    });

    loadingEl.style.display = 'none';
    table.classList.remove('hidden');
  } catch (err) {
    console.error("Errore durante il caricamento ordini:", err);
    tbody.innerHTML = "";
    loadingEl.textContent = "Errore durante il caricamento ordini.";
    loadingEl.style.color = "#b91c1c";
    loadingEl.style.display = 'block';
    table.classList.add('hidden');
  }
}

/** costruisce dinamicamente i campi della maschera admin */
function buildAdminOrderFields() {
  const container = document.getElementById("admin-order-fields");
  if (!container) return;
  container.innerHTML = "";

  ORDER_FIELDS.forEach(f => {
    let inputHTML = "";
    const id = `admin-field-${f.key}`;

    if (f.type === "textarea") {
      inputHTML = `<textarea id="${id}" class="border rounded p-2 w-full"></textarea>`;
    } else if (f.type === "date") {
      inputHTML = `<input type="date" id="${id}" class="border rounded p-2 w-full">`;
    } else if (f.type === "number") {
      inputHTML = `<input type="number" id="${id}" class="border rounded p-2 w-full">`;
    } else if (f.type === "sn") {
      inputHTML = `
        <select id="${id}" class="border rounded p-2 w-full">
          <option value="">Seleziona</option>
          <option value="S">SÃ¬</option>
          <option value="N">No</option>
        </select>`;
    } else {
      inputHTML = `<input type="text" id="${id}" class="border rounded p-2 w-full">`;
    }

    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <label for="${id}" class="block text-sm font-medium text-gray-700 mb-1">
        ${f.label}
      </label>
      ${inputHTML}
    `;
    container.appendChild(wrapper);
  });
}

/** Apre la card di modifica completa per Admin e popola i campi */
function handleAdminEdit(order) {
  if (!order) return;

  // Nascondi la tabella principale
  const ordersCard = document.getElementById('orders-admin-card');
  if (ordersCard) ordersCard.classList.add('hidden');

  const editCard = document.getElementById('admin-order-edit-card');
  if (!editCard) {
    console.error("âŒ ERRORE: #admin-order-edit-card non trovato!");
    showToast("Impossibile aprire la maschera di modifica.", "error");
    return;
  }
  editCard.classList.remove('hidden');

  const eanDisplay = document.getElementById('admin-ean-display');
  if (eanDisplay) eanDisplay.textContent = order.eanCode || order.productCode || '';

  // costruisce campi se non esistono
  buildAdminOrderFields();

  // Popola i valori
  ORDER_FIELDS.forEach(f => {
    const id = `admin-field-${f.key}`;
    const input = document.getElementById(id);
    if (!input) return;
    const value = order[f.key];

    if (f.type === "date") {
      input.value = formatDateForInput(value);
    } else if (f.type === "textarea") {
      input.value = value || "";
    } else {
      input.value = value == null ? "" : value;
    }
  });

  // Applica permessi (Admin tutto abilitato, altri in base a editableFields)
  applyFieldPermissions("admin-order-edit-card");

  currentAdminOrder = order;
}

async function saveAdminOrderUpdates() {
  if (!currentAdminOrder || !currentAdminOrder.objectId) {
    showToast("âš ï¸ Nessun ordine selezionato.", "error");
    return;
  }

  const updatedOrder = { objectId: currentAdminOrder.objectId };

  ORDER_FIELDS.forEach(f => {
    const id = `admin-field-${f.key}`;
    const input = document.getElementById(id);
    if (!input) return;
    const raw = input.value;
    updatedOrder[f.key] = parseValueFromInput(f.type, raw);
  });

  updatedOrder.lastUpdated = new Date();

  try {
    await Backendless.Data.of(ORDER_TABLE_NAME).save(updatedOrder);
    showToast("âœ… Aggiornamenti salvati correttamente!", "success");
    await loadAllOrdersForAdmin();
    highlightUpdatedRow(updatedOrder.objectId);

    const editCard   = document.getElementById('admin-order-edit-card');
    const ordersCard = document.getElementById('orders-admin-card');
    if (editCard)   editCard.classList.add('hidden');
    if (ordersCard) ordersCard.classList.remove('hidden');
  } catch (err) {
    console.error("Errore salvataggio ordine:", err);
    showToast("âŒ Errore durante il salvataggio.", "error");
  }
}

function cancelAdminOrderEdit() {
  const editCard   = document.getElementById('admin-order-edit-card');
  const ordersCard = document.getElementById('orders-admin-card');
  if (editCard)   editCard.classList.add('hidden');
  if (ordersCard) ordersCard.classList.remove('hidden');
  currentAdminOrder = null;
}

function highlightUpdatedRow(objectId) {
  const table = document.getElementById('admin-orders-table');
  if (!table) return;
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach(row => {
    if (row.dataset.objectid === objectId) {
      row.style.transition = 'background-color 0.5s ease';
      row.style.backgroundColor = '#d1fae5';
      setTimeout(() => { row.style.backgroundColor = ''; }, 1500);
    }
  });
}


// =====================================================
// WORKER â€“ LISTA ORDINI + EAN OPERATIVO
// =====================================================
async function loadOrdersForUser(role) {
  const config     = ROLE_CONFIG[role] || ROLE_CONFIG[ROLES.ADMIN];
  const loadingEl  = document.getElementById('loading-orders');
  const table      = document.getElementById('orders-table');
  if (!table) return;
  const tbody      = table.querySelector('tbody');

  loadingEl.textContent   = "Caricamento ordini in corso...";
  loadingEl.style.display = "block";
  loadingEl.style.color   = "#111";
  tbody.innerHTML         = "";
  table.classList.add('hidden');

  try {
    const query = Backendless.DataQueryBuilder.create();
    query.setSortBy(["lastUpdated DESC"]);
    query.setPageSize(100);
    if (config.filter) query.setWhereClause(config.filter);

    const orders = await Backendless.Data.of(ORDER_TABLE_NAME).find(query);

    if (!orders || orders.length === 0) {
      loadingEl.textContent = "Nessun ordine disponibile.";
      table.classList.add('hidden');
      return;
    }

    const thead = table.querySelector('thead');
    if (thead) {
      thead.innerHTML = `
        <tr>
          ${config.columns.map(col => `<th class="px-4 py-2 capitalize">${col}</th>`).join('')}
          <th class="px-4 py-2">Azioni</th>
        </tr>`;
    }

    orders.forEach(order => {
      const tr = document.createElement('tr');
      tr.classList.add('hover:bg-gray-100');

      const colsHtml = config.columns.map(col => {
        if (col === "driveLinks") {
          if (Array.isArray(order.driveLinks) && order.driveLinks.length > 0) {
            return `<td class="px-4 py-2">${
              order.driveLinks.map(raw => {
                const link = escapeHTML(String(raw).trim());
                return `<a href="${link}" target="_blank"
                           class="text-blue-600 underline block truncate max-w-xs hover:text-blue-800">
                           ${link}</a>`;
              }).join('')
            }</td>`;
          } else {
            return `<td class="px-4 py-2 text-gray-400 italic">Nessun link</td>`;
          }
        }
        if (col === "status") {
          return `<td class="px-4 py-2">${order.status || ""}</td>`;
        }
        return `<td class="px-4 py-2">${order[col] || ""}</td>`;
      }).join('');

      tr.innerHTML = colsHtml + `<td class="px-4 py-2">${config.actions(order)}</td>`;
      tbody.appendChild(tr);
    });

    loadingEl.style.display = "none";
    table.classList.remove('hidden');
  } catch (err) {
    console.error("Errore durante il caricamento ordini:", err);
    tbody.innerHTML = "";
    loadingEl.textContent = "Errore durante il caricamento ordini.";
    loadingEl.style.color = "#b91c1c";
    loadingEl.style.display = "block";
    table.classList.add('hidden');
  }
}

/** apre la stessa maschera di admin ma per un worker (rispettando i permessi) */
async function openWorkerOrderEditor(orderId) {
  try {
    const order = await Backendless.Data.of(ORDER_TABLE_NAME).findById(orderId);
    if (!order) {
      showToast("âŒ Ordine non trovato!", "error");
      return;
    }
    handleAdminEdit(order); // riusa la stessa maschera
    applyFieldPermissions('admin-order-edit-card');
  } catch (err) {
    console.error("Errore apertura ordine worker:", err);
    showToast("Errore durante l'apertura dell'ordine.", "error");
  }
}

async function updateOrderStatus(orderId, newStatus, successMessage = "Ordine aggiornato con successo!") {
  if (!orderId) return;
  if (!confirm(`Vuoi impostare lo stato su "${newStatus}"?`)) return;

  const statusEl = document.getElementById('loading-orders');
  statusEl.textContent = "Aggiornamento in corso...";
  statusEl.style.display = "block";
  statusEl.style.color = "#111";

  try {
    const updatedOrder = {
      objectId: orderId,
      status: newStatus,
      lastUpdated: new Date()
    };
    if (newStatus === STATUS.COMPLETED) {
      updatedOrder.completedAt = new Date();
    }

    await Backendless.Data.of(ORDER_TABLE_NAME).save(updatedOrder);

    statusEl.textContent = successMessage;
    statusEl.style.color = "#16a34a";

    setTimeout(() => {
      statusEl.style.display = "none";
      loadOrdersForUser(currentRole);
    }, 1200);
  } catch (error) {
    console.error("Errore durante l'aggiornamento ordine:", error);
    statusEl.textContent = "Errore durante l'aggiornamento ordine âŒ";
    statusEl.style.color = "#b91c1c";
  }
}

function showFeedback(message, type) {
  const feedbackElement = document.getElementById('operation-feedback');
  if (!feedbackElement) return;
  feedbackElement.classList.remove('status-success', 'status-error', 'status-info', 'hidden');
  feedbackElement.textContent = message;
  feedbackElement.classList.add(`status-${type}`);
  feedbackElement.style.display = 'block';
  setTimeout(() => {
    feedbackElement.style.display = 'none';
  }, 3000);
}

function resetEanActionState(showCancelFeedback = false) {
  const eanActions = document.getElementById('ean-actions-area');
  if (eanActions) eanActions.classList.add('hidden');
  const photoUploadArea = document.getElementById('photo-upload-area');
  if (photoUploadArea) photoUploadArea.classList.add('hidden');
  const eanInput = document.getElementById('ean-input');
  if (eanInput) eanInput.value = '';
  currentEanInProcess = null;
  if (showCancelFeedback) {
    showFeedback("Operazione di aggiornamento annullata.", 'info');
  }
}

/** costruisce la maschera operativa worker all'interno di #operational-fields */
function buildWorkerOperationalFields() {
  const container = document.getElementById('operational-fields');
  if (!container) return;
  if (container.dataset.built === "true") return; // giÃ  fatto
  container.innerHTML = '';

  ORDER_FIELDS.forEach(f => {
    // per il worker ha senso non mostrare i primissimi campi descrittivi?
    // Per coerenza li mostriamo tutti, poi i permessi decidono cosa Ã¨ editabile
    let inputHTML = "";
    const id = `field-${f.key}`;

    if (f.type === "textarea") {
      inputHTML = `<textarea id="${id}" class="border rounded-md p-2"></textarea>`;
    } else if (f.type === "date") {
      inputHTML = `<input type="date" id="${id}" class="border rounded-md p-2">`;
    } else if (f.type === "number") {
      inputHTML = `<input type="number" id="${id}" class="border rounded-md p-2">`;
    } else if (f.type === "sn") {
      inputHTML = `
        <select id="${id}" class="border rounded-md p-2">
          <option value="">Seleziona</option>
          <option value="S">S</option>
          <option value="N">N</option>
        </select>`;
    } else {
      inputHTML = `<input type="text" id="${id}" class="border rounded-md p-2">`;
    }

    const wrapper = document.createElement('div');
    wrapper.className = "flex flex-col";
    wrapper.innerHTML = `
      <label class="text-sm font-medium text-gray-700 mb-1" for="${id}">
        ${f.label}
      </label>
      ${inputHTML}
    `;
    container.appendChild(wrapper);
  });

  container.dataset.built = "true";
}

async function confirmEanInput() {
  const eanInputField = document.getElementById("ean-input");
  const eanInput = eanInputField ? eanInputField.value.trim() : "";
  const scanStatus     = document.getElementById("scan-status");
  const actionsArea    = document.getElementById("ean-actions-area");
  const photoUploadArea= document.getElementById("photo-upload-area");
  const currentEanDisplay = document.getElementById("current-ean-display");

  if (!eanInput) {
    scanStatus.textContent = "Inserisci un codice EAN o un Codice Articolo!";
    scanStatus.className   = "status-message status-error";
    scanStatus.classList.remove("hidden");
    if (actionsArea) actionsArea.classList.add("hidden");
    if (photoUploadArea) photoUploadArea.style.display = "none";
    return;
  }

  try {
    scanStatus.textContent = "Verifica in corso...";
    scanStatus.className   = "status-message status-info";
    scanStatus.classList.remove("hidden");

    const query = Backendless.DataQueryBuilder.create()
      .setWhereClause(`eanCode='${eanInput}' OR productCode='${eanInput}'`);
    const orders = await Backendless.Data.of(ORDER_TABLE_NAME).find(query);

    if (!orders || orders.length === 0) {
      scanStatus.textContent = `âŒ Codice ${eanInput} non trovato in Backendless.`;
      scanStatus.className   = "status-message status-error";
      if (actionsArea)    actionsArea.classList.add("hidden");
      if (photoUploadArea)photoUploadArea.style.display = "none";
      return;
    }

    const order = orders[0];
    scanStatus.textContent = `âœ… Codice ${eanInput} trovato. Compila o aggiorna i dati operativi.`;
    scanStatus.className   = "status-message status-success";

    // costruiamo i campi worker se non esistono
    buildWorkerOperationalFields();

    if (actionsArea) actionsArea.classList.remove("hidden");
    if (currentEanDisplay) currentEanDisplay.textContent = eanInput;

    if (currentRole === ROLES.PHOTOGRAPHER && photoUploadArea) {
      photoUploadArea.style.display = "block";
      const uploadEanDisplay = document.getElementById("current-ean-display-upload");
      if (uploadEanDisplay) uploadEanDisplay.textContent = eanInput;
    } else if (photoUploadArea) {
      photoUploadArea.style.display = "none";
    }

    // Popola i valori nei campi worker
    ORDER_FIELDS.forEach(f => {
      const id = `field-${f.key}`;
      const el = document.getElementById(id);
      if (!el) return;
      const value = order[f.key];

      if (f.type === "date") {
        el.value = formatDateForInput(value);
      } else {
        el.value = value == null ? "" : value;
      }
    });

    // Applica permessi nel contenitore
    applyFieldPermissions("ean-actions-area");

    currentEanInProcess = { objectId: order.objectId, ean: eanInput };
  } catch (err) {
    console.error("Errore durante la verifica EAN:", err);
    scanStatus.textContent = "Errore durante la verifica EAN.";
    scanStatus.className   = "status-message status-error";
    if (actionsArea) actionsArea.classList.add("hidden");
    if (photoUploadArea) photoUploadArea.style.display = "none";
  }
}

// Salva i dati operativi da maschera worker
async function saveEanUpdates() {
  const statusEl = document.getElementById("update-status");

  if (!currentEanInProcess || !currentEanInProcess.objectId) {
    statusEl.textContent = "Errore: nessun ordine in modifica.";
    statusEl.className = "status-message status-error";
    statusEl.classList.remove("hidden");
    return;
  }

  const orderId = currentEanInProcess.objectId;

  try {
    // Ricarico l’ordine per evitare dati obsoleti
    let order = await Backendless.Data.of("Orders").findById(orderId);

    if (!order) {
      statusEl.textContent = "❌ Ordine non trovato.";
      statusEl.className = "status-message status-error";
      statusEl.classList.remove("hidden");
      return;
    }

    // --- Mappa campi operativi ---
    const fieldMap = {
      "field-shots": "shots",
      "field-quantity": "quantity",
      "field-s1-prog": "s1Prog",
      "field-s2-prog": "s2Prog",
      "field-prog-on-model": "progOnModel",
      "field-still-shot": "stillShot",
      "field-onmodel-shot": "onModelShot",
      "field-priority": "priority",
      "field-s1-stylist": "s1Stylist",
      "field-s2-stylist": "s2Stylist",
      "field-provenienza": "provenienza",
      "field-tipologia": "tipologia",
      "field-ordine": "ordine",
      "field-data-ordine": "dataOrdine",
      "field-entry-date": "entryDate",
      "field-exit-date": "exitDate",
      "field-collo": "collo",
      "field-data-reso": "dataReso",
      "field-ddt": "ddt",
      "field-note-logistica": "noteLogistica",
      "field-data-presa-post": "dataPresaPost",
      "field-data-consegna-post": "dataConsegnaPost",
      "field-calendario": "calendario",
      "field-postpresa": "postPresa",
    };

    // --- Aggiorna campi modificabili ---
    for (const [inputId, prop] of Object.entries(fieldMap)) {
      const el = document.getElementById(inputId);
      if (!el || el.disabled) continue; // rispetto permessi

      let value = el.value;

      // Gestione speciali
      if (el.type === "date" && value) {
        value = new Date(value).toISOString(); // ⚠ Backendless accetta solo ISO
      }

      if (el.tagName === "SELECT" && (value === "true" || value === "false")) {
        value = value === "true";
      }

      order[prop] = value;
    }

    // --- Salvataggio Drive link (solo fotografo) ---
    if (currentRole === ROLES.PHOTOGRAPHER) {
      const rawLinks = document.getElementById("photo-drive-links")?.value.trim() || "";

      const driveLinks = rawLinks
        .split("\n")
        .map(l => l.trim())
        .filter(l => l.length > 0);

      if (driveLinks.length > 0) {
        order.driveLinks = driveLinks;
        order.status = "completed"; // ✔ Ordine completato dal fotografo
      }
    }

    // --- Salvataggio su Backendless ---
    await Backendless.Data.of("Orders").save(order);

    // Messaggio conferma
    statusEl.textContent = "✔ Modifiche salvate con successo.";
    statusEl.className = "status-message status-success";
    statusEl.classList.remove("hidden");

    // Chiudi maschera dopo mezzo secondo
    setTimeout(() => {
      resetEanActionState();
      loadOrdersForUser(currentRole);
    }, 600);

  } catch (error) {
    console.error("Errore salvataggio EAN:", error);
    statusEl.textContent = "❌ Errore durante il salvataggio.";
    statusEl.className = "status-message status-error";
    statusEl.classList.remove("hidden");
  }
}


// =====================================================
// DASHBOARD ADMIN (STATISTICHE + CHART)
// =====================================================
async function loadAdminDashboard() {
  const container = document.getElementById("admin-stats");
  const chartEl   = document.getElementById("admin-stats-chart");
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
      const div = document.createElement("div");
      div.className = `p-4 border rounded-lg text-center ${color}`;
      div.innerHTML = `<p class="font-semibold">${status}</p><p class="text-2xl font-bold">${count}</p>`;
      container.appendChild(div);
    });

    if (window.Chart) {
      const ctx    = chartEl.getContext("2d");
      const labels = Object.keys(counts);
      const data   = Object.values(counts);

      if (_adminChart) _adminChart.destroy();

      _adminChart = new Chart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [{
            label: "Numero ordini",
            data,
            backgroundColor: labels.map(() => "rgba(75, 192, 192, 0.5)")
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
      });
    }
  } catch (err) {
    console.error("Errore caricamento dashboard:", err);
  }
}


// =====================================================
// TOGGLE SEZIONI ADMIN + AVVIO
// =====================================================
document.addEventListener("DOMContentLoaded", () => {
  // Toggle carte
  const toggleUsers  = document.getElementById('toggle-users-card');
  const toggleImport = document.getElementById('toggle-import-card');
  const toggleStats  = document.getElementById('toggle-stats-card');

  const usersCard  = document.getElementById('card-users');
  const importCard = document.getElementById('card-import');
  const statsSec   = document.getElementById('admin-stats-section');

  // Popola checkbox per nuovo utente
  populateEditableFieldsCheckboxes();

  // Card Gestione Utenti
  if (toggleUsers && usersCard) {
    const saved = localStorage.getItem('showUsersCard');
    if (saved !== null) {
      toggleUsers.checked = saved === 'true';
      usersCard.style.display = toggleUsers.checked ? 'block' : 'none';
    }
    toggleUsers.addEventListener('change', () => {
      usersCard.style.display = toggleUsers.checked ? 'block' : 'none';
      localStorage.setItem('showUsersCard', toggleUsers.checked);
    });
  }

  // Card Import Excel
  if (toggleImport && importCard) {
    const saved = localStorage.getItem('showImportCard');
    if (saved !== null) {
      toggleImport.checked = saved === 'true';
      importCard.style.display = toggleImport.checked ? 'block' : 'none';
    }
    toggleImport.addEventListener('change', () => {
      importCard.style.display = toggleImport.checked ? 'block' : 'none';
      localStorage.setItem('showImportCard', toggleImport.checked);
    });
  }

  // Riepilogo ordini
  if (toggleStats && statsSec) {
    const saved = localStorage.getItem('showStatsSection');
    if (saved !== null) {
      toggleStats.checked = saved === 'true';
      statsSec.style.display = toggleStats.checked ? 'block' : 'none';
    }
    toggleStats.addEventListener('change', () => {
      statsSec.style.display = toggleStats.checked ? 'block' : 'none';
      localStorage.setItem('showStatsSection', toggleStats.checked);
    });
  }
});

// Controlla lo stato autenticazione al caricamento pagina
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
    .catch(error => {
      console.error("Errore di inizializzazione sessione:", error);
      showLoginArea();
    });
};
