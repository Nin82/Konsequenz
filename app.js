// =====================================================
//  CONFIGURAZIONE BACKENDLESS & COSTANTI
// =====================================================

const APPLICATION_ID = 'C2A5C327-CF80-4BB0-8017-010681F0481C';
const API_KEY        = 'B266000F-684B-4889-9174-2D1734001E08';

const USER_TABLE_NAME  = "Users";
const ORDER_TABLE_NAME = "Orders";

// Stati ordine
const STATUS = {
  IMPORTED:              "Importato",
  IN_WAREHOUSE:          "In magazzino",
  WAITING_PHOTO:         "In attesa foto",
  IN_PHOTO_PROCESS:      "Fotografia in corso",
  WAITING_POST:          "In attesa post-produzione",
  IN_POST_PROCESS:       "Post-produzione in corso",
  WAITING_ADMIN_CHECK:   "In attesa validazione admin",
  COMPLETED:             "Completato",
  DELIVERED:             "Consegnato",
};

const STATUS_COLORS = {
  [STATUS.IMPORTED]:            "bg-gray-100 text-gray-700 border-gray-300",
  [STATUS.IN_WAREHOUSE]:        "bg-slate-100 text-slate-700 border-slate-300",
  [STATUS.WAITING_PHOTO]:       "bg-yellow-100 text-yellow-700 border-yellow-300",
  [STATUS.IN_PHOTO_PROCESS]:    "bg-amber-100 text-amber-700 border-amber-300",
  [STATUS.WAITING_POST]:        "bg-blue-100 text-blue-700 border-blue-300",
  [STATUS.IN_POST_PROCESS]:     "bg-indigo-100 text-indigo-700 border-indigo-300",
  [STATUS.WAITING_ADMIN_CHECK]: "bg-purple-100 text-purple-700 border-purple-300",
  [STATUS.COMPLETED]:           "bg-green-100 text-green-700 border-green-300",
  [STATUS.DELIVERED]:           "bg-emerald-100 text-emerald-700 border-emerald-300",
  DEFAULT:                      "bg-gray-100 text-gray-600 border-gray-300",
};

// Ruoli
const ROLES = {
  ADMIN:       "Admin",
  WAREHOUSE:   "Magazzino",
  PHOTOGRAPHER:"Photographer",
  POST_PROD:   "PostProducer",
  PARTNER:     "Partner",
  CUSTOMER:    "Customer",
};

// -----------------------------------------------------
// CONFIGURAZIONE COLONNE / AZIONI PER RUOLO
// (per le tabelle ordini nei worker)
// -----------------------------------------------------
const ROLE_TABLE_CONFIG = {
  [ROLES.WAREHOUSE]: {
    where: "",  // vede tutto
    columns: ["productCode","eanCode","brand","color","size","status"],
    actions: order => `
      <button class="btn-primary px-3 py-1 text-xs"
              onclick="openWorkerOrderEditor('${order.objectId}')">
        Apri Modifica
      </button>
    `
  },
  [ROLES.PHOTOGRAPHER]: {
    where: `status = '${STATUS.WAITING_PHOTO}' OR status = '${STATUS.IN_PHOTO_PROCESS}'`,
    columns: ["productCode","eanCode","brand","color","size","status"],
    actions: order => `
      <button class="btn-success px-3 py-1 text-xs"
              onclick="openWorkerOrderEditor('${order.objectId}')">
        Apri Modifica
      </button>
    `
  },
  [ROLES.POST_PROD]: {
    where: `status = '${STATUS.WAITING_POST}' OR status = '${STATUS.IN_POST_PROCESS}'`,
    columns: ["productCode","eanCode","brand","color","size","status"],
    actions: order => `
      <button class="btn-primary px-3 py-1 text-xs"
              onclick="openWorkerOrderEditor('${order.objectId}')">
        Apri Modifica
      </button>
    `
  },
  [ROLES.PARTNER]: {
    // vede solo i suoi ordini
    whereFactory: userId => `assignedToId = '${userId}'`,
    columns: ["productCode","eanCode","brand","color","size","status"],
    actions: order => `
      <button class="btn-primary px-3 py-1 text-xs"
              onclick="openWorkerOrderEditor('${order.objectId}')">
        Dettaglio
      </button>
    `
  },
  [ROLES.CUSTOMER]: {
    where: `status = '${STATUS.DELIVERED}'`, // solo consegnati
    columns: ["productCode","eanCode","brand","color","size","status"],
    actions: _order => `<span class="text-xs text-gray-400">Solo consultazione</span>`
  }
};

