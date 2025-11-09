// Configurazione Backendless (sostituisci con le tue chiavi reali)
const APPLICATION_ID = 'C2A5C327-CF80-4BB0-8017-010681F0481C'; // <--- Aggiorna qui
const API_KEY = 'B266000F-684B-4889-9174-2D1734001E08';       // <--- Aggiorna qui

// Inizializza Backendless
Backendless.initApp(APP_ID, API_KEY);

let currentUser = null;
let currentRole = null;
let currentEan = null;
const ORDERS_TABLE_NAME = "Orders"; // Nome della tabella ordini su Backendless

// Mappatura delle colonne Excel che vogliamo salvare nel DB
// Chiave: Nome intestazione Excel - Valore: Nome campo nel Database
const EXCEL_COLUMNS = {
    'Ean Code': 'eanCode',
    'Codice Articolo': 'codiceArticolo',
    'Style Name': 'styleName',
    'Style Group': 'styleGroup',
    'Brand': 'brand',
    'Colore': 'colore',
    'Taglia': 'taglia',
    'N. Scatti': 'nScatti',
    'Priorità': 'priorita',
    'Post-presa in carico': 'postProducerResponsabile' // Responsabile Post-Prod.
};

// Costanti per i ruoli e gli stati di lavoro
const ROLES = {
    ADMIN: "Admin",
    PHOTOGRAPHER: "Photographer",
    POST_PRODUCER: "PostProducer"
};

const STATUS = {
    TO_BE_PHOTOGRAPHED: "Da Fotografare",
    PHOTO_IN_PROGRESS: "Fotografia in Corso",
    TO_BE_POST_PRODUCED: "Da Post-Produrre",
    POST_PROD_IN_PROGRESS: "Post-Produzione in Corso",
    COMPLETED: "Completato",
    ERROR: "Errore"
};

// --- UTILITY PER LA DASHBOARD ---

/** Mostra un messaggio di stato in un elemento specifico. */
function showStatus(elementId, message, isError = false) {
    const el = document.getElementById(elementId);
    if (!el) return;

    el.innerHTML = message;
    el.style.display = 'block';

    if (isError) {
        el.className = 'status-message bg-red-100 text-red-700';
    } else if (message.includes('Successo') || message.includes('Completato')) {
        el.className = 'status-message bg-green-100 text-green-700';
    } else {
        el.className = 'status-message bg-blue-100 text-blue-700';
    }
}

/** Nasconde un messaggio di stato. */
function hideStatus(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
        el.style.display = 'none';
    }
}

// --- UTILITY PER IL PROGRESS BAR (NUOVE FUNZIONI) ---

/** Mostra il progress bar e lo inizializza. */
function showProgress(message = "Caricamento...") {
    document.getElementById('import-progress-container').style.display = 'block';
    document.getElementById('import-status').textContent = message;
    document.getElementById('import-status').style.display = 'block';
    updateProgress(0);
}

/** Aggiorna la barra di avanzamento. */
function updateProgress(percentage, message = null) {
    const fill = document.getElementById('progress-fill');
    const percentText = document.getElementById('progress-percentage');
    
    // Clampa la percentuale tra 0 e 100
    percentage = Math.max(0, Math.min(100, percentage)); 

    fill.style.width = percentage + '%';
    percentText.textContent = Math.floor(percentage) + '%';
    
    if (message) {
         document.getElementById('import-status').textContent = message;
    }
}

/** Nasconde il progress bar. */
function hideProgress() {
    document.getElementById('import-progress-container').style.display = 'none';
    updateProgress(0);
}


// --- GESTIONE AUTHENTICATION ---

/** Gestisce l'accesso standard (Login). */
async function handleStandardLogin(email, password) {
    hideStatus('login-status');
    showStatus('login-status', 'Accesso in corso...');

    try {
        const user = await Backendless.UserService.login(email, password, true);
        currentUser = user;
        
        // Recupera il ruolo salvato in una proprietà personalizzata (es. role)
        currentRole = user.role || ROLES.PHOTOGRAPHER; 

        // Salva le informazioni nel DOM e reindirizza
        document.getElementById('worker-name').textContent = user.name || user.email;
        document.getElementById('worker-role').textContent = currentRole;
        document.getElementById('worker-role-display-queue').textContent = currentRole;
        
        updateUIForRole(currentRole);

        hideStatus('login-status');

    } catch (error) {
        console.error("Errore di Login:", error);
        showStatus('login-status', `Errore di accesso: ${error.message || 'Credenziali non valide.'}`, true);
    }
}

