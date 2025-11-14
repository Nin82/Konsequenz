// =====================================================
//  CONFIGURAZIONE BACKENDLESS
// =====================================================

const APP_ID = "C2A5C327-CF80-4BB0-8017-010681F0481C";
const API_KEY = "B266000F-684B-4889-9174-2D1734001E08";

const ORDER_TABLE = "Orders";
const USER_TABLE = "Users";

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



// =====================================================
// PIPELINE STATI ORDINI
// =====================================================

const ORDER_STATES = {
  WAREHOUSE_PENDING: "warehouse_pending",
  PHOTO_PENDING: "photo_pending",
  POST_PENDING: "post_pending",
  ADMIN_VALIDATION: "admin_validation",
  COMPLETED: "completed",
};

// Ruolo → stato successivo + ruolo assegnatario
const PIPELINE_FLOW = {
  Warehouse: {
    nextState: ORDER_STATES.PHOTO_PENDING,
    assignToRole: "Photographer",
  },

  Photographer: {
    nextState: ORDER_STATES.POST_PENDING,
    assignToRole: "PostProducer",
  },

  PostProducer: {
    nextState: ORDER_STATES.ADMIN_VALIDATION,
    assignToRole: "Admin",
  },

  Admin: {
    nextState: ORDER_STATES.COMPLETED,
    assignToRole: "Admin",
  },
};



// Per i box colorati stats
const STATUS_COLORS = {
  [ORDER_STATES.WAREHOUSE_PENDING]: "bg-amber-50 text-amber-700 border-amber-200",
  [ORDER_STATES.PHOTO_PENDING]: "bg-sky-50 text-sky-700 border-sky-200",
  [ORDER_STATES.POST_PENDING]: "bg-indigo-50 text-indigo-700 border-indigo-200",
  [ORDER_STATES.ADMIN_VALIDATION]: "bg-orange-50 text-orange-700 border-orange-200", // Aggiunto per coerenza
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
let permissionsEditingUser = null;
let statsChartInstance = null;
let currentPermissionUser = null;

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

function toast(msg, type = "info") {
  console.log("[TOAST]", type, msg);
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
//  LOGIN / LOGOUT
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

    currentUser = user;
    currentRole = user.role || ROLES.CUSTOMER;

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

  if (currentRole === ROLES.ADMIN) {
    show($("sidebar"));
    show($("nav-admin"));
    hide($("nav-worker"));

    show($("admin-view"));
    hide($("worker-view"));

    await loadUsersList();
    await loadAdminOrders();
    await loadAdminStats();
  } else {
    show($("sidebar"));
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
//  GESTIONE UTENTI ADMIN
// =====================================================



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
    const newUser = await Backendless.UserService.register({
      email,
      password: pw,
      role,
    });

    statusEl.textContent = `Utente ${email} creato.`;
    statusEl.className = "text-xs mt-1 text-emerald-600";

    $("new-user-email").value = "";
    $("new-user-password").value = "";
    $("new-user-role").value = "";

    await loadUsersList();
  } catch (err) {
    console.error("Errore creazione utente", err);
    statusEl.textContent = err.message || "Errore creando l'utente.";
    statusEl.className = "text-xs mt-1 text-rose-600";
  }
}

// ===== MODALE PERMESSI =====

function openPermissionsModal(user) {
    currentPermissionUser = user;

    // Set email header
    document.getElementById("permissions-user-email").textContent = user.email;

    // Parsing valori user
    // Assicurati che visibleFields e editableFields siano array, non stringhe JSON
    const visible = parseJsonField(user.visibleFields);
    const editable = parseJsonField(user.editableFields);

    // Container
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

    // Mostra modale
    document.getElementById("permissions-modal").classList.remove("hidden");
}

function closePermissionsModal() {
  currentPermissionUser = null;
  hide($("permissions-modal"));
}


async function saveUserPermissions() {
    const modal = document.getElementById("permissions-modal");
    const statusEl = document.getElementById("permissions-status");

    if (!currentPermissionUser) return;

    // Reset status
    statusEl.textContent = "Salvataggio in corso...";
    statusEl.classList.remove("hidden", "text-green-600", "text-red-600");
    statusEl.classList.add("text-slate-600");

    try {
        const visible = [];
        const editable = [];

        // Raccogli i campi dalle checkbox basate su ORDER_FIELDS
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
            loadUsersList(); // Ricarica la lista utenti
        }, 700);

    } catch (err) {
        console.error("Errore salvataggio permessi", err);
        statusEl.textContent = "Errore durante il salvataggio: " + (err.message || "");
        statusEl.classList.remove("text-slate-600");
        statusEl.classList.add("text-rose-600");
    }
}