// Campi operativi da mostrare nella maschera EAN / editor worker
const OPERATION_FIELDS = [
  // OPERATIVI
  { id: "field-shots",          label: "N. Scatti",              prop: "shots",        type: "number" },
  { id: "field-quantity",       label: "Qta",                    prop: "quantity",     type: "number" },
  { id: "field-s1-prog",        label: "S1-Prog",                prop: "s1Prog",       type: "text"   },
  { id: "field-s2-prog",        label: "S2-Prog",                prop: "s2Prog",       type: "text"   },
  { id: "field-prog-on-model",  label: "Prog. on-m",             prop: "progOnModel",  type: "text"   },
  { id: "field-still-shot",     label: "Scatto Still (S/N)",     prop: "stillShot",    type: "selectSN" },
  { id: "field-onmodel-shot",   label: "Scatto On Model (S/N)",  prop: "onModelShot",  type: "selectSN" },
  { id: "field-priority",       label: "Priorità",               prop: "priority",     type: "text"   },
  { id: "field-s1-stylist",     label: "S1-Stylist",             prop: "s1Stylist",    type: "text"   },
  { id: "field-s2-stylist",     label: "S2-Stylist",             prop: "s2Stylist",    type: "text"   },
  // LOGISTICA
  { id: "field-provenienza",    label: "Provenienza",            prop: "provenienza",  type: "text"   },
  { id: "field-tipologia",      label: "Tipologia",              prop: "tipologia",    type: "text"   },
  { id: "field-ordine",         label: "Numero Ordine",          prop: "ordine",       type: "text"   },
  { id: "field-data-ordine",    label: "Data Ordine",            prop: "dataOrdine",   type: "date"   },
  { id: "field-entry-date",     label: "Entry Date",             prop: "entryDate",    type: "date"   },
  { id: "field-exit-date",      label: "Exit Date",              prop: "exitDate",     type: "date"   },
  { id: "field-collo",          label: "Collo",                  prop: "collo",        type: "text"   },
  { id: "field-data-reso",      label: "Data Reso",              prop: "dataReso",     type: "date"   },
  { id: "field-ddt",            label: "Numero DDT",             prop: "ddt",          type: "text"   },
  { id: "field-note-logistica", label: "Note Logistica",         prop: "noteLogistica",type: "textarea" },
  { id: "field-data-presa-post",label: "Data Presa Post",        prop: "dataPresaPost",type: "date"   },
  { id: "field-data-consegna-post", label: "Data Consegna Post", prop: "dataConsegnaPost", type: "date" },
  { id: "field-calendario",     label: "Calendario",             prop: "calendario",   type: "selectSN" },
  { id: "field-postpresa",      label: "Post Presa",             prop: "postPresa",    type: "text"   },
];

// =====================================================
//  VARIABILI GLOBALI
// =====================================================

let currentUser          = null;
let currentRole          = null;
let currentEanOrder      = null;  // ordine aperto in maschera EAN / worker
let currentAdminOrder    = null;  // ordine aperto in editor admin

// Inizializza Backendless
Backendless.initApp(APPLICATION_ID, API_KEY);

// =====================================================
//  FUNZIONI DI UTILITÀ UI
// =====================================================

function showLoginArea(message = "") {
  const loginArea   = document.getElementById("login-area");
  const workerDash  = document.getElementById("worker-dashboard");
  const adminDash   = document.getElementById("admin-dashboard");
  const loginStatus = document.getElementById("login-status");

  if (loginArea)   loginArea.style.display  = "block";
  if (workerDash)  workerDash.style.display = "none";
  if (adminDash)   adminDash.style.display  = "none";

  const workerName = document.getElementById("worker-name");
  const workerRole = document.getElementById("worker-role");
  if (workerName) workerName.textContent = "Ospite";
  if (workerRole) workerRole.textContent = "Non Loggato";

  if (loginStatus) {
    loginStatus.textContent = message || "";
    loginStatus.classList.remove("hidden");
    if (!message) loginStatus.classList.add("hidden");
  }
}

function showStatusMessage(elementId, message, type = "info") {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.classList.remove("hidden", "status-error", "status-success", "status-info");
  el.classList.add(`status-${type}`);
}

function showToast(message, type = "info") {
  const box = document.createElement("div");
  box.textContent = message;
  box.className =
    `fixed bottom-4 right-4 px-4 py-2 rounded shadow-lg text-white z-50
     ${type === "success" ? "bg-green-600"
      : type === "error" ? "bg-red-600"
      : "bg-blue-600"}`;
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3500);
}

// =====================================================
//  AUTENTICAZIONE / RUOLI
// =====================================================

function handleStandardLogin(email, password) {
  if (!email || !password) {
    showStatusMessage("login-status", "Inserisci email e password.", "error");
    return;
  }

  showStatusMessage("login-status", "Accesso in corso...", "info");

  Backendless.UserService.login(email, password, true)
    .then(user => handleLoginSuccess(user))
    .catch(err => {
      console.error("Errore login:", err);
      showStatusMessage(
        "login-status",
        "Accesso fallito: " + (err.message || "Errore di sistema."),
        "error"
      );
    });
}

function handleLogout() {
  Backendless.UserService.logout()
    .then(() => {
      currentUser     = null;
      currentRole     = null;
      currentEanOrder = null;
      currentAdminOrder = null;
      showLoginArea("Logout avvenuto con successo.");
    })
    .catch(err => {
      console.error("Errore logout:", err);
      showLoginArea("Errore durante il logout, riprova.");
    });
}

function handlePasswordRecovery() {
  const email = document.getElementById("user-email")?.value.trim();
  if (!email) {
    showStatusMessage(
      "login-status",
      "Per recuperare la password, inserisci l'email.",
      "error"
    );
    return;
  }

  Backendless.UserService.restorePassword(email)
    .then(() => {
      showStatusMessage(
        "login-status",
        `Email di reset inviata a ${email}.`,
        "success"
      );
    })
    .catch(err => {
      console.error("Errore recover:", err);
      showStatusMessage(
        "login-status",
        "Errore nel recupero password: " + (err.message || ""),
        "error"
      );
    });
}

// Legge il ruolo dal record Users (campo "role")
function getRoleFromUser(user) {
  if (user.role) {
    return Promise.resolve(user.role);
  }

  const qb = Backendless.DataQueryBuilder.create()
    .setProperties(["objectId", "role"])
    .setWhereClause(`objectId = '${user.objectId}'`)
    .setPageSize(1);

  return Backendless.Data.of(USER_TABLE_NAME)
    .find(qb)
    .then(res => {
      if (res && res.length > 0) {
        return res[0].role || "Nessun Ruolo";
      }
      return "Nessun Ruolo";
    })
    .catch(err => {
      console.error("Errore getRoleFromUser:", err);
      return "Nessun Ruolo";
    });
}