/** Gestisce il Logout. */
async function handleLogout() {
    try {
        await Backendless.UserService.logout();
        currentUser = null;
        currentRole = null;
        // Resetta la UI allo stato di login
        document.getElementById('login-area').style.display = 'block';
        document.getElementById('worker-dashboard').style.display = 'none';
        document.getElementById('admin-dashboard').style.display = 'none';
        document.getElementById('worker-name').textContent = 'Ospite';
        document.getElementById('worker-role').textContent = 'Non Loggato';
        hideStatus('login-status');
        
    } catch (error) {
        console.error("Errore di Logout:", error);
    }
}

/** Aggiorna l'interfaccia utente in base al ruolo. */
function updateUIForRole(role) {
    document.getElementById('login-area').style.display = 'none';
    document.getElementById('worker-dashboard').style.display = 'none';
    document.getElementById('admin-dashboard').style.display = 'none';

    if (role === ROLES.ADMIN) {
        document.getElementById('admin-dashboard').style.display = 'block';
        loadUsers(); 
    } else if (role === ROLES.PHOTOGRAPHER || role === ROLES.POST_PRODUCER) {
        document.getElementById('worker-dashboard').style.display = 'block';
        loadOrders(role); // Carica ordini specifici per il ruolo
    } else {
        showStatus('login-status', 'Ruolo utente non riconosciuto.', true);
        handleLogout();
    }
}

// --- GESTIONE ORDINI (WORKER DASHBOARD) ---

/** Carica gli ordini in base al ruolo. */
function loadOrders(role) {
    document.getElementById('loading-orders').style.display = 'block';
    
    // Definizione della query
    let query = new Backendless.Data.QueryBuilder();
    query.setPageSize(100); // Max 100 ordini alla volta

    if (role === ROLES.PHOTOGRAPHER) {
        // Il fotografo vede gli ordini da fotografare
        query.setWhereClause(`Status = '${STATUS.TO_BE_PHOTOGRAPHED}'`);
    } else if (role === ROLES.POST_PRODUCER) {
        // Il post producer vede gli ordini da post-produrre
        query.setWhereClause(`Status = '${STATUS.TO_BE_POST_PRODUCED}'`);
    }
    // NOTA: Se si vuole filtrare per responsabile Post-Produzione, si aggiunge:
    // if (role === ROLES.POST_PRODUCER && currentUser) {
    //     query.setWhereClause(`Status = '${STATUS.TO_BE_POST_PRODUCED}' AND postProducerResponsabile = '${currentUser.name}'`);
    // }


    Backendless.Data.of(ORDERS_TABLE_NAME).find(query)
        .then(orders => {
            document.getElementById('loading-orders').style.display = 'none';
            renderOrdersTable(orders, role);
        })
        .catch(error => {
            console.error("Errore nel caricamento ordini:", error);
            document.getElementById('loading-orders').textContent = `Errore di caricamento: ${error.message}`;
        });
}

