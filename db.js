const DB_NAME = 'survey_offline';
const DB_VERSION = 1;
let _db = null;

function openDB() {
    return new Promise((resolve, reject) => {
        if (_db) return resolve(_db);
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = e => {
            const d = e.target.result;
            if (!d.objectStoreNames.contains('applications')) {
                const s = d.createObjectStore('applications', { keyPath: 'encryptedID' });
                s.createIndex('appNumber', 'appNumber');
            }
            if (!d.objectStoreNames.contains('static_data')) {
                d.createObjectStore('static_data', { keyPath: 'key' });
            }
            if (!d.objectStoreNames.contains('pending_surveys')) {
                const s = d.createObjectStore('pending_surveys', { keyPath: 'localID', autoIncrement: true });
                s.createIndex('status', 'status');
                s.createIndex('encryptedAppID', 'encryptedAppID');
            }
            if (!d.objectStoreNames.contains('survey_photos')) {
                const s = d.createObjectStore('survey_photos', { keyPath: 'photoID', autoIncrement: true });
                s.createIndex('localSurveyID', 'localSurveyID');
            }
        };
        req.onsuccess = e => { _db = e.target.result; resolve(_db); };
        req.onerror = () => reject(req.error);
    });
}

async function dbPut(store, value) {
    const d = await openDB();
    return new Promise((resolve, reject) => {
        const tx = d.transaction(store, 'readwrite');
        tx.objectStore(store).put(value);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function dbGet(store, key) {
    const d = await openDB();
    return new Promise((resolve, reject) => {
        const req = d.transaction(store).objectStore(store).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function dbGetAll(store) {
    const d = await openDB();
    return new Promise((resolve, reject) => {
        const req = d.transaction(store).objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function dbAdd(store, value) {
    const d = await openDB();
    return new Promise((resolve, reject) => {
        const tx = d.transaction(store, 'readwrite');
        const req = tx.objectStore(store).add(value);
        req.onsuccess = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
    });
}

async function dbDelete(store, key) {
    const d = await openDB();
    return new Promise((resolve, reject) => {
        const tx = d.transaction(store, 'readwrite');
        tx.objectStore(store).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function dbGetByIndex(store, index, value) {
    const d = await openDB();
    return new Promise((resolve, reject) => {
        const req = d.transaction(store).objectStore(store).index(index).getAll(value);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// Application cache
const saveApplication = data => dbPut('applications', data);
const getApplication = id => dbGet('applications', id);
const getAllApplications = () => dbGetAll('applications');
const deleteApplication = id => dbDelete('applications', id);

// Static data cache
const saveStaticData = (key, data) => dbPut('static_data', { key, data, cachedAt: Date.now() });
const getStaticData = async key => { const r = await dbGet('static_data', key); return r?.data; };

// Pending surveys
async function savePendingSurvey(data) {
    return dbAdd('pending_surveys', { ...data, createdAt: Date.now(), status: 'pending', errorMsg: null, syncedAt: null });
}

async function updateSurveyStatus(localID, status, errorMsg = null) {
    const d = await openDB();
    return new Promise((resolve, reject) => {
        const tx = d.transaction('pending_surveys', 'readwrite');
        const store = tx.objectStore('pending_surveys');
        const req = store.get(localID);
        req.onsuccess = () => {
            const s = req.result;
            if (!s) return resolve();
            s.status = status;
            s.errorMsg = errorMsg;
            if (status === 'synced') s.syncedAt = Date.now();
            store.put(s);
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function deleteSurveyAndPhotos(localID) {
    const d = await openDB();
    return new Promise((resolve, reject) => {
        const tx = d.transaction(['pending_surveys', 'survey_photos'], 'readwrite');
        tx.objectStore('pending_surveys').delete(localID);
        const req = tx.objectStore('survey_photos').index('localSurveyID').getAll(localID);
        req.onsuccess = () => {
            req.result.forEach(p => tx.objectStore('survey_photos').delete(p.photoID));
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

const getPendingSurveys = () => dbGetAll('pending_surveys');
const getSurvey = id => dbGet('pending_surveys', id);

// Photos
const savePhoto = (localSurveyID, name, type, blob) => dbAdd('survey_photos', { localSurveyID, name, type, blob });
const getPhotos = localSurveyID => dbGetByIndex('survey_photos', 'localSurveyID', localSurveyID);