// Gestione esito login
async function handleLoginSuccess(user) {
  currentUser = user;

  try {
    const role = await getRoleFromUser(user);
    currentRole = role;

    // Aggiorna sidebar
    const nameEl = document.getElementById("worker-name");
    const roleEl = document.getElementById("worker-role");
    if (nameEl) nameEl.textContent = user.name || user.email;
    if (roleEl) roleEl.textContent = role;

    const loginArea  = document.getElementById("login-area");
    const workerDash = document.getElementById("worker-dashboard");
    const adminDash  = document.getElementById("admin-dashboard");

    if (loginArea)  loginArea.style.display = "none";

    if (role === ROLES.ADMIN) {
      if (adminDash)  adminDash.style.display  = "block";
      if (workerDash) workerDash.style.display = "none";

      // carica pannello admin
      loadUsersAndRoles();
      loadAllOrdersForAdmin();
      loadAdminStats();
    } else {
      if (adminDash)  adminDash.style.display  = "none";
      if (workerDash) workerDash.style.display = "block";

      const roleQueue = document.getElementById("worker-role-display-queue");
      if (roleQueue) roleQueue.textContent = role;

      loadOrdersForUser(role);
    }
  } catch (err) {
    console.error("Errore handleLoginSuccess:", err);
    showLoginArea("Errore nella gestione del ruolo.");
  }
}

// =====================================================
//  GESTIONE UTENTI (ADMIN)
// =====================================================

function loadUsersAndRoles() {
  const loadingEl = document.getElementById("loading-users");
  if (loadingEl) {
    loadingEl.textContent = "Caricamento lista utenti...";
    loadingEl.style.display = "block";
  }

  const qb = Backendless.DataQueryBuilder.create()
    .setProperties(["objectId", "email", "role"])
    .setPageSize(100);

  Backendless.Data.of(USER_TABLE_NAME)
    .find(qb)
    .then(users => renderUsersTable(users))
    .catch(err => {
      console.error("Errore loadUsersAndRoles:", err);
      if (loadingEl) {
        loadingEl.textContent = "Errore nel caricamento utenti.";
        loadingEl.style.color = "#b91c1c";
      }
    });
}

function renderUsersTable(users) {
  const tbody      = document.querySelector("#users-table tbody");
  const loadingEl  = document.getElementById("loading-users");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!users || users.length === 0) {
    if (loadingEl) {
      loadingEl.textContent = "Nessun utente trovato.";
      loadingEl.style.display = "block";
    }
    return;
  }
  if (loadingEl) loadingEl.style.display = "none";

  users.forEach(u => {
    // non mostra l'admin corrente come riga modificabile
    if (currentUser && u.objectId === currentUser.objectId) return;

    const tr = document.createElement("tr");
    tr.classList.add("hover:bg-gray-50");

    const tdEmail = document.createElement("td");
    tdEmail.className = "px-4 py-2";
    tdEmail.textContent = u.email || "";
    tr.appendChild(tdEmail);

    const tdRole = document.createElement("td");
    tdRole.className = "px-4 py-2";
    tdRole.textContent = u.role || "Nessun Ruolo";
    tr.appendChild(tdRole);

    const tdActions = document.createElement("td");
    tdActions.className = "px-4 py-2 space-x-2";

    // select ruolo
    const sel = document.createElement("select");
    sel.className = "border rounded px-2 py-1 text-sm";
    Object.values(ROLES).forEach(r => {
      if (r === ROLES.ADMIN) return; // non assegno Admin così facilmente
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = r;
      if (u.role === r) opt.selected = true;
      sel.appendChild(opt);
    });

    const btnSave = document.createElement("button");
    btnSave.className = "btn-success text-xs px-2 py-1";
    btnSave.textContent = "Salva Ruolo";
    btnSave.onclick = () => updateRole(u.objectId, sel.value);

    const btnDelete = document.createElement("button");
    btnDelete.className = "btn-danger text-xs px-2 py-1";
    btnDelete.textContent = "Elimina";
    btnDelete.onclick = () => deleteUser(u.objectId, u.email);

    tdActions.appendChild(sel);
    tdActions.appendChild(btnSave);
    tdActions.appendChild(btnDelete);

    tr.appendChild(tdActions);
    tbody.appendChild(tr);
  });
}

function handleUserCreation() {
  const email    = document.getElementById("new-user-email")?.value.trim();
  const password = document.getElementById("new-user-password")?.value;
  const role     = document.getElementById("new-user-role")?.value;

  if (!email || !password || !role) {
    showStatusMessage(
      "user-creation-status",
      "Compila tutti i campi (email, password, ruolo).",
      "error"
    );
    return;
  }

  Backendless.UserService.register({ email, password })
    .then(newUser => {
      // aggiorna il ruolo
      const userUpdate = { objectId: newUser.objectId, role };
      return Backendless.Data.of(USER_TABLE_NAME).save(userUpdate);
    })
    .then(() => {
      showStatusMessage(
        "user-creation-status",
        `Utente ${email} creato con ruolo ${role}.`,
        "success"
      );
      document.getElementById("new-user-email").value = "";
      document.getElementById("new-user-password").value = "";
      document.getElementById("new-user-role").value = "";
      loadUsersAndRoles();
    })
    .catch(err => {
      console.error("Errore creazione utente:", err);
      showStatusMessage(
        "user-creation-status",
        "Errore creazione utente: " + (err.message || ""),
        "error"
      );
    });
}

