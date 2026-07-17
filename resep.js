document.addEventListener('DOMContentLoaded', () => {
    const recipeGrid = document.getElementById('recipeGrid');
    const recipeModal = document.getElementById('recipeModal');
    const recipeModalTitle = document.getElementById('recipeModalTitle');
    const recipeForm = document.getElementById('recipeForm');
    
    // Form fields
    const inputEditId = document.getElementById('recipeEditId');
    const inputName = document.getElementById('recipeName');
    const inputPrice = document.getElementById('recipePrice');
    const inputImage = document.getElementById('recipeImage');
    const imagePreview = document.getElementById('imagePreview');
    const inputIngredients = document.getElementById('recipeIngredients');
    const inputSteps = document.getElementById('recipeSteps');
    const inputVariasiPrice = document.getElementById('recipeVariasiPrice');

    let currentVariasiRaw = {};
    let currentVariasiPrice = {};
    let currentActiveTab = 'Botol_250ml';
    let currentBase64Image = '';

    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Simpan nilai textarea dan harga saat ini ke tab yang aktif sebelumnya
            currentVariasiRaw[currentActiveTab] = inputIngredients.value;
            if (inputVariasiPrice.value) {
                currentVariasiPrice[currentActiveTab] = parseFloat(inputVariasiPrice.value);
            } else {
                delete currentVariasiPrice[currentActiveTab];
            }
            
            // Ubah gaya tab
            tabBtns.forEach(b => {
                b.classList.remove('active');
                b.style.background = 'var(--input-bg)';
                b.style.color = 'var(--text-muted)';
            });
            e.target.classList.add('active');
            e.target.style.background = 'var(--primary-color)';
            e.target.style.color = 'white';
            
            // Muat konten tab yang baru
            currentActiveTab = e.target.getAttribute('data-tab');
            inputIngredients.value = currentVariasiRaw[currentActiveTab] || '';
            inputVariasiPrice.value = currentVariasiPrice[currentActiveTab] || '';
        });
    });

    inputImage.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) {
            currentBase64Image = '';
            imagePreview.style.display = 'none';
            return;
        }
        if (file.size > 10 * 1024 * 1024) { // 10 MB
            alert('Ukuran file maksimal 10MB!');
            this.value = ''; // Reset input
            currentBase64Image = '';
            imagePreview.style.display = 'none';
            return;
        }
        const reader = new FileReader();
        reader.onload = function(event) {
            currentBase64Image = event.target.result;
            imagePreview.src = currentBase64Image;
            imagePreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    });

    recipeGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 2rem;"><i class="ri-loader-4-line ri-spin" style="font-size: 2rem; color: var(--primary-color);"></i><p>Memuat resep dari Google Sheets...</p></div>';
    initializeStore().then(() => {
        renderRecipes();
    });

    // Listen for background updates
    document.addEventListener('storeUpdated', () => {
        if (!recipeModal.classList.contains('active')) { // Hanya render jika form tidak terbuka
            renderRecipes();
        }
    });

    function renderRecipes() {
        const recipes = getRecipes();
        
        if (recipes.length === 0) {
            recipeGrid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <i class="ri-book-3-line"></i>
                    <p>Belum ada resep menu.</p>
                    <span>Silahkan tambahkan resep baru.</span>
                </div>
            `;
            return;
        }

        recipeGrid.innerHTML = recipes.map(recipe => {
            const isAvailable = checkRecipeAvailability(recipe);
            const statusBadge = isAvailable 
                ? '<span style="background: var(--primary-light); color: var(--primary-color); padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">Tersedia</span>'
                : '<span style="background: var(--danger-light); color: var(--danger-color); padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">Habis</span>';

            // Ambil salah satu variasi untuk ditampilkan di preview (misal Cup Medium jika ada, atau yang pertama)
            let defaultIngs = [];
            if (recipe.resepVariasi) {
                defaultIngs = recipe.resepVariasi['Cup_Medium'] || Object.values(recipe.resepVariasi)[0] || [];
            } else {
                defaultIngs = recipe.ingredients || []; // Fallback untuk resep lama
            }

            return `
            <div class="recipe-card">
                <img src="${recipe.image || 'assets/espresso.png'}" alt="${recipe.name}" class="recipe-image" onerror="this.src='assets/espresso.png'">
                <div class="recipe-content">
                    <div class="recipe-header" style="align-items: center;">
                        <h3 class="recipe-title">${recipe.name}</h3>
                        ${statusBadge}
                    </div>
                    
                    <div class="recipe-section" style="margin-bottom: 0.5rem;">
                        <span style="font-weight: 600; color: var(--primary-color);">${formatCurrency(recipe.price || 0)}</span>
                    </div>
                    
                    <div class="recipe-section">
                        <div class="recipe-section-title"><i class="ri-flask-line"></i> Bahan-bahan (Preview)</div>
                        <ul class="recipe-ingredients">
                            ${defaultIngs.map(ing => `
                                <li><span>${ing.name}</span> <span>${ing.required} ${ing.unit}</span></li>
                            `).join('')}
                        </ul>
                    </div>

                    <div class="recipe-section">
                        <div class="recipe-section-title"><i class="ri-list-ordered"></i> Langkah Pembuatan</div>
                        <ol class="recipe-steps">
                            ${recipe.steps.map(step => `<li>${step}</li>`).join('')}
                        </ol>
                    </div>
                    
                    <div class="recipe-footer">
                        <button class="icon-btn edit-btn" title="Edit Resep" onclick="window.editRecipe('${recipe.id}')">
                            <i class="ri-pencil-line"></i>
                        </button>
                        <button class="icon-btn delete-btn" title="Hapus Resep" onclick="window.deleteRecipe('${recipe.id}')">
                            <i class="ri-delete-bin-line"></i>
                        </button>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    }

    function checkRecipeAvailability(recipe) {
        const inventoryData = getInventory();

        // Kumpulkan semua variasi yang ada
        let variasions = [];
        if (recipe.resepVariasi && Object.keys(recipe.resepVariasi).length > 0) {
            variasions = Object.values(recipe.resepVariasi);
        } else if (recipe.ingredients && recipe.ingredients.length > 0) {
            variasions = [recipe.ingredients]; // Fallback resep lama
        }

        // Jika tidak ada variasi sama sekali, anggap tidak tersedia
        if (variasions.length === 0) return false;

        // Dianggap TERSEDIA jika setidaknya 1 variasi mencukupi stok
        for (const ingsToCheck of variasions) {
            let variasiOk = true;
            for (const ing of ingsToCheck) {
                const name = ing.name.trim().toLowerCase();
                const amount = ing.required;
                const invItem = inventoryData.find(inv => inv.name.trim().toLowerCase() === name);
                const availableQty = invItem ? invItem.quantity : 0;
                if (availableQty < amount) {
                    variasiOk = false;
                    break;
                }
            }
            if (variasiOk) return true; // Minimal 1 variasi tersedia
        }

        return false; // Semua variasi tidak tersedia
    }

    function openRecipeModal() {
        recipeModalTitle.textContent = 'Tambah Resep Baru';
        recipeForm.reset();
        inputEditId.value = '';
        currentBase64Image = '';
        imagePreview.style.display = 'none';
        imagePreview.src = '';
        
        currentVariasiRaw = {};
        currentVariasiPrice = {};
        
        // Reset tab
        tabBtns.forEach(b => {
            b.classList.remove('active');
            b.style.background = 'var(--input-bg)';
            b.style.color = 'var(--text-muted)';
        });
        const firstTab = document.querySelector('.tab-btn[data-tab="Botol_250ml"]');
        if (firstTab) {
            firstTab.classList.add('active');
            firstTab.style.background = 'var(--primary-color)';
            firstTab.style.color = 'white';
            currentActiveTab = 'Botol_250ml';
        }
        inputIngredients.value = '';
        inputVariasiPrice.value = '';
        
        recipeModal.classList.add('active');
    }

    function closeRecipeModal() {
        recipeModal.classList.remove('active');
    }

    function saveRecipe() {
        if (!inputName.value || !inputPrice.value || !inputSteps.value) {
            alert('Mohon isi nama, harga, dan langkah pembuatan!');
            return;
        }

        // Simpan state textarea dan harga tab saat ini
        currentVariasiRaw[currentActiveTab] = inputIngredients.value;
        if (inputVariasiPrice.value) {
            currentVariasiPrice[currentActiveTab] = parseFloat(inputVariasiPrice.value);
        } else {
            delete currentVariasiPrice[currentActiveTab];
        }

        // Parse semua variasi
        const resepVariasi = {};
        for (const [key, rawText] of Object.entries(currentVariasiRaw)) {
            if (rawText && rawText.trim() !== '') {
                const parsed = rawText.split('\n').map(line => {
                    const parts = line.split(',');
                    if (parts.length >= 3) {
                        return {
                            name: parts[0].trim(),
                            required: parseFloat(parts[1].trim()),
                            unit: parts[2].trim()
                        };
                    }
                    return null;
                }).filter(item => item !== null && !isNaN(item.required));
                
                resepVariasi[key] = parsed;
            }
        }

        // Parse steps textarea
        const steps = inputSteps.value.split('\n').filter(line => line.trim() !== '');

        const recipes = getRecipes();
        
        let nextId = 1;
        if (recipes.length > 0) {
            const ids = recipes.map(r => parseInt(r.id.toString().replace(/\D/g, '')) || 0);
            nextId = Math.max(...ids) + 1;
        }

        const recipeData = {
            id: inputEditId.value || 'REC-' + nextId,
            name: inputName.value.trim(),
            price: parseFloat(inputPrice.value),
            image: currentBase64Image || 'assets/espresso.png', // Save base64
            resepVariasi: resepVariasi, // Parsed version for order logic
            resepVariasiRaw: currentVariasiRaw, // Raw version for form edit
            resepVariasiPrice: currentVariasiPrice, // Harga khusus per variasi
            ingredients: resepVariasi['Cup_Medium'] || Object.values(resepVariasi)[0] || [], // Fallback for safety
            steps
        };

        if (inputEditId.value) {
            // Update
            const index = recipes.findIndex(r => r.id === inputEditId.value);
            if (index !== -1) {
                const isDuplicate = recipes.some(
                    r => r.id !== inputEditId.value && r.name.trim().toLowerCase() === recipeData.name.toLowerCase()
                );
                if (isDuplicate) {
                    showRecipeDuplicateWarning(`Menu "${recipeData.name}" sudah ada! Gunakan nama yang berbeda.`);
                    return;
                }
                
                // If the user didn't upload a new image, keep the old one
                if (!currentBase64Image && recipes[index].image) {
                    recipeData.image = recipes[index].image;
                }
                
                recipes[index] = recipeData;
            }
        } else {
            // Cek duplikat
            const isDuplicate = recipes.some(r => r.name.trim().toLowerCase() === recipeData.name.toLowerCase());
            if (isDuplicate) {
                showRecipeDuplicateWarning(`Menu "${recipeData.name}" sudah ada! Gunakan nama yang berbeda.`);
                return;
            }
            recipes.push(recipeData);
        }

        saveRecipes(recipes);
        closeRecipeModal();
        renderRecipes();
    }

    function editRecipe(id) {
        const recipes = getRecipes();
        const recipe = recipes.find(r => r.id === id);
        if (!recipe) return;

        recipeModalTitle.textContent = 'Edit Resep';
        inputEditId.value = recipe.id;
        inputName.value = recipe.name;
        inputPrice.value = recipe.price;
        
        // Image handling
        currentBase64Image = '';
        inputImage.value = '';
        if (recipe.image && recipe.image.startsWith('data:image')) {
            imagePreview.src = recipe.image;
            imagePreview.style.display = 'block';
            currentBase64Image = recipe.image; // Keep it so saveRecipe doesn't lose it if untouched
        } else {
            imagePreview.style.display = 'none';
        }
        
        // Variations handling
        currentVariasiRaw = recipe.resepVariasiRaw ? { ...recipe.resepVariasiRaw } : {};
        currentVariasiPrice = recipe.resepVariasiPrice ? { ...recipe.resepVariasiPrice } : {};
        
        // Backward compatibility
        if (Object.keys(currentVariasiRaw).length === 0 && recipe.ingredients && recipe.ingredients.length > 0) {
            const rawIngredients = recipe.ingredients.map(i => `${i.name}, ${i.required}, ${i.unit}`).join('\n');
            currentVariasiRaw['Cup_Medium'] = rawIngredients;
        }

        // Reset tab UI to Botol_250ml
        tabBtns.forEach(b => {
            b.classList.remove('active');
            b.style.background = 'var(--input-bg)';
            b.style.color = 'var(--text-muted)';
        });
        const firstTab = document.querySelector('.tab-btn[data-tab="Botol_250ml"]');
        if (firstTab) {
            firstTab.classList.add('active');
            firstTab.style.background = 'var(--primary-color)';
            firstTab.style.color = 'white';
            currentActiveTab = 'Botol_250ml';
        }
        
        inputIngredients.value = currentVariasiRaw[currentActiveTab] || '';
        inputVariasiPrice.value = currentVariasiPrice[currentActiveTab] || '';
        inputSteps.value = recipe.steps.join('\n');

        recipeModal.classList.add('active');
    }

    function deleteRecipe(id) {
        if (confirm('Apakah Anda yakin ingin menghapus resep ini?')) {
            let recipes = getRecipes();
            recipes = recipes.filter(r => r.id !== id);
            saveRecipes(recipes);
            renderRecipes();
        }
    }

    window.openRecipeModal = openRecipeModal;
    window.closeRecipeModal = closeRecipeModal;
    window.saveRecipe = saveRecipe;
    window.editRecipe = editRecipe;
    window.deleteRecipe = deleteRecipe;

    function showRecipeDuplicateWarning(message) {
        let warningEl = document.getElementById('recipeDuplicateWarning');
        if (!warningEl) {
            warningEl = document.createElement('div');
            warningEl.id = 'recipeDuplicateWarning';
            warningEl.style.cssText = `
                display: flex; align-items: center; gap: 0.6rem;
                background: #FEE2E2; color: #B91C1C;
                border: 1px solid #FECACA; border-radius: 0.75rem;
                padding: 0.85rem 1.1rem; margin-bottom: 1rem;
                font-weight: 500; font-size: 0.9rem;
            `;
            warningEl.innerHTML = `<i class="ri-error-warning-line" style="font-size:1.2rem; flex-shrink:0;"></i><span></span>`;
            recipeForm.insertBefore(warningEl, recipeForm.firstChild);
        }
        warningEl.querySelector('span').textContent = message;
        warningEl.style.display = 'flex';

        clearTimeout(warningEl._timer);
        warningEl._timer = setTimeout(() => {
            warningEl.style.display = 'none';
        }, 4000);
    }
});