/** Renderizza la tabella degli ordini con le colonne aggiornate (come richiesto dall'Excel). */
function renderOrdersTable(orders, role) {
    const tableBody = document.querySelector('#orders-table tbody');
    tableBody.innerHTML = '';

    if (orders.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-gray-500">Nessun ordine in coda per la tua fase.</td></tr>`;
        return;
    }

    orders.forEach(order => {
        const row = tableBody.insertRow();
        
        // Cella 1: EAN Code
        row.insertCell().textContent = order.eanCode || 'N/D';
        
        // Cella 2: Codice Articolo
        row.insertCell().textContent = order.codiceArticolo || 'N/D';

        // Cella 3: Style Name
        row.insertCell().textContent = order.styleName || 'N/D';
        
        // Cella 4: N. Scatti (Centrato)
        const nScattiCell = row.insertCell();
        nScattiCell.textContent = order.nScatti || '0';
        nScattiCell.classList.add('text-center');

        // Cella 5: Priorità (Centrato)
        const prioritaCell = row.insertCell();
        prioritaCell.textContent = order.priorita || '-';
        prioritaCell.classList.add('text-center');

        // Cella 6: Fase (Status)
        row.insertCell().textContent = order.Status || 'In attesa';
        
        // Cella 7: Azioni
        const actionCell = row.insertCell();
        actionCell.classList.add('action-cell', 'text-center');

        // Determina il testo del pulsante in base al ruolo
        let buttonText = '';
        if (role === ROLES.PHOTOGRAPHER) {
            buttonText = 'Avvia Foto';
        } else if (role === ROLES.POST_PRODUCER) {
            buttonText = 'Visualizza Foto';
        }

        const actionButton = document.createElement('button');
        actionButton.textContent = buttonText;
        actionButton.className = 'btn-primary text-xs py-1 px-3 rounded-lg font-semibold';
        actionButton.onclick = () => {
            if (role === ROLES.PHOTOGRAPHER) {
                // Imposta l'EAN e avvia la fase di upload per il fotografo
                document.getElementById('ean-input').value = order.eanCode;
                confirmEanInput();
            } else if (role === ROLES.POST_PRODUCER) {
                // Avvia la modale di visualizzazione per il post producer
                openPhotoModal(order.eanCode);
            }
        };
        actionCell.appendChild(actionButton);
    });
}

// --- GESTIONE WORKFLOW LAVORATORE ---

/** Conferma l'EAN inserito e prepara l'area di upload/visualizzazione. */
async function confirmEanInput() {
    hideStatus('scan-status');
    const ean = document.getElementById('ean-input').value.trim();
    if (!ean) {
        showStatus('scan-status', 'Inserisci un codice EAN valido.', true);
        return;
    }

    currentEan = ean;
    showStatus('scan-status', `Ricerca EAN ${ean}...`);
    document.getElementById('photo-upload-area').style.display = 'none';

    try {
        let query = new Backendless.Data.QueryBuilder();
        query.setWhereClause(`eanCode = '${ean}'`);
        const order = await Backendless.Data.of(ORDERS_TABLE_NAME).findFirst(query);

        if (!order) {
            showStatus('scan-status', `Errore: Ordine con EAN ${ean} non trovato nel sistema.`, true);
            return;
        }

        const requiredStatus = (currentRole === ROLES.PHOTOGRAPHER) 
            ? STATUS.TO_BE_PHOTOGRAPHED 
            : STATUS.TO_BE_POST_PRODUCED;
        
        if (order.Status !== requiredStatus) {
            showStatus('scan-status', `L'ordine ${ean} è in stato: ${order.Status}. Non è pronto per la tua fase (${currentRole}).`, true);
            return;
        }

        // Tutto OK: aggiorna l'interfaccia
        document.getElementById('current-ean-display').textContent = ean;
        
        if (currentRole === ROLES.PHOTOGRAPHER) {
            document.getElementById('photo-upload-area').style.display = 'block';
            showStatus('scan-status', `Ordine ${ean} caricato. Carica le foto!`, false);

            // Opzionale: Aggiorna lo stato a "In Corso"
            await updateOrderStatus(order.objectId, STATUS.PHOTO_IN_PROGRESS);
        } else if (currentRole === ROLES.POST_PRODUCER) {
            openPhotoModal(ean); // Il post producer visualizza subito la modale
            showStatus('scan-status', `Ordine ${ean} caricato. Visualizza le foto!`, false);

            // Opzionale: Aggiorna lo stato a "In Corso"
            await updateOrderStatus(order.objectId, STATUS.POST_PROD_IN_PROGRESS);
        }

    } catch (error) {
        console.error("Errore conferma EAN:", error);
        showStatus('scan-status', `Errore: ${error.message}`, true);
    }
}

