// store.js
// Handles Data Synchronization with Google Sheets API

const API_URL = 'https://script.google.com/macros/s/AKfycbz4JlU3AAzizrI-1NtNRe_pM2xU_l9__kkDEfhhn8c5O2F8l1p8ryzph_PmLZM7CRjq/exec';

let localInventoryCache = [];
let localRecipesCache = [];

async function initializeStore() {
    // 1. Coba muat dari cache lokal terlebih dahulu untuk render instan
    const cachedInv = localStorage.getItem('cache_inventory');
    const cachedRec = localStorage.getItem('cache_recipes');
    
    if (cachedInv && cachedRec) {
        localInventoryCache = JSON.parse(cachedInv);
        localRecipesCache = JSON.parse(cachedRec);
    }

    // 2. Ambil data terbaru di background
    const fetchPromise = (async () => {
        try {
            const invResponse = await fetch(API_URL + '?action=getInventory');
            localInventoryCache = await invResponse.json();
            localStorage.setItem('cache_inventory', JSON.stringify(localInventoryCache));
            
            const recResponse = await fetch(API_URL + '?action=getRecipes');
            localRecipesCache = await recResponse.json();
            localStorage.setItem('cache_recipes', JSON.stringify(localRecipesCache));
            
            // Memberitahu UI bahwa data terbaru sudah siap untuk di-render ulang
            document.dispatchEvent(new Event('storeUpdated'));
        } catch (e) {
            console.error("Background sync failed:", e);
        }
    })();

    // Jika belum ada cache sama sekali (pertama kali buka), tunggu loading selesai
    if (!cachedInv || !cachedRec) {
        await fetchPromise;
    }
    
    return true;
}

// Helpers for Inventory
function getInventory() {
    return localInventoryCache;
}

async function saveInventory(data) {
    localInventoryCache = data;
    localStorage.setItem('cache_inventory', JSON.stringify(localInventoryCache));
    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'saveInventory', payload: data })
        });
    } catch(e) {
        console.error("Failed to save inventory to Google Sheets:", e);
    }
}

// Helpers for Recipes
function getRecipes() {
    return localRecipesCache;
}

async function saveRecipes(data) {
    localRecipesCache = data;
    localStorage.setItem('cache_recipes', JSON.stringify(localRecipesCache));
    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'saveRecipes', payload: data })
        });
    } catch(e) {
        console.error("Failed to save recipes to Google Sheets:", e);
    }
}

// Helper for Order History
async function saveOrder(orderData) {
    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'saveOrder', payload: orderData })
        });
    } catch(e) {
        console.error("Failed to save order to Google Sheets:", e);
    }
}

// Format Currency Utility
function formatCurrency(amount) {
    return 'Rp ' + amount.toLocaleString('id-ID');
}
