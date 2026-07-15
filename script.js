document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const form = document.getElementById('inventoryForm');
    const inputName = document.getElementById('itemName');
    const inputQuantity = document.getElementById('itemQuantity');
    const inputUnit = document.getElementById('itemUnit');
    const inputNotes = document.getElementById('itemNotes');
    const inputEditId = document.getElementById('editId');
    const btnSubmit = document.getElementById('btnSubmit');
    const btnCancel = document.getElementById('btnCancel');
    
    const tableBody = document.getElementById('inventoryList');
    const emptyState = document.getElementById('emptyState');
    const tableContainer = document.querySelector('.table-responsive');
    const searchInput = document.getElementById('searchInput');

    // Restock Modal Elements
    const restockModal = document.getElementById('restockModal');
    const closeRestockModal = document.getElementById('closeRestockModal');
    const restockForm = document.getElementById('restockForm');
    const restockItemId = document.getElementById('restockItemId');
    const restockItemName = document.getElementById('restockItemName');
    const restockQuantity = document.getElementById('restockQuantity');
    const restockUnit = document.getElementById('restockUnit');
    const restockDate = document.getElementById('restockDate');
    const restockHistoryList = document.getElementById('restockHistoryList');
    const emptyRestockHistory = document.getElementById('emptyRestockHistory');

    // Initialize
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;"><i class="ri-loader-4-line ri-spin"></i> Memuat data dari Google Sheets...</td></tr>';
    initializeStore().then(() => {
        renderTable();
    });

    // Listen for background updates
    document.addEventListener('storeUpdated', () => {
        if (!form.contains(document.activeElement)) { // Hanya render ulang jika tidak sedang mengetik
            renderTable(searchInput.value.toLowerCase());
        }
    });

    // Event Listeners
    form.addEventListener('submit', handleFormSubmit);
    btnCancel.addEventListener('click', resetForm);
    searchInput.addEventListener('input', handleSearch);

    // Restock Modal Listeners
    closeRestockModal.addEventListener('click', () => {
        restockModal.classList.remove('active');
    });
    restockModal.addEventListener('click', (e) => {
        if (e.target === restockModal) {
            restockModal.classList.remove('active');
        }
    });
    restockForm.addEventListener('submit', handleRestockSubmit);

    function handleFormSubmit(e) {
        e.preventDefault();
        
        const name = inputName.value.trim();
        const quantity = parseFloat(inputQuantity.value);
        const unit = inputUnit.value;
        const notes = inputNotes.value.trim();
        const editId = inputEditId.value;

        if (!name || isNaN(quantity) || !unit) {
            alert('Mohon lengkapi data wajib (Nama, Jumlah, Satuan).');
            return;
        }

        const inventoryData = getInventory();

        if (editId) {
            // Update existing
            const index = inventoryData.findIndex(item => item.id === editId);
            if (index !== -1) {
                // Cek duplikat nama, kecuali item itu sendiri (case-insensitive)
                const isDuplicate = inventoryData.some(
                    item => item.id !== editId && item.name.trim().toLowerCase() === name.toLowerCase()
                );
                if (isDuplicate) {
                    showDuplicateWarning(`Bahan "${name}" sudah ada di inventory! Gunakan nama yang berbeda.`);
                    return;
                }
                inventoryData[index] = {
                    ...inventoryData[index],
                    name,
                    quantity,
                    unit,
                    notes
                };
            }
        } else {
            // Cek duplikat nama (case-insensitive)
            const isDuplicate = inventoryData.some(item => item.name.trim().toLowerCase() === name.toLowerCase());
            if (isDuplicate) {
                showDuplicateWarning(`Bahan "${name}" sudah ada di dalam inventory!`);
                return;
            }

            // Add new
            let nextId = 1;
            if (inventoryData.length > 0) {
                const ids = inventoryData.map(i => parseInt(i.id.toString().replace(/\D/g, '')) || 0);
                nextId = Math.max(...ids) + 1;
            }
            
            const newItem = {
                id: 'INV-' + nextId,
                name,
                quantity,
                unit,
                notes
            };
            inventoryData.push(newItem);
        }

        saveInventory(inventoryData);
        resetForm();
        renderTable();
    }

    function editItem(id) {
        const inventoryData = getInventory();
        const item = inventoryData.find(i => i.id === id);
        if (!item) return;

        // Fill form
        inputEditId.value = item.id;
        inputName.value = item.name;
        inputQuantity.value = item.quantity;
        inputUnit.value = item.unit;
        inputNotes.value = item.notes || '';

        // Change UI state
        btnSubmit.innerHTML = '<i class="ri-refresh-line"></i> <span>Perbarui Bahan</span>';
        btnSubmit.classList.replace('btn-primary', 'btn-warning');
        btnSubmit.style.backgroundColor = 'var(--warning-color)';
        btnSubmit.style.boxShadow = '0 4px 14px 0 rgba(245, 158, 11, 0.39)';
        
        btnCancel.style.display = 'inline-flex';

        // Highlight row
        renderTable(); // Re-render to clear other highlights
        const row = document.getElementById(`row-${id}`);
        if (row) {
            row.classList.add('editing-row');
        }
        
        // Scroll to form
        form.scrollIntoView({ behavior: 'smooth' });
    }

    function deleteItem(id) {
        if (confirm('Apakah Anda yakin ingin menghapus bahan ini?')) {
            let inventoryData = getInventory();
            inventoryData = inventoryData.filter(item => item.id !== id);
            saveInventory(inventoryData);
            renderTable();
        }
    }

    function handleSearch(e) {
        const term = e.target.value.toLowerCase();
        renderTable(term);
    }

    function restockItem(id) {
        const inventoryData = getInventory();
        const item = inventoryData.find(i => i.id === id);
        if (!item) return;

        restockItemId.value = item.id;
        restockItemName.value = item.name;
        restockUnit.value = item.unit;
        restockQuantity.value = '';
        
        const today = new Date().toISOString().split('T')[0];
        restockDate.value = today;

        renderRestockHistory(item);
        
        if(restockModal) restockModal.classList.add('active');
    }

    function renderRestockHistory(item) {
        const history = item.restockHistory || [];
        if (history.length === 0) {
            restockHistoryList.innerHTML = '';
            emptyRestockHistory.style.display = 'block';
        } else {
            emptyRestockHistory.style.display = 'none';
            // Urutan dari No.1 (entry pertama/tertua) ke bawah
            restockHistoryList.innerHTML = history.map((entry, index) => `
                <tr>
                    <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">${index + 1}</td>
                    <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">${entry.date}</td>
                    <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);"><span class="qty-badge">${entry.quantity} ${item.unit}</span></td>
                </tr>
            `).join('');
        }
    }

    function handleRestockSubmit(e) {
        e.preventDefault();
        const id = restockItemId.value;
        const qty = parseFloat(restockQuantity.value);
        const date = restockDate.value;

        if (!id || isNaN(qty) || !date) return;

        const inventoryData = getInventory();
        const index = inventoryData.findIndex(i => i.id === id);
        if (index !== -1) {
            const item = inventoryData[index];
            if (!item.restockHistory) {
                item.restockHistory = [];
            }
            item.restockHistory.push({
                date: date,
                quantity: qty
            });
            item.quantity += qty;

            saveInventory(inventoryData);
            
            renderTable(searchInput.value.toLowerCase());
            renderRestockHistory(item);
            
            restockQuantity.value = '';
            alert('Berhasil menambah stok!');
        }
    }

    function resetForm() {
        form.reset();
        inputEditId.value = '';
        
        // Reset UI state
        btnSubmit.innerHTML = '<i class="ri-save-line"></i> <span>Tambah Bahan</span>';
        btnSubmit.style.backgroundColor = '';
        btnSubmit.style.boxShadow = '';
        btnSubmit.classList.remove('btn-warning');
        btnSubmit.classList.add('btn-primary');
        
        btnCancel.style.display = 'none';
        
        renderTable(); // Remove highlights
    }

    function renderTable(searchTerm = '') {
        const inventoryData = getInventory();
        let filteredData = inventoryData;
        
        if (searchTerm) {
            filteredData = inventoryData.filter(item => 
                item.name.toLowerCase().includes(searchTerm) || 
                (item.notes && item.notes.toLowerCase().includes(searchTerm))
            );
        }

        if (filteredData.length === 0) {
            tableContainer.style.display = 'none';
            emptyState.style.display = 'flex';
            if (searchTerm) {
                emptyState.querySelector('p').textContent = 'Pencarian tidak ditemukan.';
                emptyState.querySelector('span').textContent = 'Coba kata kunci lain.';
            } else {
                emptyState.querySelector('p').textContent = 'Belum ada data inventory.';
                emptyState.querySelector('span').textContent = 'Silahkan tambahkan bahan melalui form di atas.';
            }
        } else {
            tableContainer.style.display = 'block';
            emptyState.style.display = 'none';
            
            tableBody.innerHTML = filteredData.map(item => `
                <tr id="row-${item.id}">
                    <td class="item-name-cell">${item.name}</td>
                    <td>
                        <span class="qty-badge">${item.quantity} ${item.unit}</span>
                    </td>
                    <td>${item.unit}</td>
                    <td class="notes-cell" title="${item.notes || '-'}">${item.notes || '-'}</td>
                    <td class="actions-col">
                        <div class="action-btns">
                            <button class="icon-btn" onclick="window.restockItem('${item.id}')" title="Restok" style="color: var(--primary-color); background-color: var(--primary-light);">
                                <i class="ri-add-box-line"></i>
                            </button>
                            <button class="icon-btn edit-btn" onclick="window.editItem('${item.id}')" title="Edit">
                                <i class="ri-pencil-line"></i>
                            </button>
                            <button class="icon-btn delete-btn" onclick="window.deleteItem('${item.id}')" title="Hapus">
                                <i class="ri-delete-bin-line"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    }

    // Expose functions to global scope for inline onclick handlers
    window.editItem = editItem;
    window.deleteItem = deleteItem;
    window.restockItem = restockItem;

    function showDuplicateWarning(message) {
        // Cari atau buat elemen peringatan
        let warningEl = document.getElementById('inventoryDuplicateWarning');
        if (!warningEl) {
            warningEl = document.createElement('div');
            warningEl.id = 'inventoryDuplicateWarning';
            warningEl.style.cssText = `
                display: flex; align-items: center; gap: 0.6rem;
                background: #FEE2E2; color: #B91C1C;
                border: 1px solid #FECACA; border-radius: 0.75rem;
                padding: 0.85rem 1.1rem; margin-bottom: 1rem;
                font-weight: 500; font-size: 0.9rem;
                animation: fadeIn 0.3s ease;
            `;
            warningEl.innerHTML = `<i class="ri-error-warning-line" style="font-size:1.2rem; flex-shrink:0;"></i><span></span>`;
            form.insertBefore(warningEl, form.firstChild);
        }
        warningEl.querySelector('span').textContent = message;
        warningEl.style.display = 'flex';

        // Sembunyikan otomatis setelah 4 detik
        clearTimeout(warningEl._timer);
        warningEl._timer = setTimeout(() => {
            warningEl.style.display = 'none';
        }, 4000);

        // Scroll ke form
        form.scrollIntoView({ behavior: 'smooth' });
    }
});