async function saveUserPermissions() {
  if (!permissionsEditingUser) return;

  const visible = [];
  const editable = [];

  ORDER_FIELDS.forEach((f) => {
    const vis = $(`vis-${f.key}`);
    const ed = $(`ed-${f.key}`);
    if (vis && vis.checked) visible.push(f.key);
    if (ed && ed.checked) editable.push(f.key);
  });

  const statusEl = $("permissions-status");
  statusEl.classList.remove("hidden");
  statusEl.className = "text-xs mt-2 text-slate-600";
  statusEl.textContent = "Salvataggio in corso...";

  try {
    await Backendless.Data.of(USER_TABLE).save({
      objectId: permissionsEditingUser.objectId,
      visibleFields: JSON.stringify(visible),
      editableFields: JSON.stringify(editable),
    });

    statusEl.textContent = "Permessi salvati.";
    statusEl.className = "text-xs mt-2 text-emerald-600";

    setTimeout(() => closePermissionsModal(), 700);
  } catch (err) {
    console.error("Errore salvataggio permessi", err);
    statusEl.textContent = err.message || "Errore salvando i permessi.";
    statusEl.className = "text-xs mt-2 text-rose-600";
  }
}


async function saveUserPermissions() {
  const modal = document.getElementById("permissions-modal");
  const statusEl = document.getElementById("permissions-status");

  try {
    const visible = [];
    const editable = [];

    document.querySelectorAll("[data-field-visible]").forEach(ch => {
      if (ch.checked) visible.push(ch.getAttribute("data-field-visible"));
    });

    document.querySelectorAll("[data-field-edit]").forEach(ch => {
      if (ch.checked) editable.push(ch.getAttribute("data-field-edit"));
    });

    currentPermissionUser.visibleFields = visible;
    currentPermissionUser.editableFields = editable;

    await Backendless.Data.of("Users").save(currentPermissionUser);

    statusEl.textContent = "Permessi salvati con successo ✔";
    statusEl.classList.remove("hidden");
    statusEl.classList.add("text-green-600");

    setTimeout(() => {
      modal.classList.add("hidden");
      statusEl.classList.add("hidden");
      loadUsersList();
    }, 600);

  } catch (err) {
    console.error("Errore salvataggio permessi", err);
    statusEl.textContent = "Errore durante il salvataggio";
    statusEl.classList.remove("hidden");
    statusEl.classList.add("text-red-600");
  }
}

