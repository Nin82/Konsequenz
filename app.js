// app.js - Blocco 1 di 3: Inizializzazione, Setup e Autenticazione

// --- CONFIGURAZIONE E INIZIALIZZAZIONE ---

// !!! CHIAVI BACKENDLESS (Valori corretti forniti dall'utente) !!!
const APPLICATION_ID = "C2A5C327-CF80-4BB0-8017-010681F0481C";
const JS_API_KEY = "B266000F-684B-4889-9174-2D1734001E08";

// Variabili globali di stato
let currentUser = null;
let currentRole = null;
let currentWorkingEAN = null;
let currentObjectId = null; // ID dell'ordine attualmente in lavorazione (per upload foto)

// Stati del Database e Nomi Tabelle
const ORDER_TABLE_NAME = "Orders";
const USER_TABLE_NAME = "Users";

// Nomi dei ruoli
const ROLES = {
    PHOTOGRAPHER: 'Photographer',
    POST_PRODUCER: 'PostProducer',
    ADMIN: 'Admin'
};

// Stadi del Workflow
const WORKFLOW_STATUS = {
    WAITING_ADMIN: "In attesa Admin", // Default all'importazione
    IN_MAGAZZINO: "In Magazzino", // 1. Scansione EAN in magazzino
    FOTO_SCATTATE: "Foto 1 Fatta", // 2. Photographer ha caricato le foto
    WAITING_POST_PROD: "In attesa Post Prod.", // 3. Le foto attendono l'accettazione (Stato per il Post Producer)
    FOTO_ACCETTATE: "Foto 2 Accettate", // 4. PostProducer accetta le foto
    FOTO_RIFIUTATE: "Foto 3 Rifiutate" // 5. PostProducer rifiuta le foto (ritorna al Photographer)
};


// Inizializzazione di Backendless e Service Worker
document.addEventListener('DOMContentLoaded', () => {
    if (typeof Backendless !== 'undefined') {
        try {
            Backendless.initApp(APPLICATION_ID, JS_API_KEY);
            console.log("Backendless inizializzato.");

            // Tenta di registrare il Service Worker (PWA)
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/service-worker.js')
                    .then(registration => console.log('Service Worker registrato:', registration.scope))
                    .catch(error => console.error('Service Worker fallito:', error));
            }
            
            // Verifica se l'utente è già loggato
            Backendless.UserService.getCurrentUser()
                .then(user => {
                    if (user) {
                        handleLoginSuccess(user);
                    } else {
                        showLoginArea("Inserisci le credenziali.");
                    }
                })
                .catch(error => {
                    console.error("Errore recupero utente corrente:", error);
                    showLoginArea("Sessione scaduta o errore di rete. Riprova.");
                });

        } catch (e) {
            console.error("Errore fatale: Backendless.initApp non è riuscito.", e);
            showLoginArea("Errore di configurazione del servizio (Controllare le chiavi API).");
        }
    } else {
        showLoginArea("Errore: La libreria Backendless (CDN) non è stata caricata. Controllare index.html.");
    }
});


// --- GESTIONE UTENTE E AUTENTICAZIONE ---

function getRoleFromUser(user) {
    // Backendless di default non include il ruolo. Lo leggiamo direttamente dal campo 'role'
    // che l'Admin imposta nella tabella Users.
    if (!user || !user.role) {
        return Promise.reject(new Error("Ruolo utente non trovato."));
    }
    return Promise.resolve(user.role);
}


function handleLoginSuccess(user) {
    currentUser = user;
    
    // Recupera il ruolo dall'utente (dovrebbe essere un campo nella tabella Users)
    getRoleFromUser(user)
        .then(role => {
            currentRole = role;
            
            const displayName = user.name || user.email;
            document.getElementById('worker-name').textContent = displayName;
            document.getElementById('worker-role').textContent = currentRole;
            
            document.getElementById('login-area').style.display = 'none';

            if (currentRole === ROLES.ADMIN) {
                document.getElementById('admin-dashboard').style.display = 'block';
                loadUsersAndRoles(); // Carica la tabella utenti per l'Admin
            } else if (currentRole === ROLES.PHOTOGRAPHER || currentRole === ROLES.POST_PRODUCER) {
                document.getElementById('worker-dashboard').style.display = 'block';
                loadOrdersForUser(currentRole); // Carica gli ordini pertinenti
            } else {
                showLoginArea("Ruolo utente non autorizzato.");
                handleLogout();
            }
        })
        .catch(roleError => {
            console.error(`Errore nel recupero del ruolo: ${roleError.message}`);
            showLoginArea(`Accesso fallito: ${roleError.message}`);
            Backendless.UserService.logout(); 
        });
}

