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
    // Nasconde la sidebar in modalità mobile quando si è nel login
    document.getElementById('sidebar')?.classList.add('hidden'); 

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
    
    // Rimuovi tutte le classi di stato e applica quelle corrette
    el.classList.remove('bg-red-100', 'text-red-700', 'bg-green-100', 'text-green-700', 'bg-yellow-100', 'text-yellow-700', 'bg-blue-100', 'text-blue-700');

    if (isSuccess) {
        el.classList.add('bg-green-100', 'text-green-700');
    } else {
        el.classList.add('bg-red-100', 'text-red-700');
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

/**
 * Gestisce il logout e mostra un messaggio personalizzato all'utente.
 * @param {string} customMessage - Il messaggio da mostrare dopo il logout.
 */
function handleLogout(customMessage = "Logout avvenuto con successo.") {
    // Logga per debug: verifica se il messaggio di errore arriva qui
    console.log("LOGOUT TRIGGERED. Messaggio: " + customMessage);

    Backendless.UserService.logout()
        .then(() => {
            currentUser = null;
            currentRole = null;
            currentEanInProcess = null;
            showLoginArea(customMessage); // Usa il messaggio personalizzato, anche se è il default
        })
        .catch(error => {
            console.error("Errore di Logout (probabilmente irrilevante in caso di logout forzato):", error);
            // Mostra il messaggio originale anche in caso di errore di logout
            showLoginArea(customMessage); 
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
            console.error("Errore nel recupero del ruolo (getRoleFromUser):", error);
            // Rilancia l'errore per essere gestito dal .catch di handleLoginSuccess
            throw new Error(`Recupero ruolo fallito: ${error.message}`); 
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
            
            // Mostra la sidebar (in desktop)
            document.getElementById('sidebar')?.classList.remove('hidden'); 
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
                // AGGIUNTA UI: Visualizza il ruolo nella coda lavoratori
                document.getElementById('worker-role-display-queue').textContent = currentRole; 
                loadOrdersForUser(currentRole); // Carica gli ordini pertinenti
            } else {
                // Caso: Ruolo non gestito o 'Nessun Ruolo' -> Logout forzato
                const errorReason = `ACCESSO NEGATO: Ruolo utente "${currentRole}" non valido o mancante. Controlla il campo 'role' nella tua tabella Users.`;
                console.warn(errorReason);
                handleLogout(errorReason); // Passa la vera causa dell'errore
            }
        })
        .catch(error => {
            // Questo catch cattura l'errore lanciato da getRoleFromUser
            const errorReason = `ERRORE CRITICO (getRole): Impossibile determinare il ruolo. Causa: ${error.message}.`;
            console.error("Errore critico durante la gestione del ruolo:", error);
            handleLogout(errorReason); // Passa la vera causa dell'errore
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
        actionCell.classList.add('flex', 'flex-col', 'md:flex-row', 'gap-2'); // Aggiunto flex per layout mobile

        // Select per il cambio ruolo
        const roleSelect = document.createElement('select');
        // Rimosso W-1/2 e aggiunto classe per padding e bordi
        roleSelect.className = 'p-2 border border-gray-300 rounded-md text-sm'; 
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
        // Rimosso mr-2 e aggiunto classi di Tailwind
        saveButton.className = 'btn-success text-xs py-1 px-2 font-medium'; 
        saveButton.onclick = () => updateRole(user.objectId, roleSelect.value);

        // Bottone per eliminare l'utente
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Elimina';
        deleteButton.className = 'btn-danger text-xs py-1 px-2 font-medium';
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
                // Non usiamo più style.color direttamente, usiamo classi Tailwind in showStatusMessage se avessimo uno status element.
            });
    } catch (e) {
        // >>> LOG CRITICO 4: Errore sincrono (es. ID HTML sbagliato)
        console.error("ERRORE SINCRONO in loadUsersAndRoles:", e);
        document.getElementById('loading-users').textContent = 
            `ERRORE SINCRONO: La dashboard non può essere visualizzata (Errore: ${e.message}).`;
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
    // Ho mantenuto il confirm per semplicità, ricordando che è deprecato in app reali.
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

/**
 * Funzione di gestione file Excel/CSV per l'importazione degli ordini.
 */
function handleFileUpload() {
    const fileInput = document.getElementById('excel-file-input');
    const file = fileInput.files[0];

    if (!file) {
        showStatusMessage('import-status', 'Per favore, seleziona un file Excel (.xlsx, .xls) o CSV.', false);
        return;
    }

    showStatusMessage('import-status', `Lettura del file "${file.name}" in corso...`, true);

    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        let workbook;
        
        try {
            // Tenta di leggere come Excel
            workbook = XLSX.read(data, { type: 'array' });
        } catch (excelError) {
            console.warn("Non è un file Excel standard, provo a leggere come CSV/Testo...", excelError);
            
            // Se fallisce, prova a leggere come testo (utile per i CSV)
            const textData = new TextDecoder('utf-8').decode(data);
            try {
                workbook = XLSX.read(textData, { type: 'binary' });
            } catch (csvError) {
                 showStatusMessage('import-status', `Errore: Impossibile leggere il file come Excel o CSV/Testo. Assicurati sia un formato valido.`, false);
                 console.error("Errore lettura CSV/Testo:", csvError);
                 return;
            }
        }


        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Converte in JSON, ignorando le prime righe vuote e assicurandosi che le intestazioni siano corrette
        // header: 1 indica di usare la prima riga come intestazione
        // range: "A1:I9999" limita la lettura alle prime 9 colonne (A-I)
        const jsonRows = XLSX.utils.sheet_to_json(worksheet, {
            header: 1, 
            range: "A1:I9999", // Limita l'importazione fino alla colonna I
            defval: "", // Usa stringa vuota per celle vuote
            raw: false // Non forzare numeri grezzi, mantieni formattazione per EAN
        });

        if (jsonRows.length <= 1) {
            showStatusMessage('import-status', 'File letto, ma non contiene righe di dati valide.', false);
            return;
        }

        // Estrai l'intestazione dalla prima riga
        const headers = jsonRows[0];
        // Estrai i dati, saltando l'intestazione
        const dataRows = jsonRows.slice(1);
        
        console.log("Intestazioni rilevate:", headers);
        console.log("Numero di righe dati:", dataRows.length);
        
        // Mappatura delle colonne da Excel ai nomi dei campi in Backendless/JS
        const FIELD_MAPPING = {
            "Codice Articolo": "productCode",
            "Ean Code": "eanCode",
            "Style Name": "styleName",
            "Style Group": "styleGroup",
            "Brand": "brand",
            "Colore": "color",
            "Taglia": "size",
            "Categoria": "category",
            "Genere": "gender"
        };
        
        // Array per contenere gli oggetti ordine da salvare
        const ordersToSave = [];
        const missingEanCount = 0;

        dataRows.forEach(row => {
            const order = {};
            let hasEan = false;
            
            // Itera attraverso i dati della riga e mappa con le intestazioni
            headers.forEach((header, index) => {
                const dbField = FIELD_MAPPING[header.trim()];
                if (dbField) {
                    order[dbField] = String(row[index]).trim(); // Converti tutto in stringa e pulisci
                    if (dbField === 'eanCode' && order[dbField]) {
                        hasEan = true;
                    }
                }
            });

            // Aggiungi i campi gestionali iniziali
            if (hasEan && order.eanCode) {
                // Rimuovi spazi extra dal codice EAN, che è critico
                order.eanCode = order.eanCode.replace(/\s/g, ''); 
                order.status = STATUS.WAITING_PHOTO; // Imposta lo stato iniziale
                order.lastUpdated = new Date();
                ordersToSave.push(order);
            } else {
                missingEanCount++;
                console.warn("Riga scartata per EAN mancante/vuoto:", row);
            }
        });

        if (ordersToSave.length === 0) {
            showStatusMessage('import-status', `Nessun ordine valido trovato nel file. ${missingEanCount} riga/e scartata/e.`, false);
            return;
        }

        showStatusMessage('import-status', `Trovati ${ordersToSave.length} ordini validi. Inizio salvataggio nel database...`, true);
        
        // Salva TUTTI gli ordini contemporaneamente (Bulk Save)
        Backendless.Data.of(ORDER_TABLE_NAME).bulkCreate(ordersToSave)
            .then(result => {
                const successfulSaves = result.length;
                const totalRows = dataRows.length;
                
                let message = `Importazione completata: ${successfulSaves} ordini creati con successo.`;
                if (missingEanCount > 0) {
                    message += ` (${missingEanCount} riga/e scartata/e per EAN mancante).`;
                }

                showStatusMessage('import-status', message, true);
                fileInput.value = ''; // Resetta il campo file
                // Potremmo qui ricaricare la lista ordini Admin se ne avessimo una
            })
            .catch(error => {
                console.error("Errore in BulkCreate Backendless:", error);
                showStatusMessage('import-status', `Errore critico durante il salvataggio in Backendless: ${error.message}`, false);
            });

    };
    
    // Inizia la lettura del file come ArrayBuffer (necessario per XLSX.read)
    reader.readAsArrayBuffer(file);
}


