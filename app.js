// Configurazione Backendless (sostituisci con le tue chiavi reali)
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
    // Mostra solo area login
    const loginArea = document.getElementById('login-area');
    const workerDashboard = document.getElementById('worker-dashboard');
    const adminDashboard = document.getElementById('admin-dashboard');
    const generalOrdersView = document.getElementById('general-orders-view');

    // Sicurezza: controlla esistenza
    if (loginArea) loginArea.classList.remove('hidden');
    if (workerDashboard) workerDashboard.classList.add('hidden');
    if (adminDashboard) adminDashboard.classList.add('hidden');
    if (generalOrdersView) generalOrdersView.classList.add('hidden');

    // Reset utente
    const name = document.getElementById('worker-name');
    const role = document.getElementById('worker-role');
    if (name) name.textContent = 'Ospite';
    if (role) role.textContent = 'Non Loggato';

    // Stato login
    const status = document.getElementById('login-status');
    if (status) {
        status.textContent = message || '';
        status.classList.toggle('hidden', !message);
    }

    // Reset EAN / upload
    const scanStatus = document.getElementById('scan-status');
    if (scanStatus) scanStatus.textContent = '';
    const upload = document.getElementById('photo-upload-area');
    if (upload) upload.classList.add('hidden');
}

function showStatusMessage(elementId, message, isSuccess = true) {
    const el = document.getElementById(elementId);
    if (!el) {
        console.warn(`showStatusMessage: elemento con ID "${elementId}" non trovato.`);
        return;
    }

    if (!message) {
        el.classList.add('hidden');
        return;
    }

    el.textContent = message;
    el.classList.remove('hidden');

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
    const status = document.getElementById('login-status');

    if (!email || !password) {
        showLoginArea("Per favore, inserisci email e password.");
        return;
    }

    if (status) {
        status.textContent = "Accesso in corso...";
        status.classList.remove('hidden');
    }

    Backendless.UserService.login(email, password, true)
        .then(user => {
            handleLoginSuccess(user);
        })
        .catch(error => {
            console.error("Errore di Login:", error);
            const message = error.message || "Credenziali non valide o errore di sistema.";
            showLoginArea("Accesso fallito: " + message);
        });
}

function handleLogout() {
    Backendless.UserService.logout()
        .then(() => {
            currentUser = null;
            currentRole = null;
            currentEanInProcess = null;

            // Nasconde tutte le dashboard e la vista generale
            hideAllDashboards();

            // Mostra nuovamente l’area di login
            showLoginArea("Logout avvenuto con successo.");
        })
        .catch(error => {
            console.error("Errore di Logout:", error);
            showLoginArea("Errore durante il logout. Riprova.");
        });
}

function handlePasswordRecovery() {
    const emailInput = document.getElementById('user-email');
    if (!emailInput) {
        console.warn("Campo email non trovato nel DOM.");
        return;
    }

    const email = emailInput.value.trim();
    if (!email) {
        showLoginArea("Per recuperare la password, inserisci l'email nel campo apposito.");
        return;
    }

    Backendless.UserService.restorePassword(email)
        .then(() => {
            showLoginArea(`📧 Email di recupero inviata a ${email}. Controlla la tua casella di posta.`);
        })
        .catch(error => {
            console.error("Errore di recupero password:", error);
            const msg = error.message || "Errore durante il recupero della password.";
            showLoginArea(`❌ Recupero password fallito: ${msg}`);
        });
}

