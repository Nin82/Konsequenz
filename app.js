// =====================================================
//  CONFIGURAZIONE BACKENDLESS
// =====================================================

const APP_ID = "C2A5C327-CF80-4BB0-8017-010681F0481C";
const API_KEY = "B266000F-684B-4889-9174-2D1734001E08";

const ORDER_TABLE = "Orders";
const USER_TABLE = "Users";

// Limite massimo di record per chiamata API imposto da Backendless
const MAX_PAGE_SIZE = 100; 

Backendless.initApp(APP_ID, API_KEY);

// =====================================================
//  COSTANTI RUOLI E STATI
// =====================================================

const ROLES = {
  ADMIN: "Admin",
  WAREHOUSE: "Warehouse",
  PHOTOGRAPHER: "Photographer",
  POST_PRODUCER: "PostProducer",
  PARTNER: "Partner",
  CUSTOMER: "Customer",
};

const ORDER_STATES = {
  WAREHOUSE_PENDING: "warehouse_pending",
  PHOTO_PENDING: "photo_pending",
  POST_PENDING: "post_pending",
  ADMIN_VALIDATION: "admin_validation",
  COMPLETED: "completed",
};

// Ruolo → stato successivo + ruolo assegnatario
const PIPELINE_FLOW = {
  [ROLES.WAREHOUSE]: {
    nextState: ORDER_STATES.PHOTO_PENDING,
    assignToRole: ROLES.PHOTOGRAPHER,
  },
  [ROLES.PHOTOGRAPHER]: {
    nextState: ORDER_STATES.POST_PENDING,
    assignToRole: ROLES.POST_PRODUCER,
  },
  [ROLES.POST_PRODUCER]: {
    nextState: ORDER_STATES.ADMIN_VALIDATION,
    assignToRole: ROLES.ADMIN, // Assegna all'admin per la validazione finale
  },
  [ROLES.ADMIN]: {
    nextState: ORDER_STATES.COMPLETED,
    assignToRole: ROLES.ADMIN,
  },
};

