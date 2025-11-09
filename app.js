// Configurazione Backendless (sostituisci con le tue chiavi reali)
const APPLICATION_ID = 'C2A5C327-CF80-4BB0-8017-010681F0481C';
const API_KEY = 'B266000F-684B-4889-9174-2D1734001E08';       

// Nomi delle tabelle
const USER_TABLE_NAME = "Users";
const ORDER_TABLE_NAME = "Orders";
const STORAGE_CONTAINER_NAME = "product_photos";

// Stati Ordine
const STATUS = {
    WAITING_PHOTO: "In attesa foto", // Riga 12 corretta
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
    [cite_start]POST_PRODUCER: "PostProducer" [cite: 4]
};

// Variabili globali di stato
let currentUser = null;
let currentRole = null;
let currentEanInProcess = null; [cite_start]// [cite: 5]

// Inizializzazione di Backendless
[cite_start]Backendless.initApp(APPLICATION_ID, API_KEY); [cite: 6]
console.log("Backendless inizializzato.");

// Registrazione del Service Worker per la PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('Service Worker registrato con successo:', registration.scope);
            })
            .catch(error => {
                [cite_start]console.error('Service Worker fallito:', error); [cite: 7]
            });
    });
[cite_start]} // [cite: 8]

// ----------------------------------------------------
// FUNZIONI DI UTILITY E UI
// ----------------------------------------------------

function showLoginArea(message = "") {
    [cite_start]document.getElementById('login-area').style.display = 'block'; [cite: 9]
    document.getElementById('worker-dashboard').style.display = 'none';
    document.getElementById('admin-dashboard').style.display = 'none';
    document.getElementById('worker-name').textContent = 'Ospite';
    document.getElementById('worker-role').textContent = 'Non Loggato';
    
    const status = document.getElementById('login-status');
    status.textContent = message;
    status.style.display = message ? [cite_start]'block' : 'none'; [cite: 10]
    
    // Assicurati che gli stati di upload/scansione siano resettati
    document.getElementById('scan-status').textContent = '';
    [cite_start]document.getElementById('photo-upload-area').style.display = 'none'; [cite: 11]
}

function showStatusMessage(elementId, message, isSuccess = true) {
    const el = document.getElementById(elementId);
    el.textContent = message;
    [cite_start]el.style.display = 'block'; [cite: 12]
    if (isSuccess) {
        el.classList.remove('text-red-600', 'bg-red-100');
        [cite_start]el.classList.add('text-green-600', 'bg-green-100'); [cite: 13]
    } else {
        el.classList.remove('text-green-600', 'bg-green-100');
        [cite_start]el.classList.add('text-red-600', 'bg-red-100'); [cite: 14]
    }
}

// ----------------------------------------------------
// AUTENTICAZIONE E GESTIONE UTENTI
// ----------------------------------------------------

function handleStandardLogin(email, password) {
    if (!email || !password) {
        showLoginArea("Per favore, inserisci email e password.");
        [cite_start]return; [cite: 15]
    }
    
    document.getElementById('login-status').textContent = "Accesso in corso...";
    [cite_start]Backendless.UserService.login(email, password, true) [cite: 16]
        .then(user => {
            handleLoginSuccess(user);
        })
        .catch(error => {
            console.error("Errore di Login:", error);
            const message = error.message || "Credenziali non valide o errore di sistema.";
            showLoginArea("Accesso Fallito: " + message);
        [cite_start]}); [cite: 17]
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
            [cite_start]console.error("Errore di Logout:", error); [cite: 18]
            showLoginArea("Errore durante il logout. Riprova.");
        [cite_start]}); [cite: 19]
}