function getRoleFromUser(user) {
    if (!user || !user.objectId) {
        console.warn("getRoleFromUser: utente non valido o mancante.");
        return Promise.resolve('Nessun Ruolo');
    }

    // Se il ruolo è già presente nell'oggetto utente
    if (user.role) {
        return Promise.resolve(user.role);
    }

    // Recupera ruolo dal database Backendless
    const queryBuilder = Backendless.DataQueryBuilder.create()
        .setProperties(["objectId", "role"])
        .setWhereClause(`objectId = '${user.objectId}'`);

    return Backendless.Data.of(USER_TABLE_NAME).find(queryBuilder)
        .then(result => {
            if (Array.isArray(result) && result.length > 0) {
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
    if (!user) {
        console.error("handleLoginSuccess: utente non valido.");
        showLoginArea("Errore: utente non valido.");
        return;
    }

    currentUser = user;

    getRoleFromUser(user)
        .then(role => {
            currentRole = role;

            const displayName = user.name || user.email || "Utente";
            const workerName = document.getElementById('worker-name');
            const workerRole = document.getElementById('worker-role');
            const loginArea = document.getElementById('login-area');
            const adminDashboard = document.getElementById('admin-dashboard');
            const workerDashboard = document.getElementById('worker-dashboard');
            const generalOrdersView = document.getElementById('general-orders-view');

            // Sicurezza DOM
            if (workerName) workerName.textContent = displayName;
            if (workerRole) workerRole.textContent = currentRole;
            if (loginArea) loginArea.classList.add('hidden');
            if (generalOrdersView) generalOrdersView.classList.add('hidden');

            // Gestione dashboard per ruolo
            if (currentRole === ROLES.ADMIN) {
                if (adminDashboard) adminDashboard.classList.remove('hidden');
                if (workerDashboard) workerDashboard.classList.add('hidden');
                loadUsersAndRoles();
                loadAllOrdersForAdmin();
            } 
            else if (currentRole === ROLES.PHOTOGRAPHER || currentRole === ROLES.POST_PRODUCER) {
                if (adminDashboard) adminDashboard.classList.add('hidden');
                if (workerDashboard) workerDashboard.classList.remove('hidden');
                loadOrdersForUser(currentRole);
            } 
            else {
                console.warn("Ruolo non autorizzato:", currentRole);
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


function function showGeneralOrdersView() {
    const generalOrdersView = document.getElementById('general-orders-view');
    const adminDashboard = document.getElementById('admin-dashboard');
    const workerDashboard = document.getElementById('worker-dashboard');
    const loginArea = document.getElementById('login-area');

    if (!generalOrdersView) return console.warn("Elemento #general-orders-view non trovato.");
    // Nasconde tutto il resto
    if (loginArea) loginArea.classList.add('hidden');
    if (workerDashboard) workerDashboard.classList.add('hidden');
    if (adminDashboard) adminDashboard.classList.add('hidden');
    // Mostra la vista generale
    generalOrdersView.classList.remove('hidden');
    
    // 💡 AGGIUNGI QUESTA CHIAMATA PER CARICARE I DATI 💡
    loadGeneralOrders();
}


// ----------------------------------------------------
// FUNZIONE PER MOSTRARE LA DASHBOARD PRINCIPALE
// ----------------------------------------------------
function showMainDashboard() {
    const generalOrdersView = document.getElementById('general-orders-view');
    const adminDashboard = document.getElementById('admin-dashboard');
    const workerDashboard = document.getElementById('worker-dashboard');
    const loginArea = document.getElementById('login-area');

    // 1. Nasconde tutte le aree dell'applicazione
    if (loginArea) loginArea.classList.add('hidden');
    if (generalOrdersView) generalOrdersView.classList.add('hidden');
    
    // Assicurati che le dashboard siano nascoste prima di mostrare quella corretta
    if (workerDashboard) workerDashboard.classList.add('hidden');
    if (adminDashboard) adminDashboard.classList.add('hidden');

    // 2. Mostra la dashboard corretta in base al ruolo
    if (currentRole === ROLES.ADMIN) {
        if (adminDashboard) adminDashboard.classList.remove('hidden');
    } else if (currentRole === ROLES.PHOTOGRAPHER || currentRole === ROLES.POST_PRODUCER) {
        if (workerDashboard) workerDashboard.classList.remove('hidden');
    } else {
        // Se non c'è un ruolo valido (es. sessione scaduta), torna alla login
        showLoginArea(); 
    }
}

// ----------------------------------------------------
// FUNZIONI ADMIN (DASHBOARD)
// ----------------------------------------------------

function renderUsersTable(users) {
    const tableBody = document.querySelector('#users-table tbody');
    const loadingUsersEl = document.getElementById('loading-users');

    if (!tableBody || !loadingUsersEl) {
        console.warn("renderUsersTable: elementi DOM non trovati.");
        return;
    }

    tableBody.innerHTML = '';

    if (!users || users.length === 0) {
        loadingUsersEl.textContent = "Nessun utente trovato (a parte te, Admin).";
        loadingUsersEl.classList.remove('hidden');
        return;
    }

    loadingUsersEl.classList.add('hidden');

    users.forEach(user => {
        if (!user || user.objectId === currentUser?.objectId) return;

        const row = tableBody.insertRow();

        // Email
        const emailCell = row.insertCell();
        emailCell.textContent = user.email || "—";

        // Ruolo corrente
        const currentRoleCell = row.insertCell();
        currentRoleCell.textContent = user.role || 'Nessun Ruolo';

        // Azioni
        const actionCell = row.insertCell();
        actionCell.classList.add('action-cell');

        // Select ruoli
        const roleSelect = document.createElement('select');
        roleSelect.className = 'w-1/2 p-2 border border-gray-300 rounded-md text-sm';

        Object.values(ROLES)
            .filter(r => r !== ROLES.ADMIN)
            .forEach(role => {
                const option = document.createElement('option');
                option.value = role;
                option.textContent = role;
                if (user.role === role) option.selected = true;
                roleSelect.appendChild(option);
            });

        // Bottone Salva
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Salva Ruolo';
        saveButton.className = 'btn-success text-xs py-1 px-2 mr-2';
        saveButton.onclick = () => updateRole(user.objectId, roleSelect.value);

        // Bottone Elimina
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Elimina';
        deleteButton.className = 'btn-danger text-xs py-1 px-2';
        deleteButton.onclick = () => deleteUser(user.objectId, user.email);

        // Montaggio celle
        actionCell.appendChild(roleSelect);
        actionCell.appendChild(saveButton);
        actionCell.appendChild(deleteButton);
    });
}

function loadUsersAndRoles() {
    const loadingUsersEl = document.getElementById('loading-users');
    if (!loadingUsersEl) {
        console.warn("Elemento #loading-users non trovato.");
        return;
    }

    loadingUsersEl.textContent = "Caricamento lista utenti...";
    loadingUsersEl.classList.remove('hidden');
    loadingUsersEl.classList.remove('text-red-600');
    loadingUsersEl.classList.add('text-gray-700');

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
                `ERRORE: Impossibile caricare gli utenti. (${error.message})`;
            loadingUsersEl.classList.add('text-red-600');
        });
}

function updateRole(userId, newRole) {
    if (userId === currentUser.objectId) {
        showStatusMessage(
            'user-creation-status',
            'Non puoi modificare il tuo ruolo tramite questo pannello.',
            false
        );
        return;
    }

    const userUpdate = { objectId: userId, role: newRole };

    Backendless.Data.of(USER_TABLE_NAME).save(userUpdate)
        .then(() => {
            showStatusMessage(
                'user-creation-status',
                `Ruolo dell'utente aggiornato a ${newRole} con successo.`,
                true
            );
            loadUsersAndRoles(); // ricarica lista utenti aggiornata
        })
        .catch(error => {
            console.error("Errore aggiornamento ruolo:", error);
            showStatusMessage(
                'user-creation-status',
                `Errore nell'aggiornamento del ruolo: ${error.message || "Errore sconosciuto"}`,
                false
            );
        });
}

function deleteUser(userId, email) {
    if (userId === currentUser.objectId) {
        showStatusMessage(
            'user-creation-status',
            'Non puoi eliminare te stesso dal pannello.',
            false
        );
        return;
    }

    if (!confirm(`Sei sicuro di voler eliminare l'utente ${email}?`)) return;

    Backendless.Data.of(USER_TABLE_NAME).remove({ objectId: userId })
        .then(() => {
            showStatusMessage(
                'user-creation-status',
                `Utente ${email} eliminato con successo.`,
                true
            );
            loadUsersAndRoles(); // ricarica lista utenti aggiornata
        })
        .catch(error => {
            console.error("Errore eliminazione utente:", error);
            showStatusMessage(
                'user-creation-status',
                `Errore nell'eliminazione dell'utente: ${error.message || "Errore sconosciuto"}`,
                false
            );
        });
}

function handleUserCreation() {
    const email = document.getElementById('new-user-email').value.trim();
    const password = document.getElementById('new-user-password').value;
    const role = document.getElementById('new-user-role').value;

    if (!email || !password || !role) {
        showStatusMessage(
            'user-creation-status',
            'Per favore, compila tutti i campi per il nuovo utente.',
            false
        );
        return;
    }

    Backendless.UserService.register({ email, password })
        .then(newUser => {
            // Assegna ruolo all'utente appena creato
            return Backendless.Data.of(USER_TABLE_NAME).save({
                objectId: newUser.objectId,
                role: role
            });
        })
        .then(() => {
            showStatusMessage(
                'user-creation-status',
                `Utente ${email} creato e ruolo ${role} assegnato con successo.`,
                true
            );
            // Pulisce i campi del form
            document.getElementById('new-user-email').value = '';
            document.getElementById('new-user-password').value = '';
            document.getElementById('new-user-role').value = '';
            loadUsersAndRoles(); // ricarica lista utenti
        })
        .catch(error => {
            console.error("Errore creazione utente:", error);
            showStatusMessage(
                'user-creation-status',
                `Creazione utente fallita: ${error.message || "Errore sconosciuto"}`,
                false
            );
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

    // Valori admin
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

        for (let i = 0; i < total; i++) {
            const row = jsonData[i];
            const productCode = row["Codice Articolo"] || "";

            // Controllo duplicati
            const query = Backendless.DataQueryBuilder.create().setWhereClause(`productCode='${productCode}'`);
            const duplicates = await Backendless.Data.of("Orders").find(query);

            if (duplicates.length > 0) {
                logEl.style.display = 'block';
                logEl.textContent += `❌ Codice duplicato trovato: ${productCode}\n`;
                failCount++;
            } else {
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
            }

            // Aggiornamento progress bar
            if (progressBar) progressBar.style.width = Math.round(((i + 1) / total) * 100) + "%";
        }

        // Stato finale
        statusEl.textContent = `Importazione completata: ${successCount} successi, ${failCount} errori.`;
        statusEl.className = failCount === 0
            ? 'status-message bg-green-100 text-green-700 p-2 rounded'
            : 'status-message bg-yellow-100 text-yellow-700 p-2 rounded';

        fileInput.value = "";

        if (typeof loadAllOrdersForAdmin === 'function') loadAllOrdersForAdmin();
        if (typeof showAdminFeedback === 'function') showAdminFeedback(`Importazione completata: ${successCount} successi, ${failCount} errori.`);
    };

    reader.readAsArrayBuffer(file);
}


/**
 * Mostra la card di modifica ordine per Admin e popola i campi
 * @param {Object} order - Oggetto ordine da Backendless
 */
function openAdminOrderCard(order) {
    if (!order || !order.eanCode) return;

    const card = document.getElementById('admin-order-edit-card');
    if (!card) return;

    // Mostra la card
    card.classList.remove('hidden');

    // Mostra EAN nell'intestazione
    const eanDisplay = document.getElementById('admin-ean-display');
    if (eanDisplay) eanDisplay.textContent = order.eanCode;

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
            el.value = order[prop] != null ? order[prop] : '';
        }
    });

    // Salva l'ordine corrente
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
        if (el) updatedOrder[prop] = el.value != null ? el.value.trim() : "";
    });

    // Timestamp aggiornamento
    updatedOrder.lastUpdated = new Date();

    try {
        await Backendless.Data.of(ORDER_TABLE_NAME).save(updatedOrder);

        // Feedback e aggiornamento stato
        showAdminFeedback("✅ Aggiornamenti salvati correttamente!", "success");
        currentAdminOrder = updatedOrder;

        // Ricarica lista ordini e evidenzia la riga aggiornata
        if (typeof loadAllOrdersForAdmin === "function") {
            await loadAllOrdersForAdmin();
        }
        if (typeof highlightUpdatedRow === "function") {
            highlightUpdatedRow(updatedOrder.objectId);
        }

        // Chiudi card modifica e riapri lista ordini
        const editCard = document.getElementById('admin-order-edit-card');
        if (editCard) editCard.classList.add('hidden');

        const ordersCard = document.getElementById('orders-admin-card');
        if (ordersCard) ordersCard.classList.remove('hidden');

    } catch (err) {
        console.error("Errore durante il salvataggio ordine:", err);
        showAdminFeedback("❌ Errore durante il salvataggio: " + (err.message || ""), "error");
    }
}

// ----------------------------------------------------
// FUNZIONI CHIUSURA CARD (ADMIN)
// ----------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  const toggles = [
    { toggleId: 'toggle-users-card', cardId: 'card-users', storageKey: 'showUsersCard' },
    { toggleId: 'toggle-import-card', cardId: 'card-import', storageKey: 'showImportCard' }
  ];

  toggles.forEach(({ toggleId, cardId, storageKey }) => {
    const toggle = document.getElementById(toggleId);
    const card = document.getElementById(cardId);
    if (!toggle || !card) return;

    // Ripristina stato da localStorage
    const savedState = localStorage.getItem(storageKey);
    if (savedState !== null) {
      toggle.checked = savedState === 'true';
      card.style.display = toggle.checked ? 'block' : 'none';
    }

    // Gestione toggle
    toggle.addEventListener('change', () => {
      card.style.display = toggle.checked ? 'block' : 'none';
      localStorage.setItem(storageKey, toggle.checked);
    });
  });
});