// =====================================================
//  IMPORT EXCEL
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

      // Recupera il MAGAZZINIERE per assegnazione automatica
      let warehouseUser = null;
      try {
        const qbUser = Backendless.DataQueryBuilder.create()
          .setWhereClause("role = 'Warehouse'")
          .setPageSize(1);

        const users = await Backendless.Data.of("Users").find(qbUser);
        warehouseUser = users.length > 0 ? users[0] : null;
      } catch (e) {
        console.warn("Impossibile recuperare magazziniere", e);
      }

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];

        const productCode = r["Codice Articolo"] || r["productCode"] || "";
        const ean = r["Ean Code"] || r["eanCode"] || "";

        if (!productCode && !ean) {
          logEl.textContent += `⚠ Riga ${i + 1}: nessun Codice Articolo/EAN.\n`;
          err++;
          continue;
        }

        // Controllo duplicato
        const qb = Backendless.DataQueryBuilder.create()
          .setWhereClause(buildWhereEquals("productCode", productCode))
          .setPageSize(1);

        const existing = await Backendless.Data.of("Orders").find(qb);
        if (existing.length > 0) {
          logEl.textContent += `❌ Duplicato: ${productCode}\n`;
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

          // 🔥 Pipeline automatica → parte dal Magazzino
          status: ORDER_STATES.WAREHOUSE_PENDING,
          assignedToRole: "Warehouse",
          assignedToEmail: warehouseUser ? warehouseUser.email : "",

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

      statusEl.textContent = `Importazione completata: ${ok} ok, ${dup} duplicati, ${err} errori.`;
      statusEl.className = "text-xs text-emerald-600";

      // aggiorna viste admin
      await loadAdminOrders();
      await loadAdminStats();

      // reset input file
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
//  ORDINI ADMIN – TABELLONE + MODALE
// =====================================================

function getVisibleFieldsForAdminTable() {
  // Admin vede sempre TUTTI i campi + status + assignedToEmail
  return [
    "productCode",
    "eanCode",
    "brand",
    "color",
    "size",
    "status",
    "assignedToEmail",
  ];
}

async function loadWorkerOrders() {
    const loading = $("worker-orders-loading");
    const header = $("worker-orders-header");
    const body = $("worker-orders-body");

    loading.textContent = "Caricamento…";
    header.innerHTML = "";
    body.innerHTML = "";
    
    const workerRole = currentUser.role;
    let allOrders = []; // Array per accumulare tutti i risultati
    const MAX_PAGE_SIZE = 100; 
    let offset = 0;
    let ordersChunk;

    try {
        // Implementazione della paginazione (ciclo do...while)
        do {
            // Mostra solo ordini assegnati a questo utente
            const qb = Backendless.DataQueryBuilder.create()
                .setWhereClause(buildWhereEquals("assignedToEmail", currentUser.email))
                .setPageSize(MAX_PAGE_SIZE) // Limite Backendless
                .setOffset(offset)          // 0, 100, 200, ecc.
                .setSortBy(["lastUpdated DESC"]);

            ordersChunk = await Backendless.Data.of(ORDER_TABLE).find(qb);

            allOrders.push(...ordersChunk); // Aggiunge i risultati
            offset += MAX_PAGE_SIZE;      // Incrementa l'offset per la prossima pagina
            
        } while (ordersChunk.length === MAX_PAGE_SIZE); // Continua finché la pagina è piena


        const orders = allOrders; // 'orders' contiene TUTTI i record


        // Determina i campi visibili per questo ruolo
        const defaultVisible = ["productCode", "eanCode", "status"];
        // Assicurati che currentUser.visibleFields sia parsato correttamente (da stringa JSON)
        const visibleFields = parseJsonField(currentUser.visibleFields); 
        
        // Filtra i campi da mostrare in base alla configurazione del ruolo
        const fieldsToShow = ORDER_FIELDS.filter((f) =>
            visibleFields.length > 0 ? visibleFields.includes(f.key) : defaultVisible.includes(f.key)
        );
        
        // Determina se il worker ha permessi di modifica per mostrare il bottone "Modifica"
        const editableFields = parseJsonField(currentUser.editableFields);
        const hasEditPermission = editableFields.length > 0;
        
        // Determina il testo del bottone "Avanza"
        const advanceBtnText = PIPELINE_FLOW[workerRole]?.nextState ? 
            `Avanza a ${PIPELINE_FLOW[workerRole].nextState.replace('_', ' ').toUpperCase()}` : 
            'Avanza a FINE';


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
                     // Logica per il badge di stato colorato
                     const colorClass = STATUS_COLORS[o.status] || 'bg-slate-50 text-slate-600 border-slate-200';
                     td.innerHTML = `<span class="inline-block px-2 py-0.5 rounded-full text-[10px] ${colorClass}">${o.status.replace('_', ' ') || ''}</span>`;
                } else if (f.key === 'lastUpdated') {
                    td.textContent = o[f.key] ? new Date(o[f.key]).toLocaleDateString('it-IT') : "";
                } else {
                     td.textContent = o[f.key] || "";
                }
                tr.appendChild(td);
            });

            // BOTTONI AZIONI
            const tdAct = document.createElement("td");
            tdAct.className = "px-3 py-2 space-x-1 whitespace-nowrap";

            // Bottone Modifica (mostrato solo se l'utente ha permessi di modifica su almeno un campo)
            if (hasEditPermission) {
                const btnEdit = document.createElement("button");
                btnEdit.className = "btn-secondary text-[10px]";
                btnEdit.textContent = "Modifica";
                btnEdit.onclick = () => openOrderModal(o.objectId);
                tdAct.appendChild(btnEdit);
            }
            
            // Bottone Avanza
            const btnAdvance = document.createElement("button");
            btnAdvance.className = "btn-primary text-[10px]";
            btnAdvance.textContent = advanceBtnText;
            btnAdvance.onclick = () => advanceOrder(o.objectId);
            
            // Mostra Avanza solo se l'ordine è assegnato a lui E non è Admin Validation/Completed
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