// Per i box colorati stats (CORRETTO con ORDER_STATES)
const STATUS_COLORS = {
  [ORDER_STATES.WAREHOUSE_PENDING]: "bg-amber-50 text-amber-700 border-amber-200",
  [ORDER_STATES.PHOTO_PENDING]: "bg-sky-50 text-sky-700 border-sky-200",
  [ORDER_STATES.POST_PENDING]: "bg-indigo-50 text-indigo-700 border-indigo-200",
  [ORDER_STATES.ADMIN_VALIDATION]: "bg-orange-50 text-orange-700 border-orange-200",
  [ORDER_STATES.COMPLETED]: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

// Config campi ordine (per tabella & modale)
const ORDER_FIELDS = [
  { key: "productCode", label: "Codice Articolo", type: "text" },
  { key: "eanCode", label: "EAN", type: "text" },
  { key: "styleName", label: "Style Name", type: "text" },
  { key: "styleGroup", label: "Style Group", type: "text" },
  { key: "brand", label: "Brand", type: "text" },
  { key: "color", label: "Colore", type: "text" },
  { key: "size", label: "Taglia", type: "text" },
  { key: "category", label: "Categoria", type: "text" },
  { key: "gender", label: "Genere", type: "text" },
  { key: "shots", label: "N. scatti", type: "text" },
  { key: "quantity", label: "Qta", type: "text" },
  { key: "s1Prog", label: "s1-Prog", type: "text" },
  { key: "s2Prog", label: "s2-Prog", type: "text" },
  { key: "progOnModel", label: "Prog on-m", type: "text" },
  { key: "stillShot", label: "Scatto Still (S/N)", type: "text" },
  { key: "onModelShot", label: "Scatto On Model (S/N)", type: "text" },
  { key: "priority", label: "Priorità", type: "text" },
  { key: "s1Stylist", label: "s1-Stylist", type: "text" },
  { key: "s2Stylist", label: "s2-Stylist", type: "text" },
  { key: "provenienza", label: "Provenienza", type: "text" },
  { key: "tipologia", label: "Tipologia", type: "text" },
  { key: "ordine", label: "Ordine", type: "text" },
  { key: "dataOrdine", label: "Data ordine", type: "date-string" },
  { key: "entryDate", label: "Entry Date", type: "date-string" },
  { key: "exitDate", label: "Exit Date", type: "date-string" },
  { key: "collo", label: "Collo", type: "text" },
  { key: "dataReso", label: "Data Reso", type: "date-string" },
  { key: "ddtNumber", label: "DDT N.", type: "text" },
  { key: "noteLogistica", label: "Note logistica", type: "textarea" },
  { key: "status", label: "Stato", type: "text" },
  { key: "assignedToEmail", label: "Assegnato a", type: "text" },
];

// =====================================================
//  STATO GLOBALE
// =====================================================

let currentUser = null;
let currentRole = null;
let adminOrdersCache = [];
let currentOrderEditing = null;
let currentPermissionUser = null; // Usato per il modale permessi
let statsChartInstance = null;
let allWorkersCache = [];

// =====================================================
//  UTILITY UI
// =====================================================

function $(id) {
  return document.getElementById(id);
}

function show(el) {
  if (el) el.classList.remove("hidden");
}

function hide(el) {
  if (el) el.classList.add("hidden");
}

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

// Mostra un messaggio di notifica (sostituisce alert/console.log)
function toast(msg, type = "info") {
  console.log(`[TOAST - ${type.toUpperCase()}]`, msg);
  // Qui potresti implementare la logica per mostrare il toast visivamente nell'interfaccia
  const statusEl = document.getElementById("toast-container"); // Assumi che esista
  if (!statusEl) return;
  
  statusEl.textContent = msg;
  statusEl.className = `p-2 rounded-md text-xs text-white fixed bottom-4 right-4 z-50 ${
      type === 'error' ? 'bg-red-500' : 'bg-slate-700'
  }`;
  show(statusEl);
  setTimeout(() => hide(statusEl), 3000);
}

// parse JSON string field safely
function parseJsonField(str) {
  if (!str) return [];
  try {
    const val = JSON.parse(str);
    if (Array.isArray(val)) return val;
    return [];
  } catch {
    // fallback: comma-separated
    return String(str)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

function buildWhereEquals(field, value) {
  const escaped = String(value).replace(/'/g, "\\'");
  return `${field} = '${escaped}'`;
}

// =====================================================
//  LOGIN / LOGOUT / NAVIGAZIONE
// =====================================================

async function handleLoginClick() {
  const email = $("login-email").value.trim();
  const pw = $("login-password").value;

  const statusEl = $("login-status");
  statusEl.classList.remove("hidden");
  statusEl.className = "mt-4 text-xs text-center text-slate-600";
  statusEl.textContent = "Accesso in corso...";

  if (!email || !pw) {
    statusEl.textContent = "Inserisci email e password.";
    statusEl.className = "mt-4 text-xs text-center text-rose-600";
    return;
  }

  try {
    const user = await Backendless.UserService.login(email, pw, true);

    // Recupera l'utente completo (in caso il login non restituisca tutti i campi)
    const qb = Backendless.DataQueryBuilder.create().setWhereClause(`objectId = '${user.objectId}'`);
    const fullUser = await Backendless.Data.of(USER_TABLE).find(qb);


    currentUser = fullUser[0] || user;
    currentRole = currentUser.role || ROLES.CUSTOMER;

    await afterLogin();
  } catch (err) {
    console.error("Errore login", err);
    statusEl.textContent = err.message || "Errore durante il login.";
    statusEl.className = "mt-4 text-xs text-center text-rose-600";
  }
}

async function afterLogin() {
  hide($("login-view"));

  // sidebar
  $("sidebar-username").textContent = currentUser.email || currentUser.name || "Utente";
  $("sidebar-role").textContent = currentRole || "Ruolo non definito";
  show($("logout-btn"));
  show($("sidebar"));

  if (currentRole === ROLES.ADMIN) {
    show($("nav-admin"));
    hide($("nav-worker"));

    show($("admin-view"));
    hide($("worker-view"));

    await loadUsersList();
    await loadAllWorkers(); // <-- NUOVA CHIAMATA
    await loadAdminOrders();
    await loadAdminStats();
  } else {
    show($("nav-worker"));
    hide($("nav-admin"));

    hide($("admin-view"));
    show($("worker-view"));

    $("worker-role-info").textContent = `Ruolo: ${currentRole}`;
    await loadWorkerOrders();
  }
}

async function handleLogout() {
  try {
    await Backendless.UserService.logout();
  } catch (e) {
    console.warn("Logout error (ignorabile)", e);
  }
  currentUser = null;
  currentRole = null;
  statsChartInstance = null;

  hide($("admin-view"));
  hide($("worker-view"));
  hide($("sidebar"));
  hide($("logout-btn"));

  show($("login-view"));
}

// navigation from sidebar
function showSection(section) {
  if (section === "admin" && currentRole === ROLES.ADMIN) {
    show($("admin-view"));
    hide($("worker-view"));
  } else if (section === "worker" && currentRole && currentRole !== ROLES.ADMIN) {
    hide($("admin-view"));
    show($("worker-view"));
  }
}

// =====================================================
//  TOGGLE CARDS ADMIN
// =====================================================

function initAdminToggles() {
  const map = [
    { toggleId: "toggle-users", cardId: "card-users" },
    { toggleId: "toggle-import", cardId: "card-import" },
    { toggleId: "toggle-orders", cardId: "card-orders" },
    { toggleId: "toggle-stats", cardId: "card-stats" },
  ];

  map.forEach(({ toggleId, cardId }) => {
    const t = $(toggleId);
    const c = $(cardId);
    if (!t || !c) return;

    const key = `konseq_toggle_${toggleId}`;
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      t.checked = stored === "true";
    }
    c.style.display = t.checked ? "block" : "none";

    t.addEventListener("change", () => {
      c.style.display = t.checked ? "block" : "none";
      localStorage.setItem(key, String(t.checked));
    });
  });
}

// =====================================================
//  GESTIONE UTENTI ADMIN (VERSIONE CONSOLIDATA)
// =====================================================

// Nuova funzione consolidata per caricare la lista utenti
async function loadUsersList() {
    const tbody = document.getElementById("users-table-body");
    const loading = document.getElementById("users-loading");

    tbody.innerHTML = "";
    loading.textContent = "Caricamento…";

    try {
        const qb = Backendless.DataQueryBuilder.create()
            .setWhereClause("email != null")
            .setSortBy(["email ASC"])
            .setPageSize(MAX_PAGE_SIZE); // Massima dimensione di pagina

        const users = await Backendless.Data.of("Users").find(qb);

        loading.textContent = users.length === 0 ? "Nessun utente trovato." : "";

        users.filter(u => u.objectId !== currentUser.objectId).forEach((u) => {
            const tr = document.createElement("tr");
            tr.className = "hover:bg-slate-50";

            // ---- EMAIL ----
            const tdEmail = document.createElement("td");
            tdEmail.className = "px-3 py-2";
            tdEmail.textContent = u.email;
            tr.appendChild(tdEmail);

            // ---- RUOLO (SELECT) ----
            const tdRole = document.createElement("td");
            tdRole.className = "px-3 py-2";

            const select = document.createElement("select");
            select.className = "form-input text-xs";

            const roles = Object.values(ROLES);

            roles.forEach((r) => {
                const opt = document.createElement("option");
                opt.value = r;
                opt.textContent = r;
                if (u.role === r) opt.selected = true;
                select.appendChild(opt);
            });

            select.addEventListener("change", () => changeUserRole(u.objectId, select.value));

            tdRole.appendChild(select);
            tr.appendChild(tdRole);

            // ---- AZIONI ----
            const tdActions = document.createElement("td");
            tdActions.className = "px-3 py-2";

            const btn = document.createElement("button");
            btn.className = "btn-secondary text-xs";
            btn.textContent = "Permessi";
            btn.onclick = () => openPermissionsModal(u);

            tdActions.appendChild(btn);
            tr.appendChild(tdActions);

            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error("Errore loadUsersList", err);
        loading.textContent = "Errore caricamento utenti";
    }
}

async function changeUserRole(userId, newRole) {
    try {
        // Recupera solo l'oggetto da aggiornare, non l'intera riga (più efficiente)
        await Backendless.Data.of("Users").save({
             objectId: userId,
             role: newRole,
        });

        toast("Ruolo aggiornato", "success");
    } catch (err) {
        console.error("Errore cambio ruolo", err);
        toast("Errore aggiornamento ruolo", "error");
    }
}

async function handleCreateUser() {
  const email = $("new-user-email").value.trim();
  const pw = $("new-user-password").value;
  const role = $("new-user-role").value;
  const statusEl = $("user-create-status");

  statusEl.classList.remove("hidden");
  statusEl.className = "text-xs mt-1 text-slate-600";

  if (!email || !pw || !role) {
    statusEl.textContent = "Compila email, password e ruolo.";
    statusEl.className = "text-xs mt-1 text-rose-600";
    return;
  }

  try {
    // Backendless richiede registrazione standard, poi aggiungiamo il ruolo
    const newUser = await Backendless.UserService.register({
      email,
      password: pw,
      role, // Aggiungiamo il ruolo al momento della registrazione
    });

    statusEl.textContent = `Utente ${email} creato.`;
    statusEl.className = "text-xs mt-1 text-emerald-600";

    $("new-user-email").value = "";
    $("new-user-password").value = "";
    $("new-user-role").value = "";

    await loadUsersList(); // Usa la nuova funzione
  } catch (err) {
    console.error("Errore creazione utente", err);
    statusEl.textContent = err.message || "Errore creando l'utente.";
    statusEl.className = "text-xs mt-1 text-rose-600";
  }
}


// Carica tutti i lavoratori (non Admin e non Customer) in una cache globale
async function loadAllWorkers() {
    let allWorkers = []; // Array per accumulare tutti i lavoratori
    let offset = 0;
    const MAX_PAGE_SIZE = 100; // Limite fisso di Backendless
    let workersChunk;

    try {
        // Implementazione della paginazione ricorsiva per gli utenti
        do {
            const qb = Backendless.DataQueryBuilder.create()
                .setWhereClause("role != 'Admin' AND role != 'Customer' AND email != null")
                .setPageSize(MAX_PAGE_SIZE)
                .setOffset(offset);

            workersChunk = await Backendless.Data.of("Users").find(qb);
            
            allWorkers.push(...workersChunk);
            offset += MAX_PAGE_SIZE;

        } while (workersChunk.length === MAX_PAGE_SIZE);

        allWorkersCache = allWorkers; // Popola la cache globale
        
    } catch (err) {
        console.error("Errore caricamento lavoratori", err);
        // È utile sapere se c'è un errore, ma non deve bloccare l'intera app
    }
}


// Ritorna l'elenco dei campi (chiavi) che devono essere mostrati nella tabella Admin.
function getVisibleFieldsForAdminTable() {
    // Lista di campi di default per l'Admin. L'ordine qui determina l'ordine delle colonne.
    return [
        "productCode", 
        "eanCode", 
        "status", 
	"brand",
	"category",
	"color",
	"provenienza",
	"tipologia",
	"styleGroup",
	"gender",
	"entryDate",
	"exitDate",
	"noteLogistica",
	"photoStoragePath",
        "assignedToRole",
        "assignedToEmail", // Campo cruciale ora per l'assegnazione
        "noteAdmin",
        "lastUpdated" // Utile per l'ordinamento
    ];
}

// Gestisce l'assegnazione manuale tramite il menu a tendina Admin
async function assignOrderManually(orderId, newEmail) {
    if (!newEmail) {
        toast("Assegnazione annullata.", "info");
        return;
    }
    
    try {
        const update = { 
            objectId: orderId, 
            assignedToEmail: newEmail,
            lastUpdated: new Date()
        };

        await Backendless.Data.of(ORDER_TABLE).save(update);

        toast(`Ordine assegnato a ${newEmail}.`, "success");
        
        // Ricarica la tabella per aggiornare la visualizzazione
        loadAdminOrders(); 
        
    } catch (err) {
        console.error("Errore assegnazione manuale", err);
        toast("Errore durante l'assegnazione manuale.", "error");
    }
}

/**
 * Salva la data e ora corrente (timestamp) per un campo specifico dell'ordine.
 * @param {string} orderId L'ID dell'oggetto ordine.
 * @param {string} fieldKey La chiave del campo data da aggiornare (es. 'entryDate').
 * @param {HTMLElement} dateSpan L'elemento <span> da aggiornare nella UI.
 */
async function saveDateStamp(orderId, fieldKey, dateSpan) {
    if (!confirm(`Sei sicuro di voler valorizzare il campo ${fieldKey} con la data/ora attuale?`)) {
        return;
    }

    const now = new Date(); // Data e ora attuali
    const updateObj = {
        objectId: orderId,
        lastUpdated: now // Aggiorna sempre la data di ultima modifica
    };
    
    // Assegna il timestamp al campo dinamico (es. updateObj.entryDate = now)
    updateObj[fieldKey] = now; 

    try {
        await Backendless.Data.of(ORDER_TABLE).save(updateObj);

        // Aggiorna l'interfaccia utente in modo immediato
        dateSpan.textContent = now.toLocaleDateString('it-IT');
        
        // Puoi anche ricaricare l'intera tabella se preferisci che gli altri campi si aggiornino
        // loadAdminOrders(); 
        
        toast(`${fieldKey} aggiornato a ${now.toLocaleDateString('it-IT')}`, "success");

    } catch (err) {
        console.error(`Errore salvataggio data per ${fieldKey}`, err);
        toast(`Errore salvataggio data per ${fieldKey}`, "error");
    }
}

// ===== MODALE PERMESSI (VERSIONE FINALE) =====

function openPermissionsModal(user) {
    currentPermissionUser = user;

    document.getElementById("permissions-user-email").textContent = user.email;

    // Parsing valori user (usa parseJsonField)
    const visible = parseJsonField(user.visibleFields);
    const editable = parseJsonField(user.editableFields);

    const boxVisible = document.getElementById("perm-visible-fields");
    const boxEditable = document.getElementById("perm-editable-fields");

    boxVisible.innerHTML = "";
    boxEditable.innerHTML = "";

    // Costruzione checkbox basata su ORDER_FIELDS per coerenza
    ORDER_FIELDS.forEach(f => {
        // VISIBILI
        const rowV = document.createElement("div");
        rowV.className = "p-1.5 hover:bg-slate-50";
        rowV.innerHTML = `
            <label class="flex items-center gap-2">
                <input type="checkbox" 
                       data-field-visible="${f.key}" 
                       ${visible.includes(f.key) ? "checked" : ""}
                       class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500">
                <span class="text-xs">${f.label} (${f.key})</span>
            </label>
        `;
        boxVisible.appendChild(rowV);

        // EDITABILI
        const rowE = document.createElement("div");
        rowE.className = "p-1.5 hover:bg-slate-50";
        rowE.innerHTML = `
            <label class="flex items-center gap-2">
                <input type="checkbox" 
                       data-field-edit="${f.key}" 
                       ${editable.includes(f.key) ? "checked" : ""}
                       class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500">
                <span class="text-xs">${f.label} (${f.key})</span>
            </label>
        `;
        boxEditable.appendChild(rowE);
    });

    document.getElementById("permissions-status").classList.add("hidden");
    document.getElementById("permissions-modal").classList.remove("hidden");
}

function closePermissionsModal() {
  currentPermissionUser = null;
  hide($("permissions-modal"));
}


async function saveUserPermissions() {
    const statusEl = document.getElementById("permissions-status");

    if (!currentPermissionUser) return;

    statusEl.textContent = "Salvataggio in corso...";
    statusEl.classList.remove("hidden", "text-emerald-600", "text-rose-600");
    statusEl.classList.add("text-slate-600");

    try {
        const visible = [];
        const editable = [];

        document.querySelectorAll("[data-field-visible]").forEach(ch => {
            if (ch.checked) visible.push(ch.getAttribute("data-field-visible"));
        });

        document.querySelectorAll("[data-field-edit]").forEach(ch => {
            if (ch.checked) editable.push(ch.getAttribute("data-field-edit"));
        });

        const updateObj = {
            objectId: currentPermissionUser.objectId,
            // Backendless memorizza i permessi come stringhe JSON
            visibleFields: JSON.stringify(visible), 
            editableFields: JSON.stringify(editable),
        };

        await Backendless.Data.of("Users").save(updateObj);

        statusEl.textContent = "Permessi salvati con successo ✔";
        statusEl.classList.remove("text-slate-600");
        statusEl.classList.add("text-emerald-600");

        setTimeout(() => {
            closePermissionsModal();
            loadUsersList();
        }, 700);

    } catch (err) {
        console.error("Errore salvataggio permessi", err);
        statusEl.textContent = "Errore durante il salvataggio: " + (err.message || "");
        statusEl.classList.remove("text-slate-600");
        statusEl.classList.add("text-rose-600");
    }
}


// =====================================================
//  IMPORT EXCEL (CORRETTO)
// =====================================================

async function handleImportClick() {
  const fileInput = $("import-file");
  const statusEl = $("import-status");
  const logEl = $("import-log");
  const progressBar = $("import-progress");

  // Reset UI
  statusEl.textContent = "";
  logEl.textContent = "";
  hide(logEl);
  progressBar.style.width = "0%";

  if (!fileInput.files || fileInput.files.length === 0) {
    statusEl.textContent = "Seleziona un file prima di importare.";
    statusEl.className = "text-xs text-rose-600";
    return;
  }

  const origin = $("import-origin").value.trim();
  const type = $("import-type").value.trim();
  const orderNumber = $("import-order-number").value.trim();
  const orderDate = $("import-order-date").value;

  const file = fileInput.files[0];

  statusEl.textContent = "Lettura file...";
  statusEl.className = "text-xs text-slate-600";

  const reader = new FileReader();

  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: "array" });
      const sheet = wb.SheetNames[0];
      const ws = wb.Sheets[sheet];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

      if (!rows || rows.length === 0) {
        statusEl.textContent = "File vuoto o non leggibile.";
        statusEl.className = "text-xs text-rose-600";
        return;
      }

      statusEl.textContent = `Importazione ${rows.length} righe...`;
      statusEl.className = "text-xs text-slate-600";

      let ok = 0;
      let dup = 0;
      let err = 0;

      show(logEl);

      // Recupera il MAGAZZINIERE per assegnazione automatica (qualsiasi utente Warehouse)
      let warehouseUser = null;
      try {
        const qbUser = Backendless.DataQueryBuilder.create()
          .setWhereClause(`role = '${ROLES.WAREHOUSE}'`)
          .setPageSize(1);

        const users = await Backendless.Data.of("Users").find(qbUser);
        warehouseUser = users.length > 0 ? users[0] : null;
      } catch (e) {
        console.warn("Impossibile recuperare magazziniere", e);
      }
      
      const assignedEmail = warehouseUser ? warehouseUser.email : "";

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];

        const productCode = r["Codice Articolo"] || r["productCode"] || "";
        const ean = r["Ean Code"] || r["eanCode"] || "";

        if (!productCode && !ean) {
          logEl.textContent += `⚠ Riga ${i + 1}: nessun Codice Articolo/EAN. Ignorata.\n`;
          err++;
          continue;
        }

        // Controllo duplicato
        const whereClause = productCode ? buildWhereEquals("productCode", productCode) : buildWhereEquals("eanCode", ean);

        const qb = Backendless.DataQueryBuilder.create()
          .setWhereClause(whereClause)
          .setPageSize(1);

        const existing = await Backendless.Data.of(ORDER_TABLE).find(qb);
        if (existing.length > 0) {
          logEl.textContent += `❌ Duplicato: ${productCode || ean}\n`;
          dup++;
          progressBar.style.width = `${Math.round(((i + 1) / rows.length) * 100)}%`;
          continue;
        }

        const orderObj = {
          productCode,
          eanCode: ean,
          styleName: r["Style Name"] || "",
          styleGroup: r["Style Group"] || "",
          brand: r["Brand"] || "",
          color: r["Colore"] || "",
          size: r["Taglia"] || "",
          category: r["Categoria"] || "",
          gender: r["Genere"] || "",
          shots: r["N. Scatti"] || "",
          quantity: r["Qta"] || "",
          s1Prog: r["s1-Prog"] || "",
          s2Prog: r["s2-Prog"] || "",
          progOnModel: r["Prog. on-m"] || "",
          stillShot: r["Scatto Still (S/N)"] || "",
          onModelShot: r["Scatto On Model (S/N)"] || "",
          priority: r["Priorità"] || "",
          s1Stylist: r["s1-Stylist"] || "",
          s2Stylist: r["s2-Stylist"] || "",
          provenienza: origin || r["provenienza"] || "",
          tipologia: type || r["tipologia"] || "",
          ordine: orderNumber || String(r["Ordine"] || ""),
          dataOrdine: orderDate || r["Data ordine"] || "",
          entryDate: r["Entry Date"] || "",
          exitDate: r["Exit Date"] || "",
          collo: String(r["Collo"] || ""),
          dataReso: r["Data Reso"] || "",
          ddtNumber: r["DDT N."] || "",
          noteLogistica: r["Note Logistica"] || "",

          // 🔥 Pipeline automatica → parte dal Magazzino (CORRETTO)
          status: ORDER_STATES.WAREHOUSE_PENDING, 
          assignedToRole: ROLES.WAREHOUSE,
          assignedToEmail: assignedEmail,

          lastUpdated: new Date(),
        };

        try {
          await Backendless.Data.of(ORDER_TABLE).save(orderObj);
          ok++;
        } catch (e2) {
          console.error("Errore salvataggio ordine", e2);
          logEl.textContent += `❌ Errore salvataggio ${productCode}: ${e2.message}\n`;
          err++;
        }

        progressBar.style.width = `${Math.round(((i + 1) / rows.length) * 100)}%`;
      }

      statusEl.textContent = `Importazione completata: ${ok} ordini creati, ${dup} duplicati, ${err} errori.`;
      statusEl.className = "text-xs text-emerald-600";

      await loadAdminOrders();
      await loadAdminStats();

      fileInput.value = "";
    } catch (error) {
      console.error("Errore lettura/import", error);
      statusEl.textContent = error.message || "Errore durante l'import.";
      statusEl.className = "text-xs text-rose-600";
    }
  };

  reader.readAsArrayBuffer(file);
}