function handlePasswordRecovery() {
    [cite_start]const email = document.getElementById('user-email').value; [cite: 20]
    if (!email) {
        showLoginArea("Per recuperare la password, inserisci l'email nel campo apposito.");
        [cite_start]return; [cite: 21]
    }

    Backendless.UserService.restorePassword(email)
        .then(() => {
            showLoginArea(`Email di recupero inviata a ${email}. Controlla la tua casella di posta.`);
        })
        .catch(error => {
            console.error("Errore di recupero password:", error);
            showLoginArea(`Errore di recupero password: ${error.message}`);
        [cite_start]}); [cite: 22]
}

/**
 * Funzione per recuperare il ruolo utente.
 * Nota: il campo "role" deve esistere nella tabella Users.
 [cite_start]*/ [cite: 23]
function getRoleFromUser(user) {
    // Se il campo role è già sull'oggetto utente, usalo direttamente
    if (user.role) {
        [cite_start]return Promise.resolve(user.role); [cite: 24]
    }

    // Altrimenti, fai una chiamata per recuperare l'oggetto utente con la colonna 'role'
    const queryBuilder = Backendless.DataQueryBuilder.create()
        .setProperties(["objectId", "role"])
        .setWhereClause(`objectId = '${user.objectId}'`);
    [cite_start]return Backendless.Data.of(USER_TABLE_NAME).find(queryBuilder) [cite: 25]
        .then(result => {
            if (result && result.length > 0) {
                return result[0].role || 'Nessun Ruolo'; // Ritorna il ruolo
            }
            return 'Nessun Ruolo'; // Fallback
        })
        .catch(error => {
            [cite_start]console.error("Errore nel recupero del ruolo:", error); [cite: 26]
            return 'Nessun Ruolo'; // Fallback in caso di errore
        [cite_start]}); [cite: 27]
}

function handleLoginSuccess(user) {
    currentUser = user;
    
    // >>> LOG CRITICO 1: Login avvenuto, Recupero Ruolo in corso.
    [cite_start]console.log("LOGIN SUCCESS: Tentativo di recuperare il ruolo per l'utente.", user); [cite: 28]
    [cite_start]getRoleFromUser(user) [cite: 29]
        .then(role => {
            currentRole = role;
            
            const displayName = user.name || user.email;
            document.getElementById('worker-name').textContent = displayName;
            document.getElementById('worker-role').textContent = currentRole;
            
            [cite_start]document.getElementById('login-area').style.display = 'none'; [cite: 30]

            if (currentRole === ROLES.ADMIN) {
                // >>> LOG CRITICO 2: Ruolo Admin rilevato, si tenta di mostrare la dashboard.
                console.log("RUOLO ADMIN: Mostro dashboard e carico utenti."); 
                document.getElementById('admin-dashboard').style.display = 'block';
                document.getElementById('worker-dashboard').style.display = 'none'; [cite_start]// Nascondi worker [cite: 31]
                loadUsersAndRoles(); // Carica la tabella utenti per l'Admin
            } else if (currentRole === ROLES.PHOTOGRAPHER || currentRole === ROLES.POST_PRODUCER) {
                document.getElementById('admin-dashboard').style.display = 'none'; [cite_start]// Nascondi Admin [cite: 32]
                [cite_start]document.getElementById('worker-dashboard').style.display = 'block'; [cite: 33]
                loadOrdersForUser(currentRole); // Carica gli ordini pertinenti
            } else {
                showLoginArea("Ruolo utente non autorizzato o non definito.");
                [cite_start]handleLogout(); [cite: 34]
            }
        })
        .catch(error => {
            console.error("Errore critico durante la gestione del ruolo:", error);
            showLoginArea(`Errore nella verifica del ruolo: ${error.message}`);
            handleLogout();
        [cite_start]}); [cite: 35]
}

// ----------------------------------------------------
// FUNZIONI ADMIN (DASHBOARD)
// ----------------------------------------------------