/** Aggiorna lo stato di un ordine su Backendless. */
async function updateOrderStatus(objectId, newStatus) {
    try {
        const data = {
            objectId: objectId,
            Status: newStatus
        };
        const updatedOrder = await Backendless.Data.of(ORDERS_TABLE_NAME).save(data);
        console.log(`Ordine ${objectId} aggiornato a stato: ${newStatus}`);
        return updatedOrder;
    } catch (error) {
        console.error("Errore aggiornamento stato ordine:", error);
        // Ricarica la lista per aggiornare la UI
        if (currentRole) loadOrders(currentRole); 
    }
}

/** Gestisce l'upload delle foto e la conclusione della fase (Photographer/PostProducer). */
async function handlePhotoUploadAndCompletion() {
    hideStatus('upload-status-message');
    showProgress("Inizio upload file...");
    
    const filesInput = document.getElementById('photo-files');
    const files = filesInput.files;

    if (!currentEan || files.length === 0) {
        showStatus('upload-status-message', 'Seleziona almeno un file e conferma l\'EAN.', true);
        hideProgress();
        return;
    }

    const folderName = `product_photos/${currentEan}/${currentRole}`; // Es: product_photos/EAN/Photographer

    try {
        let uploadedFileUrls = [];
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // Upload del singolo file
            const uploadResult = await Backendless.Files.upload(file, folderName, true);
            uploadedFileUrls.push(uploadResult.fileURL);
            
            // Aggiorna la barra di progresso (visivamente)
            const progress = ((i + 1) / files.length) * 90; // Arriva fino al 90%
            updateProgress(progress, `Caricamento file ${i + 1} di ${files.length}...`);
        }
        
        // 90% - Aggiornamento dello stato dell'ordine
        updateProgress(95, "Aggiornamento stato ordine...");

        // Trova l'ordine e aggiorna lo stato e i link alle foto
        let query = new Backendless.Data.QueryBuilder().setWhereClause(`eanCode = '${currentEan}'`);
        const order = await Backendless.Data.of(ORDERS_TABLE_NAME).findFirst(query);
        
        if (order) {
            const newStatus = (currentRole === ROLES.PHOTOGRAPHER) ? STATUS.TO_BE_POST_PRODUCED : STATUS.COMPLETED;
            
            let updateData = {
                objectId: order.objectId,
                Status: newStatus,
            };
            
            // Il Fotografo salva i link delle foto
            if (currentRole === ROLES.PHOTOGRAPHER) {
                 updateData.photoLinks = JSON.stringify(uploadedFileUrls);
            }
            
            await Backendless.Data.of(ORDERS_TABLE_NAME).save(updateData);
            
            updateProgress(100, "Fase completata con successo!");
            
            showStatus('upload-status-message', `Caricamento completato. L'ordine è ora in stato: ${newStatus}.`, false);

            // Pulisci e nascondi
            setTimeout(() => {
                cancelPhotoUpload();
                loadOrders(currentRole); // Ricarica la lista degli ordini
            }, 2000);

        } else {
            throw new Error("Ordine non trovato dopo il caricamento.");
        }

    } catch (error) {
        console.error("Errore durante l'upload:", error);
        showStatus('upload-status-message', `Errore di upload o aggiornamento stato: ${error.message}`, true);
        hideProgress();
    }
}

/** Annulla il processo di upload. */
function cancelPhotoUpload() {
    currentEan = null;
    document.getElementById('ean-input').value = '';
    document.getElementById('photo-files').value = '';
    document.getElementById('photo-upload-area').style.display = 'none';
    hideStatus('scan-status');
    hideStatus('upload-status-message');
    hideProgress();
    // Ricarica per aggiornare l'elenco se lo stato è stato messo "In Corso"
    if (currentRole) loadOrders(currentRole); 
}

// --- GESTIONE ADMIN (IMPORTAZIONE EXCEL) ---

