// =====================================================
// PARTE 1 – CONFIGURAZIONE E COSTANTI
// =====================================================
// Configurazione Backendless (sostituisci con le tue chiavi reali)
const APPLICATION_ID = 'C2A5C327-CF80-4BB0-8017-010681F0481C';
const API_KEY = 'B266000F-684B-4889-9174-2D1734001E08';

// Nomi delle tabelle
const USER_TABLE_NAME = "Users";
const ORDER_TABLE_NAME = "Orders";
const STORAGE_CONTAINER_NAME = "product_photos";

// STATI ORDINE
const STATUS_WAITING_PHOTO = "In attesa foto";
const STATUS = {
  WAITING_PHOTO: STATUS_WAITING_PHOTO,
  IN_PHOTO_PROCESS: "Fotografia in corso",
  WAITING_POST_PRODUCTION: "In attesa post-produzione",
  IN_POST_PROCESS: "Post-produzione in corso",
  COMPLETED: "Completato",
  REJECTED: "Rifiutato/Ritorna a foto"
};

// 🎨 CONFIGURAZIONE COLORI STATI
const STATUS_COLORS = {
  [STATUS.WAITING_PHOTO]: "bg-yellow-100 text-yellow-700 border-yellow-300",
  [STATUS.WAITING_POST_PRODUCTION]: "bg-blue-100 text-blue-700 border-blue-300",
  [STATUS.IN_POST_PROCESS]: "bg-amber-100 text-amber-700 border-amber-300",
  ["In approvazione"]: "bg-purple-100 text-purple-700 border-purple-300",
  [STATUS.COMPLETED]: "bg-green-100 text-green-700 border-green-300",
  [STATUS.REJECTED]: "bg-red-100 text-red-700 border-red-300",
  DEFAULT: "bg-gray-100 text-gray-600 border-gray-300"
};

// Ruoli Utente (Devono coincidere con i ruoli Backendless)
const ROLES = {
  ADMIN: "Admin",
  PHOTOGRAPHER: "Photographer",
  POST_PRODUCER: "PostProducer"
};