function renderUsersTable(users) {
    const tableBody = document.querySelector('#users-table tbody');
    [cite_start]tableBody.innerHTML = ''; [cite: 36]
    if (!users || users.length === 0) {
        document.getElementById('loading-users').textContent = "Nessun utente trovato (a parte te, Admin).";
        [cite_start]return; [cite: 37]
    }
    
    [cite_start]document.getElementById('loading-users').style.display = 'none'; [cite: 38]
    users.forEach(user => {
        // Ignora l'utente Admin loggato per prevenire l'auto-rimozione
        if (user.objectId === currentUser.objectId) return; 

        const row = tableBody.insertRow();
        
        // Colonna 1: Email
        row.insertCell().textContent = user.email;

        // Colonna 2: Ruolo Attuale
        const currentRoleCell = row.insertCell();
        [cite_start]currentRoleCell.textContent = user.role || 'Nessun Ruolo'; [cite: 39]
        
        // Colonna 3: Cambia Ruolo / Elimina
        const actionCell = row.insertCell();
        actionCell.classList.add('action-cell');

        // Select per il cambio ruolo
        const roleSelect = document.createElement('select');
        roleSelect.className = 'w-1/2 p-2 border border-gray-300 rounded-md text-sm';
        [cite_start]Object.values(ROLES).filter(r => r !== ROLES.ADMIN).forEach(role => { [cite: 40]
            const option = document.createElement('option');
            option.value = role;
            option.textContent = role;
            [cite_start]if (user.role === role) { [cite: 41]
                [cite_start]option.selected = true; [cite: 42]
            }
            roleSelect.appendChild(option);
        });
        // Bottone per salvare il ruolo
        [cite_start]const saveButton = document.createElement('button'); [cite: 43]
        [cite_start]saveButton.textContent = 'Salva Ruolo'; [cite: 44]
        saveButton.className = 'btn-success text-xs py-1 px-2 mr-2';
        [cite_start]saveButton.onclick = () => updateRole(user.objectId, roleSelect.value); [cite: 45]
        // Bottone per eliminare l'utente
        const deleteButton = document.createElement('button');
        [cite_start]deleteButton.textContent = 'Elimina'; [cite: 46]
        deleteButton.className = 'btn-danger text-xs py-1 px-2';
        deleteButton.onclick = () => deleteUser(user.objectId, user.email);

        actionCell.appendChild(roleSelect);
        actionCell.appendChild(saveButton);
        actionCell.appendChild(deleteButton);
    [cite_start]}); [cite: 47]
}

function loadUsersAndRoles() {
    try {
        [cite_start]console.log("Inizio: Caricamento lista utenti e ruoli per dashboard Admin."); [cite: 48]
        // Backendless non gestisce direttamente i ruoli in una singola proprietà dell'utente, 
        [cite_start]// ma si affida al campo "role" che abbiamo aggiunto alla tabella Users. [cite: 49]
        const queryBuilder = Backendless.DataQueryBuilder.create()
            .setProperties(["objectId", "email", "role"]) // Richiedi esplicitamente l'email e il nostro campo 'role'
            [cite_start].setPageSize(50); [cite: 50]
        // Limite di 50 utenti

        Backendless.Data.of(USER_TABLE_NAME).find(queryBuilder)
            .then(users => {
                console.log("Utenti caricati:", users);
                renderUsersTable(users);
            })
            .catch(error => {
                [cite_start]// >>> LOG CRITICO 3: Errore nella query (Probabilmente permessi) [cite: 51]
                console.error("ERRORE CRITICO in loadUsersAndRoles (Find):", error);
                document.getElementById('loading-users').textContent = 
                    `ERRORE: Impossibile caricare gli utenti. Controlla i permessi READ sulla tabella 'Users' (Errore: ${error.message}).`;
                [cite_start]document.getElementById('loading-users').style.color = '#dc2626'; [cite: 52]
            });
    [cite_start]} catch (e) { [cite: 53]
        // >>> LOG CRITICO 4: Errore sincrono (es. ID HTML sbagliato)
        [cite_start]console.error("ERRORE SINCRONO in loadUsersAndRoles:", e); [cite: 54]
        document.getElementById('loading-users').textContent = 
            [cite_start]`ERRORE SINCRONO: La dashboard non può essere visualizzata (Errore: ${e.message}).`; [cite: 55]
        document.getElementById('loading-users').style.color = '#dc2626';
    }
}

