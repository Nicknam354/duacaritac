document.addEventListener('DOMContentLoaded', () => {
    // ============================================================
    // STATE
    // ============================================================
    let cart = [];
    let currentRecipe = null;
    let customQty = 1;

    const SIZE_OPTIONS = {
        'Botol': ['250ml', '1000ml'],
        'Cup':   ['Medium', 'Large']
    };


    // Quick cash denomination buttons (in IDR)
    const QUICK_CASH = [5000, 10000, 20000, 50000, 100000];

    // ============================================================
    // DOM REFS
    // ============================================================
    const menuGrid        = document.getElementById('menuGrid');
    const menuSearch      = document.getElementById('menuSearch');
    const floatingCartBtn = document.getElementById('floatingCartBtn');
    const cartBadge       = document.getElementById('cartBadge');
    const cartTotalLabel  = document.getElementById('cartTotalLabel');

    const viewMenu  = document.getElementById('view-menu');
    const viewCart  = document.getElementById('view-cart');
    const viewCash  = document.getElementById('view-cash');

    const customizeModal = document.getElementById('customizeModal');
    const qrisModal      = document.getElementById('qrisModal');
    const finishModal    = document.getElementById('finishModal');

    const customizeModalTitle    = document.getElementById('customizeModalTitle');
    const customizeModalPrice    = document.getElementById('customizeModalPrice');
    const customQtyDisplay       = document.getElementById('customQtyDisplay');
    const customNotes            = document.getElementById('customNotes');
    const sizeSection            = document.getElementById('sizeSection');
    const sizeOptionsEl          = document.getElementById('sizeOptions');
    const customSubtotalPreview  = document.getElementById('customSubtotalPreview');
    const inventoryStatusPreview = document.getElementById('inventoryStatusPreview');
    const btnAddToCart           = document.getElementById('btnAddToCart');

    const cartItemsList  = document.getElementById('cartItemsList');
    const cartSubtotal   = document.getElementById('cartSubtotal');
    const cartGrandTotal = document.getElementById('cartGrandTotal');

    const cashTotalDisplay  = document.getElementById('cashTotalDisplay');
    const cashInput         = document.getElementById('cashInput');
    const kembalianDisplay  = document.getElementById('kembalianDisplay');
    const btnBayarCash      = document.getElementById('btnBayarCash');
    const quickCashBtns     = document.getElementById('quickCashBtns');

    // ============================================================
    // INIT
    // ============================================================
    menuGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem;"><i class="ri-loader-4-line ri-spin" style="font-size:2rem;color:var(--primary-color);"></i><p style="margin-top:0.5rem;color:var(--text-muted);">Memuat menu...</p></div>';
    initializeStore().then(() => renderMenu());

    document.addEventListener('storeUpdated', () => {
        if (viewMenu.style.display !== 'none') renderMenu();
    });

    // Packaging radio → update size options
    document.querySelectorAll('input[name="packaging"]').forEach(radio => {
        radio.addEventListener('change', () => {
            // updateSubtotalPreview akan dipanggil di dalam updateSizeOptions
            // setelah size radio pertama otomatis terpilih
            updateSizeOptions(radio.value);
        });
    });

    // Cancel buttons for customize modal
    document.getElementById('btnCancelCustomize').addEventListener('click', closeCustomizeModal);
    document.getElementById('btnCancelCustomize2').addEventListener('click', closeCustomizeModal);

    // Search filter
    menuSearch.addEventListener('input', () => renderMenu(menuSearch.value.toLowerCase()));

    // Payment method card styling
    document.querySelectorAll('input[name="payMethod"]').forEach(radio => {
        radio.addEventListener('change', () => {
            document.querySelectorAll('.payment-card').forEach(card => card.classList.remove('selected'));
            radio.closest('.payment-card')?.classList.add('selected');
        });
    });
    // Set initial selected state
    document.querySelector('.payment-card:has(input:checked)')?.classList.add('selected');

    // ============================================================
    // RENDER MENU
    // ============================================================
    function renderMenu(searchTerm = '') {
        let recipes = getRecipes();
        if (searchTerm) {
            recipes = recipes.filter(r => r.name.toLowerCase().includes(searchTerm));
        }

        if (recipes.length === 0) {
            menuGrid.innerHTML = `
                <div class="empty-state" style="grid-column:1/-1;">
                    <i class="ri-store-2-line"></i>
                    <p>${searchTerm ? 'Menu tidak ditemukan.' : 'Menu tidak tersedia.'}</p>
                    <span>${searchTerm ? 'Coba kata kunci lain.' : 'Silahkan tambahkan resep terlebih dahulu di halaman Resep.'}</span>
                </div>`;
            return;
        }

        const inventoryData = getInventory();

        menuGrid.innerHTML = recipes.map(recipe => {
            // Cek ketersediaan menggunakan resepVariasi jika ada, fallback ke ingredients lama
            let isAvailable = true;
            let ingsToCheck = [];
            if (recipe.resepVariasi && Object.keys(recipe.resepVariasi).length > 0) {
                // Gunakan variasi pertama yang tersedia untuk cek awal di menu card
                ingsToCheck = Object.values(recipe.resepVariasi)[0] || [];
            } else {
                ingsToCheck = recipe.ingredients || [];
            }

            for (const ing of ingsToCheck) {
                const name = ing.name.trim().toLowerCase();
                const amount = ing.required;
                const invItem = inventoryData.find(inv => inv.name.trim().toLowerCase() === name);
                const availableQty = invItem ? invItem.quantity : 0;
                
                if (availableQty < amount) {
                    isAvailable = false;
                    break;
                }
            }

            const statusBadge = isAvailable 
                ? '' 
                : '<div style="position: absolute; top: 1rem; left: 1rem; background-color: var(--danger-color); color: white; padding: 0.3rem 0.6rem; border-radius: 6px; font-weight: 600; font-size: 0.8rem; z-index: 10; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">Stok Habis</div>';

            const buttonClass = isAvailable ? 'btn-primary' : 'btn-outline';
            const buttonText = isAvailable ? '<i class="ri-add-circle-line"></i> Pesan' : '<i class="ri-error-warning-line"></i> Bahan Habis';
            const buttonAction = isAvailable ? `onclick="window.openCustomizeModal('${recipe.id}')"` : 'disabled style="cursor: not-allowed; color: var(--danger-color); border-color: var(--danger-color);"';

            // Hitung rentang harga
            let priceDisplay = formatCurrency(recipe.price || 0);
            if (recipe.resepVariasi) {
                const variasiKeys = Object.keys(recipe.resepVariasi);
                if (variasiKeys.length > 0) {
                    const distinctPrices = new Set();
                    variasiKeys.forEach(key => {
                        const vp = (recipe.resepVariasiPrice && recipe.resepVariasiPrice[key] !== undefined) 
                            ? recipe.resepVariasiPrice[key] 
                            : (recipe.price || 0);
                        distinctPrices.add(vp);
                    });
                    const priceArray = Array.from(distinctPrices).sort((a, b) => a - b);
                    if (priceArray.length === 1) {
                        priceDisplay = formatCurrency(priceArray[0]);
                    } else if (priceArray.length > 1) {
                        priceDisplay = `${formatCurrency(priceArray[0])} - ${formatCurrency(priceArray[priceArray.length - 1])}`;
                    }
                }
            }

            return `
            <div class="menu-card" style="${isAvailable ? '' : 'opacity: 0.8; filter: grayscale(30%);'}">
                <div class="menu-image-container">
                    ${statusBadge}
                    <img src="${recipe.image || 'assets/espresso.png'}" alt="${recipe.name}" class="menu-image" onerror="this.src='assets/espresso.png'">
                    <div class="menu-price" style="font-size: 0.9rem;">${priceDisplay}</div>
                </div>
                <div class="menu-content">
                    <h3 class="menu-title">${recipe.name}</h3>
                    <p class="menu-desc">Pesan sekarang untuk menikmati ${recipe.name}.</p>
                    <button class="btn ${buttonClass} btn-block" ${buttonAction}>
                        ${buttonText}
                    </button>
                </div>
            </div>
            `;
        }).join('');
    }

    // ============================================================
    // CUSTOMIZE MODAL
    // ============================================================
    function openCustomizeModal(recipeId) {
        const recipes = getRecipes();
        currentRecipe = recipes.find(r => r.id === recipeId);
        if (!currentRecipe) return;

        customizeModalTitle.textContent = currentRecipe.name;
        customizeModalPrice.textContent = formatCurrency(currentRecipe.price || 0);
        customQty = 1;
        customQtyDisplay.textContent = '1';
        customNotes.value = '';

        // Pilih packaging & size default berdasarkan variasi pertama yang ada di resep ini
        let defaultPackaging = 'Botol';
        let defaultSize = '250ml';
        if (currentRecipe.resepVariasi && Object.keys(currentRecipe.resepVariasi).length > 0) {
            const firstKey = Object.keys(currentRecipe.resepVariasi)[0]; // e.g. "Cup_Medium"
            const parts = firstKey.split('_');
            if (parts.length >= 2) {
                defaultPackaging = parts[0];  // "Cup"
                defaultSize = parts.slice(1).join('_'); // "Medium" atau "1000ml"
            }
        }
        const packagingRadio = document.querySelector(`input[name="packaging"][value="${defaultPackaging}"]`);
        if (packagingRadio) packagingRadio.checked = true;
        // Render size options dengan size yang benar langsung terpilih, lalu panggil preview sekali
        updateSizeOptions(defaultPackaging, defaultSize);

        customizeModal.classList.add('active');
    }

    function closeCustomizeModal() {
        customizeModal.classList.remove('active');
        currentRecipe = null;
    }

    function updateSizeOptions(packaging, selectedSize = null) {
        const sizes = SIZE_OPTIONS[packaging] || [];
        sizeOptionsEl.innerHTML = sizes.map((size, i) => {
            // Tandai sebagai checked jika sesuai selectedSize, atau default ke index 0
            const isChecked = selectedSize ? size === selectedSize : i === 0;
            return `
            <label class="option-card">
                <input type="radio" name="size" value="${size}" ${isChecked ? 'checked' : ''}>
                <div class="option-card-inner">
                    <span>${size}</span>
                </div>
            </label>
        `;
        }).join('');

        // Listen to size changes for preview update
        sizeOptionsEl.querySelectorAll('input[name="size"]').forEach(r => {
            r.addEventListener('change', updateSubtotalPreview);
        });

        sizeSection.style.display = sizes.length > 0 ? 'block' : 'none';

        // Panggil preview SETELAH size sudah benar-benar terpilih di DOM
        updateSubtotalPreview();
    }

    function updateSubtotalPreview() {
        if (!currentRecipe) return;

        const packaging = document.querySelector('input[name="packaging"]:checked')?.value || 'Cup';
        const size      = document.querySelector('input[name="size"]:checked')?.value || '';
        const variasiKey = `${packaging}_${size}`;
        
        let unitPrice = currentRecipe.price || 0;
        if (currentRecipe.resepVariasiPrice && currentRecipe.resepVariasiPrice[variasiKey] !== undefined) {
            unitPrice = currentRecipe.resepVariasiPrice[variasiKey];
        }

        customizeModalPrice.textContent = formatCurrency(unitPrice);

        const subtotal = unitPrice * customQty;
        customSubtotalPreview.textContent = formatCurrency(subtotal);

        const packagingLabel = size ? `${packaging} ${size}` : packaging;
        
        const availability = checkAvailability(currentRecipe, customQty, packaging, size);
        
        let statusHtml = '<div style="margin-bottom:0.5rem;font-weight:600;">Status Ketersediaan:</div>';
        
        if (availability.noRecipe) {
            // Belum ada resep untuk ukuran ini
            statusHtml += `<div style="display:flex; align-items:center; gap:0.4rem; color: var(--danger-color, #EF4444); font-size: 0.85rem; font-weight:500;">
                <i class="ri-file-warning-line"></i>
                <span>Resep untuk ukuran <strong>${packaging} ${size}</strong> belum diinput di halaman Resep.</span>
            </div>`;
        } else if (availability.details.length === 0) {
            statusHtml += '<div style="color: var(--text-muted); font-size: 0.85rem;">Belum ada resep bahan untuk variasi ini.</div>';
        } else {
            availability.details.forEach(detail => {
                const color = detail.isSufficient ? 'var(--success-color, #10B981)' : 'var(--danger-color, #EF4444)';
                const icon = detail.isSufficient ? '<i class="ri-check-line"></i>' : '<i class="ri-close-line"></i>';
                statusHtml += `<div style="display:flex; justify-content:space-between; color:${color}; margin-bottom:0.25rem;">
                    <span>${icon} ${detail.name}</span>
                    <span>${detail.required} / ${detail.available}</span>
                </div>`;
            });
        }
        
        if (inventoryStatusPreview) {
            inventoryStatusPreview.innerHTML = statusHtml;
            inventoryStatusPreview.style.display = 'block';
        }
        
        if (btnAddToCart) {
            btnAddToCart.disabled = !availability.isAvailable;
            if (!availability.isAvailable) {
                btnAddToCart.style.opacity = '0.5';
                btnAddToCart.style.cursor = 'not-allowed';
            } else {
                btnAddToCart.style.opacity = '1';
                btnAddToCart.style.cursor = 'pointer';
            }
        }
    }

    function changeCustomQty(delta) {
        const newQty = customQty + delta;
        if (newQty >= 1 && newQty <= 99) {
            customQty = newQty;
            customQtyDisplay.textContent = customQty;
            updateSubtotalPreview();
        }
    }

    function checkAvailability(recipe, qty, packaging, size) {
        const inventoryData = getInventory();
        let isAvailable = true;
        let errorMessage = '';

        const requiredAmounts = {};
        
        // Cek multi-variasi dari data resep
        // Jika resep punya resepVariasi, hanya pakai bahan dari variasi yang dipilih saja.
        // Jika tidak cocok, tampilkan detail kosong (bukan fallback ke ingredients lama).
        let activeIngredients = [];
        const variasiKey = `${packaging}_${size}`;
        
        if (recipe.resepVariasi) {
            // Resep baru dengan multi-variasi: ambil bahan sesuai pilihan
            activeIngredients = recipe.resepVariasi[variasiKey] || [];
        } else {
            // Resep lama (backward compat): pakai ingredients langsung
            activeIngredients = recipe.ingredients || [];
        }

        // Jika belum ada resep untuk ukuran ini, langsung tidak tersedia
        if (activeIngredients.length === 0) {
            return {
                isAvailable: false,
                errorMessage: `Resep untuk ukuran ${packaging} ${size} belum diinput.`,
                details: [],
                noRecipe: true  // flag khusus untuk UI
            };
        }

        // Add current requested amounts
        activeIngredients.forEach(ing => {
            const name = ing.name.trim().toLowerCase();
            requiredAmounts[name] = (requiredAmounts[name] || 0) + (ing.required * qty);
        });

        // Add amounts from cart
        cart.forEach(item => {
            (item.finalIngredients || item.recipe.ingredients || []).forEach(ing => {
                const name = ing.name.trim().toLowerCase();
                requiredAmounts[name] = (requiredAmounts[name] || 0) + (ing.required * item.qty);
            });
        });

        const details = [];

        // Now check against inventory
        for (const [name, amount] of Object.entries(requiredAmounts)) {
            const invItem = inventoryData.find(inv => inv.name.trim().toLowerCase() === name);
            const availableQty = invItem ? invItem.quantity : 0;
            const displayItem = invItem ? invItem.name : name;
            
            const isItemSufficient = availableQty >= amount;
            if (!isItemSufficient) {
                isAvailable = false;
                if (!errorMessage) {
                    errorMessage = `Bahan baku atau kemasan "${displayItem}" tidak mencukupi.\n(Dibutuhkan: ${amount}, Tersedia: ${availableQty})`;
                }
            }
            
            details.push({
                name: displayItem,
                required: amount,
                available: availableQty,
                isSufficient: isItemSufficient
            });
        }

        return { isAvailable, errorMessage, details };
    }

    function addToCart() {
        if (!currentRecipe) return;

        const packaging = document.querySelector('input[name="packaging"]:checked')?.value || 'Cup';
        const size      = document.querySelector('input[name="size"]:checked')?.value || '';
        const notes     = customNotes.value.trim();
        const packagingLabel = size ? `${packaging} ${size}` : packaging;
        const variasiKey = `${packaging}_${size}`;

        let unitPrice = currentRecipe.price || 0;
        if (currentRecipe.resepVariasiPrice && currentRecipe.resepVariasiPrice[variasiKey] !== undefined) {
            unitPrice = currentRecipe.resepVariasiPrice[variasiKey];
        }
        const subtotal  = unitPrice * customQty;

        const availability = checkAvailability(currentRecipe, customQty, packaging, size);
        if (!availability.isAvailable) {
            alert(availability.errorMessage);
            return;
        }

        // Resolve final ingredients
        let finalIngredients = currentRecipe.ingredients || [];
        
        if (currentRecipe.resepVariasi && currentRecipe.resepVariasi[variasiKey] && currentRecipe.resepVariasi[variasiKey].length > 0) {
            finalIngredients = currentRecipe.resepVariasi[variasiKey];
        }

        cart.push({
            cartId: Date.now() + Math.random(), // unique per item
            recipe: currentRecipe,
            finalIngredients: finalIngredients,
            unitPrice: unitPrice,
            packaging,
            size,
            packagingLabel,
            qty: customQty,
            notes,
            subtotal
        });

        closeCustomizeModal();
        updateCartFloatingBtn();
        showAddedAnimation();
    }

    function showAddedAnimation() {
        floatingCartBtn.classList.add('cart-bounce');
        setTimeout(() => floatingCartBtn.classList.remove('cart-bounce'), 400);
    }

    // ============================================================
    // CART FLOATING BUTTON
    // ============================================================
    function updateCartFloatingBtn() {
        const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
        const totalPrice = cart.reduce((sum, item) => sum + item.subtotal, 0);

        cartBadge.textContent = totalItems;
        cartTotalLabel.textContent = formatCurrency(totalPrice);
        floatingCartBtn.style.display = cart.length > 0 ? 'flex' : 'none';
    }

    // ============================================================
    // CART REVIEW VIEW
    // ============================================================
    function renderCartView() {
        if (cart.length === 0) {
            showMenuView();
            return;
        }

        cartItemsList.innerHTML = cart.map(item => `
            <div class="cart-item-card" id="cart-${item.cartId}">
                <div class="cart-item-img">
                    <img src="${item.recipe.image || 'assets/espresso.png'}" alt="${item.recipe.name}" onerror="this.src='assets/espresso.png'">
                </div>
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.recipe.name}</div>
                    <div class="cart-item-meta">
                        <span class="meta-chip"><i class="ri-archive-2-line"></i> ${item.packagingLabel}</span>
                        ${item.notes ? `<span class="meta-chip notes-chip"><i class="ri-sticky-note-line"></i> ${item.notes}</span>` : ''}
                    </div>
                    <div class="cart-item-bottom">
                        <span class="cart-item-qty-price">${item.qty}x &nbsp;${formatCurrency(item.unitPrice)}</span>
                        <strong class="cart-item-subtotal">${formatCurrency(item.subtotal)}</strong>
                    </div>
                </div>
                <button class="cart-remove-btn" onclick="window.removeCartItem(${item.cartId})" title="Hapus item">
                    <i class="ri-delete-bin-line"></i>
                </button>
            </div>
        `).join('');

        const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
        cartSubtotal.textContent = formatCurrency(total);
        cartGrandTotal.textContent = formatCurrency(total);
    }

    function removeCartItem(cartId) {
        cart = cart.filter(item => item.cartId !== cartId);
        updateCartFloatingBtn();
        if (cart.length === 0) {
            showMenuView();
        } else {
            renderCartView();
        }
    }

    // ============================================================
    // VIEW SWITCHING
    // ============================================================
    function showMenuView() {
        viewMenu.style.display = 'block';
        viewCart.style.display = 'none';
        viewCash.style.display = 'none';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function showCartView() {
        if (cart.length === 0) return;
        renderCartView();
        viewMenu.style.display = 'none';
        viewCart.style.display = 'block';
        viewCash.style.display = 'none';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function showCashView() {
        const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
        cashTotalDisplay.textContent = formatCurrency(total);
        cashInput.value = '';
        kembalianDisplay.textContent = 'Rp 0';
        kembalianDisplay.className = 'kembalian-value';
        btnBayarCash.disabled = true;

        // Render quick cash buttons
        quickCashBtns.innerHTML = QUICK_CASH
            .filter(v => v >= total || v >= 5000)
            .map(v => `
                <button class="quick-cash-btn" onclick="window.setQuickCash(${v})">
                    ${formatCurrency(v)}
                </button>
            `).join('');

        viewMenu.style.display = 'none';
        viewCart.style.display = 'none';
        viewCash.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function setQuickCash(amount) {
        const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
        // Stack quick cash amounts until >= total
        const current = parseFloat(cashInput.value) || 0;
        const newVal = current >= total ? amount : current + amount;
        cashInput.value = newVal;
        calculateChange();
    }

    // ============================================================
    // PAYMENT FLOW
    // ============================================================
    function proceedToPayment() {
        if (cart.length === 0) return;
        const method = document.querySelector('input[name="payMethod"]:checked')?.value || 'cash';

        if (method === 'cash') {
            showCashView();
        } else if (method === 'qris') {
            const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
            document.getElementById('qrisTotalDisplay').textContent = formatCurrency(total);
            qrisModal.classList.add('active');
        }
    }

    function calculateChange() {
        const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
        const cash  = parseFloat(cashInput.value) || 0;
        const change = cash - total;

        if (cash > 0 && cash >= total) {
            kembalianDisplay.textContent = formatCurrency(change);
            kembalianDisplay.className = 'kembalian-value kembalian-ok';
            btnBayarCash.disabled = false;
        } else if (cash > 0 && cash < total) {
            kembalianDisplay.textContent = `Kurang ${formatCurrency(total - cash)}`;
            kembalianDisplay.className = 'kembalian-value kembalian-kurang';
            btnBayarCash.disabled = true;
        } else {
            kembalianDisplay.textContent = 'Rp 0';
            kembalianDisplay.className = 'kembalian-value';
            btnBayarCash.disabled = true;
        }
    }

    function finalizeCashPayment() {
        deductInventory();
        saveOrderRecord('Cash');
        showFinishModal();
    }

    function finalizeQRISPayment() {
        deductInventory();
        saveOrderRecord('QRIS');
        qrisModal.classList.remove('active');
        showFinishModal();
    }

    function closeQRIS() {
        qrisModal.classList.remove('active');
    }

    // ============================================================
    // INVENTORY DEDUCTION
    // ============================================================
    function deductInventory() {
        const inventoryData = getInventory();

        cart.forEach(item => {
            const qty = item.qty;

            // 1. Deduct recipe ingredients × qty
            (item.finalIngredients || item.recipe.ingredients || []).forEach(ing => {
                const idx = inventoryData.findIndex(
                    inv => inv.name.trim().toLowerCase() === ing.name.trim().toLowerCase()
                );
                if (idx !== -1) {
                    inventoryData[idx].quantity = Math.max(0, inventoryData[idx].quantity - (ing.required * qty));
                }
            });

        });

        saveInventory(inventoryData);
    }

    function saveOrderRecord(paymentMethod) {
        let lastId = parseInt(localStorage.getItem('duaCarita_lastOrderId') || '0');
        lastId++;
        localStorage.setItem('duaCarita_lastOrderId', lastId.toString());

        const total     = cart.reduce((sum, item) => sum + item.subtotal, 0);
        const menuNames = cart.map(item => `${item.qty}x ${item.recipe.name} (${item.packagingLabel})`).join(', ');

        saveOrder({
            id: `#ORD-${lastId}`,
            menuName: menuNames,
            quantity: cart.reduce((sum, item) => sum + item.qty, 0),
            totalPrice: total,
            paymentMethod
        });
    }

    // ============================================================
    // FINISH MODAL
    // ============================================================
    function showFinishModal() {
        const total     = cart.reduce((sum, item) => sum + item.subtotal, 0);
        const totalQty  = cart.reduce((sum, item) => sum + item.qty, 0);
        document.getElementById('finishSummary').textContent =
            `${totalQty} item berhasil diproses. Total ${formatCurrency(total)}. Stok inventory telah diperbarui.`;
        finishModal.classList.add('active');
    }

    function printReceipt() {
        window.print();
    }

    function finishTransaction() {
        cart = [];
        finishModal.classList.remove('active');
        updateCartFloatingBtn();
        showMenuView();
        renderMenu(menuSearch.value.toLowerCase());
    }

    // ============================================================
    // EXPOSE TO WINDOW
    // ============================================================
    window.openCustomizeModal  = openCustomizeModal;
    window.changeCustomQty     = changeCustomQty;
    window.addToCart           = addToCart;
    window.removeCartItem      = removeCartItem;
    window.showMenuView        = showMenuView;
    window.showCartView        = showCartView;
    window.setQuickCash        = setQuickCash;
    window.proceedToPayment    = proceedToPayment;
    window.calculateChange     = calculateChange;
    window.finalizeCashPayment = finalizeCashPayment;
    window.finalizeQRISPayment = finalizeQRISPayment;
    window.closeQRIS           = closeQRIS;
    window.printReceipt        = printReceipt;
    window.finishTransaction   = finishTransaction;
});