// =====================================================
//  ORDINI ADMIN – TABELLONE + MODALE (CON PAGINAZIONE)
// =====================================================

// Assicurati che le costanti ORDER_TABLE, ORDER_FIELDS e STATUS_COLORS
// e le funzioni $, show, hide, applyOrdersFilters, saveDateStamp siano dichiarate altrove.

async function loadAdminOrders() {
    const tableBody = $("orders-table-body");
    const headerRow = $("orders-header-row");
    const filterRow = $("orders-filter-row");
    const loadingStatus = $("orders-loading");

    // Pulizia e stato di caricamento
    tableBody.innerHTML = "";
    headerRow.innerHTML = "";
    filterRow.innerHTML = "";
    show(loadingStatus);

    try {
        // 1. Configurazione dei campi visibili
        const visFields = getVisibleFieldsForAdminTable();
        const fieldConfig = ORDER_FIELDS.filter((f) => visFields.includes(f.key));

        // 2. FETCH DEGLI ORDINI (Query Backendless)
        // Usa Set per garantire l'unicità dei nomi delle colonne richieste
        const properties = Array.from(new Set(visFields.concat(["objectId"]))); 
        
        const queryBuilder = Backendless.DataQueryBuilder.create()
            .setProperties(properties)
            .setSortBy(["lastUpdated DESC"]);

        const orders = await Backendless.Data.of(ORDER_TABLE).find(queryBuilder);
        adminOrdersCache = orders; // Aggiorna la cache

        hide(loadingStatus);

        // 3. CREAZIONE HEADERS E FILTRI
        fieldConfig.forEach((f) => {
            // Header
            const th = document.createElement("th");
            th.className = "th";
            th.textContent = f.label;
            headerRow.appendChild(th);

            // Filter
            const td = document.createElement("td");
            td.className = "px-3 py-1";
            const input = document.createElement("input");
            input.type = "text";
            input.className = "form-input-filter"; 
            input.placeholder = "Filtro";
            input.dataset.fieldKey = f.key;
            input.addEventListener("input", applyOrdersFilters);
            td.appendChild(input);
            filterRow.appendChild(td);
        });

        // Aggiungi header e filtro per la colonna Azioni
        headerRow.insertAdjacentHTML("beforeend", '<th class="th">Azioni</th>');
        filterRow.insertAdjacentHTML("beforeend", '<td class="px-3 py-1"></td>'); 

        // 4. CREAZIONE CORPO DELLA TABELLA
        orders.forEach((o) => {
            const tr = document.createElement("tr");
            tr.dataset.objectId = o.objectId;
            
            // Loop per le colonne dei dati
            fieldConfig.forEach((f) => {
                const td = document.createElement("td");
                td.className = "px-3 py-2";
                let val = o[f.key];

                // 1. --- LOGICA BADGE DI STATO ---
                if (f.key === "status") {
                    const statusValue = val || ''; 
                    const colorClass = STATUS_COLORS[statusValue] || 'bg-slate-50 text-slate-600 border-slate-200';
                    const span = document.createElement("span");
                    
                    span.className = `inline-block px-2 py-0.5 rounded-full text-[10px] ${colorClass}`;
                    // Resiliente a null: formatta solo se c'è valore
                    span.textContent = statusValue ? statusValue.replace('_', ' ').toUpperCase() : 'N/A';
                    
                    td.appendChild(span);
                }
                // 2. --- LOGICA PULSANTE DATETIME E FORMATTAZIONE ---
                else if (f.type === "date-string" && f.key !== "lastUpdated") {
                    
                    td.className += " flex items-center justify-between";
                    
                    const dateSpan = document.createElement("span");
                    dateSpan.textContent = val ? new Date(val).toLocaleDateString('it-IT') : "";
                    
                    const btnTime = document.createElement("button");
                    // Rimuovi parte del padding per dare spazio al pulsante
                    td.className = td.className.replace("px-3", "pr-1 pl-3"); 
                    btnTime.className = "ml-2 px-1 py-0 bg-indigo-500 hover:bg-indigo-600 text-white rounded text-[8px] leading-none";
                    btnTime.textContent = "⏱";

                    btnTime.onclick = () => saveDateStamp(o.objectId, f.key, dateSpan);
                    
                    td.appendChild(dateSpan);
                    td.appendChild(btnTime);
                    
                } 
                // 3. --- LOGICA STANDARD PER ALTRI CAMPI DATA/TESTO ---
                else if (f.key === "lastUpdated") {
                    td.textContent = val ? new Date(val).toLocaleDateString('it-IT') : "";
                } else {
                    td.textContent = val || "";
                }
                // --------------------------------------------------

                tr.appendChild(td);
            });

            // Colonna Azioni
            const tdAct2 = document.createElement("td");
            tdAct2.className = "px-3 py-2 space-x-1 flex items-center gap-2 whitespace-nowrap";
            
            // Bottone Modifica
            const btnEdit = document.createElement("button");
            btnEdit.className = "btn-secondary text-[10px]";
            btnEdit.textContent = "Modifica";
            // btnEdit.onclick = () => openOrderModal(o.objectId); 

            tdAct2.appendChild(btnEdit);
            
            tr.appendChild(tdAct2);

            tableBody.appendChild(tr);
        });

    } catch (err) {
        // Messaggio di errore più dettagliato
        console.error("ERRORE CRITICO NEL CARICAMENTO ORDINI ADMIN:", err);
        loadingStatus.textContent = "Errore: Impossibile caricare gli ordini. Controlla la console del browser per i dettagli.";
        show(loadingStatus);
    }
				}

		