function updateRole(userId, newRole) {
    if (userId === currentUser.objectId) {
        showStatusMessage('user-creation-status', 'Non puoi modificare il tuo ruolo tramite questo pannello.', false);
        [cite_start]return; [cite: 56]
    }

    const userUpdate = {
        objectId: userId,
        role: newRole
    [cite_start]}; [cite: 57]
    Backendless.Data.of(USER_TABLE_NAME).save(userUpdate)
        .then(() => {
            showStatusMessage('user-creation-status', `Ruolo dell'utente aggiornato a ${newRole} con successo.`, true);
            loadUsersAndRoles(); // Ricarica la tabella
        })
        .catch(error => {
            showStatusMessage('user-creation-status', `Errore nell'aggiornamento del ruolo: ${error.message}`, false);
            console.error("Errore aggiornamento ruolo:", error);
        [cite_start]}); [cite: 58]
}

function deleteUser(userId, email) {
    // In un ambiente reale, useremmo un modale al posto di alert/confirm
    if (confirm(`Sei sicuro di voler eliminare l'utente ${email}?`)) {
        Backendless.Data.of(USER_TABLE_NAME).remove({ objectId: userId })
            .then(() => {
                showStatusMessage('user-creation-status', `Utente ${email} eliminato con successo.`, true);
                [cite_start]loadUsersAndRoles(); // Ricarica la tabella [cite: 59]
            })
            .catch(error => {
                showStatusMessage('user-creation-status', `Errore nell'eliminazione dell'utente: ${error.message}`, false);
                console.error("Errore eliminazione utente:", error);
            [cite_start]}); [cite: 60]
    }
}


function handleUserCreation() {
    const email = document.getElementById('new-user-email').value.trim();
    const password = document.getElementById('new-user-password').value;
    [cite_start]const role = document.getElementById('new-user-role').value; [cite: 61]
    if (!email || !password || !role) {
        showStatusMessage('user-creation-status', 'Per favore, compila tutti i campi per il nuovo utente.', false);
        [cite_start]return; [cite: 62]
    }

    // 1. Registrazione in Backendless.Users
    Backendless.UserService.register({
        email: email,
        password: password
    })
    .then(newUser => {
        // 2. Aggiornamento con il ruolo personalizzato
        const userUpdate = {
            objectId: newUser.objectId,
            role: role // Il nostro campo personalizzato
        [cite_start]}; [cite: 63]

        return Backendless.Data.of(USER_TABLE_NAME).save(userUpdate);
    })
    .then(() => {
        showStatusMessage('user-creation-status', `Utente ${email} creato e ruolo ${role} assegnato con successo.`, true);
        document.getElementById('new-user-email').value = '';
        document.getElementById('new-user-password').value = '';
        document.getElementById('new-user-role').value = '';
        loadUsersAndRoles(); // Aggiorna la lista
    })
    .catch(error => {
        [cite_start]console.error("Errore creazione utente:", error); [cite: 64]
        showStatusMessage('user-creation-status', `Creazione Utente Fallita: ${error.message}`, false);
    [cite_start]}); [cite: 65]
}

