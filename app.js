// Configurazione Backendless (sostituisci con le tue chiavi reali)
const APPLICATION_ID = 'C2A5C327-CF80-4BB0-8017-010681F0481C'; // <--- Aggiorna qui
const API_KEY = 'B266000F-684B-4889-9174-2D1734001E08';       // <--- Aggiorna qui

// Nomi delle tabelle
const USER_TABLE_NAME = "Users";
const ORDER_TABLE_NAME = "Orders";
const STORAGE_CONTAINER_NAME = "product_photos";

// Stati Ordine
const STATUS = {
    WAITING_PHOTO: "In attesa foto", // Inizia qui
    IN_PHOTO_PROCESS: "Fotografia in corso", // Durante la sessione foto
    WAITING_POST_PRODUCTION: "In attesa post-produzione",
    IN_POST_PROCESS: "Post-produzione in corso", // Durante la sessione post
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
    
    // Assicurati che gli stati di upload/scansione siano resettati
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

/**
 * Funzione per recuperare il ruolo utente.
 * Nota: il campo "role" deve esistere nella tabella Users.
 */
function getRoleFromUser(user) {
    // Se il campo role è già sull'oggetto utente, usalo direttamente
    if (user.role) {
        return Promise.resolve(user.role);
    }

    // Altrimenti, fai una chiamata per recuperare l'oggetto utente con la colonna 'role'
    const queryBuilder = Backendless.DataQueryBuilder.create()
        .setProperties(["objectId", "role"])
        .setWhereClause(`objectId = '${user.objectId}'`);

    return Backendless.Data.of(USER_TABLE_NAME).find(queryBuilder)
        .then(result => {
            if (result && result.length > 0) {
                return result[0].role || 'Nessun Ruolo'; // Ritorna il ruolo
            }
            return 'Nessun Ruolo'; // Fallback
        })
        .catch(error => {
            console.error("Errore nel recupero del ruolo:", error);
            return 'Nessun Ruolo'; // Fallback in caso di errore
        });
}

function handleLoginSuccess(user) {
    currentUser = user;
    
    // >>> LOG CRITICO 1: Login avvenuto, Recupero Ruolo in corso.
    console.log("LOGIN SUCCESS: Tentativo di recuperare il ruolo per l'utente.", user); 
    
    getRoleFromUser(user)
        .then(role => {
            currentRole = role;
            
            const displayName = user.name || user.email;
            document.getElementById('worker-name').textContent = displayName;
            document.getElementById('worker-role').textContent = currentRole;
            
            document.getElementById('login-area').style.display = 'none';

            if (currentRole === ROLES.ADMIN) {
                // >>> LOG CRITICO 2: Ruolo Admin rilevato, si tenta di mostrare la dashboard.
                console.log("RUOLO ADMIN: Mostro dashboard e carico utenti."); 
                document.getElementById('admin-dashboard').style.display = 'block';
                document.getElementById('worker-dashboard').style.display = 'none'; // Nascondi worker
                loadUsersAndRoles(); // Carica la tabella utenti per l'Admin
            } else if (currentRole === ROLES.PHOTOGRAPHER || currentRole === ROLES.POST_PRODUCER) {
                document.getElementById('admin-dashboard').style.display = 'none'; // Nascondi Admin
                document.getElementById('worker-dashboard').style.display = 'block';
                loadOrdersForUser(currentRole); // Carica gli ordini pertinenti
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
    
    if (!users || users.length === 0) {
        document.getElementById('loading-users').textContent = "Nessun utente trovato (a parte te, Admin).";
        return;
    }
    
    document.getElementById('loading-users').style.display = 'none';

    users.forEach(user => {
        // Ignora l'utente Admin loggato per prevenire l'auto-rimozione
        if (user.objectId === currentUser.objectId) return; 

        const row = tableBody.insertRow();
        
        // Colonna 1: Email
        row.insertCell().textContent = user.email;

        // Colonna 2: Ruolo Attuale
        const currentRoleCell = row.insertCell();
        currentRoleCell.textContent = user.role || 'Nessun Ruolo';
        
        // Colonna 3: Cambia Ruolo / Elimina
        const actionCell = row.insertCell();
        actionCell.classList.add('action-cell');

        // Select per il cambio ruolo
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

        // Bottone per salvare il ruolo
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Salva Ruolo';
        saveButton.className = 'btn-success text-xs py-1 px-2 mr-2';
        saveButton.onclick = () => updateRole(user.objectId, roleSelect.value);

        // Bottone per eliminare l'utente
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
    try {
        console.log("Inizio: Caricamento lista utenti e ruoli per dashboard Admin.");
        
        // Backendless non gestisce direttamente i ruoli in una singola proprietà dell'utente, 
        // ma si affida al campo "role" che abbiamo aggiunto alla tabella Users.
        const queryBuilder = Backendless.DataQueryBuilder.create()
            .setProperties(["objectId", "email", "role"]) // Richiedi esplicitamente l'email e il nostro campo 'role'
            .setPageSize(50); // Limite di 50 utenti

        Backendless.Data.of(USER_TABLE_NAME).find(queryBuilder)
            .then(users => {
                console.log("Utenti caricati:", users);
                renderUsersTable(users);
            })
            .catch(error => {
                // >>> LOG CRITICO 3: Errore nella query (Probabilmente permessi)
                console.error("ERRORE CRITICO in loadUsersAndRoles (Find):", error);
                document.getElementById('loading-users').textContent = 
                    `ERRORE: Impossibile caricare gli utenti. Controlla i permessi READ sulla tabella 'Users' (Errore: ${error.message}).`;
                document.getElementById('loading-users').style.color = '#dc2626';
            });
    } catch (e) {
        // >>> LOG CRITICO 4: Errore sincrono (es. ID HTML sbagliato)
        console.error("ERRORE SINCRONO in loadUsersAndRoles:", e);
        document.getElementById('loading-users').textContent = 
            `ERRORE SINCRONO: La dashboard non può essere visualizzata (Errore: ${e.message}).`;
        document.getElementById('loading-users').style.color = '#dc2626';
    }
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
            loadUsersAndRoles(); // Ricarica la tabella
        })
        .catch(error => {
            showStatusMessage('user-creation-status', `Errore nell'aggiornamento del ruolo: ${error.message}`, false);
            console.error("Errore aggiornamento ruolo:", error);
        });
}

function deleteUser(userId, email) {
    // In un ambiente reale, useremmo un modale al posto di alert/confirm
    if (confirm(`Sei sicuro di voler eliminare l'utente ${email}?`)) {
        Backendless.Data.of(USER_TABLE_NAME).remove({ objectId: userId })
            .then(() => {
                showStatusMessage('user-creation-status', `Utente ${email} eliminato con successo.`, true);
                loadUsersAndRoles(); // Ricarica la tabella
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
        };

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
        console.error("Errore creazione utente:", error);
        showStatusMessage('user-creation-status', `Creazione Utente Fallita: ${error.message}`, false);
    });
}

// Funzione di gestione file Excel (PLACEHOLDER, da implementare nel dettaglio)
function handleFileUpload() {
    // Implementazione del caricamento file Excel e parsing
    showStatusMessage('import-status', 'Funzione di importazione file Excel in fase di implementazione.', true);
}


// ----------------------------------------------------
// FUNZIONI WORKER (DASHBOARD) - PLACEHOLDERS
// ----------------------------------------------------

function loadOrdersForUser(role) {
    const tableBody = document.querySelector('#orders-table tbody');
    const loadingText = document.getElementById('loading-orders');

    loadingText.textContent = `Caricamento ordini per il ruolo ${role}...`;
    tableBody.innerHTML = '';

    // Determina lo stato degli ordini da caricare in base al ruolo
    let whereClause = '';
    if (role === ROLES.PHOTOGRAPHER) {
        whereClause = `status = '${STATUS.WAITING_PHOTO}'`;
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

                // Colonna Azioni
                const actionCell = row.insertCell();
                actionCell.classList.add('action-cell');

                // Bottone per aprire il modal foto
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

// Funzione per aprire il modal dell'ordine (foto ecc.)
function openOrderModal(order) {
    document.getElementById('photo-modal').style.display = 'block';
    document.getElementById('modal-ean-title').textContent = order.eanCode || '';
    const modalContent = document.getElementById('photo-modal-content');
    modalContent.innerHTML = `
        <p><strong>Brand:</strong> ${order.brand || ''}</p>
        <p><strong>Categoria:</strong> ${order.category || ''}</p>
        <p><strong>Colore:</strong> ${order.color || ''}</p>
        <p><strong>Taglia:</strong> ${order.size || ''}</p>
        <p><strong>Status:</strong> ${order.status || ''}</p>
        <p><strong>Foto:</strong> ${order.photoStoragePath || 'Nessuna foto caricata'}</p>
    `;
}

// ----------------------------------------------------
// FUNZIONE IMPORT EXCEL -> Backendless Orders (con progress bar)
// ----------------------------------------------------

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

        // Prendi il primo foglio
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Converti in JSON
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

        // Progress bar dinamica
        let progressBar = document.getElementById('import-progress-bar');
        if (!progressBar) {
            progressBar = document.createElement('div');
            progressBar.id = 'import-progress-bar';
            progressBar.style.width = '0%';
            progressBar.style.height = '8px';
            progressBar.style.backgroundColor = '#10b981'; // verde
            progressBar.style.borderRadius = '4px';
            progressBar.style.marginTop = '6px';
            statusEl.parentNode.insertBefore(progressBar, statusEl.nextSibling);
        }

        const total = jsonData.length;
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i];

            // Crea oggetto per Backendless Orders
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
                status: "In attesa foto", // stato iniziale
                assignedToPhotographerId: "",
                assignedToPostProducerId: "",
                lastUpdated: new Date()
                // puoi aggiungere altri campi step-by-step se necessario
            };

            try {
                await Backendless.Data.of("Orders").save(orderObj);
                successCount++;
            } catch (err) {
                console.error("Errore import ordine:", err);
                failCount++;
            }

            // Aggiorna progress bar
            const progress = Math.round(((i + 1) / total) * 100);
            progressBar.style.width = progress + "%";
        }

        statusEl.textContent = `Importazione completata: ${successCount} successi, ${failCount} errori.`;
        statusEl.className = failCount === 0 ? 'status-message bg-green-100 text-green-700' : 'status-message bg-yellow-100 text-yellow-700';

        // Resetta file input
        fileInput.value = "";

        // Aggiorna lista ordini per il ruolo corrente
        if (currentRole === ROLES.PHOTOGRAPHER || currentRole === ROLES.POST_PRODUCER) {
            loadOrdersForUser(currentRole);
        }
    };

    reader.readAsArrayBuffer(file);
}


function confirmEanInput() {
    const ean = document.getElementById('ean-input').value.trim();
    if (!ean) {
        alert("Inserisci un EAN valido!");
        return;
    }

    // Mostra EAN nelle sezioni
    document.getElementById('current-ean-display').textContent = ean;

    // Mostra il blocco azioni operative
    const actionsArea = document.getElementById('ean-actions-area');
    actionsArea.classList.remove('hidden');

    // Mostra anche l'area upload foto
    const photoArea = document.getElementById('photo-upload-area');
    photoArea.classList.remove('hidden');

    // Aggiorna status scan
    const scanStatus = document.getElementById('scan-status');
    scanStatus.textContent = `EAN ${ean} confermato. Ora completa le azioni operative e/o carica le foto.`;
    scanStatus.classList.remove('hidden');
}

function handlePhotoUploadAndCompletion() {
    if (!currentEanInProcess) {
        showStatusMessage('upload-status-message', 'Nessun EAN in lavorazione. Scannerizza prima il codice.', false);
        return;
    }
    const files = document.getElementById('photo-files').files;
    if (files.length === 0) {
        showStatusMessage('upload-status-message', 'Seleziona almeno un file da caricare.', false);
        return;
    }

    showStatusMessage('upload-status-message', `Caricamento ${files.length} immagini per EAN ${currentEanInProcess}...`, true);
    // Logica di upload Backendless e aggiornamento dello stato Ordine

    // PLACEHOLDER: Simula il successo
    setTimeout(() => {
        showStatusMessage('upload-status-message', `Caricamento completato per EAN ${currentEanInProcess}. Ordine avanzato.`, true);
        currentEanInProcess = null;
        document.getElementById('photo-upload-area').style.display = 'none';
        document.getElementById('ean-input').value = '';
        document.getElementById('photo-files').value = null; // Resetta il campo file
    }, 2000);
}

function cancelPhotoUpload() {
    showStatusMessage('scan-status', 'Lavorazione annullata.', false);
    currentEanInProcess = null;
    document.getElementById('photo-upload-area').style.display = 'none';
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
                            return Backendless.UserService.resendEmailConfirmation('email@example.com'); // Placeholder, ma non viene usato
                        }
                        return user;
                    });
            } else {
                showLoginArea();
            }
        })
        .then(user => {
            if (user) {
                // Se user è un errore, viene catturato nel .catch precedente
                if (user && user.objectId) {
                    handleLoginSuccess(user);
                } else {
                     showLoginArea(); // Se l'utente non è valido o l'oggetto è incompleto
                }
            }
        })
        .catch(error => {
            console.error("Errore di inizializzazione sessione:", error);
            showLoginArea();
        });
};