// filtro client-side
function applyOrdersFilters() {
  const filterInputs = Array.from(
    $("orders-filter-row").querySelectorAll("input[data-field-key]")
  );
  const filters = {};
  filterInputs.forEach((inp) => {
    const value = inp.value.trim().toLowerCase();
    if (value) filters[inp.dataset.fieldKey] = value;
  });

  const body = $("orders-table-body");
  const rows = Array.from(body.querySelectorAll("tr"));

  rows.forEach((row) => {
    const oid = row.dataset.objectId;
    const order = adminOrdersCache.find((o) => o.objectId === oid);
    if (!order) return;

    let visible = true;
    for (const [field, value] of Object.entries(filters)) {
      const raw = (order[field] || "").toString().toLowerCase();
      if (!raw.includes(value)) {
        visible = false;
        break;
      }
    }

    row.style.display = visible ? "" : "none";
  });
}

// ===== MODALE ORDINE (ADMIN E WORKER) =====

async function openOrderModal(objectId) {
  const isWorker = currentRole !== ROLES.ADMIN;
  
  const order = adminOrdersCache.find((o) => o.objectId === objectId) || await Backendless.Data.of(ORDER_TABLE).findById(objectId);
  if (!order) {
    alert("Ordine non trovato.");
    return;
  }

  currentOrderEditing = order;
  setText("order-modal-id", objectId);

  const container = $("order-modal-fields");
  container.innerHTML = "";
  
  // Campi modificabili solo per i worker con permessi
  const editableFields = isWorker ? parseJsonField(currentUser.editableFields) : ORDER_FIELDS.map(f => f.key);

  ORDER_FIELDS.forEach((f) => {
    const val = order[f.key] || "";
    const isEditable = editableFields.includes(f.key);

    const wrapper = document.createElement("div");
    wrapper.className = "flex flex-col gap-1";

    const label = document.createElement("label");
    label.className = "text-[11px] font-medium text-slate-600";
    label.textContent = f.label;
    wrapper.appendChild(label);

    let control;

    if (f.key === 'status') {
      control = document.createElement("input");
      control.type = "text";
      control.value = val;
      control.disabled = true; // Lo stato si cambia solo con il bottone 'Avanza'
    } else if (f.type === "textarea") {
      control = document.createElement("textarea");
      control.rows = 3;
      control.value = val;
    } else if (f.type === "date-string") {
      control = document.createElement("input");
      control.type = "date";
      if (val && /^\d{4}-\d{2}-\d{2}/.test(val)) {
        control.value = val.substring(0, 10);
      }
    } else {
      control = document.createElement("input");
      control.type = "text";
      control.value = val;
    }
    
    // Disabilita se non è l'admin e il campo non è modificabile
    if (isWorker && !isEditable && f.key !== 'status') {
        control.disabled = true;
        control.classList.add('bg-slate-100', 'text-slate-500');
    }

    control.id = `order-field-${f.key}`;
    control.className =
      "rounded border border-slate-300 px-2 py-1 text-[11px] bg-white";

    wrapper.appendChild(control);
    container.appendChild(wrapper);
  });

  // Mostra il pulsante di salvataggio solo se l'admin o se ci sono campi editabili per il worker
  const saveBtn = $("order-modal-save-btn");
  if (isWorker && editableFields.length === 0) {
      hide(saveBtn);
  } else {
      show(saveBtn);
  }
  

  $("order-modal-status").classList.add("hidden");
  show($("order-modal"));
}