// Funzione di gestione file Excel (PLACEHOLDER, da implementare nel dettaglio)
function handleFileUpload() {
    [cite_start]const fileInput = document.getElementById('excel-file-input'); [cite: 89]
    const statusEl = document.getElementById('import-status');

    if (!fileInput.files || fileInput.files.length === 0) {
        statusEl.textContent = "Seleziona un file Excel prima di procedere.";
        [cite_start]statusEl.className = 'status-message bg-red-100 text-red-700'; [cite: 90]
        statusEl.style.display = 'block';
        return;
    }

    [cite_start]const file = fileInput.files[0]; [cite: 91]
    const reader = new FileReader();
    reader.onload = async function(e) {
        [cite_start]const data = new Uint8Array(e.target.result); [cite: 92]
        const workbook = XLSX.read(data, { type: 'array' });

        // Prendi il primo foglio
        [cite_start]const sheetName = workbook.SheetNames[0]; [cite: 93]
        const worksheet = workbook.Sheets[sheetName];

        // Converti in JSON
        [cite_start]const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" }); [cite: 94]
        if (!jsonData || jsonData.length === 0) {
            [cite_start]statusEl.textContent = "File Excel vuoto o non leggibile."; [cite: 95]
            statusEl.className = 'status-message bg-red-100 text-red-700';
            statusEl.style.display = 'block';
            return;
        }

        [cite_start]statusEl.textContent = `Inizio importazione di ${jsonData.length} ordini...`; [cite: 96]
        statusEl.className = 'status-message bg-blue-100 text-blue-700';
        statusEl.style.display = 'block';

        // Progress bar dinamica
        [cite_start]let progressBar = document.getElementById('import-progress-bar'); [cite: 97]
        if (!progressBar) {
            progressBar = document.createElement('div');
            [cite_start]progressBar.id = 'import-progress-bar'; [cite: 98]
            progressBar.style.width = '0%';
            progressBar.style.height = '8px';
            progressBar.style.backgroundColor = '#10b981'; // verde
            progressBar.style.borderRadius = '4px';
            [cite_start]progressBar.style.marginTop = '6px'; [cite: 99]
            statusEl.parentNode.insertBefore(progressBar, statusEl.nextSibling);
        }

        [cite_start]const total = jsonData.length; [cite: 100]
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < jsonData.length; i++) {
            [cite_start]const row = jsonData[i]; [cite: 101]
            // Crea oggetto per Backendless Orders
            const orderObj = {
                productCode: row["Codice Articolo"] || [cite_start]"", [cite: 102]
                eanCode: row["Ean Code"] || [cite_start]"", [cite: 103]
                styleName: row["Style Name"] || [cite_start]"", [cite: 104]
                styleGroup: row["Style Group"] || [cite_start]"", [cite: 105]
                brand: row["Brand"] || [cite_start]"", [cite: 106]
                color: row["Colore"] || [cite_start]"", [cite: 107]
                size: row["Taglia"] || [cite_start]"", [cite: 108]
                category: row["Categoria"] || [cite_start]"", [cite: 109]
                gender: row["Genere"] || [cite_start]"", [cite: 110]
                status: STATUS.WAITING_PHOTO, // 🆕 Usa la costante globale STATUS
                assignedToPhotographerId: "",
                assignedToPostProducerId: "",
                lastUpdated: new Date()
                // puoi aggiungere altri campi step-by-step se necessario
            [cite_start]}; [cite: 111]
            [cite_start]try { [cite: 112]
                await Backendless.Data.of("Orders").save(orderObj);
                [cite_start]successCount++; [cite: 113]
            } catch (err) {
                [cite_start]console.error("Errore import ordine:", err); [cite: 114]
                failCount++;
            }

            // Aggiorna progress bar
            [cite_start]const progress = Math.round(((i + 1) / total) * 100); [cite: 115]
            progressBar.style.width = progress + "%";
        }

        [cite_start]statusEl.textContent = `Importazione completata: ${successCount} successi, ${failCount} errori.`; [cite: 116]
        statusEl.className = failCount === 0 ? [cite_start]'status-message bg-green-100 text-green-700' : 'status-message bg-yellow-100 text-yellow-700'; [cite: 117]
        // Resetta file input
        [cite_start]fileInput.value = ""; [cite: 118]
        // Aggiorna lista ordini per il ruolo corrente
        if (currentRole === ROLES.PHOTOGRAPHER || currentRole === ROLES.POST_PRODUCER) {
            [cite_start]loadOrdersForUser(currentRole); [cite: 119]
        }
    };

    reader.readAsArrayBuffer(file);
}


