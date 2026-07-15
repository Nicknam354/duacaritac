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
    const inputIngredients = document.getElementById('recipeIngredients');
    const inputSteps = document.getElementById('recipeSteps');

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

        recipeGrid.innerHTML = recipes.map(recipe => `
            <div class="recipe-card">
                <img src="${recipe.image || 'assets/espresso.png'}" alt="${recipe.name}" class="recipe-image" onerror="this.src='assets/espresso.png'">
                <div class="recipe-content">
                    <div class="recipe-header">
                        <h3 class="recipe-title">${recipe.name}</h3>
                    </div>
                    
                    <div class="recipe-section" style="margin-bottom: 0.5rem;">
                        <span style="font-weight: 600; color: var(--primary-color);">${formatCurrency(recipe.price || 0)}</span>
                    </div>
                    
                    <div class="recipe-section">
                        <div class="recipe-section-title"><i class="ri-flask-line"></i> Bahan-bahan</div>
                        <ul class="recipe-ingredients">
                            ${recipe.ingredients.map(ing => `
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
        `).join('');
    }

    function openRecipeModal() {
        recipeModalTitle.textContent = 'Tambah Resep Baru';
        recipeForm.reset();
        inputEditId.value = '';
        recipeModal.classList.add('active');
    }

    function closeRecipeModal() {
        recipeModal.classList.remove('active');
    }

    function saveRecipe() {
        if (!inputName.value || !inputPrice.value || !inputIngredients.value || !inputSteps.value) {
            alert('Mohon isi semua bidang yang wajib!');
            return;
        }

        // Parse ingredients textarea
        const ingredients = inputIngredients.value.split('\n').map(line => {
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
            image: inputImage.value.trim() || 'assets/espresso.png',
            ingredients,
            steps
        };

        if (inputEditId.value) {
            // Update
            const index = recipes.findIndex(r => r.id === inputEditId.value);
            if (index !== -1) {
                // Cek duplikat nama, kecuali resep itu sendiri (case-insensitive)
                const isDuplicate = recipes.some(
                    r => r.id !== inputEditId.value && r.name.trim().toLowerCase() === recipeData.name.toLowerCase()
                );
                if (isDuplicate) {
                    showRecipeDuplicateWarning(`Menu "${recipeData.name}" sudah ada! Gunakan nama yang berbeda.`);
                    return;
                }
                recipes[index] = recipeData;
            }
        } else {
            // Cek duplikat nama (case-insensitive)
            const isDuplicate = recipes.some(r => r.name.trim().toLowerCase() === recipeData.name.toLowerCase());
            if (isDuplicate) {
                showRecipeDuplicateWarning(`Menu "${recipeData.name}" sudah ada! Gunakan nama yang berbeda.`);
                return;
            }
            // Add
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
        inputImage.value = recipe.image;
        
        // Format ingredients back to textarea
        inputIngredients.value = recipe.ingredients.map(i => `${i.name}, ${i.required}, ${i.unit}`).join('\n');
        
        // Format steps back to textarea
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

    // Expose to window for inline HTML onclick handlers
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
