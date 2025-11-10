// Configurazione Backendless (sostituisci con le tue chiavi reali.)
const APPLICATION_ID = 'C2A5C327-CF80-4BB0-8017-010681F0481C';
const API_KEY = 'B266000F-684B-4889-9174-2D1734001E08';       

// Nomi delle tabelle
const USER_TABLE_NAME = "Users";
const ORDER_TABLE_NAME = "Orders";
const STORAGE_CONTAINER_NAME = "product_photos";

// STATI ORDINE
const STATUS_WAITING_PHOTO = "In attesa foto"; // 💡 NUOVA COSTANTE STRINGA SEPARATA (SOLUZIONE AL BLOCCO)
const STATUS = {
    IN_PHOTO_PROCESS: "Fotografia in corso",
    WAITING_POST_PRODUCTION: "In attesa post-produzione",
    IN_POST_PROCESS: "Post-produzione in corso",
    COMPLETED: "Completato",
    REJECTED: "Rifiutato/Ritorna a foto"
};

// Ruoli Utente (Devono coincidere con i ruoli Backendless)
const ROLES = {
    ADMIN: "Admin",
    PHOTOGRAPHER: "Photographer",
    POST_PRODUCER: "PostProducer"
    MAGAZZINO: "Magazzino",
    PARTNER: "Partner"
    FORNITORE: "Fornitore"		
	
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

// ----------------------------------------------------
// FUNZIONI DI UTILITY E UI
// ----------------------------------------------------

function showLoginArea(message = "") {
    document.getElementById('login-area').style.display = 'block';
    document.getElementById('worker-dashboard').style.display = 'none';
    document.getElementById('admin-dashboard').style.display = 'none';
    document.getElementById('worker-name').textContent = 'Ospite';
    document.getElementById('worker-role').textContent = 'Non Loggato';
    
    const status = document.getElementById('login-status');
    status.textContent = message;
    status.style.display = message ? 'block' : 'none';
    
    document.getElementById('scan-status').textContent = '';
    document.getElementById('photo-upload-area').style.display = 'none';
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

// ----------------------------------------------------
// AUTENTICAZIONE E GESTIONE UTENTI
// ----------------------------------------------------

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

function handleLoginSuccess(user) {
    currentUser = user;

    getRoleFromUser(user)
        .then(role => {
            currentRole = role;

            const displayName = user.name || user.email;
            document.getElementById('worker-name').textContent = displayName;
            document.getElementById('worker-role').textContent = currentRole;

            document.getElementById('login-area').style.display = 'none';

            if (currentRole === ROLES.ADMIN) {
                // Dashboard Admin
                document.getElementById('admin-dashboard').style.display = 'block';
                document.getElementById('worker-dashboard').style.display = 'none'; 
                loadUsersAndRoles(); 
                loadAllOrdersForAdmin();
            } else if (
                currentRole === ROLES.PHOTOGRAPHER || 
                currentRole === ROLES.POST_PRODUCER || 
                currentRole === ROLES.MAGAZZINO ||
                currentRole === ROLES.PARTNER ||
                currentRole === ROLES.FORNITORE
            ) {
                // Dashboard Worker generici
                document.getElementById('admin-dashboard').style.display = 'none'; 
                document.getElementById('worker-dashboard').style.display = 'block';
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

// ----------------------------------------------------
// FUNZIONI ADMIN (DASHBOARD)
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
        if (user.objectId === currentUser.objectId) return; 

        const row = tableBody.insertRow();
        row.insertCell().textContent = user.email;

        const currentRoleCell = row.insertCell();
        currentRoleCell.textContent = user.role || 'Nessun Ruolo';
        
        const actionCell = row.insertCell();
        actionCell.classList.add('action-cell');

        const roleSelect = document.createElement('select');
        roleSelect.className = 'w-1/2 p-2 border border-gray-300 rounded-md text-sm';
        Object.values(ROLES).filter(r => r !== ROLES.ADMIN).forEach(role => {
            const option = document.createElement('option');
            option.value = role;
            option.textContent = role;
            if (user.role === role) {
                option.selected = true;
            }
            roleSelect.appendChild(option);
        });
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Salva Ruolo';
        saveButton.className = 'btn-success text-xs py-1 px-2 mr-2';
        saveButton.onclick = () => updateRole(user.objectId, roleSelect.value);
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Elimina';
        deleteButton.className = 'btn-danger text-xs py-1 px-2';
        deleteButton.onclick = () => deleteUser(user.objectId, user.email);

        actionCell.appendChild(roleSelect);
        actionCell.appendChild(saveButton);
        actionCell.appendChild(deleteButton);
    });
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
    if (userId === currentUser.objectId) {
        showStatusMessage('user-creation-status', 'Non puoi modificare il tuo ruolo tramite questo pannello.', false);
        return;
    }

    const userUpdate = {
        objectId: userId,
        role: newRole
    };
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


function handleUserCreation() {
    const email = document.getElementById('new-user-email').value.trim();
    const password = document.getElementById('new-user-password').value;
    const role = document.getElementById('new-user-role').value;
    if (!email || !password || !role) {
        showStatusMessage('user-creation-status', 'Per favore, compila tutti i campi per il nuovo utente.', false);
        return;
    }

    Backendless.UserService.register({
        email: email,
        password: password
    })
    .then(newUser => {
        const userUpdate = {
            objectId: newUser.objectId,
            role: role 
        };

        return Backendless.Data.of(USER_TABLE_NAME).save(userUpdate);
    })
    .then(() => {
        showStatusMessage('user-creation-status', `Utente ${email} creato e ruolo ${role} assegnato con successo.`, true);
        document.getElementById('new-user-email').value = '';
        document.getElementById('new-user-password').value = '';
        document.getElementById('new-user-role').value = '';
        loadUsersAndRoles(); 
    })
    .catch(error => {
        console.error("Errore creazione utente:", error);
        showStatusMessage('user-creation-status', `Creazione Utente Fallita: ${error.message}`, false);
    });
}


// ----------------------------------------------------
// FUNZIONI DI UPLOAD FILE ADMIN
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



/**
 * Mostra la card di modifica ordine per Admin e popola i campi
 * @param {Object} order - Oggetto ordine da Backendless
 */
function openAdminOrderCard(order) {
    if (!order || !order.eanCode) return;

    // Mostra la card
    const card = document.getElementById('admin-order-edit-card');
    card.classList.remove('hidden');

    // Mostra EAN nell'intestazione
    document.getElementById('admin-ean-display').textContent = order.eanCode;

    // Mappa campi HTML -> proprietà Backendless
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
        if (el) {
            el.value = order[prop] || '';
        }
    });

    // Salva l'ID dell'ordine corrente per saveAdminOrderUpdates
    currentAdminOrder = order;
}



// ----------------------------------------------------
// FUNZIONI GESTIONE ORDINI (ADMIN)
// ----------------------------------------------------
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

    // Timestamp aggiornamento
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


// ----------------------------------------------------
// FUNZIONI CHIUSURA CARD (ADMIN)
// ----------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  const toggleUsers = document.getElementById('toggle-users-card');
  const toggleImport = document.getElementById('toggle-import-card');
  const usersCard = document.getElementById('card-users');
  const importCard = document.getElementById('card-import');

  // === Card Gestione Utenti ===
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

  // === Card Import Excel ===
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
});