// 🔧 CONFIGURAZIONE RUOLI (colonne dinamiche + azioni per tabella worker)
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
      <button class="btn-success px-3 py-1 text-sm"
              onclick="startPhotoUpload && startPhotoUpload('${order.objectId}', '${order.eanCode}')">
        Carica Link
      </button>`
  },

  [ROLES.POST_PRODUCER]: {
    filter: `status = '${STATUS.WAITING_POST_PRODUCTION}'`,
    columns: ["productCode", "eanCode", "brand", "color", "size", "status", "driveLinks"],
    actions: order => `
      <button class="btn-primary px-3 py-1 text-sm"
              onclick="updateOrderStatus('${order.objectId}', '${STATUS.COMPLETED}', 'Ordine completato con successo ✅')">
        Segna come completato
      </button>`
  }
};

// =====================================================
// CONFIGURAZIONE DEI CAMPI MODIFICABILI PER UTENTE
// =====================================================
const EDITABLE_FIELDS = [
  { key: "productCode", label: "Codice Articolo", type: "stringa" },
  { key: "eanCode", label: "Ean Code", type: "stringa" },
  { key: "styleName", label: "Style Name", type: "stringa" },
  { key: "styleGroup", label: "Style Group", type: "stringa" },
  { key: "brand", label: "Brand", type: "stringa" },
  { key: "color", label: "Colore", type: "stringa" },
  { key: "size", label: "Taglia", type: "stringa" },
  { key: "category", label: "Categoria", type: "stringa" },
  { key: "gender", label: "Genere", type: "stringa" },
  { key: "shots", label: "N. Scatti", type: "numero" },
  { key: "quantity", label: "Qta", type: "numero" },
  { key: "s1Prog", label: "s1-Prog", type: "stringa" },
  { key: "s2Prog", label: "s2-Prog", type: "stringa" },
  { key: "progOnModel", label: "Prog. on-m", type: "stringa" },
  { key: "stillShot", label: "Scatto Still (S/N)", type: "boolean" },
  { key: "onModelShot", label: "Scatto On Model (S/N)", type: "boolean" },
  { key: "priority", label: "Priorità", type: "stringa" },
  { key: "s1Stylist", label: "s1-Stylist", type: "stringa" },
  { key: "s2Stylist", label: "s2-Stylist", type: "stringa" },
  { key: "provenienza", label: "provenienza", type: "stringa" },
  { key: "tipologia", label: "tipologia", type: "stringa" },
  { key: "ordine", label: "Ordine", type: "numero" },
  { key: "dataOrdine", label: "Data ordine", type: "data" },
  { key: "entryDate", label: "Entry Date", type: "data" },
  { key: "exitDate", label: "Exit Date", type: "data" },
  { key: "collo", label: "Collo", type: "numero" },
  { key: "dataReso", label: "Data Reso", type: "data" },
  { key: "ddt", label: "DDT N.", type: "stringa" },
  { key: "noteLogistica", label: "Note Logistica", type: "stringa" },
  { key: "dataPresaPost", label: "Data Presa in Carico Post", type: "data" },
  { key: "dataConsegnaPost", label: "Data Consegna Post", type: "data" },
  { key: "calendario", label: "Calendario", type: "boolean" },
  { key: "postPresa", label: "Post-presa in carico", type: "stringa" }
];


// ➕ RUOLO AGGIUNTIVO (fuori dall’oggetto ROLE_CONFIG)
ROLE_CONFIG.QUALITY_CHECKER = {
  filter: `status = 'In approvazione'`,
  columns: ["productCode", "eanCode", "brand", "status", "driveLinks"],
  actions: order => `
    <button class="btn-success px-3 py-1 text-sm mr-2"
            onclick="updateOrderStatus('${order.objectId}', 'Approvato', 'Ordine approvato ✅')">
      Approva
    </button>
    <button class="btn-danger px-3 py-1 text-sm"
            onclick="updateOrderStatus('${order.objectId}', 'Respinto', 'Ordine respinto ❌')">
      Rifiuta
    </button>`
};

// Variabili globali di stato
let currentUser = null;
let currentRole = null;
let currentEanInProcess = null;
let currentAdminOrder = null;

// Inizializzazione di Backendless
Backendless.initApp(APPLICATION_ID, API_KEY);
console.log("Backendless inizializzato.");

// Registrazione del Service Worker per la PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('Service Worker registrato con successo:', registration.scope);
      })
      .catch(error => {
        console.error('Service Worker fallito:', error);
      });
  });
}

// =====================================================
// PARTE 2 – AUTENTICAZIONE E GESTIONE UTENTI
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
  const uploadArea = document.getElementById('photo-upload-area');
  if (uploadArea) uploadArea.style.display = 'none';
}

function showStatusMessage(elementId, message, isSuccess = true) {
  const el = document.getElementById(elementId);
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

function handleStandardLogin(email, password) {
  if (!email || !password) {
    showLoginArea("Per favore, inserisci email e password.");
    return;
  }

  document.getElementById('login-status').textContent = "Accesso in corso...";
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

  const queryBuilder = Backendless.DataQueryBuilder.create()
    .setProperties(["objectId", "role"])
    .setWhereClause(`objectId = '${user.objectId}'`);
  return Backendless.Data.of(USER_TABLE_NAME).find(queryBuilder)
    .then(result => {
      if (result && result.length > 0) {
        return result[0].role || 'Nessun Ruolo';
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

      // ✅ Recupera anche i permessi personalizzati dell’utente
      try {
        const userDetails = await Backendless.Data.of(USER_TABLE_NAME).findById(user.objectId);
        currentUser.editableFields = userDetails.editableFields || [];
      } catch (err) {
        console.error("Errore nel recupero dei permessi personalizzati:", err);
        currentUser.editableFields = [];
      }

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
      }
      else if (currentRole === ROLES.PHOTOGRAPHER || currentRole === ROLES.POST_PRODUCER) {
        document.getElementById('admin-dashboard').style.display = 'none';
        document.getElementById('worker-dashboard').style.display = 'block';
        loadOrdersForUser(currentRole);
      }
      else {
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

// ----------------------------------------------------
// FUNZIONI ADMIN (USERS LIST/CRUD RUOLI)
// ----------------------------------------------------

function renderUsersTable(users) {
  const tableBody = document.querySelector('#users-table tbody');
  tableBody.innerHTML = '';
  const loadingUsersEl = document.getElementById('loading-users');

  if (!users || users.length === 0) {
    loadingUsersEl.textContent = "Nessun utente trovato (a parte te, Admin).";
    loadingUsersEl.style.display = 'block';
    return;
  }

  loadingUsersEl.style.display = 'none';

  users.forEach(user => {
    // ✅ Evita errore se currentUser è nullo
    if (currentUser && user.objectId === currentUser.objectId) return;

    const row = tableBody.insertRow();
    row.insertCell().textContent = user.email;

    const currentRoleCell = row.insertCell();
    currentRoleCell.textContent = user.role || 'Nessun Ruolo';

    const actionCell = row.insertCell();
    actionCell.classList.add('action-cell');

    // 🔽 Select per assegnare ruolo
    const roleSelect = document.createElement('select');
    roleSelect.className = 'w-1/2 p-2 border border-gray-300 rounded-md text-sm';
    Object.values(ROLES)
      .filter(r => r !== ROLES.ADMIN)
      .forEach(role => {
        const option = document.createElement('option');
        option.value = role;
        option.textContent = role;
        if (user.role === role) {
          option.selected = true;
        }
        roleSelect.appendChild(option);
      });

    // 💾 Bottone salva ruolo
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Salva Ruolo';
    saveButton.className = 'btn-success text-xs py-1 px-2 mr-2';
    saveButton.onclick = () => updateRole(user.objectId, roleSelect.value);

    // 🗑️ Bottone elimina utente
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Elimina';
    deleteButton.className = 'btn-danger text-xs py-1 px-2';
    deleteButton.onclick = () => deleteUser(user.objectId, user.email);

    // ⚙️ NUOVO – Bottone configurazione permessi
    const permissionsButton = document.createElement('button');
    permissionsButton.textContent = 'Configura Permessi';
    permissionsButton.className = 'btn-secondary text-xs py-1 px-2 ml-2';
    permissionsButton.onclick = () => openPermissionsModal(user.objectId);

    // Append di tutti gli elementi
    actionCell.appendChild(roleSelect);
    actionCell.appendChild(saveButton);
    actionCell.appendChild(deleteButton);
    actionCell.appendChild(permissionsButton);
  });
}

// === GESTIONE PERMESSI DINAMICI CREAZIONE UTENTE ===


// Campi modificabili possibili (coerenti con Backendless)
const EDITABLE_FIELD_OPTIONS = [
  "shots", "quantity", "s1Prog", "s2Prog", "progOnModel",
  "stillShot", "onModelShot", "priority", "s1Stylist", "s2Stylist",
  "provenienza", "tipologia", "ordine", "dataOrdine", "entryDate",
  "exitDate", "collo", "dataReso", "ddt", "noteLogistica",
  "dataPresaPost", "dataConsegnaPost", "calendario", "postPresa"
];

// Popola i checkbox dei campi editabili quando viene selezionato un ruolo
document.addEventListener("DOMContentLoaded", () => {
  const roleSelect = document.getElementById("new-user-role");
  const section = document.getElementById("editable-fields-section");
  const container = document.getElementById("editable-fields-container");

  if (!roleSelect || !section || !container) return; // sicurezza

  roleSelect.addEventListener("change", e => {
    const role = e.target.value;

    // Se Admin, nascondi
    if (role === "Admin") {
      section.classList.add("hidden");
      container.innerHTML = "";
      return;
    }

    // Mostra la sezione e genera le check
    section.classList.remove("hidden");
    container.innerHTML = "";

    EDITABLE_FIELD_OPTIONS.forEach(field => {
      const label = document.createElement("label");
      label.className = "flex items-center space-x-2";
      label.innerHTML = `
        <input type="checkbox" class="editable-field-checkbox" value="${field}">
        <span>${field}</span>
      `;
      container.appendChild(label);
    });
  });
});


// ===============================
// GESTIONE PERMESSI UTENTE (editableFields)
// ===============================

// elenco completo e coerente con i tuoi campi Orders
const ALL_ORDER_FIELDS = [
  "productCode","eanCode","styleName","styleGroup","brand","color","size","category","gender",
  "shots","quantity","s1Prog","s2Prog","progOnModel","stillShot","onModelShot","priority",
  "s1Stylist","s2Stylist","provenienza","tipologia","ordine","dataOrdine","entryDate","exitDate",
  "collo","dataReso","ddt","noteLogistica","dataPresaPost","dataConsegnaPost","calendario","postPresa"
];

let selectedUserForPermissions = null;

/** Apre il modale e costruisce le checkbox in base ai permessi attuali dell'utente */
async function openPermissionsModal(userId) {
  selectedUserForPermissions = userId;

  const modal = document.getElementById("permissions-modal");
  const list = document.getElementById("permissions-list");
  if (!modal || !list) {
    console.error("permissions-modal o permissions-list non trovati nell'HTML.");
    return;
  }

  // pulizia
  list.innerHTML = "";

  try {
    // recupera l'utente per leggere editableFields
    const user = await Backendless.Data.of(USER_TABLE_NAME).findById(userId);
    const currentPerms = Array.isArray(user.editableFields) ? user.editableFields : [];

    // costruzione dinamica delle checkbox
    ALL_ORDER_FIELDS.forEach(field => {
      const isChecked = currentPerms.includes(field);

      const label = document.createElement("label");
      label.className = "flex items-center gap-2 text-sm";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.className = "perm-checkbox";
      input.value = field;
      if (isChecked) input.checked = true;

      const span = document.createElement("span");
      span.textContent = field;

      label.appendChild(input);
      label.appendChild(span);
      list.appendChild(label);
    });

    // mostra modale
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  } catch (err) {
    console.error("Errore apertura modale permessi:", err);
    if (typeof showAdminFeedback === "function") {
      showAdminFeedback("Errore nel recupero permessi utente.", "error");
    } else {
      alert("Errore nel recupero permessi utente.");
    }
  }
}

/** Chiude il modale dei permessi */
function closePermissionsModal() {
  const modal = document.getElementById("permissions-modal");
  const list = document.getElementById("permissions-list");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
  if (list) list.innerHTML = "";
  selectedUserForPermissions = null;
}

/** Salva i permessi selezionati su Backendless (colonna Users.editableFields) */
async function saveUserPermissions() {
  if (!selectedUserForPermissions) return;

  const checked = Array.from(document.querySelectorAll(".perm-checkbox:checked"));
  const selectedFields = checked.map(cb => cb.value);

  try {
    await Backendless.Data.of(USER_TABLE_NAME).save({
      objectId: selectedUserForPermissions,
      editableFields: selectedFields
    });

    if (typeof showAdminFeedback === "function") {
      showAdminFeedback("Permessi aggiornati con successo ✅", "success");
    } else {
      alert("Permessi aggiornati con successo ✅");
    }

    closePermissionsModal();
  } catch (err) {
    console.error("Errore salvataggio permessi:", err);
    if (typeof showAdminFeedback === "function") {
      showAdminFeedback("Errore durante il salvataggio dei permessi ❌", "error");
    } else {
      alert("Errore durante il salvataggio dei permessi ❌");
    }
  }
}

function loadUsersAndRoles() {
  const loadingUsersEl = document.getElementById('loading-users');
  loadingUsersEl.textContent = "Caricamento lista utenti...";
  loadingUsersEl.style.display = 'block';

  const queryBuilder = Backendless.DataQueryBuilder.create()
    .setProperties(["objectId", "email", "role"])
    .setPageSize(50);

  Backendless.Data.of(USER_TABLE_NAME).find(queryBuilder)
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
  if (confirm(`Sei sicuro di voler eliminare l'utente ${email}?`)) {
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
}