/** Gestisce il caricamento e l'importazione del file Excel. */
async function handleFileUpload() {
    hideStatus('import-status');
    const fileInput = document.getElementById('excel-file-input');
    const file = fileInput.files[0];

    if (!file) {
        showStatus('import-status', 'Seleziona un file Excel (.xlsx o .xls).', true);
        return;
    }
    
    // Mostra il progress bar
    showProgress("Lettura file...");

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // Converti in array di oggetti JSON
            const jsonOrders = XLSX.utils.sheet_to_json(worksheet);
            
            if (jsonOrders.length === 0) {
                throw new Error("Il file Excel non contiene dati validi.");
            }
            
            updateProgress(10, `Trovati ${jsonOrders.length} ordini. Inizio salvataggio...`);

            // Mappa i dati Excel nel formato Backendless
            const backendlessOrders = [];
            for (const item of jsonOrders) {
                const orderData = {};
                let isValid = true;

                // Mappa solo le colonne definite in EXCEL_COLUMNS
                for (const excelCol in EXCEL_COLUMNS) {
                    const dbField = EXCEL_COLUMNS[excelCol];
                    
                    let value = item[excelCol];
                    // Normalizzazione dei valori (rimuovi spazi, gestisci null/undefined)
                    if (typeof value === 'string') {
                        value = value.trim();
                    } else if (value === undefined || value === null) {
                        value = null; 
                    }

                    orderData[dbField] = value;
                }
                
                // VALIDAZIONE MINIMA: Ean Code e Codice Articolo sono essenziali
                if (!orderData.eanCode || !orderData.codiceArticolo) {
                    console.warn("Riga scartata per mancanza di Ean Code o Codice Articolo:", item);
                    isValid = false;
                }

                if (isValid) {
                    // Aggiungi campi di stato iniziali
                    orderData.Status = STATUS.TO_BE_PHOTOGRAPHED; 
                    orderData.photoLinks = "[]"; // Array JSON vuoto per i link delle foto
                    orderData.OwnerId = currentUser ? currentUser.objectId : 'admin_import'; 
                    
                    backendlessOrders.push(orderData);
                }
            }

            if (backendlessOrders.length === 0) {
                 throw new Error("Nessun ordine valido da importare trovato nel file.");
            }

            const totalRecords = backendlessOrders.length;
            let successCount = 0;
            let errorCount = 0;

            // Salva gli ordini in batch, aggiornando il progress bar
            for (let i = 0; i < totalRecords; i++) {
                const order = backendlessOrders[i];
                try {
                    // Cerca prima per Ean Code per evitare duplicati
                    let query = new Backendless.Data.QueryBuilder().setWhereClause(`eanCode = '${order.eanCode}'`);
                    const existingOrder = await Backendless.Data.of(ORDERS_TABLE_NAME).findFirst(query);
                    
                    if (existingOrder) {
                        // Aggiorna l'ordine esistente
                        order.objectId = existingOrder.objectId;
                        await Backendless.Data.of(ORDERS_TABLE_NAME).save(order);
                    } else {
                        // Salva il nuovo ordine
                        await Backendless.Data.of(ORDERS_TABLE_NAME).save(order);
                    }
                    successCount++;
                } catch (saveError) {
                    errorCount++;
                    console.error(`Errore nel salvataggio dell'ordine EAN ${order.eanCode}:`, saveError);
                }

                // Calcola e aggiorna il progresso (dal 10% al 90%)
                const progress = 10 + (i / totalRecords) * 80;
                updateProgress(progress, `Salvataggio ordini: ${successCount} salvati, ${errorCount} errori.`);
                
                // Un piccolo ritardo per non bloccare l'interfaccia se il salvataggio è troppo veloce
                await new Promise(resolve => setTimeout(resolve, 5)); 
            }
            
            updateProgress(100, `Importazione Completata: ${successCount} ordini importati/aggiornati, ${errorCount} errori.`);
            showStatus('import-status', `Successo! ${successCount} ordini importati/aggiornati. ${errorCount} errori.`, errorCount > 0);
            fileInput.value = ''; // Pulisci l'input file
            
        } catch (error) {
            console.error("Errore durante l'elaborazione del file:", error);
            showStatus('import-status', `Errore: ${error.message || 'Si è verificato un errore sconosciuto durante l\'elaborazione del file.'}`, true);
        } finally {
            // Nascondi il progress bar dopo 3 secondi
            setTimeout(hideProgress, 3000);
        }
    };
    reader.readAsArrayBuffer(file);
}