// ===== MODALE ORDINE =====

async function openOrderModal(objectId) {
  const order = adminOrdersCache.find((o) => o.objectId === objectId);
  if (!order) {
    alert("Ordine non trovato nella cache.");
    return;
  }

  currentOrderEditing = order;
  setText("order-modal-id", objectId);

  const container = $("order-modal-fields");
  container.innerHTML = "";

  ORDER_FIELDS.forEach((f) => {
    const val = order[f.key] || "";

    const wrapper = document.createElement("div");
    wrapper.className = "flex flex-col gap-1";

    const label = document.createElement("label");
    label.className = "text-[11px] font-medium text-slate-600";
    label.textContent = f.label;
    wrapper.appendChild(label);

    let control;

    if (f.type === "textarea") {
      control = document.createElement("textarea");
      control.rows = 3;
    } else if (f.type === "date-string") {
      control = document.createElement("input");
      control.type = "date";
      // se valore è tipo "2025-11-14" lo mettiamo, altrimenti lasciamo
      if (val && /^\d{4}-\d{2}-\d{2}/.test(val)) {
        control.value = val.substring(0, 10);
      }
    } else {
      control = document.createElement("input");
      control.type = "text";
      control.value = val;
    }

    control.id = `order-field-${f.key}`;
    control.className =
      "rounded border border-slate-300 px-2 py-1 text-[11px] bg-white";

    wrapper.appendChild(control);
    container.appendChild(wrapper);
  });

  $("order-modal-status").classList.add("hidden");
  show($("order-modal"));
}

function closeOrderModal() {
  currentOrderEditing = null;
  hide($("order-modal"));
}

function changeOrderStatusFromModal(newStatus) {
  const el = $("order-field-status");
  if (el) el.value = newStatus;
}