function handleStandardLogin(email, password) {
    const statusDisplay = document.getElementById('login-status');
    statusDisplay.textContent = "Accesso in corso...";

    Backendless.UserService.login(email, password, true)
        .then(user => {
            handleLoginSuccess(user);
        })
        .catch(error => {
            console.error("Errore di Login:", error);
            // Mostra un messaggio di errore informativo
            let displayMessage = error.message || "Credenziali non valide o utente non confermato.";
            statusDisplay.textContent = `Login fallito: ${displayMessage}`;
        });
}

function handlePasswordRecovery() {
    const email = document.getElementById('user-email').value.trim();
    const statusDisplay = document.getElementById('login-status');

    if (!email) {
        statusDisplay.textContent = "Inserisci la tua email per il recupero password.";
        return;
    }

    statusDisplay.textContent = "Invio richiesta di reset password in corso...";

    Backendless.UserService.restorePassword(email)
        .then(() => {
            statusDisplay.textContent = `Istruzioni di reset inviate a ${email}. Controlla la tua casella email.`;
            document.getElementById('user-password').value = '';
        })
        .catch(error => {
            console.error("Errore recupero password:", error);
            statusDisplay.textContent = `Errore reset: ${error.message}. Assicurati che l'email sia corretta.`;
        });
}

function handleLogout() {
    Backendless.UserService.logout()
        .then(() => {
            showLoginArea("Logout completato.");
            window.location.reload();
        })
        .catch(error => {
            console.error("Errore Logout:", error);
            showLoginArea("Errore durante il logout. Riprova.");
        });
}

function showLoginArea(message) {
    document.getElementById('admin-dashboard').style.display = 'none';
    document.getElementById('worker-dashboard').style.display = 'none';
    document.getElementById('login-area').style.display = 'block';
    document.getElementById('login-status').textContent = message;
}

// --- FINE SEZIONE 1 ---

// app.js - Blocco 2 di 3: Dashboard Admin e Logica Workflow

// --- FUNZIONI UTILITY PER IL WORKFLOW ---

/**
 * Aggiorna lo stato di un ordine nel database.
 * @param {string} objectId L'ID dell'oggetto ordine.
 * @param {string} newStatus Il nuovo stato del workflow (da WORKFLOW_STATUS).
 * @param {object} [extraData={}] Dati aggiuntivi da aggiornare (es. photoLink).
 * @returns {Promise<object>} L'oggetto aggiornato.
 */
function updateOrderStatus(objectId, newStatus, extraData = {}) {
    const data = {
        objectId: objectId,
        status: newStatus,
        lastUpdated: new Date().toISOString(),
        ...extraData
    };
    const dataStore = Backendless.Data.of(ORDER_TABLE_NAME);
    return dataStore.save(data);
}

// --- LOGICA DASHBOARD LAVORATORE (Photographer/PostProducer) ---

/**
 * Carica gli ordini pertinenti per l'utente loggato.
 * @param {string} role Il ruolo dell'utente (Photographer o PostProducer).
 */