function closeOrderModal() {
  currentOrderEditing = null;
  hide($("order-modal"));
}


async function saveOrderFromModal() {
  if (!currentOrderEditing) return;

  const statusEl = $("order-modal-status");
  statusEl.classList.remove("hidden");
  statusEl.className = "text-xs mt-2 text-slate-600";
  statusEl.textContent = "Salvataggio in corso...";

  const update = { objectId: currentOrderEditing.objectId };
  const isWorker = currentRole !== ROLES.ADMIN;
  const editableFields = isWorker ? parseJsonField(currentUser.editableFields) : ORDER_FIELDS.map(f => f.key);


  ORDER_FIELDS.forEach((f) => {
    // Solo l'admin o i campi esplicitamente editabili dal worker vengono aggiornati
    if (currentRole === ROLES.ADMIN || editableFields.includes(f.key)) {
        const input = $(`order-field-${f.key}`);
        if (!input) return;
    
        if (f.type === "date-string") {
          update[f.key] = input.value || "";
        } else {
          update[f.key] = input.value;
        }
    }
  });

  update.lastUpdated = new Date();

  try {
    await Backendless.Data.of(ORDER_TABLE).save(update);
    statusEl.textContent = "Ordine aggiornato.";
    statusEl.className = "text-xs mt-2 text-emerald-600";

    if (currentRole === ROLES.ADMIN) {
        await loadAdminOrders();
        await loadAdminStats();
    } else {
        await loadWorkerOrders();
    }
    

    setTimeout(() => {
      closeOrderModal();
    }, 700);
  } catch (err) {
    console.error("Errore salvataggio ordine", err);
    statusEl.textContent = err.message || "Errore durante il salvataggio.";
    statusEl.className = "text-xs mt-2 text-rose-600";
  }
}