function updateRole(userId, newRole) {
  if (!userId || !newRole) return;
  if (currentUser && userId === currentUser.objectId) {
    showStatusMessage(
      "user-creation-status",
      "Non puoi modificare il tuo stesso ruolo.",
      "error"
    );
    return;
  }

  Backendless.Data.of(USER_TABLE_NAME)
    .save({ objectId: userId, role: newRole })
    .then(() => {
      showStatusMessage(
        "user-creation-status",
        `Ruolo aggiornato a ${newRole}.`,
        "success"
      );
      loadUsersAndRoles();
    })
    .catch(err => {
      console.error("Errore updateRole:", err);
      showStatusMessage(
        "user-creation-status",
        "Errore aggiornando ruolo: " + (err.message || ""),
        "error"
      );
    });
}

function deleteUser(userId, email) {
  if (!confirm(`Eliminare l'utente ${email}?`)) return;
  Backendless.Data.of(USER_TABLE_NAME)
    .remove({ objectId: userId })
    .then(() => {
      showStatusMessage(
        "user-creation-status",
        `Utente ${email} eliminato.`,
        "success"
      );
      loadUsersAndRoles();
    })
    .catch(err => {
      console.error("Errore deleteUser:", err);
      showStatusMessage(
        "user-creation-status",
        "Errore eliminazione utente: " + (err.message || ""),
        "error"
      );
    });
}

// =====================================================
//  IMPORT ORDINI (ADMIN)
// =====================================================

async function handleFileUpload() {
  const fileInput  = document.getElementById("excel-file-input");
  const statusEl   = document.getElementById("import-status");
  const logEl      = document.getElementById("import-log");
  const progressEl = document.getElementById("import-progress-bar");

  if (logEl) {
    logEl.textContent = "";
    logEl.style.display = "none";
  }

  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    showStatusMessage(
      "import-status",
      "Seleziona un file Excel da importare.",
      "error"
    );
    return;
  }

  const provenienzaVal = document.getElementById("admin-provenienza")?.value.trim() || "";
  const tipologiaVal   = document.getElementById("admin-tipologia")?.value.trim()   || "";
  const ordineVal      = document.getElementById("admin-ordine")?.value.trim()      || "";
  const dataOrdineVal  = document.getElementById("admin-data-ordine")?.value        || "";

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = async e => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData  = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      if (!jsonData || jsonData.length === 0) {
        showStatusMessage(
          "import-status",
          "File Excel vuoto o non leggibile.",
          "error"
        );
        return;
      }

      showStatusMessage(
        "import-status",
        `Inizio importazione di ${jsonData.length} righe...`,
        "info"
      );

      const total = jsonData.length;
      let success = 0;
      let fail    = 0;

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const productCode = row["Codice Articolo"] || row["productCode"] || "";

        if (!productCode) {
          fail++;
          continue;
        }

        // controlla duplicati su productCode
        const qb = Backendless.DataQueryBuilder.create()
          .setWhereClause(`productCode = '${productCode}'`)
          .setPageSize(1);

        const duplicates = await Backendless.Data.of(ORDER_TABLE_NAME).find(qb);
        if (duplicates && duplicates.length > 0) {
          if (logEl) {
            logEl.style.display = "block";
            logEl.textContent += `❌ Duplicato: ${productCode}\n`;
          }
          fail++;
        } else {
          const orderObj = {
            productCode,
            eanCode:   row["Ean Code"]     || row["EAN"]      || "",
            styleName: row["Style Name"]   || "",
            styleGroup:row["Style Group"]  || "",
            brand:     row["Brand"]        || "",
            color:     row["Colore"]       || "",
            size:      row["Taglia"]       || "",
            category:  row["Categoria"]    || "",
            gender:    row["Genere"]       || "",
            provenienza: provenienzaVal || row["Provenienza"] || "",
            tipologia:   tipologiaVal   || row["Tipologia"]   || "",
            ordine:      ordineVal      || row["Ordine"]      || "",
            dataOrdine:  dataOrdineVal  || row["Data Ordine"] || "",
            status:      STATUS.IN_WAREHOUSE,  // dopo import → va al magazzino
            lastUpdated: new Date()
          };

          try {
            await Backendless.Data.of(ORDER_TABLE_NAME).save(orderObj);
            success++;
          } catch (err2) {
            console.error("Errore import ordine:", err2);
            fail++;
          }
        }

        const progress = Math.round(((i + 1) / total) * 100);
        if (progressEl) progressEl.style.width = progress + "%";
      }

      showStatusMessage(
        "import-status",
        `Importazione completata: ${success} ok, ${fail} errori.`,
        fail === 0 ? "success" : "info"
      );

      // pulisce input file
      fileInput.value = "";

      // ricarica lista ordini admin
      loadAllOrdersForAdmin();
      loadAdminStats();

    } catch (err) {
      console.error("Errore handleFileUpload:", err);
      showStatusMessage(
        "import-status",
        "Errore durante l'importazione: " + (err.message || ""),
        "error"
      );
    }
  };

  reader.readAsArrayBuffer(file);
}

// =====================================================
//  ORDINI ADMIN – LISTA & EDITOR
// =====================================================