function loadOrdersForUser(role) {
    const loadingStatusEl = document.getElementById('loading-orders');
    loadingStatusEl.textContent = 'Caricamento ordini in corso...';
    
    let whereClause = "";
    
    if (role === ROLES.PHOTOGRAPHER) {
        // Il Fotografo vede gli ordini da fare o da rifare
        whereClause = `status IN ('${WORKFLOW_STATUS.IN_MAGAZZINO}', '${WORKFLOW_STATUS.FOTO_RIFIUTATE}')`;
    } else if (role === ROLES.POST_PRODUCER) {
        // Il Post Producer vede solo gli ordini in attesa della sua approvazione
        whereClause = `status = '${WORKFLOW_STATUS.WAITING_POST_PROD}'`;
    } else {
        // L'Admin usa una funzione diversa per vedere tutti gli ordini
        loadingStatusEl.textContent = '';
        return; 
    }

    const queryBuilder = Backendless.DataQueryBuilder.create()
        .setWhereClause(whereClause)
        .setSortBy(['lastUpdated DESC']);
    
    Backendless.Data.of(ORDER_TABLE_NAME).find(queryBuilder)
        .then(orders => {
            loadingStatusEl.textContent = `Trovati ${orders.length} ordini in attesa.`;
            renderOrdersTable(orders);
        })
        .catch(error => {
            console.error("Errore nel caricamento degli ordini:", error);
            loadingStatusEl.textContent = 'Errore nel caricamento degli ordini dal database.';
            renderOrdersTable([]);
        });
}

/**
 * Renderizza la tabella degli ordini per il lavoratore.
 * @param {Array<object>} orders Lista degli ordini da visualizzare.
 */
function renderOrdersTable(orders) {
    const tbody = document.getElementById('orders-table').querySelector('tbody');
    tbody.innerHTML = ''; // Pulisce la tabella
    
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Nessun ordine in attesa di lavorazione.</td></tr>';
        return;
    }

    orders.forEach(order => {
        const row = tbody.insertRow();
        
        // Colonna EAN Code
        row.insertCell().textContent = order.eanCode || 'N/D';
        // Colonna Cliente
        row.insertCell().textContent = order.cliente || 'N/D';
        // Colonna Stato Attuale
        row.insertCell().textContent = order.status;

        // Colonna Azioni
        const actionCell = row.insertCell();
        actionCell.className = 'action-cell';

        // Logica Azioni in base al Ruolo e allo Stato
        if (currentRole === ROLES.PHOTOGRAPHER) {
            // Fotografo: Può solo procedere scansionando l'EAN
            actionCell.textContent = "Scannerizza l'EAN per lavorare.";

        } else if (currentRole === ROLES.POST_PRODUCER) {
            // Post Producer: Può visualizzare le foto e decidere
            const viewButton = document.createElement('button');
            viewButton.textContent = 'Vedi Foto';
            viewButton.className = 'btn-warning'; // Giallo/Arancione per 'Vedi'
            viewButton.onclick = () => showPhotoModal(order);
            actionCell.appendChild(viewButton);
        }
    });
}

/**
 * Gestisce l'input EAN (tramite scanner o digitazione).
 */
function confirmEanInput() {
    const ean = document.getElementById('ean-input').value.trim();
    const statusEl = document.getElementById('scan-status');
    statusEl.textContent = 'Verifica EAN in corso...';

    if (!ean) {
        statusEl.textContent = 'Per favore, inserisci un codice EAN valido.';
        return;
    }

    // Ricerca l'ordine corrispondente all'EAN
    const queryBuilder = Backendless.DataQueryBuilder.create()
        .setWhereClause(`eanCode = '${ean}'`);
        
    Backendless.Data.of(ORDER_TABLE_NAME).find(queryBuilder)
        .then(orders => {
            if (orders.length === 0) {
                statusEl.textContent = `ERRORE: Ordine con EAN ${ean} non trovato.`;
                cancelPhotoUpload(); // Resetta l'area di upload
                return;
            }

            const order = orders[0];
            currentWorkingEAN = ean;
            currentObjectId = order.objectId;
            
            // Logica di avanzamento del workflow in base al ruolo
            processEanWorkflow(order, statusEl);
        })
        .catch(error => {
            console.error("Errore durante la ricerca EAN:", error);
            statusEl.textContent = 'Errore di connessione al database.';
            cancelPhotoUpload();
        });
}

/**
 * Logica di avanzamento del workflow per l'EAN scansionato.
 * @param {object} order L'oggetto ordine.
 * @param {HTMLElement} statusEl L'elemento dove mostrare lo stato.
 */