// =====================================================
// AVANZA ORDINE NELLA PIPELINE AUTOMATICA
// =====================================================
async function advanceOrder(orderId) {
  try {
    const order = await Backendless.Data.of(ORDER_TABLE).findById(orderId);
    if (!order) return toast("Ordine non trovato", "error");

    const role = currentUser.role;
    const step = PIPELINE_FLOW[role];

    if (!step) return toast(`Il tuo ruolo (${role}) non può avanzare ordini.`, "error");

    // Aggiorna stato
    order.status = step.nextState;

    // Assegna automaticamente al ruolo successivo
    order.assignedToRole = step.assignToRole;

    // Assegna all'utente corretto SOLO se non è Admin
    if (step.assignToRole !== ROLES.ADMIN) {
      // Troviamo il primo utente con quel ruolo (Logica semplice: primo trovato)
      const qb = Backendless.DataQueryBuilder.create()
        .setWhereClause(`role = '${step.assignToRole}'`)
        .setPageSize(1);

      const users = await Backendless.Data.of("Users").find(qb);

      if (users.length > 0) {
        order.assignedToEmail = users[0].email;
      } else {
         order.assignedToEmail = ""; // Nessun utente assegnabile, resta non assegnato
         toast(`Attenzione: Nessun utente trovato per il ruolo ${step.assignToRole}. Ordine non assegnato.`, "error");
      }
    } else {
        // Se è l'Admin la validazione finale, l'email assegnataria è l'Admin stesso
        order.assignedToEmail = currentUser.email; 
    }

    await Backendless.Data.of(ORDER_TABLE).save(order);

    toast(`Ordine avanzato a "${order.status}" e assegnato a ${order.assignedToRole}.`, "success");

    // Ricarica tabella
    if (currentUser.role === ROLES.ADMIN) {
        loadAdminOrders();
        loadAdminStats();
    } else {
        loadWorkerOrders();
    }

  } catch (e) {
    console.error("Errore advanceOrder:", e);
    toast("Errore durante l'avanzamento dell'ordine.", "error");
  }
}


