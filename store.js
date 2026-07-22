// store.js
// Handles Data Synchronization with Google Sheets API

const API_URL = 'https://script.google.com/macros/s/AKfycbz4JlU3AAzizrI-1NtNRe_pM2xU_l9__kkDEfhhn8c5O2F8l1p8ryzph_PmLZM7CRjq/exec';

let localInventoryCache = [];
let localRecipesCache = [];

// Dirty flags: timestamp kapan user terakhir menyimpan secara lokal.
// Background sync tidak akan menimpa data jika baru saja disimpan (< 10 detik).
let inventoryDirtyAt = 0;
let recipesDirtyAt = 0;
const SYNC_COOLDOWN_MS = 10000; // 10 detik

const SESSION_SYNC_KEY = 'duaCarita_session_synced';

async function initializeStore() {
    // 1. Coba muat dari cache lokal terlebih dahulu untuk render instan
    const cachedInv = localStorage.getItem('cache_inventory');
    const cachedRec = localStorage.getItem('cache_recipes');
    
    if (cachedInv && cachedRec) {
        localInventoryCache = JSON.parse(cachedInv);
        const parsedRecipes = JSON.parse(cachedRec);
        // Pastikan unpack saat load dari cache lokal (aman meski data belum di-pack)
        localRecipesCache = parsedRecipes.map(unpackRecipe);
    }

    const isSessionSynced = sessionStorage.getItem(SESSION_SYNC_KEY);

    // 2. Ambil data terbaru di background JIKA belum di-sync di sesi ini (atau cache kosong)
    if (!isSessionSynced || !cachedInv || !cachedRec) {
        const fetchPromise = (async () => {
            try {
                const invResponse = await fetch(API_URL + '?action=getInventory');
                const freshInventory = await invResponse.json();
                // Hanya timpa jika tidak ada perubahan lokal yang belum disync
                if (Date.now() - inventoryDirtyAt > SYNC_COOLDOWN_MS) {
                    localInventoryCache = freshInventory;
                    localStorage.setItem('cache_inventory', JSON.stringify(localInventoryCache));
                }
                
                const recResponse = await fetch(API_URL + '?action=getRecipes');
                let freshRecipes = await recResponse.json();
                freshRecipes = freshRecipes.map(unpackRecipe);
                // Hanya timpa jika tidak ada perubahan lokal yang belum disync
                if (Date.now() - recipesDirtyAt > SYNC_COOLDOWN_MS) {
                    localRecipesCache = freshRecipes;
                    localStorage.setItem('cache_recipes', JSON.stringify(localRecipesCache));
                }
                
                sessionStorage.setItem(SESSION_SYNC_KEY, 'true');

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
    } else {
        // Data sudah di-sync di sesi ini, gunakan cache lokal 100% tanpa fetch background
        // Trigger event agar komponen UI merender data lokal instan
        setTimeout(() => document.dispatchEvent(new Event('storeUpdated')), 0);
    }
    
    return true;
}

// Helpers for Inventory
function getInventory() {
    return localInventoryCache;
}

async function saveInventory(data) {
    localInventoryCache = data;
    inventoryDirtyAt = Date.now();
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
    recipesDirtyAt = Date.now();
    localStorage.setItem('cache_recipes', JSON.stringify(localRecipesCache));
    try {
        // Pack data sebelum dikirim ke server agar variasi tersimpan di dalam field 'steps'
        const packedData = data.map(packRecipe);
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'saveRecipes', payload: packedData })
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

// --- Utility Helpers for Packing/Unpacking Variasi ---
// Karena backend Google Sheets mungkin membuang field bertipe Object (seperti resepVariasi),
// kita sembunyikan data variasi tersebut ke dalam array 'steps' sebagai string.
function packRecipe(recipe) {
    const packed = { ...recipe };
    if (packed.resepVariasi || packed.resepVariasiRaw || packed.resepVariasiPrice) {
        const variasiData = JSON.stringify({
            v: packed.resepVariasi || {},
            r: packed.resepVariasiRaw || {},
            p: packed.resepVariasiPrice || {}
        });
        packed.steps = [...(packed.steps || []), `__VARIASI_DATA__::${variasiData}`];
        // Hapus field asli agar tidak bentrok dengan parser backend
        delete packed.resepVariasi;
        delete packed.resepVariasiRaw;
        delete packed.resepVariasiPrice;
    }
    return packed;
}

function unpackRecipe(recipe) {
    const unpacked = { ...recipe };
    if (unpacked.steps && Array.isArray(unpacked.steps) && unpacked.steps.length > 0) {
        const lastStep = unpacked.steps[unpacked.steps.length - 1];
        if (typeof lastStep === 'string' && lastStep.startsWith('__VARIASI_DATA__::')) {
            try {
                const variasiData = JSON.parse(lastStep.substring('__VARIASI_DATA__::'.length));
                unpacked.resepVariasi = variasiData.v;
                unpacked.resepVariasiRaw = variasiData.r;
                unpacked.resepVariasiPrice = variasiData.p || {};
                unpacked.steps = unpacked.steps.slice(0, -1);
            } catch (e) {
                console.error("Failed to parse variasi data", e);
            }
        }
    }
    return unpacked;
}