function cancelAdminOrderEdit() {
    const editCard = document.getElementById('admin-order-edit-card');
    const ordersCard = document.getElementById('orders-admin-card'); // usa ID sicuro

    // Nasconde card modifica
    editCard.classList.add('hidden');
    currentAdminOrder = null;

    // Mostra di nuovo la lista ordini
    if (ordersCard) ordersCard.classList.remove('hidden');

    // Pulisce tutti i campi della card di modifica
    const fields = editCard.querySelectorAll('input, textarea, select');
    fields.forEach(f => f.value = '');
}

function highlightUpdatedRow(objectId) {
    const table = document.getElementById('admin-orders-table');
    if (!table) return;

    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
        if (row.dataset.objectid === objectId) {
            // Effetto flash verde
            row.style.transition = 'background-color 0.5s ease';
            row.style.backgroundColor = '#d1fae5'; // verde chiaro Tailwind (emerald-100)
            setTimeout(() => {
                row.style.backgroundColor = '';
            }, 1500);
        }
    });
}	


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


/**
 * Carica tutti gli ordini da Backendless e li mostra nella tabella Admin
 */
async function loadAllOrdersForAdmin() {
    const loadingEl = document.getElementById('loading-orders');
    const table = document.getElementById('admin-orders-table');
    const tbody = table.querySelector('tbody');
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Modifica';
    editBtn.className = 'btn-primary py-1 px-2';
    editBtn.onclick = () => openAdminOrderCard(order);	

    loadingEl.textContent = "Caricamento ordini in corso...";
    tbody.innerHTML = "";
    table.classList.add('hidden');

    try {
        const orders = await Backendless.Data.of(ORDER_TABLE_NAME).find({ sortBy: ['lastUpdated DESC'] });

        if (!orders || orders.length === 0) {
            loadingEl.textContent = "Nessun ordine trovato.";
            return;
        }

        orders.forEach(order => {
            const tr = document.createElement('tr');
            tr.classList.add('hover:bg-gray-100', 'cursor-pointer');

            tr.innerHTML = `
                <td class="px-4 py-2">${order.eanCode || ''}</td>
                <td class="px-4 py-2">${order.brand || ''}</td>
                <td class="px-4 py-2">${order.styleName || ''}</td>
                <td class="px-4 py-2">${order.category || ''}</td>
                <td class="px-4 py-2">
                    <button class="btn-primary px-3 py-1 text-sm" onclick='handleAdminEdit(${JSON.stringify(order).replace(/"/g,'&quot;')})'>Modifica</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        loadingEl.style.display = 'none';
        table.classList.remove('hidden');
    } catch (err) {
        console.error(err);
        loadingEl.textContent = "Errore durante il caricamento ordini.";
    }
}


function handleAdminEdit(order) {
    // 1️⃣ Nascondi lista ordini
    const ordersCard = document.getElementById('orders-admin-card');
    if (ordersCard) ordersCard.style.display = 'none';

    // 2️⃣ Popola form/modale con i dati dell'ordine
    openAdminOrderCard(order);

    // 3️⃣ Override dei pulsanti Salva / Annulla nella modale
    const saveBtn = document.getElementById('admin-order-save-btn');
    const cancelBtn = document.getElementById('admin-order-cancel-btn');

    if (saveBtn) {
        saveBtn.onclick = async () => {
            await saveAdminOrderChanges(order); // salva le modifiche su Backendless
            closeAdminEditCard();
        };
    }

    if (cancelBtn) {
        cancelBtn.onclick = () => closeAdminEditCard();
    }
}

function closeAdminEditCard() {
    const ordersCard = document.getElementById('orders-admin-card');
    if (ordersCard) ordersCard.style.display = 'block';

    // Ricarica la lista ordini admin
    loadAllOrdersForAdmin();
}


// ----------------------------------------------------
// FUNZIONI WORKER (DASHBOARD)
// ----------------------------------------------------

function loadOrdersForUser(role) {
    const tableBody = document.querySelector('#orders-table tbody');
    const loadingText = document.getElementById('loading-orders');

    loadingText.textContent = `Caricamento ordini per il ruolo ${role}...`;
    tableBody.innerHTML = '';
    
    let whereClause = '';
    if (role === ROLES.PHOTOGRAPHER) {
        whereClause = `status = '${STATUS_WAITING_PHOTO}'`; // 💡 USA LA NUOVA COSTANTE
    } else if (role === ROLES.POST_PRODUCER) {
        whereClause = `status = '${STATUS.WAITING_POST_PRODUCTION}'`;
    } else {
        tableBody.innerHTML = '<tr><td colspan="11">Ruolo non valido per la visualizzazione ordini.</td></tr>';
        return;
    }

    const queryBuilder = Backendless.DataQueryBuilder.create()
        .setWhereClause(whereClause)
        .setSortBy(['lastUpdated DESC'])
        .setPageSize(50);
    Backendless.Data.of(ORDER_TABLE_NAME).find(queryBuilder)
        .then(orders => {
            if (!orders || orders.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="11">Nessun ordine da visualizzare.</td></tr>';
                loadingText.textContent = '';
                return;
            }

            loadingText.textContent = '';
            document.getElementById('worker-role-display-queue').textContent = role;

            orders.forEach(order => {
                const row = tableBody.insertRow();

                row.insertCell().textContent = order.productCode || '';
                row.insertCell().textContent = order.eanCode || '';
                row.insertCell().textContent = order.styleName || '';
                row.insertCell().textContent = order.styleGroup || '';
                row.insertCell().textContent = order.brand || '';
                row.insertCell().textContent = order.color || '';
                row.insertCell().textContent = order.size || '';
                row.insertCell().textContent = order.category || '';
                row.insertCell().textContent = order.gender || '';
                row.insertCell().textContent = order.status || '';
                
                const actionCell = row.insertCell();
                actionCell.classList.add('action-cell');

                const viewBtn = document.createElement('button');
                viewBtn.textContent = 'Visualizza Foto';
                viewBtn.className = 'btn-primary text-xs py-1 px-2';
                viewBtn.onclick = () => openPhotoModal(order.eanCode);

                actionCell.appendChild(viewBtn);
            });
        })
        .catch(error => {
            console.error("Errore nel caricamento ordini:", error);
            tableBody.innerHTML = `<tr><td colspan="11">Errore nel caricamento ordini: ${error.message}</td></tr>`;
            loadingText.textContent = '';
        });
}

function openPhotoModal(eanCode) {
    document.getElementById('photo-modal').style.display = 'block';
    document.getElementById('modal-ean-title').textContent = eanCode || '';
    const modalContent = document.getElementById('photo-modal-content');
    modalContent.innerHTML = `<p>Caricamento foto per EAN: ${eanCode}...</p>`;
}

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
    photoUploadArea.style.display = 'none';
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
      photoUploadArea.style.display = 'none';
      return;
    }

    const order = orders[0];
    scanStatus.textContent = `✅ Codice ${eanInput} trovato. Compila o aggiorna i dati operativi.`;
    scanStatus.className = "status-message status-success";
    
    actionsArea.classList.remove("hidden");
    if (currentEanDisplay) currentEanDisplay.textContent = eanInput; 

    if (currentRole === ROLES.PHOTOGRAPHER) {
        photoUploadArea.style.display = 'block';
        const uploadEanDisplay = document.getElementById("current-ean-display-upload");
        if(uploadEanDisplay) uploadEanDisplay.textContent = eanInput;
    } else {
        photoUploadArea.style.display = 'none';
    }

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
    Object.entries(map).forEach(([inputId, key]) => {
      const el = document.getElementById(inputId);
      if (el) el.value = order[key] || "";
    });
    
    currentEanInProcess = { objectId: order.objectId, ean: eanInput };
  } catch (err) {
    console.error(err);
    scanStatus.textContent = "Errore durante la verifica EAN.";
    scanStatus.className = "status-message status-error";
    actionsArea.classList.add("hidden");
    photoUploadArea.style.display = 'none';
  }
}

// 💾 Salva i dati operativi aggiornati su Backendless
async function saveEanUpdates() {
    // Controlla che ci sia un EAN attivo (ACCESSO DIRETTO ALLA VARIABILE GLOBALE)
    if (!currentEanInProcess || !currentEanInProcess.objectId) {
        showFeedback("⚠️ Nessun EAN attivo. Scannerizza un codice prima.", 'error');
        return;
    }

    const ean = currentEanInProcess.ean;
    const objectId = currentEanInProcess.objectId;
    
    // Mappa campi HTML → colonne Backendless (Mappa dal tuo codice)
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
    
    // Costruisci l’oggetto aggiornato
    const updatedOrder = { objectId };
    Object.entries(map).forEach(([inputId, key]) => {
        const el = document.getElementById(inputId);
        updatedOrder[key] = el ? el.value.trim() : '';
    });
    
    // Aggiungi timestamp di aggiornamento
    updatedOrder.lastUpdated = new Date();
    
    try {
        // Usa il nuovo sistema di feedback
        showFeedback("⏳ Salvataggio in corso...", 'info');
        
        await Backendless.Data.of("Orders").save(updatedOrder);

        // Successo
        showFeedback(`✅ Aggiornamenti per ${ean} salvati correttamente!`, 'success');
        
        // Ricarica dell'interfaccia dopo 1 secondo
        setTimeout(async () => {
            resetEanActionState(false); 
            
            // 🔥 CORREZIONE DEL BUG RUOLO PERDUTO
            try {
                // Ricarica l'oggetto utente COMPLETO dalla sessione corrente
                const updatedUser = await Backendless.UserService.getCurrentUser();
                
                // Estrai la stringa del ruolo
                const reloadedRole = await getRoleFromUser(updatedUser); 
                
                // Aggiorna la variabile globale del ruolo
                currentRole = reloadedRole; // <--- ACCESSO DIRETTO
                
                // Chiama la funzione di caricamento ordini PASSANDO LA STRINGA del ruolo
                loadOrdersForUser(reloadedRole); 
            } catch (err) {
                console.error("Errore critico nel ricaricare l'utente/ruolo dopo il salvataggio:", err);
                // Fallback: ricarica con il ruolo globale se ancora valido
                loadOrdersForUser(currentRole); 
            }
        }, 1000); 

    } catch (err) {
        console.error("Errore durante il salvataggio:", err);
        // Errore
        showFeedback(`❌ Errore durante il salvataggio su Backendless. ${err.message || ''}`, 'error');
    }
}

/* ======================================================
   NUOVE UTILITY PER IL FEEDBACK
   ====================================================== */

/**
 * Mostra un messaggio di feedback con stile specifico e lo nasconde dopo 3 secondi.
 * @param {string} message Il testo da mostrare.
 * @param {string} type 'success', 'error', o 'info'.
 */
function showFeedback(message, type) {
  const feedbackElement = document.getElementById('operation-feedback');
  if (!feedbackElement) return console.error("⚠️ Elemento #operation-feedback non trovato.");

  // Rimuovi tutti gli stili precedenti
  feedbackElement.classList.remove('status-success', 'status-error', 'status-info', 'hidden');

  // Applica lo stile corretto
  feedbackElement.textContent = message;
  feedbackElement.classList.add(`status-${type}`);

  // 🔥 Forza la visibilità
  feedbackElement.style.display = 'block';

  // Nasconde dopo 3 secondi
  setTimeout(() => {
    feedbackElement.style.display = 'none';
  }, 3000);
}

/**
 * Resetta l'interfaccia di azione EAN allo stato iniziale.
 * @param {boolean} showCancelFeedback Se true, mostra un messaggio di annullamento.
 */
function resetEanActionState(showCancelFeedback = false) {
    // 1. Nasconde/mostra gli elementi
    document.getElementById('ean-actions-area').classList.add('hidden');
    document.getElementById('photo-upload-area').classList.add('hidden');
    document.getElementById('confirm-ean-btn').classList.remove('hidden');

    // 2. Resetta i campi di input EAN
    document.getElementById('ean-input').value = '';

    // 3. Feedback visivo se l'utente ha premuto Annulla/Chiudi Dettaglio
    if (showCancelFeedback) {
        showFeedback("Operazione di aggiornamento annullata.", 'info'); 
    }
}


function handlePhotoUploadAndCompletion() {
    alert("Funzione di upload non ancora implementata!");
}

function closePhotoModal() {
    document.getElementById('photo-modal').style.display = 'none';
}




/**
 * Carica e mostra gli ordini nella card "Riepilogo Ordini" con filtri.
 * @param {Object} filters - Oggetto contenente i filtri: {status, role, ean}
 */
async function loadSummaryOrders(filters = {}) {
    const tbody = document.getElementById('summary-orders-table').querySelector('tbody');
    tbody.innerHTML = ''; // svuota la tabella prima di riempirla

    try {
        // Configurazione della query Backendless
        let whereClauses = [];

        if (filters.status) {
            whereClauses.push(`stato = '${filters.status}'`);
        }
        if (filters.role) {
            whereClauses.push(`assegnatoARuolo = '${filters.role}'`);
        }
        if (filters.ean) {
            whereClauses.push(`EAN LIKE '%${filters.ean}%'`);
        }

        const whereClause = whereClauses.length > 0 ? whereClauses.join(' AND ') : '';

        // Recupero dati da Backendless
        const result = await Backendless.Data.of("Orders").find({ where: whereClause });

        if (result.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="8" class="text-center py-2">Nessun ordine trovato</td>`;
            tbody.appendChild(tr);
            return;
        }

        // Popola la tabella
        result.forEach(order => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="border px-2 py-1 text-sm">${order.EAN || ''}</td>
                <td class="border px-2 py-1 text-sm">${order.codiceArticolo || ''}</td>
                <td class="border px-2 py-1 text-sm">${order.brand || ''}</td>
                <td class="border px-2 py-1 text-sm">${order.stile || ''}</td>
                <td class="border px-2 py-1 text-sm">${order.categoria || ''}</td>
                <td class="border px-2 py-1 text-sm">${order.genere || ''}</td>
                <td class="border px-2 py-1 text-sm">${order.stato || ''}</td>
                <td class="border px-2 py-1 text-sm">${order.assegnatoARuolo || ''}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Errore caricamento ordini:", error);
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="8" class="text-center py-2 text-red-600">Errore nel caricamento degli ordini</td>`;
        tbody.appendChild(tr);
    }
}


function openSummaryOrdersCard() {
    // 1️⃣ Nasconde tutte le card principali
    const cards = document.querySelectorAll('.dashboard-card');
    cards.forEach(card => {
        card.style.display = 'none';
    });

    // 2️⃣ Mostra la card riepilogo
    const summaryCard = document.getElementById('summary-orders-card');
    if (summaryCard) {
        summaryCard.style.display = 'block';
    } else {
        console.error("Elemento #summary-orders-card non trovato.");
        return;
    }

    // 3️⃣ Resetta i filtri
    const filterStatus = document.getElementById('filter-status');
    const filterRole = document.getElementById('filter-role');
    const filterEan = document.getElementById('filter-ean');

    if (filterStatus) filterStatus.value = '';
    if (filterRole) filterRole.value = '';
    if (filterEan) filterEan.value = '';

    // 4️⃣ Carica tutti gli ordini senza filtri inizialmente
    loadSummaryOrders();
}

// Collega il pulsante alla funzione
const summaryBtn = document.getElementById('open-summary-btn');
if (summaryBtn) {
    summaryBtn.addEventListener('click', openSummaryOrdersCard);
} else {
    console.error("Pulsante #open-summary-btn non trovato.");
}



// Event listener bottone Riepilogo
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('open-summary-btn').onclick = openSummaryOrdersCard;
  document.getElementById('apply-filters-btn').onclick = () => {
    const status = document.getElementById('filter-status').value;
    const role = document.getElementById('filter-role').value;
    const ean = document.getElementById('filter-ean').value.trim();
    loadSummaryOrders({ status, role, ean });
  };
});


// ----------------------------------------------------
// GESTIONE INIZIALE
// ----------------------------------------------------

// Controlla lo stato di autenticazione all'avvio
window.onload = function() {
    Backendless.UserService.isValidLogin()
        .then(isValid => {
            if (isValid) {
                return Backendless.UserService.getCurrentUser()
                    .then(user => {
                        if (!user || !user.role) {
                             return user;
                        }
                        return user;
                    });
            } else {
                showLoginArea();
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