async function handleUserCreation() {
  const email = document.getElementById("new-user-email").value.trim();
  const password = document.getElementById("new-user-password").value.trim();
  const role = document.getElementById("new-user-role").value;
  const statusEl = document.getElementById("user-creation-status");

  if (!email || !password || !role) {
    statusEl.textContent = "⚠️ Compila tutti i campi (Email, Password e Ruolo).";
    statusEl.className = "status-message status-warning";
    statusEl.classList.remove("hidden");
    return;
  }

  try {
    statusEl.textContent = "Creazione utente in corso...";
    statusEl.className = "status-message status-info";
    statusEl.classList.remove("hidden");

    // Raccogli i campi modificabili selezionati
    const checkboxes = document.querySelectorAll(".editable-field-checkbox:checked");
    const editableFields = Array.from(checkboxes).map(c => c.value);

    // Crea nuovo utente su Backendless
    const newUser = new Backendless.User();
    newUser.email = email;
    newUser.password = password;
    newUser.role = role;
    newUser.editableFields = editableFields; // <-- memorizzati su Backendless

    const savedUser = await Backendless.UserService.register(newUser);

    // Assegna il ruolo nel sistema di sicurezza
    await Backendless.Roles.addUserToRole(savedUser, role);

    statusEl.textContent = `✅ Utente ${email} creato con ruolo ${role}.`;
    statusEl.className = "status-message status-success";

    // Ripulisce form
    document.getElementById("new-user-email").value = "";
    document.getElementById("new-user-password").value = "";
    document.getElementById("new-user-role").value = "";
    document.getElementById("editable-fields-section").classList.add("hidden");

    loadUsersAndRoles();
  } catch (err) {
    console.error("Errore creazione utente:", err);
    statusEl.textContent = `❌ Errore durante la creazione: ${err.message}`;
    statusEl.className = "status-message status-error";
  }
}
// =====================================================
// PARTE 3 – FUNZIONI ADMIN (ORDINI: LISTA, EDIT, IMPORT)
// =====================================================