async function loadAllOrdersForAdmin() {
  const loadingEl = document.getElementById("loading-admin-orders");
  const table     = document.getElementById("admin-orders-table");
  const tbody     = table ? table.querySelector("tbody") : null;

  if (!table || !tbody) return;

  loadingEl.textContent = "Caricamento ordini...";
  loadingEl.style.display = "block";
  tbody.innerHTML = "";

  try {
    const qb = Backendless.DataQueryBuilder.create()
      .setPageSize(100)
      .setSortBy(["lastUpdated DESC"]);

    const orders = await Backendless.Data.of(ORDER_TABLE_NAME).find(qb);

    if (!orders || orders.length === 0) {
      loadingEl.textContent = "Nessun ordine trovato.";
      return;
    }

    orders.forEach(o => {
      const tr = document.createElement("tr");
      tr.classList.add("hover:bg-gray-50");

      tr.innerHTML = `
        <td class="px-4 py-2">${o.productCode || ""}</td>
        <td class="px-4 py-2">${o.eanCode || ""}</td>
        <td class="px-4 py-2">${o.brand || ""}</td>
        <td class="px-4 py-2">${o.color || ""}</td>
        <td class="px-4 py-2">${o.size || ""}</td>
        <td class="px-4 py-2">
          ${
            Array.isArray(o.driveLinks) && o.driveLinks.length
              ? o.driveLinks
                  .map(l =>
                    `<a href="${l}" target="_blank"
                        class="text-blue-600 underline block truncate max-w-xs">
                      ${l}
                     </a>`
                  )
                  .join("")
              : `<span class="text-gray-400 italic">Nessun link</span>`
          }
        </td>
        <td class="px-4 py-2 space-x-2">
          <button class="btn-primary px-3 py-1 text-xs"
                  onclick="openAdminOrderEditor('${o.objectId}')">
            Modifica
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    loadingEl.style.display = "none";

  } catch (err) {
    console.error("Errore loadAllOrdersForAdmin:", err);
    loadingEl.textContent = "Errore durante il caricamento ordini.";
    loadingEl.style.color = "#b91c1c";
  }
}

// Editor Admin – carica ordine e apre card
async function openAdminOrderEditor(orderId) {
  try {
    const order = await Backendless.Data.of(ORDER_TABLE_NAME).findById(orderId);
    if (!order) {
      showToast("❌ Ordine non trovato.", "error");
      return;
    }

    const listCard = document.getElementById("orders-admin-card");
    const editCard = document.getElementById("admin-order-edit-card");
    const fieldsContainer = document.getElementById("admin-order-fields");
    const eanDisplay = document.getElementById("admin-ean-display");

    if (listCard)  listCard.classList.add("hidden");
    if (!editCard || !fieldsContainer) {
      console.error("Editor admin non trovato in HTML.");
      return;
    }

    editCard.classList.remove("hidden");
    fieldsContainer.innerHTML = "";
    if (eanDisplay) eanDisplay.textContent = order.eanCode || order.productCode || "";

    // Genera stesso set di campi operativi + base
    const adminFields = [
      { label: "Codice Articolo", prop: "productCode", type: "text" },
      { label: "EAN Code",        prop: "eanCode",     type: "text" },
      { label: "Style Name",      prop: "styleName",   type: "text" },
      { label: "Style Group",     prop: "styleGroup",  type: "text" },
      { label: "Brand",           prop: "brand",       type: "text" },
      { label: "Colore",          prop: "color",       type: "text" },
      { label: "Taglia",          prop: "size",        type: "text" },
      { label: "Categoria",       prop: "category",    type: "text" },
      { label: "Genere",          prop: "gender",      type: "text" },
      // operativi / logistica come per worker
      ...OPERATION_FIELDS.map(f => ({
        label: f.label,
        prop:  f.prop,
        type:  f.type
      })),
      { label: "Stato",           prop: "status",      type: "text" },
    ];

    adminFields.forEach(f => {
      const wrapper = document.createElement("div");
      wrapper.className = "flex flex-col";

      const labelEl = document.createElement("label");
      labelEl.className = "text-sm font-medium text-gray-700 mb-1";
      labelEl.textContent = f.label;
      wrapper.appendChild(labelEl);

      let inputEl;
      if (f.type === "textarea") {
        inputEl = document.createElement("textarea");
        inputEl.className = "border rounded-md p-2";
      } else if (f.type === "selectSN") {
        inputEl = document.createElement("select");
        inputEl.className = "border rounded-md p-2";
        const optEmpty = document.createElement("option");
        optEmpty.value = "";
        optEmpty.textContent = "Seleziona";
        const optS = document.createElement("option");
        optS.value = "S";
        optS.textContent = "S";
        const optN = document.createElement("option");
        optN.value = "N";
        optN.textContent = "N";
        inputEl.appendChild(optEmpty);
        inputEl.appendChild(optS);
        inputEl.appendChild(optN);
      } else {
        inputEl = document.createElement("input");
        inputEl.type = f.type === "date" ? "date" :
                       f.type === "number" ? "number" : "text";
        inputEl.className = "border rounded-md p-2";
      }

      inputEl.id = `admin-field-${f.prop}`;
      const val = order[f.prop] || "";
      if (f.type === "date" && val && val.length >= 10) {
        inputEl.value = val.substring(0,10); // yyyy-MM-dd
      } else {
        inputEl.value = val;
      }

      wrapper.appendChild(inputEl);
      fieldsContainer.appendChild(wrapper);
    });

    currentAdminOrder = order;

  } catch (err) {
    console.error("Errore openAdminOrderEditor:", err);
    showToast("Errore apertura dettaglio ordine.", "error");
  }
}

// Salvataggio editor admin
async function saveAdminOrderUpdates() {
  if (!currentAdminOrder || !currentAdminOrder.objectId) {
    showStatusMessage(
      "admin-update-feedback",
      "Nessun ordine in modifica.",
      "error"
    );
    return;
  }

  const updated = { objectId: currentAdminOrder.objectId };

  // campi base + operativi/admin
  const fieldsToRead = [
    "productCode","eanCode","styleName","styleGroup","brand","color",
    "size","category","gender","status",
    ...OPERATION_FIELDS.map(f => f.prop),
  ];

  fieldsToRead.forEach(prop => {
    const el = document.getElementById(`admin-field-${prop}`);
    if (!el) return;
    let val = el.value;

    updated[prop] = val;
  });

  updated.lastUpdated = new Date();

  try {
    await Backendless.Data.of(ORDER_TABLE_NAME).save(updated);
    showStatusMessage(
      "admin-update-feedback",
      "Aggiornamenti salvati.",
      "success"
    );
    currentAdminOrder = { ...currentAdminOrder, ...updated };

    // ricarica lista e torna indietro
    await loadAllOrdersForAdmin();
    cancelAdminOrderEdit();

  } catch (err) {
    console.error("Errore saveAdminOrderUpdates:", err);
    showStatusMessage(
      "admin-update-feedback",
      "Errore nel salvataggio: " + (err.message || ""),
      "error"
    );
  }
}

function cancelAdminOrderEdit() {
  const editCard = document.getElementById("admin-order-edit-card");
  const listCard = document.getElementById("orders-admin-card");
  if (editCard) editCard.classList.add("hidden");
  if (listCard) listCard.classList.remove("hidden");
  currentAdminOrder = null;
}

// =====================================================
//  DASHBOARD ADMIN – STATISTICHE
// =====================================================

async function loadAdminStats() {
  const container = document.getElementById("admin-stats");
  const canvas    = document.getElementById("admin-stats-chart");
  if (!container || !canvas) return;

  container.innerHTML = "";

  try {
    const qb = Backendless.DataQueryBuilder.create()
      .setPageSize(200);
    const orders = await Backendless.Data.of(ORDER_TABLE_NAME).find(qb);

    const counts = {};
    orders.forEach(o => {
      const s = o.status || "Sconosciuto";
      counts[s] = (counts[s] || 0) + 1;
    });

    Object.entries(counts).forEach(([status, count]) => {
      const colorClasses = STATUS_COLORS[status] || STATUS_COLORS.DEFAULT;
      const box = document.createElement("div");
      box.className = `p-4 border rounded-lg text-center ${colorClasses}`;
      box.innerHTML = `
        <p class="font-semibold text-sm">${status}</p>
        <p class="text-2xl font-bold">${count}</p>
      `;
      container.appendChild(box);
    });

    if (window.Chart) {
      const ctx = canvas.getContext("2d");
      const labels = Object.keys(counts);
      const data   = Object.values(counts);

      if (window._adminChart) window._adminChart.destroy();
      window._adminChart = new Chart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [{
            label: "Ordini",
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
    console.error("Errore loadAdminStats:", err);
  }
}

// =====================================================
//  WORKER – LISTA ORDINI PER RUOLO
// =====================================================

async function loadOrdersForUser(role) {
  const loadingEl = document.getElementById("loading-orders");
  const table     = document.getElementById("orders-table");
  if (!loadingEl || !table) return;

  const tbody = table.querySelector("tbody");
  const thead = table.querySelector("thead");
  tbody.innerHTML = "";
  loadingEl.textContent = "Caricamento ordini...";
  loadingEl.style.display = "block";
  table.classList.add("hidden");

  try {
    const config = ROLE_TABLE_CONFIG[role] || ROLE_TABLE_CONFIG[ROLES.WAREHOUSE];
    const qb = Backendless.DataQueryBuilder.create()
      .setPageSize(100)
      .setSortBy(["lastUpdated DESC"]);

    if (config.whereFactory && currentUser) {
      qb.setWhereClause(config.whereFactory(currentUser.objectId));
    } else if (config.where) {
      qb.setWhereClause(config.where);
    }

    const orders = await Backendless.Data.of(ORDER_TABLE_NAME).find(qb);

    if (!orders || orders.length === 0) {
      loadingEl.textContent = "Nessun ordine disponibile.";
      return;
    }

    // intestazione tabella
    if (thead) {
      thead.innerHTML = `
        <tr>
          ${config.columns
            .map(c => `<th class="px-4 py-2 text-left capitalize">${c}</th>`)
            .join("")}
          <th class="px-4 py-2 text-left">Azioni</th>
        </tr>`;
    }

    orders.forEach(o => {
      const tr = document.createElement("tr");
      tr.classList.add("hover:bg-gray-50");

      const colsHtml = config.columns.map(col => {
        const value = o[col] || "";
        return `<td class="px-4 py-2 text-sm">${value}</td>`;
      }).join("");

      tr.innerHTML = colsHtml + `
        <td class="px-4 py-2 text-sm">
          ${config.actions(o)}
        </td>
      `;
      tbody.appendChild(tr);
    });

    loadingEl.style.display = "none";
    table.classList.remove("hidden");

  } catch (err) {
    console.error("Errore loadOrdersForUser:", err);
    loadingEl.textContent = "Errore durante il caricamento ordini.";
    loadingEl.style.color = "#b91c1c";
  }
}

// =====================================================
//  WORKER – MASCHERA EAN / MODIFICA
// =====================================================

// genera i campi dentro #operational-fields UNA sola volta
function buildOperationalFieldsIfNeeded() {
  const container = document.getElementById("operational-fields");
  if (!container) return;
  if (container.dataset.built === "1") return;

  OPERATION_FIELDS.forEach(f => {
    const wrapper = document.createElement("div");
    wrapper.className = "flex flex-col";

    const labelEl = document.createElement("label");
    labelEl.className = "text-sm font-medium text-gray-700 mb-1";
    labelEl.textContent = f.label;
    wrapper.appendChild(labelEl);

    let inputEl;
    if (f.type === "textarea") {
      inputEl = document.createElement("textarea");
      inputEl.className = "border rounded-md p-2";
    } else if (f.type === "selectSN") {
      inputEl = document.createElement("select");
      inputEl.className = "border rounded-md p-2";
      const optEmpty = document.createElement("option");
      optEmpty.value = "";
      optEmpty.textContent = "Seleziona";
      const optS = document.createElement("option");
      optS.value = "S";
      optS.textContent = "S";
      const optN = document.createElement("option");
      optN.value = "N";
      optN.textContent = "N";
      inputEl.appendChild(optEmpty);
      inputEl.appendChild(optS);
      inputEl.appendChild(optN);
    } else {
      inputEl = document.createElement("input");
      inputEl.type = f.type === "date" ? "date" :
                     f.type === "number" ? "number" : "text";
      inputEl.className = "border rounded-md p-2";
    }

    inputEl.id = f.id;
    wrapper.appendChild(inputEl);
    container.appendChild(wrapper);
  });

  container.dataset.built = "1";
}

// Apre la maschera EAN a partire da un ordine (per conferma EAN o da "Apri Modifica")
function openEanEditorWithOrder(order) {
  buildOperationalFieldsIfNeeded();

  const actionsArea   = document.getElementById("ean-actions-area");
  const scanStatus    = document.getElementById("scan-status");
  const currentEanLbl = document.getElementById("current-ean-display");
  const uploadArea    = document.getElementById("photo-upload-area");
  const uploadEanLbl  = document.getElementById("current-ean-display-upload");
  const linksTextarea = document.getElementById("photo-drive-links");

  if (!actionsArea) return;

  if (scanStatus) {
    scanStatus.textContent = "✅ Codice trovato. Puoi modificare i dati operativi.";
    scanStatus.className = "status-message status-success";
    scanStatus.classList.remove("hidden");
  }

  actionsArea.classList.remove("hidden");
  if (currentEanLbl) currentEanLbl.textContent = order.eanCode || order.productCode || "";

  // per fotografo mostra box link
  if (currentRole === ROLES.PHOTOGRAPHER) {
    if (uploadArea) uploadArea.classList.remove("hidden");
    if (uploadEanLbl) uploadEanLbl.textContent = order.eanCode || order.productCode || "";
    if (linksTextarea) {
      if (Array.isArray(order.driveLinks) && order.driveLinks.length > 0) {
        linksTextarea.value = order.driveLinks.join("\n");
      } else {
        linksTextarea.value = "";
      }
    }
  } else {
    if (uploadArea) uploadArea.classList.add("hidden");
    if (linksTextarea) linksTextarea.value = "";
  }

  // popola campi operativi
  OPERATION_FIELDS.forEach(f => {
    const el = document.getElementById(f.id);
    if (!el) return;
    let val = order[f.prop] || "";
    if (f.type === "date" && val && val.length >= 10) {
      el.value = val.substring(0,10);
    } else {
      el.value = val;
    }
  });

  currentEanOrder = order;
}

// Scannerizza EAN inserito manualmente
async function confirmEanInput() {
  const eanInput = document.getElementById("ean-input")?.value.trim();
  const scanStatus = document.getElementById("scan-status");
  const actionsArea = document.getElementById("ean-actions-area");
  const uploadArea  = document.getElementById("photo-upload-area");

  if (!eanInput) {
    if (scanStatus) {
      scanStatus.textContent = "Inserisci un codice EAN o Codice Articolo.";
      scanStatus.className = "status-message status-error";
      scanStatus.classList.remove("hidden");
    }
    if (actionsArea) actionsArea.classList.add("hidden");
    if (uploadArea)  uploadArea.classList.add("hidden");
    return;
  }

  try {
    if (scanStatus) {
      scanStatus.textContent = "Verifica in corso...";
      scanStatus.className = "status-message status-info";
      scanStatus.classList.remove("hidden");
    }

    const qb = Backendless.DataQueryBuilder.create()
      .setPageSize(1)
      .setWhereClause(`eanCode = '${eanInput}' OR productCode = '${eanInput}'`);

    const res = await Backendless.Data.of(ORDER_TABLE_NAME).find(qb);
    if (!res || res.length === 0) {
      if (scanStatus) {
        scanStatus.textContent = `❌ Codice ${eanInput} non trovato.`;
        scanStatus.className = "status-message status-error";
      }
      if (actionsArea) actionsArea.classList.add("hidden");
      if (uploadArea)  uploadArea.classList.add("hidden");
      return;
    }

    openEanEditorWithOrder(res[0]);

  } catch (err) {
    console.error("Errore confirmEanInput:", err);
    if (scanStatus) {
      scanStatus.textContent = "Errore durante la ricerca dell'ordine.";
      scanStatus.className = "status-message status-error";
    }
    if (actionsArea) actionsArea.classList.add("hidden");
    if (uploadArea)  uploadArea.classList.add("hidden");
  }
}

// Apre la stessa maschera partendo da un ordine in tabella
async function openWorkerOrderEditor(orderId) {
  try {
    const order = await Backendless.Data.of(ORDER_TABLE_NAME).findById(orderId);
    if (!order) {
      showToast("❌ Impossibile aprire il dettaglio.", "error");
      return;
    }
    // scrive l'EAN nel box input, giusto per coerenza
    const eanInput = document.getElementById("ean-input");
    if (eanInput) eanInput.value = order.eanCode || order.productCode || "";

    openEanEditorWithOrder(order);

  } catch (err) {
    console.error("Errore openWorkerOrderEditor:", err);
    showToast("Errore apertura dettaglio.", "error");
  }
}

// Salvataggio dati operativi + link (worker)
async function saveEanUpdates() {
  const statusEl = document.getElementById("update-status");
  if (!currentEanOrder || !currentEanOrder.objectId) {
    if (statusEl) {
      statusEl.textContent = "Nessun ordine in modifica.";
      statusEl.className = "status-message status-error";
      statusEl.classList.remove("hidden");
    }
    return;
  }

  try {
    // recupero ordine aggiornato da Backendless
    const order = await Backendless.Data.of(ORDER_TABLE_NAME).findById(currentEanOrder.objectId);
    if (!order) {
      statusEl.textContent = "Ordine non trovato.";
      statusEl.className = "status-message status-error";
      statusEl.classList.remove("hidden");
      return;
    }

    // aggiorna campi operativi
    OPERATION_FIELDS.forEach(f => {
      const el = document.getElementById(f.id);
      if (!el) return;
      let val = el.value;
      order[f.prop] = val;
    });

    // link foto (solo fotografo)
    if (currentRole === ROLES.PHOTOGRAPHER) {
      const linksTextarea = document.getElementById("photo-drive-links");
      const raw = (linksTextarea?.value || "").trim();
      const driveLinks = raw
        .split("\n")
        .map(l => l.trim())
        .filter(l => l.length > 0);

      if (driveLinks.length > 0) {
        order.driveLinks = driveLinks;
        // passa lo stato al post-prod
        if (order.status === STATUS.WAITING_PHOTO || order.status === STATUS.IN_PHOTO_PROCESS) {
          order.status = STATUS.WAITING_POST;
        }
      }
    }

    // se è il PostProducer può segnare "Completato"
    if (currentRole === ROLES.POST_PROD &&
        (order.status === STATUS.WAITING_POST || order.status === STATUS.IN_POST_PROCESS)) {
      // NON forzo, lo farà tramite pulsante separato se vuoi;
      // qui lasciamo solo il salvataggio dei campi.
    }

    order.lastUpdated = new Date();

    await Backendless.Data.of(ORDER_TABLE_NAME).save(order);

    if (statusEl) {
      statusEl.textContent = "✔ Modifiche salvate con successo.";
      statusEl.className = "status-message status-success";
      statusEl.classList.remove("hidden");
    }

    // piccolo refresh
    setTimeout(() => {
      resetEanActionState(false);
      loadOrdersForUser(currentRole);
    }, 700);

  } catch (err) {
    console.error("Errore saveEanUpdates:", err);
    if (statusEl) {
      statusEl.textContent = "❌ Errore nel salvataggio.";
      statusEl.className = "status-message status-error";
      statusEl.classList.remove("hidden");
    }
  }
}

// Resetta maschera EAN (chiude tutto)
function resetEanActionState(showInfo = true) {
  const actionsArea = document.getElementById("ean-actions-area");
  const uploadArea  = document.getElementById("photo-upload-area");
  const scanStatus  = document.getElementById("scan-status");
  const eanInput    = document.getElementById("ean-input");
  const linksTextarea = document.getElementById("photo-drive-links");

  if (actionsArea) actionsArea.classList.add("hidden");
  if (uploadArea)  uploadArea.classList.add("hidden");
  if (scanStatus)  scanStatus.classList.add("hidden");
  if (eanInput)    eanInput.value = "";
  if (linksTextarea) linksTextarea.value = "";

  OPERATION_FIELDS.forEach(f => {
    const el = document.getElementById(f.id);
    if (el) el.value = "";
  });

  currentEanOrder = null;

  if (showInfo) {
    showToast("Operazione annullata.", "info");
  }
}

// Aggiorna solo lo stato (per esempio "Segna come consegnato")
async function updateOrderStatus(orderId, newStatus, successMsg = "Stato aggiornato.") {
  if (!orderId) return;

  if (!confirm(`Impostare stato ordine a "${newStatus}"?`)) return;

  try {
    const updated = {
      objectId: orderId,
      status: newStatus,
      lastUpdated: new Date()
    };

    await Backendless.Data.of(ORDER_TABLE_NAME).save(updated);

    showToast(successMsg, "success");
    loadOrdersForUser(currentRole);
    loadAdminStats();

  } catch (err) {
    console.error("Errore updateOrderStatus:", err);
    showToast("Errore aggiornando lo stato.", "error");
  }
}

// =====================================================
//  TOGGLE CARD ADMIN (utenti / import / stats)
// =====================================================

document.addEventListener("DOMContentLoaded", () => {
  const toggleUsers  = document.getElementById("toggle-users-card");
  const toggleImport = document.getElementById("toggle-import-card");
  const toggleStats  = document.getElementById("toggle-stats-card");

  const usersCard    = document.getElementById("card-users");
  const importCard   = document.getElementById("card-import");
  const statsSection = document.getElementById("admin-stats-section");

  if (toggleUsers && usersCard) {
    const saved = localStorage.getItem("showUsersCard");
    if (saved !== null) {
      toggleUsers.checked = saved === "true";
      usersCard.style.display = toggleUsers.checked ? "block" : "none";
    }
    toggleUsers.addEventListener("change", () => {
      usersCard.style.display = toggleUsers.checked ? "block" : "none";
      localStorage.setItem("showUsersCard", toggleUsers.checked);
    });
  }

  if (toggleImport && importCard) {
    const saved = localStorage.getItem("showImportCard");
    if (saved !== null) {
      toggleImport.checked = saved === "true";
      importCard.style.display = toggleImport.checked ? "block" : "none";
    }
    toggleImport.addEventListener("change", () => {
      importCard.style.display = toggleImport.checked ? "block" : "none";
      localStorage.setItem("showImportCard", toggleImport.checked);
    });
  }

  if (toggleStats && statsSection) {
    const saved = localStorage.getItem("showStatsSection");
    if (saved !== null) {
      toggleStats.checked = saved === "true";
      statsSection.style.display = toggleStats.checked ? "block" : "none";
    }
    toggleStats.addEventListener("change", () => {
      statsSection.style.display = toggleStats.checked ? "block" : "none";
      localStorage.setItem("showStatsSection", toggleStats.checked);
    });
  }
});

// =====================================================
//  INIZIALIZZAZIONE SESSIONE
// =====================================================

window.onload = function () {
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
};