function processEanWorkflow(order, statusEl) {
    const uploadArea = document.getElementById('photo-upload-area');

    if (currentRole === ROLES.PHOTOGRAPHER) {
        
        if (order.status === WORKFLOW_STATUS.IN_MAGAZZINO || order.status === WORKFLOW_STATUS.FOTO_RIFIUTATE) {
            // Stato corretto per il Fotografo: Può iniziare a lavorare/rifare
            document.getElementById('current-ean-display').textContent = order.eanCode;
            uploadArea.style.display = 'block';
            uploadArea.classList.add('animate-shake'); // Aggiunge animazione
            statusEl.textContent = `Ordine EAN ${order.eanCode} pronto per l'Upload.`;

            // Aggiorna lo stato a "In Lavorazione (Fotografo)"
            updateOrderStatus(order.objectId, WORKFLOW_STATUS.FOTO_SCATTATE)
                .then(() => loadOrdersForUser(currentRole)) // Ricarica la lista per rimuoverlo subito
                .catch(err => console.error("Errore aggiornamento stato a FOTO_SCATTATE:", err));
                
        } else if (order.status === WORKFLOW_STATUS.WAITING_ADMIN) {
            // Stato iniziale: L'Admin deve approvare/iniziare
            statusEl.textContent = `Ordine EAN ${order.eanCode} è in attesa di approvazione Admin.`;
            cancelPhotoUpload();
            
        } else {
            // Stato non lavorabile dal Fotografo (es. WAITING_POST_PROD o DONE)
            statusEl.textContent = `Ordine EAN ${order.eanCode} è nello stato "${order.status}" e non può essere lavorato.`;
            cancelPhotoUpload();
        }

    } else if (currentRole === ROLES.POST_PRODUCER) {
        // Il Post Producer non usa l'input EAN per lavorare, ma la tabella
        if (order.status === WORKFLOW_STATUS.WAITING_POST_PROD) {
            statusEl.textContent = `Ordine EAN ${order.eanCode} in attesa di revisione. Utilizza la tabella per vedere le foto.`;
            showPhotoModal(order); // Apre la modale per la revisione
        } else {
            statusEl.textContent = `Ordine EAN ${order.eanCode} non in attesa di post-produzione. Stato: ${order.status}`;
        }
        cancelPhotoUpload();
    }
    
    // Pulisce l'input EAN
    document.getElementById('ean-input').value = ''; 
}

/**
 * Annulla l'upload e resetta l'area di lavoro EAN.
 */
function cancelPhotoUpload() {
    const uploadArea = document.getElementById('photo-upload-area');
    uploadArea.style.display = 'none';
    uploadArea.classList.remove('animate-shake');
    document.getElementById('photo-files').value = '';
    document.getElementById('current-ean-display').textContent = '';
    document.getElementById('upload-status-message').textContent = '';
    currentWorkingEAN = null;
    currentObjectId = null;
}

// --- LOGICA IMPORT EXCEL (Admin) ---

/**
 * Legge e parsifica il file Excel caricato.
 */
function handleFileUpload() {
    const fileInput = document.getElementById('excel-file-input');
    const file = fileInput.files[0];
    const statusEl = document.getElementById('import-status');
    statusEl.textContent = 'Parsing del file in corso...';
    
    if (!file) {
        statusEl.textContent = 'Seleziona un file Excel prima di caricare.';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // Converte il foglio in un array di oggetti JSON
            const json = XLSX.utils.sheet_to_json(worksheet, {
                header: ['eanCode', 'cliente'], // Assumiamo le colonne EAN e Cliente
                range: 1 // Salta la prima riga se contiene l'intestazione
            });

            statusEl.textContent = `Trovati ${json.length} record. Salvataggio su Backendless...`;
            uploadOrdersToBackendless(json);

        } catch (error) {
            console.error("Errore durante il parsing Excel:", error);
            statusEl.textContent = `ERRORE nel parsing del file: ${error.message}`;
        }
    };
    reader.readAsArrayBuffer(file);
}

/**
 * Carica gli ordini parsificati nel database Backendless.
 * @param {Array<object>} orders I dati degli ordini.
 */
