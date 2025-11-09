function loadOrdersForUser(role) {
    const loadingText = document.getElementById('loading-orders');
    const tableBody = document.querySelector('#orders-table tbody');

    loadingText.textContent = `Caricamento ordini per il ruolo ${role}...`;
    tableBody.innerHTML = ''; // resetta la tabella

    // Costruisci la query in base al ruolo
    let whereClause = '';
    if (role === ROLES.PHOTOGRAPHER) {
        whereClause = `status = '${STATUS.WAITING_PHOTO}'`;
    } else if (role === ROLES.POST_PRODUCER) {
        whereClause = `status = '${STATUS.WAITING_POST_PRODUCTION}'`;
    } else {
        tableBody.innerHTML = '<tr><td colspan="4">Ruolo non supportato.</td></tr>';
        return;
    }

    const queryBuilder = Backendless.DataQueryBuilder.create()
        .setWhereClause(whereClause)
        .setSortBy(['lastUpdated DESC'])
        .setPageSize(50);

    Backendless.Data.of(ORDER_TABLE_NAME).find(queryBuilder)
        .then(orders => {
            if (!orders || orders.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="4">Nessun ordine trovato.</td></tr>';
                loadingText.textContent = '';
                return;
            }

            orders.forEach(order => {
                const row = tableBody.insertRow();
                row.insertCell().textContent = order.eanCode || '';
                row.insertCell().textContent = order.brand || '';
                row.insertCell().textContent = order.status || '';
                
                // Azioni (es. apri foto, aggiorna stato)
                const actionCell = row.insertCell();
                const btnView = document.createElement('button');
                btnView.textContent = 'Apri';
                btnView.className = 'btn-primary text-xs py-1 px-2';
                btnView.onclick = () => openOrderModal(order);
                actionCell.appendChild(btnView);
            });

            loadingText.textContent = '';
        })
        .catch(err => {
            console.error('Errore caricamento ordini:', err);
            tableBody.innerHTML = `<tr><td colspan="4">Errore nel caricamento degli ordini: ${err.message}</td></tr>`;
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