/** Escaping di sicurezza per HTML */
function escapeHTML(str) {
  return String(str || '').replace(/[&<>"']/g, match => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[match]));
}

/** Feedback toast nell'area admin */
function showAdminFeedback(message, type = 'info') {
  const feedbackBox = document.createElement('div');
  feedbackBox.textContent = message;
  feedbackBox.className =
    `fixed bottom-4 right-4 px-4 py-2 rounded shadow-lg text-white z-50 
    ${type === 'success' ? 'bg-green-600' :
      type === 'error' ? 'bg-red-600' :
      'bg-blue-600'}`;

  document.body.appendChild(feedbackBox);
  setTimeout(() => feedbackBox.remove(), 4000);
}

/** Evidenzia riga aggiornata */
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

/** Carica tutti gli ordini nella tabella Admin */
async function loadAllOrdersForAdmin() {
  const loadingEl = document.getElementById('loading-admin-orders');
  const table = document.getElementById('admin-orders-table');
  const tbody = table.querySelector('tbody');

  loadingEl.textContent = "Caricamento ordini in corso...";
  loadingEl.style.display = "block";
  loadingEl.style.color = "#111";
  tbody.innerHTML = "";
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
      tr.classList.add('hover:bg-gray-100', 'cursor-pointer');
      tr.dataset.objectid = order.objectId;

      tr.innerHTML = `
        <td class="px-4 py-2">${escapeHTML(order.productCode)}</td>
        <td class="px-4 py-2">${escapeHTML(order.eanCode)}</td>
        <td class="px-4 py-2">${escapeHTML(order.brand)}</td>
        <td class="px-4 py-2">${escapeHTML(order.color)}</td>
        <td class="px-4 py-2">${escapeHTML(order.size)}</td>
        <td class="px-4 py-2">
          ${Array.isArray(order.driveLinks) && order.driveLinks.length > 0
            ? order.driveLinks.map(raw => {
                const link = escapeHTML(String(raw).trim());
                return `
                  <a href="${link}" target="_blank"
                     class="text-blue-600 underline block truncate max-w-xs hover:text-blue-800">
                     ${link}
                  </a>`;
              }).join('')
            : '<span class="text-gray-400 italic">Nessun link</span>'}
        </td>
        <td class="px-4 py-2">
          <button class="btn-primary px-3 py-1 text-sm" data-oid="${order.objectId}">
            Modifica
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });

    // bind pulsanti Modifica → maschera completa
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

/** Apre la card di modifica completa per Admin e popola i campi */
async function handleAdminEdit(order) {
  if (!order) return;

  // Nascondi tabella principale
  const ordersCard = document.getElementById('orders-admin-card');
  if (ordersCard) ordersCard.classList.add('hidden');

  // Mostra maschera di modifica
  const editCard = document.getElementById('admin-order-edit-card');
  editCard.classList.remove('hidden');

  // Mostra intestazione EAN
  document.getElementById('admin-ean-display').textContent =
    order.eanCode || order.productCode || '';

  const container = document.getElementById("admin-order-edit-fields");
  container.innerHTML = ""; // pulisci prima

  // Lista dei campi con tipo (testo, numero, data, booleano)
  const fields = {
    productCode: "text",
    eanCode: "text",
    styleName: "text",
    styleGroup: "text",
    brand: "text",
    color: "text",
    size: "text",
    category: "text",
    gender: "text",
    shots: "number",
    quantity: "number",
    s1Prog: "text",
    s2Prog: "text",
    progOnModel: "text",
    stillShot: "boolean",
    onModelShot: "boolean",
    priority: "text",
    s1Stylist: "text",
    s2Stylist: "text",
    provenienza: "text",
    tipologia: "text",
    ordine: "number",
    dataOrdine: "date",
    entryDate: "date",
    exitDate: "date",
    collo: "number",
    dataReso: "date",
    ddt: "text",
    noteLogistica: "text",
    dataPresaPost: "date",
    dataConsegnaPost: "date",
    calendario: "boolean",
    postPresa: "text"
  };

  // Genera campi dinamicamente
  for (const [key, type] of Object.entries(fields)) {
    const value = order[key] || "";
    let inputHTML = "";

    if (type === "boolean") {
      inputHTML = `
        <select id="admin-field-${key}" class="border rounded p-2 w-full">
          <option value="true" ${value === true ? "selected" : ""}>Sì</option>
          <option value="false" ${value === false ? "selected" : ""}>No</option>
        </select>
      `;
    } else {
      inputHTML = `<input type="${type}" id="admin-field-${key}" value="${value}" class="border rounded p-2 w-full">`;
    }

    const fieldEl = document.createElement("div");
    fieldEl.innerHTML = `
      <label class="block text-sm font-medium text-gray-700 mb-1">
        ${key}
      </label>
      ${inputHTML}
    `;
    container.appendChild(fieldEl);
  }

  // Applica permessi dinamici (chi può modificare cosa)
  applyFieldPermissions("admin-order-edit-card");

  // Salva ordine attuale
  currentAdminOrder = order;
}

/**
 * Abilita o disabilita i campi in base ai permessi dell'utente loggato
 */
function applyFieldPermissions(containerId) {
  if (!currentUser || !Array.isArray(currentUser.editableFields)) return;

  const allowed = currentUser.editableFields;
  const inputs = document.querySelectorAll(`#${containerId} input, #${containerId} select, #${containerId} textarea`);

  inputs.forEach(el => {
    const fieldName = el.id.replace(/^admin-field-|^field-/, ""); // rimuove prefissi
    if (allowed.includes(fieldName)) {
      el.disabled = false;
      el.classList.remove("opacity-50", "cursor-not-allowed");
    } else {
      el.disabled = true;
      el.classList.add("opacity-50", "cursor-not-allowed");
    }
  });
}


/** Salva aggiornamenti della card Admin */
async function saveAdminOrderUpdates() {
  if (!currentAdminOrder || !currentAdminOrder.objectId) {
    showAdminFeedback("⚠️ Nessun ordine selezionato.", "error");
    return;
  }

  const updatedOrder = { objectId: currentAdminOrder.objectId };

  // Stessa mappa campi
  const map = {
    "admin-field-productCode": "productCode",
    "admin-field-eanCode": "eanCode",
    "admin-field-styleName": "styleName",
    "admin-field-styleGroup": "styleGroup",
    "admin-field-brand": "brand",
    "admin-field-color": "color",
    "admin-field-size": "size",
    "admin-field-category": "category",
    "admin-field-gender": "gender",
    "admin-field-shots": "shots",
    "admin-field-quantity": "quantity",
    "admin-field-s1Prog": "s1Prog",
    "admin-field-s2Prog": "s2Prog",
    "admin-field-progOnModel": "progOnModel",
    "admin-field-stillShot": "stillShot",
    "admin-field-onModelShot": "onModelShot",
    "admin-field-priority": "priority",
    "admin-field-s1Stylist": "s1Stylist",
    "admin-field-s2Stylist": "s2Stylist",
    "admin-field-provenienza": "provenienza",
    "admin-field-tipologia": "tipologia",
    "admin-field-ordine": "ordine",
    "admin-field-dataOrdine": "dataOrdine",
    "admin-field-entryDate": "entryDate",
    "admin-field-exitDate": "exitDate",
    "admin-field-collo": "collo",
    "admin-field-dataReso": "dataReso",
    "admin-field-ddt": "ddt",
    "admin-field-noteLogistica": "noteLogistica",
    "admin-field-dataPresaPost": "dataPresaPost",
    "admin-field-dataConsegnaPost": "dataConsegnaPost",
    "admin-field-calendario": "calendario",
    "admin-field-postpresa": "postPresa"
  };

  Object.entries(map).forEach(([fieldId, prop]) => {
    const el = document.getElementById(fieldId);
    if (el) updatedOrder[prop] = el.value.trim();
  });

  updatedOrder.lastUpdated = new Date();

  try {
    await Backendless.Data.of(ORDER_TABLE_NAME).save(updatedOrder);
    showAdminFeedback("✅ Aggiornamenti salvati correttamente!", "success");
    currentAdminOrder = updatedOrder;

    await loadAllOrdersForAdmin(); // ricarica la lista ordini
    highlightUpdatedRow(updatedOrder.objectId); // evidenzia riga aggiornata

    // Chiudi card modifica e riapri lista ordini
    const editCard = document.getElementById('admin-order-edit-card');
    editCard.classList.add('hidden');

    const ordersCard = document.getElementById('orders-admin-card');
    if (ordersCard) ordersCard.classList.remove('hidden');

  } catch (err) {
    console.error(err);
    showAdminFeedback("❌ Errore durante il salvataggio: " + (err.message || ""), "error");
  }
}


function applyFieldPermissions(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const isAdmin = currentRole === ROLES.ADMIN;
  let allowed = [];

  if (!isAdmin && currentUser && Array.isArray(currentUser.editableFields)) {
    allowed = currentUser.editableFields;
  }

  container.querySelectorAll("input, select, textarea").forEach(input => {
    const fieldKey = input.id.replace("admin-field-", "");
    const canEdit = isAdmin || allowed.includes(fieldKey);

    input.disabled = !canEdit;
    input.classList.toggle("opacity-50", !canEdit);
  });
}

async function saveAdminOrderChanges() {
  if (!currentAdminOrder) return;

  const status = document.getElementById("admin-edit-status");
  status.textContent = "Salvataggio in corso...";
  status.className = "status-message status-info";
  status.classList.remove("hidden");

  try {
    const container = document.getElementById("admin-order-edit-fields");
    const updated = { objectId: currentAdminOrder.objectId };

    container.querySelectorAll("input, select").forEach(input => {
      const key = input.id.replace("admin-field-", "");
      if (input.type === "number") updated[key] = Number(input.value) || 0;
      else if (input.type === "date") updated[key] = input.value ? new Date(input.value) : null;
      else if (input.type === "select-one" && (input.value === "true" || input.value === "false"))
        updated[key] = input.value === "true";
      else updated[key] = input.value;
    });

    await Backendless.Data.of("Orders").save(updated);

    status.textContent = "✅ Modifiche salvate con successo!";
    status.className = "status-message status-success";

    // Ricarica lista ordini
    await loadAllOrdersForAdmin();

    // Torna alla tabella
    document.getElementById('admin-order-edit-card').classList.add('hidden');
    document.getElementById('orders-admin-card').classList.remove('hidden');
  } catch (err) {
    console.error("Errore salvataggio ordine:", err);
    status.textContent = "❌ Errore durante il salvataggio: " + err.message;
    status.className = "status-message status-error";
  }
}

function cancelAdminOrderEdit() {
  document.getElementById('admin-order-edit-card').classList.add('hidden');
  document.getElementById('orders-admin-card').classList.remove('hidden');
}


function cancelAdminOrderEdit() {
  const editCard = document.getElementById('admin-order-edit-card');
  const ordersCard = document.getElementById('orders-admin-card');

  // Nasconde card modifica
  editCard.classList.add('hidden');
  currentAdminOrder = null;

  // Mostra di nuovo la lista ordini
  if (ordersCard) ordersCard.classList.remove('hidden');

  // Pulisce tutti i campi della card di modifica
  const fields = editCard.querySelectorAll('input, textarea, select');
  fields.forEach(f => f.value = '');
}

// ----------------------------------------------------
// FUNZIONI DI UPLOAD FILE ADMIN (IMPORT EXCEL)
// ----------------------------------------------------
async function handleFileUpload() {
  const fileInput = document.getElementById('excel-file-input');
  const statusEl = document.getElementById('import-status');
  const logEl = document.getElementById('import-log');
  const progressBar = document.getElementById('import-progress-bar');

  logEl.textContent = '';
  logEl.style.display = 'none';

  if (!fileInput.files || fileInput.files.length === 0) {
    statusEl.textContent = "Seleziona un file Excel prima di procedere.";
    statusEl.className = 'status-message bg-red-100 text-red-700 p-2 rounded';
    statusEl.style.display = 'block';
    return;
  }

  // ✅ Leggiamo i valori inseriti dall’admin nei 4 campi
  const provenienzaVal = document.getElementById('admin-provenienza').value.trim();
  const tipologiaVal = document.getElementById('admin-tipologia').value.trim();
  const ordineVal = document.getElementById('admin-ordine').value.trim();
  const dataOrdineVal = document.getElementById('admin-data-ordine').value;

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = async function(e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

    if (!jsonData || jsonData.length === 0) {
      statusEl.textContent = "File Excel vuoto o non leggibile.";
      statusEl.className = 'status-message bg-red-100 text-red-700 p-2 rounded';
      statusEl.style.display = 'block';
      return;
    }

    statusEl.textContent = `Inizio importazione di ${jsonData.length} ordini...`;
    statusEl.className = 'status-message bg-blue-100 text-blue-700 p-2 rounded';
    statusEl.style.display = 'block';

    const total = jsonData.length;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const productCode = row["Codice Articolo"] || "";

      // Controllo duplicati
      const query = Backendless.DataQueryBuilder.create()
        .setWhereClause(`productCode='${productCode}'`);
      const duplicates = await Backendless.Data.of("Orders").find(query);

      if (duplicates.length > 0) {
        logEl.style.display = 'block';
        logEl.textContent += `❌ Codice duplicato trovato: ${productCode}\n`;
        failCount++;
        const progress = Math.round(((i + 1) / total) * 100);
        if (progressBar) progressBar.style.width = progress + "%";
        continue;
      }

      // ✅ Creazione oggetto ordine con campi aggiuntivi
      const orderObj = {
        productCode,
        eanCode: row["Ean Code"] || "",
        styleName: row["Style Name"] || "",
        styleGroup: row["Style Group"] || "",
        brand: row["Brand"] || "",
        color: row["Colore"] || "",
        size: row["Taglia"] || "",
        category: row["Categoria"] || "",
        gender: row["Genere"] || "",
        provenienza: provenienzaVal,
        tipologia: tipologiaVal,
        ordine: ordineVal,
        dataOrdine: dataOrdineVal || row["Data Ordine"] || "",
        status: STATUS_WAITING_PHOTO,
        assignedToPhotographerId: "",
        assignedToPostProducerId: "",
        lastUpdated: new Date()
      };

      try {
        await Backendless.Data.of("Orders").save(orderObj);
        successCount++;
      } catch (err) {
        console.error("Errore import ordine:", err);
        failCount++;
      }

      const progress = Math.round(((i + 1) / total) * 100);
      if (progressBar) progressBar.style.width = progress + "%";
    }

    // ✅ Stato finale
    statusEl.textContent = `Importazione completata: ${successCount} successi, ${failCount} errori.`;
    statusEl.className = failCount === 0
      ? 'status-message bg-green-100 text-green-700 p-2 rounded'
      : 'status-message bg-yellow-100 text-yellow-700 p-2 rounded';

    fileInput.value = "";

    // ✅ Refresh lista ordini admin
    if (typeof loadAllOrdersForAdmin === 'function') {
      loadAllOrdersForAdmin();
    }

    // ✅ Notifica visiva per admin
    if (typeof showAdminFeedback === 'function') {
      showAdminFeedback(`Importazione completata: ${successCount} successi, ${failCount} errori.`);
    }
  };

  reader.readAsArrayBuffer(file);
}

// =====================================================
// PARTE 4 – WORKER (EAN, UPLOAD LINK, FEEDBACK)
// =====================================================

/** Apertura modale foto (se usata) */
function openPhotoModal(eanCode) {
  document.getElementById('photo-modal').style.display = 'block';
  document.getElementById('modal-ean-title').textContent = eanCode || '';
  const modalContent = document.getElementById('photo-modal-content');
  modalContent.innerHTML = `<p>Caricamento foto per EAN: ${eanCode}...</p>`;
}

function closePhotoModal() {
  document.getElementById('photo-modal').style.display = 'none';
}

/** Conferma EAN o Codice Articolo */
async function confirmEanInput() {
  const eanInput = document.getElementById("ean-input").value.trim();
  const scanStatus = document.getElementById("scan-status");
  const actionsArea = document.getElementById("ean-actions-area");
  const photoUploadArea = document.getElementById("photo-upload-area");
  const currentEanDisplay = document.getElementById("current-ean-display");

  if (!eanInput) {
    scanStatus.textContent = "Inserisci un codice EAN o un Codice Articolo!";
    scanStatus.className = "status-message status-error";
    scanStatus.classList.remove("hidden");
    actionsArea.classList.add("hidden");
    photoUploadArea.style.display = "none";
    return;
  }

  try {
    scanStatus.textContent = "Verifica in corso...";
    scanStatus.className = "status-message status-info";
    scanStatus.classList.remove("hidden");

    const query = Backendless.DataQueryBuilder.create().setWhereClause(
      `eanCode='${eanInput}' OR productCode='${eanInput}'`
    );
    const orders = await Backendless.Data.of("Orders").find(query);

    if (!orders || orders.length === 0) {
      scanStatus.textContent = `❌ Codice ${eanInput} non trovato in Backendless.`;
      scanStatus.className = "status-message status-error";
      actionsArea.classList.add("hidden");
      photoUploadArea.style.display = "none";
      return;
    }

    const order = orders[0];
    scanStatus.textContent = `✅ Codice ${eanInput} trovato. Compila o aggiorna i dati operativi.`;
    scanStatus.className = "status-message status-success";

    // Mostra l'area operativa
    actionsArea.classList.remove("hidden");
    if (currentEanDisplay) currentEanDisplay.textContent = eanInput;

    // Gestione visibilità area upload foto
    if (currentRole === ROLES.PHOTOGRAPHER) {
      photoUploadArea.style.display = "block";
      const uploadEanDisplay = document.getElementById("current-ean-display-upload");
      if (uploadEanDisplay) uploadEanDisplay.textContent = eanInput;
    } else {
      photoUploadArea.style.display = "none";
    }

    // Mappa dei campi operativi
    const map = {
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

    // Popola i campi del form
    Object.entries(map).forEach(([inputId, key]) => {
      const el = document.getElementById(inputId);
      if (el) el.value = order[key] || "";
    });

    // ✅ Applica i permessi dinamici in base all’utente loggato
    applyFieldPermissions("ean-actions-area");

    // Salva lo stato corrente
    currentEanInProcess = { objectId: order.objectId, ean: eanInput };
  } catch (err) {
    console.error("Errore durante la verifica EAN:", err);
    scanStatus.textContent = "Errore durante la verifica EAN.";
    scanStatus.className = "status-message status-error";
    actionsArea.classList.add("hidden");
    photoUploadArea.style.display = "none";
  }
}
/**
 * Salva gli aggiornamenti dell'ordine corrente (solo campi autorizzati)
 */
async function saveEanUpdates() {
  const updateStatus = document.getElementById("update-status");
  if (!currentEanInProcess || !currentEanInProcess.objectId) {
    updateStatus.textContent = "❌ Nessun ordine selezionato.";
    updateStatus.className = "status-message status-error";
    updateStatus.classList.remove("hidden");
    return;
  }

  try {
    updateStatus.textContent = "Salvataggio in corso...";
    updateStatus.className = "status-message status-info";
    updateStatus.classList.remove("hidden");

    const orderId = currentEanInProcess.objectId;

    // Ottieni permessi: Admin = tutti, altri = editableFields
    const isAdmin = currentRole === ROLES.ADMIN;
    const allowedFields = isAdmin
      ? null
      : Array.isArray(currentUser.editableFields)
      ? currentUser.editableFields
      : [];

    // Mappa dei campi operativi
    const map = {
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

    // Crea oggetto aggiornamento
    const updates = {};

    Object.entries(map).forEach(([inputId, prop]) => {
      const el = document.getElementById(inputId);
      if (!el) return;

      // Se non admin, aggiorna solo se il campo è permesso
      if (!isAdmin && !allowedFields.includes(prop)) return;

      const val = el.value?.trim?.() ?? "";
      if (val !== "") updates[prop] = val;
    });

    if (Object.keys(updates).length === 0) {
      updateStatus.textContent = "⚠️ Nessun campo modificato o permesso insufficiente.";
      updateStatus.className = "status-message status-warning";
      return;
    }

    // Aggiorna record su Backendless
    updates.objectId = orderId;
    await Backendless.Data.of("Orders").save(updates);

    updateStatus.textContent = "✅ Dati aggiornati con successo!";
    updateStatus.className = "status-message status-success";

    // Piccola pausa e reset form
    setTimeout(() => {
      updateStatus.classList.add("hidden");
      resetEanActionState(true);
      loadOrdersForUser(currentRole);
    }, 1200);
  } catch (err) {
    console.error("Errore nel salvataggio EAN:", err);
    updateStatus.textContent = "❌ Errore durante il salvataggio.";
    updateStatus.className = "status-message status-error";
  }
}


/** Upload link Google Drive e cambio stato */
async function handlePhotoUploadAndCompletion() {
  const status = document.getElementById('upload-status-message');
  const linksInput = document.getElementById('photo-drive-links');

  if (!currentEanInProcess || !currentEanInProcess.objectId) {
    status.textContent = 'Nessun EAN attivo.';
    status.classList.remove('hidden');
    return;
  }

  const linksRaw = linksInput.value.trim();
  if (!linksRaw) {
    status.textContent = 'Inserisci almeno un link Google Drive.';
    status.classList.remove('hidden');
    return;
  }

  const driveLinks = linksRaw.split('\n').map(l => l.trim()).filter(l => l !== '');

  status.textContent = 'Salvataggio link in corso...';
  status.classList.remove('hidden');

  try {
    await Backendless.Data.of(ORDER_TABLE_NAME).save({
      objectId: currentEanInProcess.objectId,
      driveLinks: driveLinks,
      status: STATUS.WAITING_POST_PRODUCTION,
      lastUpdated: new Date()
    });

    status.textContent = 'Link salvati e ordine aggiornato con successo!';
    linksInput.value = '';
    resetEanActionState(false);
    loadOrdersForUser(currentRole);
  } catch (error) {
    console.error('Errore durante il salvataggio link:', error);
    status.textContent = 'Errore durante il salvataggio dei link.';
  }
}

/** Messaggi feedback worker */
function showFeedback(message, type) {
  const feedbackElement = document.getElementById('operation-feedback');
  if (!feedbackElement) return console.error("⚠️ Elemento #operation-feedback non trovato.");

  feedbackElement.classList.remove('status-success', 'status-error', 'status-info', 'hidden');
  feedbackElement.textContent = message;
  feedbackElement.classList.add(`status-${type}`);
  feedbackElement.style.display = 'block';

  setTimeout(() => { feedbackElement.style.display = 'none'; }, 3000);
}

/** Reset interfaccia EAN */
function resetEanActionState(showCancelFeedback = false) {
  document.getElementById('ean-actions-area').classList.add('hidden');
  document.getElementById('photo-upload-area').classList.add('hidden');
  document.getElementById('confirm-ean-btn').classList.remove('hidden');
  document.getElementById('ean-input').value = '';

  if (showCancelFeedback) {
    showFeedback("Operazione di aggiornamento annullata.", 'info');
  }
}

/** Aggiorna lo stato di un ordine (riuso ruoli vari) */
async function updateOrderStatus(orderId, newStatus, successMessage = "Ordine aggiornato con successo!") {
  if (!orderId) return;
  const confirmAction = confirm(`Vuoi impostare lo stato su "${newStatus}"?`);
  if (!confirmAction) return;

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
    }, 1000);
  } catch (error) {
    console.error("Errore durante l'aggiornamento ordine:", error);
    statusEl.textContent = "Errore durante l'aggiornamento ordine ❌";
    statusEl.style.color = "#b91c1c";
  }
}