function uploadOrdersToBackendless(orders) {
    const statusEl = document.getElementById('import-status');
    const ordersToSave = orders.map(order => ({
        eanCode: String(order.eanCode).trim(), // Assicura che l'EAN sia una stringa pulita
        cliente: order.cliente || 'N/D',
        status: WORKFLOW_STATUS.IN_MAGAZZINO, // Stato iniziale del workflow
        lastUpdated: new Date().toISOString()
    }));

    // Uso del metodo "bulkCreate" se supportato, altrimenti salvataggio singolo.
    // Backendless supporta il salvataggio in batch tramite `save()` con un array.
    Backendless.Data.of(ORDER_TABLE_NAME).save(ordersToSave)
        .then(savedOrders => {
            statusEl.textContent = `Caricamento completato. ${savedOrders.length} nuovi ordini creati e messi nello stato "${WORKFLOW_STATUS.IN_MAGAZZINO}".`;
            document.getElementById('excel-file-input').value = '';
            document.getElementById('import-button').disabled = true;
        })
        .catch(error => {
            console.error("Errore durante il salvataggio degli ordini:", error);
            statusEl.textContent = `ERRORE nel salvataggio degli ordini: ${error.message}`;
        });
}

// --- LOGICA UPLOAD FOTO (Photographer) ---

/**
 * Gestisce l'upload delle foto e completa la fase "Foto 1 Fatta".
 */
function handlePhotoUploadAndCompletion() {
    const fileInput = document.getElementById('photo-files');
    const files = fileInput.files;
    const statusEl = document.getElementById('upload-status-message');

    if (!currentWorkingEAN || !currentObjectId) {
        statusEl.textContent = 'Errore: Nessun EAN in lavorazione.';
        return;
    }

    if (files.length === 0) {
        statusEl.textContent = 'Seleziona almeno un file da caricare.';
        return;
    }

    statusEl.textContent = `Caricamento di ${files.length} file in corso...`;
    
    // Backendless File Upload - Creazione della cartella EAN
    const folderPath = `${FILE_PATHS.PHOTO_UPLOAD}${currentWorkingEAN}/`;
    
    // Inizializza l'array per tenere traccia degli URL dei file
    const fileUrls = [];
    const uploadPromises = [];

    // Crea una Promessa per l'upload di ciascun file
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const promise = Backendless.Files.upload(file, folderPath, true)
            .then(fileUrl => {
                fileUrls.push(fileUrl);
                statusEl.textContent = `Caricamento file ${i + 1}/${files.length} completato.`;
            })
            .catch(error => {
                console.error(`Errore upload file ${file.name}:`, error);
                throw new Error(`Errore caricamento file ${file.name}.`); // Ferma il processo
            });
        uploadPromises.push(promise);
    }

    // Esegue tutti gli upload in parallelo
    Promise.all(uploadPromises)
        .then(() => {
            // TUTTI GLI UPLOAD SONO RIUSCITI
            statusEl.textContent = 'Upload completato. Aggiornamento stato ordine...';
            
            // 1. Aggiorna lo stato dell'ordine al Post Producer
            const photoLinks = fileUrls.join('\n'); // Salva gli URL come stringa separata da newline
            
            return updateOrderStatus(currentObjectId, WORKFLOW_STATUS.WAITING_POST_PROD, { 
                photoLinks: photoLinks, 
                photographerId: currentUser.objectId // Registra chi ha fatto il lavoro
            });
        })
        .then(() => {
            // 2. Successo finale
            statusEl.textContent = `Fase Foto completata per EAN ${currentWorkingEAN}. In attesa Post Producer.`;
            cancelPhotoUpload();
            loadOrdersForUser(currentRole); // Aggiorna la lista
        })
        .catch(finalError => {
            // 3. Fallimento generale
            console.error("Errore finale del processo di upload:", finalError);
            statusEl.textContent = `ERRORE CRITICO: ${finalError.message}. Ordine non aggiornato.`;
        });
}


// --- FINE SEZIONE 2 ---

// app.js - Blocco 3 di 3: Gestione Utenti Admin e Funzioni di Supporto

// Variabile per il percorso di base per l'upload dei file
const FILE_PATHS = {
    PHOTO_UPLOAD: "product_photos/" // La cartella base dove vanno gli EAN
};

// --- LOGICA GESTIONE UTENTI (Admin) ---

/**
 * Carica tutti gli utenti (Admin) e li renderizza in una tabella.
 */