// --- GESTIONE UTENTI ADMIN ---

/** Crea un nuovo utente (Admin). */
async function handleUserCreation() {
    hideStatus('user-creation-status');
    const email = document.getElementById('new-user-email').value.trim();
    const password = document.getElementById('new-user-password').value.trim();
    const role = document.getElementById('new-user-role').value;

    if (!email || !password || !role) {
        showStatus('user-creation-status', 'Compila tutti i campi: Email, Password e Ruolo.', true);
        return;
    }
    
    showStatus('user-creation-status', 'Creazione utente in corso...');
    
    try {
        const newUser = new Backendless.User();
        newUser.email = email;
        newUser.password = password;
        // Salva il ruolo come proprietà personalizzata 'role'
        newUser.role = role;
        
        await Backendless.UserService.register(newUser);

        // Se l'utente è stato creato con successo, potresti volerlo aggiungere
        // a un ruolo Backendless specifico, ma per semplicità, usiamo la proprietà 'role'.
        
        showStatus('user-creation-status', `Successo! Utente ${email} creato con ruolo ${role}.`, false);
        document.getElementById('new-user-email').value = '';
        document.getElementById('new-user-password').value = '';
        document.getElementById('new-user-role').value = '';
        
        loadUsers(); // Ricarica la lista utenti

    } catch (error) {
        console.error("Errore creazione utente:", error);
        showStatus('user-creation-status', `Errore: ${error.message}`, true);
    }
}

/** Carica la lista degli utenti (Admin). */
async function loadUsers() {
    document.getElementById('loading-users').style.display = 'block';
    
    try {
        // Recupera tutti gli utenti. Potrebbe essere necessario filtrare per motivi di sicurezza/performance.
        const users = await Backendless.Data.of("Users").find(
            new Backendless.Data.QueryBuilder().setProperties(["objectId", "email", "role"])
        );
        document.getElementById('loading-users').style.display = 'none';
        renderUsersTable(users);
    } catch (error) {
        console.error("Errore nel caricamento utenti:", error);
        document.getElementById('loading-users').textContent = `Errore di caricamento: ${error.message}`;
    }
}

/** Renderizza la tabella degli utenti (Admin). */
function renderUsersTable(users) {
    const tableBody = document.querySelector('#users-table tbody');
    tableBody.innerHTML = '';
    
    if (users.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="3" class="text-center p-4 text-gray-500">Nessun utente registrato.</td></tr>`;
        return;
    }

    users.forEach(user => {
        const row = tableBody.insertRow();
        const currentRole = user.role || 'N/D';
        
        row.insertCell().textContent = user.email;
        row.insertCell().textContent = currentRole;

        const actionCell = row.insertCell();
        actionCell.classList.add('action-cell', 'flex', 'space-x-2');

        const roleSelect = document.createElement('select');
        roleSelect.className = 'p-1 border rounded text-xs';
        roleSelect.innerHTML = `
            <option value="Photographer">Photographer</option>
            <option value="PostProducer">Post Producer</option>
            <option value="Admin">Admin</option>
        `;
        roleSelect.value = currentRole;
        actionCell.appendChild(roleSelect);
        
        const updateButton = document.createElement('button');
        updateButton.textContent = 'Aggiorna Ruolo';
        updateButton.className = 'btn-primary text-xs py-1 px-2 rounded font-semibold';
        updateButton.onclick = () => assignRole(user.objectId, roleSelect.value);
        actionCell.appendChild(updateButton);
    });
}

/** Assegna un ruolo a un utente esistente (Admin). */
async function assignRole(objectId, role) {
    try {
        const userUpdate = {
            objectId: objectId,
            role: role
        };
        await Backendless.Data.of("Users").save(userUpdate);
        showStatus('user-creation-status', `Ruolo aggiornato a ${role} con successo.`, false);
        setTimeout(hideStatus, 3000, 'user-creation-status');
        loadUsers(); 
    } catch (error) {
        console.error("Errore nell'assegnazione del ruolo:", error);
        showStatus('user-creation-status', `Errore nell'aggiornamento del ruolo: ${error.message}`, true);
        setTimeout(hideStatus, 5000, 'user-creation-status');
    }
}