function cancelAdminOrderEdit() {
    const editCard = document.getElementById('admin-order-edit-card');
    const ordersCard = document.getElementById('orders-admin-card');

    if (!editCard) return;

    // Nasconde card modifica
    editCard.classList.add('hidden');
    currentAdminOrder = null;

    // Mostra di nuovo la lista ordini
    if (ordersCard) ordersCard.classList.remove('hidden');

    // Pulisce tutti i campi della card di modifica
    const fields = editCard.querySelectorAll('input, textarea, select');
    fields.forEach(f => {
        if (f.tagName === 'SELECT') {
            f.selectedIndex = 0;
        } else {
            f.value = '';
        }
    });

    // Rimuove eventuali messaggi di feedback residui
    const feedbackEls = editCard.querySelectorAll('.status-message, .feedback');
    feedbackEls.forEach(el => {
        el.textContent = '';
        el.style.display = 'none';
    });
}

function highlightUpdatedRow(objectId) {
    const table = document.getElementById('admin-orders-table');
    if (!table) return;

    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
        if (row.dataset.objectid === objectId) {
            // Effetto flash verde
            row.style.transition = 'background-color 0.5s ease';
            row.classList.add('highlight-row'); // aggiunge una classe temporanea

            // Rimuove la classe dopo 1.5s
            setTimeout(() => {
                row.classList.remove('highlight-row');
            }, 1500);
        }
    });
}