function loadUsersAndRoles() {
    const loadingEl = document.getElementById('loading-users');
    loadingEl.textContent = 'Caricamento lista utenti...';
    
    // Query per ottenere tutti gli utenti (escluso l'utente corrente)
    const queryBuilder = Backendless.DataQueryBuilder.create()
        .setWhereClause(`objectId != '${currentUser.objectId}'`)
        .setSortBy(['email ASC']);
    
    Backendless.Data.of(USER_TABLE_NAME).find(queryBuilder)
        .then(users => {
            loadingEl.textContent = `Trovati ${users.length} utenti.`;
            renderUsersTable(users);
        })
        .catch(error => {
            console.error("Errore nel caricamento utenti:", error);
            loadingEl.textContent = 'Errore nel caricamento utenti dal database.';
            renderUsersTable([]);
        });
}

/**
 * Renderizza la tabella degli utenti e delle loro azioni (Admin).
 * @param {Array<object>} users Lista degli utenti.
 */
function renderUsersTable(users) {
    const tbody = document.getElementById('users-table').querySelector('tbody');
    tbody.innerHTML = '';
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Nessun utente trovato.</td></tr>';
        return;
    }

    users.forEach(user => {
        const row = tbody.insertRow();
        const currentRoleValue = user.role || 'N/D';
        
        row.insertCell().textContent = user.email;
        row.insertCell().textContent = currentRoleValue;

        const actionCell = row.insertCell();
        actionCell.className = 'action-cell';

        // Select per il cambio ruolo
        const roleSelect = document.createElement('select');
        roleSelect.id = `select-role-${user.objectId}`;
        roleSelect.innerHTML = `
            <option value="Photographer" ${currentRoleValue === ROLES.PHOTOGRAPHER ? 'selected' : ''}>Photographer</option>
            <option value="PostProducer" ${currentRoleValue === ROLES.POST_PRODUCER ? 'selected' : ''}>Post Producer</option>
            <option value="Admin" ${currentRoleValue === ROLES.ADMIN ? 'selected' : ''}>Admin</option>
        `;
        actionCell.appendChild(roleSelect);
        
        // Bottone per l'aggiornamento
        const updateButton = document.createElement('button');
        updateButton.textContent = 'Aggiorna Ruolo';
        updateButton.className = 'btn-secondary';
        updateButton.style.marginLeft = '10px';
        updateButton.onclick = () => handleRoleUpdate(user.objectId, roleSelect.value);
        actionCell.appendChild(updateButton);
    });
}

/**
 * Aggiorna il ruolo di un utente specifico.
 * @param {string} userId L'objectId dell'utente.
 * @param {string} newRole Il nuovo ruolo da assegnare.
 */
function handleRoleUpdate(userId, newRole) {
    const statusEl = document.getElementById('loading-users');
    statusEl.textContent = `Aggiornamento ruolo per utente ${userId}...`;

    const userUpdate = {
        objectId: userId,
        role: newRole
    };
    
    Backendless.Data.of(USER_TABLE_NAME).save(userUpdate)
        .then(() => {
            statusEl.textContent = `Ruolo aggiornato con successo a ${newRole}.`;
            loadUsersAndRoles(); // Ricarica la lista per mostrare il cambio
        })
        .catch(error => {
            console.error("Errore nell'aggiornamento ruolo:", error);
            statusEl.textContent = `ERRORE: Impossibile aggiornare il ruolo: ${error.message}`;
        });
}

/**
 * Gestisce la creazione di un nuovo utente (Admin).
 */
function handleUserCreation() {
    const email = document.getElementById('new-user-email').value.trim();
    const password = document.getElementById('new-user-password').value;
    const role = document.getElementById('new-user-role').value;
    const statusEl = document.getElementById('user-creation-status');
    statusEl.textContent = 'Creazione in corso...';

    if (!email || !password || !role) {
        statusEl.textContent = 'Per favore, compila tutti i campi.';
        return;
    }

    const newUser = {
        email: email,
        password: password,
        role: role,
        name: email.split('@')[0] // Nome Utente di default
    };

    // 1. Registra l'utente (Backendless gestirà la conferma email se abilitata)
    Backendless.UserService.register(newUser)
        .then(user => {
            statusEl.textContent = `Utente ${email} creato con successo. Il ruolo ${role} è stato assegnato.`;
            document.getElementById('new-user-email').value = '';
            document.getElementById('new-user-password').value = '';
            document.getElementById('new-user-role').value = '';
            loadUsersAndRoles(); // Aggiorna la lista
        })
        .catch(error => {
            console.error("Errore creazione utente:", error);
            statusEl.textContent = `ERRORE: Impossibile creare utente: ${error.message}`;
        });
}

