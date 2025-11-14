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