// ----------------------------------------------------
// LISTA ORDINI PER RUOLO (WORKER TABLE DINAMICA)
// ----------------------------------------------------
async function loadOrdersForUser(role) {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG[ROLES.ADMIN];
  const loadingEl = document.getElementById('loading-orders');
  const table = document.getElementById('orders-table');
  const tbody = table.querySelector('tbody');

  loadingEl.textContent = "Caricamento ordini in corso...";
  loadingEl.style.display = "block";
  loadingEl.style.color = "#111";
  tbody.innerHTML = "";
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

    // Intestazione dinamica
    const thead = table.querySelector('thead');
    if (thead) {
      thead.innerHTML = `
        <tr>
          ${config.columns.map(col => `<th class="px-4 py-2 capitalize">${col}</th>`).join('')}
          <th class="px-4 py-2">Azioni</th>
        </tr>`;
    }

    // Righe
    orders.forEach(order => {
      const tr = document.createElement('tr');
      tr.classList.add('hover:bg-gray-100', 'cursor-pointer');

      const colsHtml = config.columns.map(col => {
        if (col === "driveLinks") {
          if (Array.isArray(order.driveLinks) && order.driveLinks.length > 0) {
            return `
              <td class="px-4 py-2">
                ${order.driveLinks
                  .map(raw => {
                    const link = escapeHTML(String(raw).trim());
                    return `
                      <a href="${link}" target="_blank"
                         class="text-blue-600 underline block truncate max-w-xs hover:text-blue-800">
                        ${link}
                      </a>`;
                  })
                  .join('')}
              </td>`;
          } else {
            return `<td class="px-4 py-2 text-gray-400 italic">Nessun link</td>`;
          }
        }
        return `<td class="px-4 py-2">${escapeHTML(order[col] || '')}</td>`;
      }).join('');

      tr.innerHTML = `${colsHtml}<td class="px-4 py-2">${config.actions(order)}</td>`;
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

// =====================================================
// PARTE 5 – TOGGLE ADMIN, DASHBOARD CHART, INIT SESSIONE
// =====================================================

// Toggle visibilità sezioni admin (utenti, import, riepilogo)
document.addEventListener("DOMContentLoaded", () => {
  const toggleUsers = document.getElementById('toggle-users-card');
  const toggleImport = document.getElementById('toggle-import-card');
  const toggleStats = document.getElementById('toggle-stats-card');

  const usersCard = document.getElementById('card-users');
  const importCard = document.getElementById('card-import');
  const statsSection = document.getElementById('admin-stats-section');

  // === Render dinamico checkbox "Campi modificabili" nella creazione utente ===
  const editableFieldsContainer = document.getElementById('editable-fields-container');
  if (editableFieldsContainer && typeof EDITABLE_FIELDS !== "undefined") {
    editableFieldsContainer.innerHTML = '';
    EDITABLE_FIELDS.forEach(f => {
      const div = document.createElement('div');
      div.innerHTML = `
        <label class="flex items-center space-x-2">
          <input type="checkbox" value="${f.key}">
          <span>${f.label}</span>
        </label>`;
      editableFieldsContainer.appendChild(div);
    });
  }


  // Card Gestione Utenti
  if (toggleUsers && usersCard) {
    const savedUsersVisibility = localStorage.getItem('showUsersCard');
    if (savedUsersVisibility !== null) {
      toggleUsers.checked = savedUsersVisibility === 'true';
      usersCard.style.display = toggleUsers.checked ? 'block' : 'none';
    }
    toggleUsers.addEventListener('change', () => {
      usersCard.style.display = toggleUsers.checked ? 'block' : 'none';
      localStorage.setItem('showUsersCard', toggleUsers.checked);
    });
  }

  // Card Import Excel
  if (toggleImport && importCard) {
    const savedImportVisibility = localStorage.getItem('showImportCard');
    if (savedImportVisibility !== null) {
      toggleImport.checked = savedImportVisibility === 'true';
      importCard.style.display = toggleImport.checked ? 'block' : 'none';
    }
    toggleImport.addEventListener('change', () => {
      importCard.style.display = toggleImport.checked ? 'block' : 'none';
      localStorage.setItem('showImportCard', toggleImport.checked);
    });
  }

  // Sezione Riepilogo Ordini
  if (toggleStats && statsSection) {
    const savedStatsVisibility = localStorage.getItem('showStatsSection');
    if (savedStatsVisibility !== null) {
      toggleStats.checked = savedStatsVisibility === 'true';
      statsSection.style.display = toggleStats.checked ? 'block' : 'none';
    }
    toggleStats.addEventListener('change', () => {
      statsSection.style.display = toggleStats.checked ? 'block' : 'none';
      localStorage.setItem('showStatsSection', toggleStats.checked);
    });
  }
});

// Dashboard riepilogo + grafico (Chart.js deve essere caricato via CDN nell'HTML)
async function loadAdminDashboard() {
  const dash = document.getElementById("admin-dashboard");
  const container = document.getElementById("admin-stats");
  const chartEl = document.getElementById("admin-stats-chart");
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

    // Mostra sezione dashboard
    dash.classList.remove("hidden");

    if (window.Chart) {
      const ctx = chartEl.getContext("2d");
      const labels = Object.keys(counts);
      const data = Object.values(counts);
      const colors = labels.map(l => {
        const c = STATUS_COLORS[l] || STATUS_COLORS.DEFAULT;
        const match = c.match(/text-([a-z]+)-(\d+)/);
        return match ? match[1] : "gray";
      });

      if (window._adminChart) window._adminChart.destroy();

      window._adminChart = new Chart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [{
            label: "Numero ordini",
            data,
            backgroundColor: colors.map(c => `var(--tw-${c}-400, #9ca3af)`)
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
    console.error("Errore caricamento dashboard:", err);
  }
}

// ----------------------------------------------------
// GESTIONE INIZIALE – RIPRISTINO SESSIONE
// ----------------------------------------------------
window.onload = function() {
  Backendless.UserService.isValidLogin()
    .then(isValid => {
      if (isValid) {
        return Backendless.UserService.getCurrentUser()
          .then(user => {
            return user;
          });
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