// ----------------------------------------------------
// FUNZIONI WORKER (DASHBOARD) - PLACEHOLDERS
// ----------------------------------------------------

function loadOrdersForUser(role) {
    [cite_start]const tableBody = document.querySelector('#orders-table tbody'); [cite: 67]
    const loadingText = document.getElementById('loading-orders');

    loadingText.textContent = `Caricamento ordini per il ruolo ${role}...`;
    [cite_start]tableBody.innerHTML = ''; [cite: 68]
    // Determina lo stato degli ordini da caricare in base al ruolo
    [cite_start]let whereClause = ''; [cite: 69]
    if (role === ROLES.PHOTOGRAPHER) {
        [cite_start]whereClause = `status = '${STATUS.WAITING_PHOTO}'`; [cite: 70]
    } else if (role === ROLES.POST_PRODUCER) {
        [cite_start]whereClause = `status = '${STATUS.WAITING_POST_PRODUCTION}'`; [cite: 71]
    } else {
        [cite_start]tableBody.innerHTML = '<tr><td colspan="11">Ruolo non valido per la visualizzazione ordini.</td></tr>'; [cite: 72]
        return;
    }

    const queryBuilder = Backendless.DataQueryBuilder.create()
        .setWhereClause(whereClause)
        .setSortBy(['lastUpdated DESC'])
        [cite_start].setPageSize(50); [cite: 73]
    Backendless.Data.of(ORDER_TABLE_NAME).find(queryBuilder)
        .then(orders => {
            if (!orders || orders.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="11">Nessun ordine da visualizzare.</td></tr>';
                loadingText.textContent = '';
                return;
            }

            [cite_start]loadingText.textContent = ''; [cite: 74]
            document.getElementById('worker-role-display-queue').textContent = role;

            orders.forEach(order => {
                const row = tableBody.insertRow();

                row.insertCell().textContent = order.productCode || '';
                [cite_start]row.insertCell().textContent = order.eanCode || ''; [cite: 75]
                row.insertCell().textContent = order.styleName || '';
                row.insertCell().textContent = order.styleGroup || '';
                row.insertCell().textContent = order.brand || '';
                row.insertCell().textContent = order.color || '';
                row.insertCell().textContent = order.size || [cite_start]''; [cite: 76]
                row.insertCell().textContent = order.category || '';
                row.insertCell().textContent = order.gender || '';
                row.insertCell().textContent = order.status || [cite_start]''; [cite: 77]
                // Colonna Azioni
                [cite_start]const actionCell = row.insertCell(); [cite: 78]
                actionCell.classList.add('action-cell');

                // Bottone per aprire il modal foto
                [cite_start]const viewBtn = document.createElement('button'); [cite: 79]
                viewBtn.textContent = 'Visualizza Foto';
                viewBtn.className = 'btn-primary text-xs py-1 px-2';
                viewBtn.onclick = () => openPhotoModal(order.eanCode);

                actionCell.appendChild(viewBtn);
            [cite_start]}); [cite: 80]
        })
        .catch(error => {
            console.error("Errore nel caricamento ordini:", error);
            tableBody.innerHTML = `<tr><td colspan="11">Errore nel caricamento ordini: ${error.message}</td></tr>`;
            loadingText.textContent = '';
        [cite_start]}); [cite: 81]
}

// Funzione per aprire il modal dell'ordine (foto ecc.)
function openOrderModal(order) {
    [cite_start]document.getElementById('photo-modal').style.display = 'block'; [cite: 82]
    document.getElementById('modal-ean-title').textContent = order.eanCode || '';
    const modalContent = document.getElementById('photo-modal-content');
    modalContent.innerHTML = `
        <p><strong>Brand:</strong> ${order.brand || [cite_start]''}</p> [cite: 83]
        <p><strong>Categoria:</strong> ${order.category || [cite_start]''}</p> [cite: 84]
        <p><strong>Colore:</strong> ${order.color || [cite_start]''}</p> [cite: 85]
        <p><strong>Taglia:</strong> ${order.size || [cite_start]''}</p> [cite: 86]
        <p><strong>Status:</strong> ${order.status || [cite_start]''}</p> [cite: 87]
        <p><strong>Foto:</strong> ${order.photoStoragePath || 'Nessuna foto caricata'}</p>
    [cite_start]`; [cite: 88]
}