// =====================================================
//  STATS
// =====================================================

async function loadAdminStats() {
  const container = $("stats-summary");
  container.innerHTML = "";

  let allOrders = [];
  let offset = 0;
  let ordersChunk;

  try {
    // Paginazione per caricare tutte le stats
    do {
        const qb = Backendless.DataQueryBuilder.create()
          .setPageSize(MAX_PAGE_SIZE)
          .setOffset(offset)
          .setSortBy(["status"]);
        
        ordersChunk = await Backendless.Data.of(ORDER_TABLE).find(qb);
        allOrders.push(...ordersChunk);
        offset += MAX_PAGE_SIZE;

    } while (ordersChunk.length === MAX_PAGE_SIZE);

    const orders = allOrders;
    const counts = {};
    orders.forEach((o) => {
      const st = o.status || "Senza stato";
      counts[st] = (counts[st] || 0) + 1;
    });

    // Ordina gli stati in base alla pipeline per visualizzazione logica
    const sortedStates = Object.values(ORDER_STATES).filter(s => counts[s]);
    const otherStates = Object.keys(counts).filter(s => !Object.values(ORDER_STATES).includes(s));
    
    [...sortedStates, ...otherStates].forEach((status) => {
      const count = counts[status];
      const colorClass = STATUS_COLORS[status] || "bg-slate-50 text-slate-700 border-slate-200";

      const div = document.createElement("div");
      div.className = `rounded-xl border px-4 py-3 ${colorClass}`;
      div.innerHTML = `
        <p class="text-xs font-semibold mb-1">${status.replace('_', ' ').toUpperCase()}</p>
        <p class="text-2xl font-bold">${count}</p>
      `;
      container.appendChild(div);
    });

    // Chart
    const ctx = $("stats-chart").getContext("2d");
    const labels = [...sortedStates, ...otherStates];
    const data = labels.map(l => counts[l]);

    if (statsChartInstance) statsChartInstance.destroy();

    statsChartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Numero ordini",
            data,
            backgroundColor: "rgba(56, 189, 248, 0.7)",
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true },
        },
      },
    });
  } catch (err) {
    console.error("Errore loadAdminStats", err);
  }
}

// =====================================================
//  WORKER VIEW (FINALE CON PAGINAZIONE)
// =====================================================