function showAdminFeedback(message, type = 'info') {
    // Contenitore globale per toast
    let container = document.getElementById('admin-feedback-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'admin-feedback-container';
        container.style.position = 'fixed';
        container.style.bottom = '1rem';
        container.style.right = '1rem';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '0.5rem';
        container.style.zIndex = '50';
        document.body.appendChild(container);
    }

    const feedbackBox = document.createElement('div');
    feedbackBox.textContent = message;
    feedbackBox.className =
        `px-4 py-2 rounded shadow-lg text-white 
        ${type === 'success' ? 'bg-green-600' :
          type === 'error' ? 'bg-red-600' :
          'bg-blue-600'}`;
    feedbackBox.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    feedbackBox.style.opacity = '0';
    feedbackBox.style.transform = 'translateY(10px)';

    container.appendChild(feedbackBox);

    // Animazione di entrata
    requestAnimationFrame(() => {
        feedbackBox.style.opacity = '1';
        feedbackBox.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
        feedbackBox.style.opacity = '0';
        feedbackBox.style.transform = 'translateY(10px)';
        setTimeout(() => feedbackBox.remove(), 500);
    }, 4000);
}


/**
 * Carica tutti gli ordini da Backendless e li mostra nella tabella Admin
 */
async function loadAllOrdersForAdmin() {
    const loadingEl = document.getElementById('loading-orders');
    const table = document.getElementById('admin-orders-table');
    const tbody = table.querySelector('tbody');

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
                <td class="px-4 py-2"></td>
            `;

            const editCell = tr.querySelector('td:last-child');
            const editBtn = document.createElement('button');
            editBtn.textContent = 'Modifica';
            editBtn.className = 'btn-primary px-3 py-1 text-sm';
            editBtn.addEventListener('click', () => openAdminOrderCard(order));
            editCell.appendChild(editBtn);

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
    if (!order) return;

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
            await saveAdminOrderUpdates(); // salva le modifiche su Backendless
            cancelAdminOrderEdit(); // chiude e resetta la card
        };
    }

    if (cancelBtn) {
        cancelBtn.onclick = () => cancelAdminOrderEdit();
    }
}

function closeAdminEditCard() {
    const editCard = document.getElementById('admin-order-edit-card');
    const ordersCard = document.getElementById('orders-admin-card');

    // Nasconde card modifica
    if (editCard) {
        editCard.classList.add('hidden');

        // Pulisce tutti i campi della card di modifica
        const fields = editCard.querySelectorAll('input, textarea, select');
        fields.forEach(f => f.value = '');
    }

    // Mostra di nuovo la lista ordini
    if (ordersCard) ordersCard.style.display = 'block';

    // Ricarica lista ordini admin
    loadAllOrdersForAdmin();

    // Reset variabile globale
    currentAdminOrder = null;
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


async function confirmEanInput() {
    const eanInputEl = document.getElementById("ean-input");
    const scanStatus = document.getElementById("scan-status");
    const actionsArea = document.getElementById("ean-actions-area");
    const photoUploadArea = document.getElementById("photo-upload-area");
    const currentEanDisplay = document.getElementById("current-ean-display");

    if (!eanInputEl) return;
    const eanInput = eanInputEl.value.trim();

    // ❌ Input vuoto
    if (!eanInput) {
        scanStatus.textContent = "Inserisci un codice EAN o un Codice Articolo!";
        scanStatus.className = "status-message status-error";
        scanStatus.classList.remove("hidden");
        if (actionsArea) actionsArea.classList.add("hidden");
        if (photoUploadArea) photoUploadArea.style.display = 'none';
        return;
    }

    try {
        // 🔄 Stato in corso
        scanStatus.textContent = "Verifica in corso...";
        scanStatus.className = "status-message status-info";
        scanStatus.classList.remove("hidden");

        const query = Backendless.DataQueryBuilder.create()
            .setWhereClause(`eanCode='${eanInput}' OR productCode='${eanInput}'`);

        const orders = await Backendless.Data.of("Orders").find(query);

        if (!orders || orders.length === 0) {
            scanStatus.textContent = `❌ Codice ${eanInput} non trovato in Backendless.`;
            scanStatus.className = "status-message status-error";
            if (actionsArea) actionsArea.classList.add("hidden");
            if (photoUploadArea) photoUploadArea.style.display = 'none';
            return;
        }

        const order = orders[0];
        scanStatus.textContent = `✅ Codice ${eanInput} trovato. Compila o aggiorna i dati operativi.`;
        scanStatus.className = "status-message status-success";
        if (actionsArea) actionsArea.classList.remove("hidden");
        if (currentEanDisplay) currentEanDisplay.textContent = eanInput;

        // 📸 Mostra area foto solo per PHOTOGRAPHER
        if (photoUploadArea) {
            if (currentRole === ROLES.PHOTOGRAPHER) {
                photoUploadArea.style.display = 'block';
                const uploadEanDisplay = document.getElementById("current-ean-display-upload");
                if (uploadEanDisplay) uploadEanDisplay.textContent = eanInput;
            } else {
                photoUploadArea.style.display = 'none';
            }
        }

        // 📝 Popola campi
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
            "field-postpresa": "postPresa"
        };

        Object.entries(map).forEach(([inputId, key]) => {
            const el = document.getElementById(inputId);
            if (el) el.value = order[key] || "";
        });

        // 🔖 Salva EAN corrente
        currentEanInProcess = { objectId: order.objectId, ean: eanInput };
    } catch (err) {
        console.error(err);
        scanStatus.textContent = "Errore durante la verifica EAN.";
        scanStatus.className = "status-message status-error";
        if (actionsArea) actionsArea.classList.add("hidden");
        if (photoUploadArea) photoUploadArea.style.display = 'none';
    }
}


// 💾 Salva i dati operativi aggiornati su Backendless
async function saveEanUpdates() {
    // Controlla EAN attivo
    if (!currentEanInProcess || !currentEanInProcess.objectId) {
        showFeedback("⚠️ Nessun EAN attivo. Scannerizza un codice prima.", 'error');
        return;
    }

    const { objectId, ean } = currentEanInProcess;

    // Mappa campi HTML → colonne Backendless
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
        "field-postpresa": "postPresa"
    };

    // Costruisci oggetto aggiornato
    const updatedOrder = { objectId };
    Object.entries(map).forEach(([inputId, key]) => {
        const el = document.getElementById(inputId);
        updatedOrder[key] = el ? el.value.trim() : '';
    });

    updatedOrder.lastUpdated = new Date();

    try {
        showFeedback("⏳ Salvataggio in corso...", 'info');
        await Backendless.Data.of("Orders").save(updatedOrder);
        showFeedback(`✅ Aggiornamenti per ${ean} salvati correttamente!`, 'success');

        // Refresh dell'interfaccia
        setTimeout(async () => {
            resetEanActionState(false);

            try {
                // Ricarica utente e ruolo
                const updatedUser = await Backendless.UserService.getCurrentUser();
                currentRole = await getRoleFromUser(updatedUser);
                loadOrdersForUser(currentRole);
            } catch (err) {
                console.error("Errore nel ricaricare utente/ruolo dopo salvataggio:", err);
                loadOrdersForUser(currentRole); // fallback
            }
        }, 1000);

    } catch (err) {
        console.error("Errore durante il salvataggio:", err);
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
function showFeedback(message, type = 'info') {
    const feedbackElement = document.getElementById('operation-feedback');
    if (!feedbackElement) return console.error("⚠️ Elemento #operation-feedback non trovato.");

    // Rimuove classi precedenti e forzata visibilità
    feedbackElement.classList.remove('status-success', 'status-error', 'status-info', 'hidden');
    feedbackElement.textContent = message;
    feedbackElement.classList.add(`status-${type}`);
    feedbackElement.style.display = 'block';

    // Rimuove messaggio precedente se c'era un timeout in corso
    if (feedbackElement.hideTimeout) clearTimeout(feedbackElement.hideTimeout);

    // Nasconde dopo 3 secondi
    feedbackElement.hideTimeout = setTimeout(() => {
        feedbackElement.style.display = 'none';
    }, 3000);
}


/**
/**
 * Resetta l'interfaccia di azione EAN allo stato iniziale.
 * @param {boolean} showCancelFeedback Se true, mostra un messaggio di annullamento.
 */
function resetEanActionState(showCancelFeedback = false) {
    const actionsArea = document.getElementById('ean-actions-area');
    const photoUploadArea = document.getElementById('photo-upload-area');
    const confirmBtn = document.getElementById('confirm-ean-btn');
    const eanInput = document.getElementById('ean-input');

    if (actionsArea) actionsArea.classList.add('hidden');
    if (photoUploadArea) photoUploadArea.classList.add('hidden');
    if (confirmBtn) confirmBtn.classList.remove('hidden');
    if (eanInput) eanInput.value = '';

    if (showCancelFeedback) {
        showFeedback("Operazione di aggiornamento annullata.", 'info'); 
    }
}


function handlePhotoUploadAndCompletion() {
    alert("Funzione di upload non ancora implementata!");
}

function openPhotoModal(eanCode) {
    const modal = document.getElementById('photo-modal');
    if (modal) {
        modal.classList.remove('hidden');
        document.getElementById('modal-ean-title').textContent = eanCode || '';
        const modalContent = document.getElementById('photo-modal-content');
        if (modalContent) {
            modalContent.innerHTML = `<p>Caricamento foto per EAN: ${eanCode}...</p>`;
        }
    } else {
        console.warn("Elemento #photo-modal non trovato.");
    }
}

// ----------------------------------------------------
// FUNZIONE PER LA VISTA GENERALE DI TUTTI GLI ORDINI
// ----------------------------------------------------
async function loadGeneralOrders() {
    const loadingEl = document.getElementById('loading-general-orders');
    const table = document.getElementById('general-orders-table');
    const tableHeader = document.getElementById('general-orders-table-header');
    const tableBody = table ? table.querySelector('tbody') : null;

    if (!loadingEl || !table || !tableHeader || !tableBody) {
        console.error("Elementi DOM per la tabella generale ordini non trovati.");
        return;
    }

    // Imposta stato di caricamento
    loadingEl.textContent = "Caricamento lista completa ordini...";
    loadingEl.classList.remove('hidden');
    table.classList.add('hidden');
    tableBody.innerHTML = ''; // Pulisci la tabella

    try {
        // Query per recuperare tutti gli ordini (fino a 100 per pagina)
        const queryBuilder = Backendless.DataQueryBuilder.create().setPageSize(100).setOffset(0);
        // Utilizza ORDER_TABLE_NAME = "Orders" 
        const orders = await Backendless.Data.of(ORDER_TABLE_NAME).find(queryBuilder); 

        if (!orders || orders.length === 0) {
            loadingEl.textContent = "Nessun ordine trovato.";
            return;
        }

        // 1. Genera l'intestazione della tabella (tutte le colonne)
        // Usa le chiavi del primo oggetto come nomi delle colonne
        const firstOrder = orders[0];
        // Filtra proprietà standard di Backendless non rilevanti per la colonna
        const columns = Object.keys(firstOrder).filter(key => typeof firstOrder[key] !== 'object' && key !== 'ownerId');
        
        tableHeader.innerHTML = columns.map(col => 
            `<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${col}</th>`
        ).join('');

        // 2. Popola il corpo della tabella
        orders.forEach(order => {
            const tr = document.createElement('tr');
            tr.classList.add('border-b', 'hover:bg-gray-50');
            
            columns.forEach(col => {
                const cell = document.createElement('td');
                cell.classList.add('px-4', 'py-2', 'whitespace-nowrap', 'text-sm', 'text-gray-900');
                let value = order[col];
                
                // Formattazione semplice per le date (se necessario)
                if (value instanceof Date) {
                    value = value.toLocaleDateString();
                }
                
                cell.textContent = value || '—';
                tr.appendChild(cell);
            });
            tableBody.appendChild(tr);
        });
        
        // Nasconde loading e mostra tabella
        loadingEl.classList.add('hidden');
        table.classList.remove('hidden');

    } catch (error) {
        console.error("Errore nel caricamento ordini generali:", error);
        loadingEl.textContent = `❌ Errore durante il caricamento ordini: ${error.message}`;
        loadingEl.classList.remove('hidden');
        loadingEl.classList.add('text-red-600');
        table.classList.add('hidden');
    }
}



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
