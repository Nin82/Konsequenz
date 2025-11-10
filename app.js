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
                document.getElementById('admin-dashboard').style.display = 'block';
                document.getElementById('worker-dashboard').style.display = 'none'; 
                loadUsersAndRoles(); 
            } else if (currentRole === ROLES.PHOTOGRAPHER || currentRole === ROLES.POST_PRODUCER) {
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

function handleFileUpload() {
    const fileInput = document.getElementById('excel-file-input');
    const statusEl = document.getElementById('import-status');

    if (!fileInput.files || fileInput.files.length === 0) {
        statusEl.textContent = "Seleziona un file Excel prima di procedere.";
        statusEl.className = 'status-message bg-red-100 text-red-700';
        statusEl.style.display = 'block';
        return;
    }

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
            statusEl.className = 'status-message bg-red-100 text-red-700';
            statusEl.style.display = 'block';
            return;
        }

        statusEl.textContent = `Inizio importazione di ${jsonData.length} ordini...`;
        statusEl.className = 'status-message bg-blue-100 text-blue-700';
        statusEl.style.display = 'block';

        let progressBar = document.getElementById('import-progress-bar');
        const total = jsonData.length;
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i];
            const orderObj = {
                productCode: row["Codice Articolo"] || "",
                eanCode: row["Ean Code"] || "",
                styleName: row["Style Name"] || "",
                styleGroup: row["Style Group"] || "",
                brand: row["Brand"] || "",
                color: row["Colore"] || "",
                size: row["Taglia"] || "",
                category: row["Categoria"] || "",
                gender: row["Genere"] || "",
                status: STATUS_WAITING_PHOTO, // 💡 USA LA NUOVA COSTANTE
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

        statusEl.textContent = `Importazione completata: ${successCount} successi, ${failCount} errori.`;
        statusEl.className = failCount === 0 ? 'status-message bg-green-100 text-green-700' : 'status-message bg-yellow-100 text-yellow-700';
        
        fileInput.value = "";
        if (currentRole === ROLES.PHOTOGRAPHER || currentRole === ROLES.POST_PRODUCER) {
            loadOrdersForUser(currentRole);
        }
    };

    reader.readAsArrayBuffer(file);
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
    
    // Rimuove tutte le classi di stato precedenti
    feedbackElement.classList.remove('status-success', 'status-error', 'status-info', 'status-info');
    
    // Imposta il tipo e il testo del messaggio
    feedbackElement.textContent = message;
    feedbackElement.classList.add(`status-${type}`);
    feedbackElement.classList.remove('hidden');

    // Nasconde il messaggio dopo 3 secondi
    setTimeout(() => {
        feedbackElement.classList.add('hidden');
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