// --- GESTIONE MODALE FOTO (Post Producer) ---

/** Apre la modale di visualizzazione foto. */
async function openPhotoModal(ean) {
    // Implementazione placeholder
    const modal = document.getElementById('photo-modal');
    const modalTitle = document.getElementById('modal-ean-title');
    const modalContent = document.getElementById('photo-modal-content');

    modalTitle.textContent = ean;
    modalContent.innerHTML = '<p class="text-gray-500">Caricamento foto in corso...</p>';

    try {
        let query = new Backendless.Data.QueryBuilder().setWhereClause(`eanCode = '${ean}'`);
        const order = await Backendless.Data.of(ORDERS_TABLE_NAME).findFirst(query);

        if (order && order.photoLinks) {
            const photoUrls = JSON.parse(order.photoLinks);
            if (photoUrls.length > 0) {
                let html = '<div class="grid grid-cols-2 md:grid-cols-3 gap-4">';
                photoUrls.forEach(url => {
                    html += `<a href="${url}" target="_blank" class="block rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow">
                                <img src="${url}" alt="Foto Prodotto" class="w-full h-32 object-cover">
                                <p class="p-2 text-xs text-center text-gray-600 truncate">${url.substring(url.lastIndexOf('/') + 1)}</p>
                             </a>`;
                });
                html += '</div>';

                html += `
                    <div class="mt-6 pt-4 border-t flex justify-end space-x-3">
                        <button onclick="updateOrderStatus('${order.objectId}', '${STATUS.COMPLETED}')" class="btn-success py-2 px-4 font-semibold">
                            Completa Post-Produzione
                        </button>
                    </div>
                `;
                modalContent.innerHTML = html;
            } else {
                modalContent.innerHTML = '<p class="text-red-500">Nessuna foto trovata per questo EAN.</p>';
            }
        } else {
            modalContent.innerHTML = '<p class="text-red-500">Nessuna foto trovata o ordine non valido.</p>';
        }

    } catch (error) {
        console.error("Errore nel caricamento foto:", error);
        modalContent.innerHTML = `<p class="text-red-500">Errore di rete/server: ${error.message}</p>`;
    }

    modal.style.display = 'flex';
}

/** Chiude la modale di visualizzazione foto. */
function closePhotoModal() {
    document.getElementById('photo-modal').style.display = 'none';
    if (currentRole) loadOrders(currentRole); // Ricarica per aggiornare lo stato
}

/** Placeholder: Gestione Recupero Password */
function handlePasswordRecovery() {
    showStatus('login-status', 'Contatta l\'amministratore per il recupero password.', false);
}


// --- INIZIALIZZAZIONE ---

// Aggiungi un controllo di stato dell'autenticazione all'avvio
window.onload = function() {
    // Nascondi la modale di default
    const modal = document.getElementById('photo-modal');
    modal.style.display = 'none';
    // Aggiungi il listener per chiudere la modale cliccando fuori
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closePhotoModal();
        }
    });

    Backendless.UserService.getCurrentUser()
        .then(user => {
            if (user) {
                // Utente già loggato
                currentUser = user;
                currentRole = user.role || ROLES.PHOTOGRAPHER;
                document.getElementById('worker-name').textContent = user.name || user.email;
                document.getElementById('worker-role').textContent = currentRole;
                document.getElementById('worker-role-display-queue').textContent = currentRole;
                updateUIForRole(currentRole);
            } else {
                // Nessun utente loggato, mostra l'area di login
                document.getElementById('login-area').style.display = 'block';
            }
        })
        .catch(error => {
            console.error("Errore nel recupero utente corrente:", error);
            document.getElementById('login-area').style.display = 'block';
        });
    
    // Inizializza il progress bar hidden
    hideProgress();
};