async function loadWorkerOrders() {
  const loading = $("worker-orders-loading");
  const header = $("worker-orders-header");
  const body = $("worker-orders-body");

  loading.textContent = "Caricamento…";
  header.innerHTML = "";
  body.innerHTML = "";
  
  const workerRole = currentUser.role;
  let allOrders = []; // Array per accumulare tutti i risultati
  let offset = 0;
  let ordersChunk;

  try {
    // Implementazione della paginazione
    do {
      // Mostra solo ordini assegnati a questo utente
      const qb = Backendless.DataQueryBuilder.create()
        .setWhereClause(buildWhereEquals("assignedToEmail", currentUser.email))
        .setPageSize(MAX_PAGE_SIZE) // 100
        .setOffset(offset)          // 0, 100, 200...
        .setSortBy(["lastUpdated DESC"]);

      ordersChunk = await Backendless.Data.of(ORDER_TABLE).find(qb);

      allOrders.push(...ordersChunk); // Aggiunge i risultati
      offset += MAX_PAGE_SIZE;      // Incrementa l'offset per la prossima pagina

    } while (ordersChunk.length === MAX_PAGE_SIZE); // Continua finché la pagina è piena


    const orders = allOrders; // 'orders' contiene TUTTI i record


    // Determina i campi visibili per questo ruolo
    // Fallback: se visibleFields è vuoto, mostra solo productCode, status, eanCode
    const defaultVisible = ["productCode", "eanCode", "status"];
    const visibleFields = parseJsonField(currentUser.visibleFields);
    
    // Filtra i campi da mostrare
    const fieldsToShow = ORDER_FIELDS.filter((f) =>
      visibleFields.length > 0 ? visibleFields.includes(f.key) : defaultVisible.includes(f.key)
    );

    // ==========================
    // HEADER TABELLA
    // ==========================
    fieldsToShow.forEach((f) => {
      const th = document.createElement("th");
      th.className = "th";
      th.textContent = f.label;
      header.appendChild(th);
    });

    const thActions = document.createElement("th");
    thActions.className = "th";
    thActions.textContent = "Azioni";
    header.appendChild(thActions);

    // ==========================
    // RIGHE ORDINI
    // ==========================
    orders.forEach((o) => {
      const tr = document.createElement("tr");
      tr.className = "hover:bg-slate-50 text-[11px]";

      // colonne dei campi
      fieldsToShow.forEach((f) => {
        const td = document.createElement("td");
        td.className = "px-3 py-2";
        
        if (f.key === 'status') {
             const colorClass = STATUS_COLORS[o.status] ? STATUS_COLORS[o.status].replace('bg-', 'bg-').replace('text-', 'text-') : 'text-slate-600';
             td.innerHTML = `<span class="inline-block px-2 py-0.5 rounded-full text-[10px] ${colorClass}">${o.status || ''}</span>`;
        } else {
             td.textContent = o[f.key] || "";
        }
        tr.appendChild(td);
      });

      // BOTTONI AZIONI
      const tdAct = document.createElement("td");
      tdAct.className = "px-3 py-2 space-x-1 whitespace-nowrap";

      // Bottone Modifica (se ha permessi di modifica)
      const editableFields = parseJsonField(currentUser.editableFields);
      if (editableFields.length > 0) {
        const btnEdit = document.createElement("button");
        btnEdit.className = "btn-secondary text-[10px]";
        btnEdit.textContent = "Modifica";
        btnEdit.onclick = () => openOrderModal(o.objectId);
        tdAct.appendChild(btnEdit);
      }
      
      // Bottone Avanza (se l'ordine è nello stato atteso per il suo ruolo)
      const expectedStatus = Object.keys(PIPELINE_FLOW).find(r => PIPELINE_FLOW[r].assignToRole === workerRole);

      // Avanza è sempre il bottone principale per il worker
      const btnAdvance = document.createElement("button");
      btnAdvance.className = "btn-primary text-[10px]";
      btnAdvance.textContent = `Avanza a ${PIPELINE_FLOW[workerRole]?.nextState.replace('_', ' ').toUpperCase() || 'FINALE'}`;
      btnAdvance.onclick = () => advanceOrder(o.objectId);
      
      // Logica: mostrare Avanza solo se l'ordine è assegnato a lui E non è già Admin Validation/Completed
      if (o.assignedToRole === workerRole && o.status !== ORDER_STATES.ADMIN_VALIDATION && o.status !== ORDER_STATES.COMPLETED) {
          tdAct.appendChild(btnAdvance);
      }


      tr.appendChild(tdAct);
      body.appendChild(tr);
    });

    loading.textContent =
      orders.length === 0 ? "Nessun ordine assegnato." : "";
  } catch (err) {
    console.error("Errore loadWorkerOrders", err);
    loading.textContent = "Errore caricamento ordini.";
  }
}

// =====================================================
//  INIT
// =====================================================

window.addEventListener("DOMContentLoaded", async () => {
  // Aggiunto un elemento vuoto per il toast (opzionale)
  if (!$("toast-container")) {
    const toastDiv = document.createElement('div');
    toastDiv.id = 'toast-container';
    toastDiv.classList.add('hidden');
    document.body.appendChild(toastDiv);
  }
  
  initAdminToggles();

  // prova sessione esistente
  try {
    const isValid = await Backendless.UserService.isValidLogin();
    if (isValid) {
      const user = await Backendless.UserService.getCurrentUser();
      if (user) {
        // Recupera l'utente completo, inclusi i campi permessi
        const qb = Backendless.DataQueryBuilder.create().setWhereClause(`objectId = '${user.objectId}'`);
        const fullUser = await Backendless.Data.of(USER_TABLE).find(qb);
        
        currentUser = fullUser[0] || user;
        currentRole = currentUser.role || ROLES.CUSTOMER;
        await afterLogin();
        return;
      }
    }
  } catch (err) {
    console.warn("Nessuna sessione valida", err);
  }

  // se arrivo qui -> mostra login
  show($("login-view"));
  hide($("admin-view"));
  hide($("worker-view"));
});