// --- LOGICA MODALE E POST PRODUCER ---

/**
 * Mostra la modale con i dettagli e le foto di un ordine.
 * @param {object} order L'oggetto ordine.
 */
function showPhotoModal(order) {
    const modalContent = document.getElementById('photo-modal-content');
    const links = order.photoLinks ? order.photoLinks.split('\n').filter(l => l.trim() !== '') : [];
    
    if (links.length === 0) {
        modalContent.innerHTML = `<p class="text-danger">ERRORE: Nessun link alle foto trovato per EAN ${order.eanCode}.</p>`;
        return;
    }

    let htmlContent = `
        <h3 style="color: #007bff;">Revisione EAN: ${order.eanCode}</h3>
        <p>Cliente: <strong>${order.cliente}</strong></p>
        <p>Inviato da: ${order.photographerId || 'N/D'}</p>
        <h4>Immagini da Revisionare:</h4>
        <div style="max-height: 400px; overflow-y: auto; padding: 10px; border: 1px solid #ccc;">
    `;

    // Aggiunge le immagini e i link
    links.forEach(link => {
        htmlContent += `
            <div style="margin-bottom: 20px; border-bottom: 1px dashed #eee;">
                <a href="${link}" target="_blank" style="font-size: 0.9em; display: block; margin-bottom: 10px;">${link}</a>
                <img src="${link}" onerror="this.onerror=null;this.src='https://placehold.co/300x200/cccccc/333333?text=Anteprima+non+disponibile';" 
                     style="width: 100%; max-width: 300px; height: auto; border-radius: 4px; display: block; margin-bottom: 10px;">
            </div>
        `;
    });
    
    htmlContent += `</div>`;


    // Aggiunge i bottoni di azione (solo per Post Producer)
    if (currentRole === ROLES.POST_PRODUCER) {
        htmlContent += `
            <div style="margin-top: 20px; text-align: center;">
                <button class="btn-success" onclick="handlePostProducerAction('${order.objectId}', true)">Accetta Lavoro</button>
                <button class="btn-danger" onclick="handlePostProducerAction('${order.objectId}', false)">Rifiuta e Invia al Fotografo</button>
            </div>
        `;
    }

    modalContent.innerHTML = htmlContent;
    document.getElementById('photo-modal').style.display = 'block';
}

/**
 * Nasconde la modale di visualizzazione foto.
 */
function closePhotoModal() {
    document.getElementById('photo-modal').style.display = 'none';
    document.getElementById('photo-modal-content').innerHTML = '';
}

/**
 * Gestisce l'azione (Accetta/Rifiuta) del Post Producer.
 * @param {string} objectId L'ID dell'ordine.
 * @param {boolean} accepted True se accettato, False se rifiutato.
 */
function handlePostProducerAction(objectId, accepted) {
    closePhotoModal(); // Chiude la modale
    const statusEl = document.getElementById('loading-orders');
    statusEl.textContent = `Azione Post Producer in corso...`;

    const newStatus = accepted ? WORKFLOW_STATUS.FOTO_ACCETTATE : WORKFLOW_STATUS.FOTO_RIFIUTATE;
    
    updateOrderStatus(objectId, newStatus, { postProducerId: currentUser.objectId })
        .then(() => {
            let message = accepted ? 
                "Lavoro Accettato. Workflow completato per questo EAN." : 
                "Lavoro Rifiutato. EAN rimesso in coda per il Fotografo.";
                
            statusEl.textContent = message;
            loadOrdersForUser(currentRole); // Ricarica la lista
        })
        .catch(error => {
            console.error("Errore nell'azione Post Producer:", error);
            statusEl.textContent = `ERRORE: Impossibile completare l'azione: ${error.message}`;
        });
}

// Collegamento del listener di chiusura modale al click fuori dalla modale
window.onclick = function(event) {
    const modal = document.getElementById('photo-modal');
    if (event.target === modal) {
        closePhotoModal();
    }
}