// 🔍 Conferma EAN o Codice Articolo e mostra azioni operative
async function confirmEanInput() {
  [cite_start]const eanInput = document.getElementById("ean-input").value.trim(); [cite: 120]
  const scanStatus = document.getElementById("scan-status");
  const actionsArea = document.getElementById("ean-actions-area");
  const photoUploadArea = document.getElementById("photo-upload-area"); // 🆕 Riferimento area foto
  [cite_start]const currentEanDisplay = document.querySelectorAll("#current-ean-display"); [cite: 121]

  if (!eanInput) {
    scanStatus.textContent = "Inserisci un codice EAN o un Codice Articolo!";
    [cite_start]scanStatus.className = "status-message status-error"; [cite: 122]
    scanStatus.classList.remove("hidden");
    actionsArea.classList.add("hidden");
    photoUploadArea.style.display = 'none'; // 🆕 Nascondi l'area foto
    return;
  }

  try {
    scanStatus.textContent = "Verifica in corso...";
    scanStatus.className = "status-message status-info";
    [cite_start]scanStatus.classList.remove("hidden"); [cite: 123]
    // 🔹 Query Backendless (EAN oppure Codice Articolo)
    const query = Backendless.DataQueryBuilder.create().setWhereClause(
      `eanCode='${eanInput}' OR productCode='${eanInput}'`
    [cite_start]); [cite: 124]
    const orders = await Backendless.Data.of("Orders").find(query);

    if (!orders || orders.length === 0) {
      [cite_start]scanStatus.textContent = `❌ Codice ${eanInput} non trovato in Backendless.`; [cite: 125]
      scanStatus.className = "status-message status-error";
      actionsArea.classList.add("hidden");
      photoUploadArea.style.display = 'none'; // 🆕 Nascondi l'area foto
      return;
    }

    // ✅ Codice trovato
    const order = orders[0];
    scanStatus.textContent = `✅ Codice ${eanInput} trovato. [cite_start]Compila o aggiorna i dati operativi.`; [cite: 126]
    scanStatus.className = "status-message status-success";
    // Mostra la sezione operativa
    [cite_start]actionsArea.classList.remove("hidden"); [cite: 127]
    currentEanDisplay.forEach((el) => (el.textContent = eanInput));

    // 🆕 Visualizza l'area di upload foto solo per i Fotografi
    if (currentRole === ROLES.PHOTOGRAPHER) {
        photoUploadArea.style.display = 'block';
    } else {
        photoUploadArea.style.display = 'none';
    }

    // 🔹 Popola i campi se già esistono dati
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
      [cite_start]"field-ordine": "ordine", [cite: 129]
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
    [cite_start]}; [cite: 130]
    Object.entries(map).forEach(([inputId, key]) => {
      const el = document.getElementById(inputId);
      if (el) el.value = order[key] || "";
    });
    // 🔹 Salva in memoria temporanea per aggiornamento successivo
    currentEanInProcess = { objectId: order.objectId, ean: eanInput }; [cite_start]// 🆕 Usiamo la variabile globale [cite: 131]
  [cite_start]} catch (err) { [cite: 132]
    console.error(err);
    scanStatus.textContent = "Errore durante la verifica EAN.";
    scanStatus.className = "status-message status-error";
    [cite_start]actionsArea.classList.add("hidden"); [cite: 133]
    photoUploadArea.style.display = 'none'; // 🆕 Nascondi l'area foto
  }
}