async function saveOrderFromModal() {
  if (!currentOrderEditing) return;

  const statusEl = $("order-modal-status");
  statusEl.classList.remove("hidden");
  statusEl.className = "text-xs mt-2 text-slate-600";
  statusEl.textContent = "Salvataggio in corso...";

  const update = { objectId: currentOrderEditing.objectId };

  ORDER_FIELDS.forEach((f) => {
    const input = $(`order-field-${f.key}`);
    if (!input) return;

    if (f.type === "date-string") {
      update[f.key] = input.value || "";
    } else {
      update[f.key] = input.value;
    }
  });

  update.lastUpdated = new Date();

  try {
    await Backendless.Data.of(ORDER_TABLE).save(update);
    statusEl.textContent = "Ordine aggiornato.";
    statusEl.className = "text-xs mt-2 text-emerald-600";

    await loadAdminOrders();
    await loadAdminStats();

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
    const order = await Backendless.Data.of("Orders").findById(orderId);
    if (!order) return alert("Ordine non trovato");

    const role = currentUser.role;
    const step = PIPELINE_FLOW[role];

    if (!step) return alert("Questo ruolo non può avanzare ordini.");

    // Aggiorna stato
    order.status = step.nextState;

    // Assegna automaticamente al ruolo successivo
    order.assignedToRole = step.assignToRole;

    // Assegna all'utente corretto SOLO se non è Admin
    if (step.assignToRole !== "Admin") {
      // Troviamo il primo utente con quel ruolo
      const qb = Backendless.DataQueryBuilder.create()
        .setWhereClause(`role = '${step.assignToRole}'`)
        .setPageSize(1);

      const users = await Backendless.Data.of("Users").find(qb);

      if (users.length > 0) {
        order.assignedToEmail = users[0].email;
      }
    }

    await Backendless.Data.of("Orders").save(order);

    alert("Ordine avanzato correttamente!");

    // Ricarica tabella
   if (currentUser.role === "Admin") loadAdminOrders();
else loadWorkerOrders();

  } catch (e) {
    console.error("Errore advanceOrder:", e);
    alert("Errore durante l'avanzamento dell'ordine.");
  }
}



// =====================================================
//  STATS
// =====================================================