// ----------------------------------------------------
// FUNZIONI WORKER (DASHBOARD) - PLACEHOLDERS
// ----------------------------------------------------

function loadOrdersForUser(role) {
    document.getElementById('loading-orders').textContent = 
        `Caricamento ordini per il ruolo ${role} (Funzione in attesa di implementazione)...`;
    // Logica per caricare ordini in base al ruolo (Photographer: WAITING_PHOTO, PostProducer: WAITING_POST_PRODUCTION)
}

function confirmEanInput() {
    const ean = document.getElementById('ean-input').value.trim();
    if (ean) {
        showStatusMessage('scan-status', `EAN ${ean} confermato. Ora carica le foto.`, true);
        document.getElementById('current-ean-display').textContent = ean;
        document.getElementById('photo-upload-area').style.display = 'block';
        currentEanInProcess = ean;
        // Aggiunge l'animazione shake
        document.getElementById('photo-upload-area').classList.add('animate-shake'); 
        setTimeout(() => {
            document.getElementById('photo-upload-area').classList.remove('animate-shake');
        }, 1000);
    } else {
        showStatusMessage('scan-status', 'Per favore, inserisci un codice EAN.', false);
    }
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
        // Resetta lo stato di scansione principale
        document.getElementById('scan-status').style.display = 'none';
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
                // Se c'è una sessione valida, prova a recuperare l'utente
                return Backendless.UserService.getCurrentUser()
                    .then(user => {
                        // Se l'utente è valido ma l'oggetto utente non ha il ruolo (cache), ricaricalo
                        if (!user || !user.objectId) {
                            // Utente invalido o incompleto (es. cache vecchia), forziamo un logout UI
                            showLoginArea("Sessione scaduta o incompleta. Effettua nuovamente l'accesso.");
                            return null;
                        }
                        return user;
                    });
            } else {
                showLoginArea();
                return null;
            }
        })
        .then(user => {
            if (user) {
                handleLoginSuccess(user);
            }
        })
        .catch(error => {
            console.error("Errore di inizializzazione sessione:", error);
            // In caso di errore critico (es. rete), mostra l'area di login
            showLoginArea("Errore di connessione o sessione non recuperabile. Riprova.");
        });
};