// 💾 Salva i dati operativi aggiornati su Backendless
async function saveEanUpdates() {
  [cite_start]const statusMsg = document.getElementById("update-status"); [cite: 134]
  // Controlla che ci sia un EAN attivo
  if (!currentEanInProcess) { // 🆕 Usiamo la variabile globale
    [cite_start]statusMsg.textContent = "⚠️ Nessun EAN attivo. Scannerizza un codice prima."; [cite: 135]
    statusMsg.className = "status-message status-error";
    statusMsg.classList.remove("hidden");
    return;
  }

  const ean = currentEanInProcess.ean; [cite_start]// 🆕 Usiamo la variabile globale [cite: 136]
  const objectId = currentEanInProcess.objectId; // 🆕 Usiamo la variabile globale
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
    [cite_start]"field-data-reso": "dataReso", [cite: 137]
    "field-ddt": "ddt",
    "field-note-logistica": "noteLogistica",
    "field-data-presa-post": "dataPresaPost",
    "field-data-consegna-post": "dataConsegnaPost",
    "field-calendario": "calendario",
    "field-postpresa": "postPresa",
  [cite_start]}; [cite: 138]
  // Costruisci l’oggetto aggiornato
  [cite_start]const updatedOrder = { objectId }; [cite: 139]
  Object.entries(map).forEach(([inputId, key]) => {
    const el = document.getElementById(inputId);
    if (el) updatedOrder[key] = el.value.trim();
  [cite_start]}); [cite: 140]
  // Aggiungi timestamp di aggiornamento
  [cite_start]updatedOrder.lastUpdated = new Date(); [cite: 141]
  try {
    statusMsg.textContent = "⏳ Salvataggio in corso...";
    statusMsg.className = "status-message status-info";
    statusMsg.classList.remove("hidden");

    [cite_start]await Backendless.Data.of("Orders").save(updatedOrder); [cite: 142]
    statusMsg.textContent = `✅ Aggiornamenti per ${ean} salvati correttamente!`;
    [cite_start]statusMsg.className = "status-message status-success"; [cite: 143]
    // Pulisci i campi dopo qualche secondo
    setTimeout(() => {
      statusMsg.classList.add("hidden");
    [cite_start]}, 4000); [cite: 144]
  } catch (err) {
    [cite_start]console.error("Errore durante il salvataggio:", err); [cite: 145]
    statusMsg.textContent = "❌ Errore durante il salvataggio su Backendless.";
    statusMsg.className = "status-message status-error";
    [cite_start]statusMsg.classList.remove("hidden"); [cite: 146]
  }
}

// 🆕 Funzione di reset generica (sostituisce cancelPhotoUpload)
function resetEanActionState() {
    showStatusMessage('scan-status', 'Lavorazione annullata.', false);
    currentEanInProcess = null;
    document.getElementById('photo-upload-area').style.display = 'none';
    document.getElementById('ean-actions-area').classList.add('hidden'); // 🆕 Nasconde anche le azioni
    document.getElementById('ean-input').value = '';
}

function closePhotoModal() {
    document.getElementById('photo-modal').style.display = 'none';
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
                        // Se l'utente è valido ma l'oggetto utente non ha il ruolo (cache), ricaricalo
                        if (!user || !user.role) {
                             [cite_start]return user; [cite: 149]
                        }
                        return user;
                    });
            } else {
                showLoginArea();
            }
        [cite_start]}) [cite: 150]
        .then(user => {
            if (user) {
                // Se user è un errore, viene catturato nel .catch precedente
                if (user && user.objectId) {
                    [cite_start]handleLoginSuccess(user); [cite: 151]
                } else {
                     showLoginArea(); [cite_start]// Se l'utente non è valido o l'oggetto è incompleto [cite: 152]
                }
            }
        })
        .catch(error => {
            console.error("Errore di inizializzazione sessione:", error);
            showLoginArea();
        [cite_start]}); [cite: 153]
}; // ❌ La chiusura } e il testo erano qui e bloccavano tutto. Ora è corretto.