async function loadAdminStats() {
  const container = $("stats-summary");
  container.innerHTML = "";

  try {
    const qb = Backendless.DataQueryBuilder.create()
      .setPageSize(100)
      .setSortBy(["status"]);

    const orders = await Backendless.Data.of(ORDER_TABLE).find(qb);

    const counts = {};
    orders.forEach((o) => {
      const st = o.status || "Senza stato";
      counts[st] = (counts[st] || 0) + 1;
    });

    Object.entries(counts).forEach(([status, count]) => {
      const colorClass = STATUS_COLORS[status] || "bg-slate-50 text-slate-700 border-slate-200";

      const div = document.createElement("div");
      div.className = `rounded-xl border px-4 py-3 ${colorClass}`;
      div.innerHTML = `
        <p class="text-xs font-semibold mb-1">${status}</p>
        <p class="text-2xl font-bold">${count}</p>
      `;
      container.appendChild(div);
    });

    // Chart
    const ctx = $("stats-chart").getContext("2d");
    const labels = Object.keys(counts);
    const data = Object.values(counts);

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
//  WORKER VIEW (bozza)
// =====================================================

async function loadWorkerOrders() {
  const loading = $("worker-orders-loading");
  const header = $("worker-orders-header");
  const body = $("worker-orders-body");

  loading.textContent = "Caricamento…";
  header.innerHTML = "";
  body.innerHTML = "";

  try {
    // Mostra solo ordini assegnati a questo utente
    const qb = Backendless.DataQueryBuilder.create()
      .setWhereClause(buildWhereEquals("assignedToEmail", currentUser.email))
      .setPageSize(100)
      .setSortBy(["lastUpdated DESC"]);

    const orders = await Backendless.Data.of(ORDER_TABLE).find(qb);

    // Determina i campi visibili per questo ruolo
    const visibleFields = parseJsonField(currentUser.visibleFields);
    const fields = ORDER_FIELDS.filter((f) =>
      visibleFields.length > 0 ? visibleFields.includes(f.key) : true
    );

    // ==========================
    // HEADER TABELLA
    // ==========================
    fields.forEach((f) => {
      const th = document.createElement("th");
      th.className = "th";
      th.textContent = f.label;
      header.appendChild(th);
    });

    const thStatus = document.createElement("th");
    thStatus.className = "th";
    thStatus.textContent = "Stato";
    header.appendChild(thStatus);

    const thAdvance = document.createElement("th");
    thAdvance.className = "th";
    thAdvance.textContent = "Avanza";
    header.appendChild(thAdvance);

    // ==========================
    // RIGHE ORDINI
    // ==========================
    orders.forEach((o) => {
      const tr = document.createElement("tr");
      tr.className = "hover:bg-slate-50 text-[11px]";

      // colonne dei campi
      fields.forEach((f) => {
        const td = document.createElement("td");
        td.className = "px-3 py-2";
        td.textContent = o[f.key] || "";
        tr.appendChild(td);
      });

      // stato
      const tdSt = document.createElement("td");
      tdSt.className = "px-3 py-2";
      tdSt.textContent = o.status || "";
      tr.appendChild(tdSt);

      // BOTTONE AVANZA
      const tdBtn = document.createElement("td");
      tdBtn.className = "px-3 py-2";

      const btn = document.createElement("button");
      btn.className = "btn-primary text-[10px]";
      btn.textContent = "Avanza";
      btn.onclick = () => advanceOrder(o.objectId);

      tdBtn.appendChild(btn);
      tr.appendChild(tdBtn);

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
//  MODALE CAMBIO RUOLO UTENTE (NUOVO BLOCCO)
// =====================================================

let roleChangeUserId = null;

// Apre la modale
function openChangeRoleModal(userId, currentRole) {
  roleChangeUserId = userId;

  const modal = document.getElementById("role-change-modal");
  const select = document.getElementById("role-change-select");

  select.value = currentRole || "";

  modal.classList.remove("hidden");
}

// Chiude
function closeChangeRoleModal() {
  roleChangeUserId = null;
  document.getElementById("role-change-modal").classList.add("hidden");
}

// Salva il nuovo ruolo
async function confirmRoleChange() {
  if (!roleChangeUserId) return;

  const newRole = document.getElementById("role-change-select").value;
  if (!newRole) {
    alert("Seleziona un ruolo valido!");
    return;
  }

  try {
    const user = await Backendless.Data.of("Users").findById(roleChangeUserId);
    user.role = newRole;

    await Backendless.Data.of("Users").save(user);

    closeChangeRoleModal();

    alert("Ruolo aggiornato con successo.");
    loadUsersList(); // refresh tabella utenti

  } catch (err) {
    console.error("Errore cambio ruolo", err);
    alert("Errore durante il salvataggio.");
  }
}

async function loadUsersList() {
  const tbody = document.getElementById("users-table-body");
  const loading = document.getElementById("users-loading");

  tbody.innerHTML = "";
  loading.textContent = "Caricamento…";

  try {
    const qb = Backendless.DataQueryBuilder.create()
      .setWhereClause("email != null")
      .setSortBy(["email ASC"])
      .setPageSize(100);

    const users = await Backendless.Data.of("Users").find(qb);

    loading.textContent = "";

    users.forEach((u) => {
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

      const roles = [
        "Admin",
        "Warehouse",
        "Photographer",
        "PostProducer",
        "Partner",
        "Customer"
      ];

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
    const user = await Backendless.Data.of("Users").findById(userId);
    user.role = newRole;

    await Backendless.Data.of("Users").save(user);

    showToast("Ruolo aggiornato");
  } catch (err) {
    console.error("Errore cambio ruolo", err);
    showToast("Errore aggiornamento ruolo", "error");
  }
}

// =====================================================
//  INIT
// =====================================================

window.addEventListener("DOMContentLoaded", async () => {
  initAdminToggles();

  // prova sessione esistente
  try {
    const isValid = await Backendless.UserService.isValidLogin();
    if (isValid) {
      const user = await Backendless.UserService.getCurrentUser();
      if (user) {
        currentUser = user;
        currentRole = user.role || ROLES.CUSTOMER;
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


