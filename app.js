// APP_VERSION and IS_DEV are injected by index.php
localStorage.setItem('appVersion', APP_VERSION);

/* ── Install prompt (Android/Chrome) ────────────────── */
let deferredInstallPrompt = null;
const isIOS        = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstallPrompt = e;
    renderInstallBanner();
});

window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    const banner = document.getElementById('install-banner');
    if (banner) banner.remove();
    showToast('App installed successfully ✓');
});

function renderInstallBanner() {
    if (isStandalone) return;
    const existing = document.getElementById('install-banner');
    if (existing) return;

    const banner = document.createElement('div');
    banner.id = 'install-banner';

    if (deferredInstallPrompt) {
        banner.innerHTML = `
            <div class="install-banner">
                <div class="install-banner-text">
                    <strong>Install as app</strong><br>
                    Works offline on your tablet — no browser needed.
                </div>
                <button class="btn btn-primary btn-sm" onclick="triggerInstall()">Install</button>
                <button class="install-banner-close" onclick="this.closest('#install-banner').remove()" title="Dismiss">×</button>
            </div>`;
    } else if (isIOS) {
        banner.innerHTML = `
            <div class="install-banner install-banner-ios">
                <div class="install-banner-text">
                    <strong>Add to Home Screen</strong><br>
                    Tap <strong>⎙ Share</strong> then <strong>Add to Home Screen</strong> to install.
                </div>
                <button class="install-banner-close" onclick="this.closest('#install-banner').remove()" title="Dismiss">×</button>
            </div>`;
    }

    if (banner.innerHTML) {
        document.getElementById('app-header').after(document.getElementById('online-bar'));
        document.getElementById('online-bar').before(banner);
    }
}

async function triggerInstall() {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    if (outcome === 'accepted') showToast('Installing…');
}

/* ── State ──────────────────────────────────────────── */
const state = {
    isOnline: navigator.onLine,
    currentView: 'home',
    currentApp: null,
    staticData: null,
    survey: {
        step: 1,
        formData: {},
        selectedDefects: new Set(),
        selectedAdvisories: new Set(),
        selectedPlots: new Set(),
        photos: []
    }
};

const TOTAL_STEPS  = 4;
const STEP_LABELS  = ['Details', 'Report', 'Checks', 'Submit'];

/* ── Utilities ──────────────────────────────────────── */
function generateTimeOptions(start = '07:00', end = '19:00', step = 10) {
    let html = '<option value="">Select...</option>';
    let [h, m] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    while (h < eh || (h === eh && m <= em)) {
        const t = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
        html += `<option value="${t}">${t}</option>`;
        m += step;
        if (m >= 60) { h++; m -= 60; }
    }
    return html;
}

function buildTree(items, idKey, pidKey) {
    const map = {};
    items.forEach(i => map[i[idKey]] = { ...i, children: [] });
    const roots = [];
    items.forEach(i => {
        if (i[pidKey] && map[i[pidKey]]) map[i[pidKey]].children.push(map[i[idKey]]);
        else roots.push(map[i[idKey]]);
    });
    return roots;
}

function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let toastTimer;
function showToast(msg, isError = false) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className   = 'toast' + (isError ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), 3000);
}

function setTitle(t)   { document.getElementById('app-title').textContent = t; }
function showBack(show){ document.getElementById('btn-back').classList.toggle('hidden', !show); }

/* ── Render: Home View ──────────────────────────────── */
async function checkForUpdate() {
    try {
        const resp = await fetch('/api/version.php');
        if (!resp.ok) return;
        const data = await resp.json();
        if (data.version !== APP_VERSION) {
            const el = document.getElementById('update-alert');
            if (el) el.style.display = 'block';
        }
    } catch (e) { /* offline — skip */ }
}

async function renderHomeView() {
    state.currentView = 'home';
    state.currentApp  = null;
    setTitle('Site Survey');
    showBack(false);

    const apps    = await getAllApplications();
    const pending = await getPendingSurveys();
    const pendingCount = pending.filter(s => s.status === 'pending' || s.status === 'error').length;

    let appsHtml = '';
    if (apps.length === 0) {
        appsHtml = `<div class="empty-state"><div class="empty-icon">📋</div>
            <p>No applications loaded.<br>Search above to load one for offline use.</p></div>`;
    } else {
        const sorted = [...apps].sort((a, b) => b.loadedAt - a.loadedAt);
        appsHtml = sorted.map(app => `
            <div class="app-item" onclick="openApp('${esc(app.encryptedID)}')">
                <div>
                    <div class="app-number">${esc(app.appNumber)}</div>
                    <div class="app-address">${esc(app.appAdd1)}${app.appTown ? ', ' + esc(app.appTown) : ''}</div>
                    <div class="app-loaded-date">Loaded ${new Date(app.loadedAt * 1000).toLocaleDateString('en-GB')}</div>
                </div>
                <div class="app-item-arrow">›</div>
            </div>`).join('');
    }

    let pendingHtml = '';
    if (pendingCount > 0) {
        pendingHtml = `<div class="card" style="margin-bottom:14px">
            <div class="card-body" style="display:flex;align-items:center;justify-content:space-between;gap:12px">
                <div><strong>${pendingCount}</strong> survey${pendingCount > 1 ? 's' : ''} waiting to sync</div>
                <button class="btn btn-primary btn-sm" onclick="showPendingView()">View</button>
            </div>
        </div>`;
    }

    document.getElementById('app-main').innerHTML = `
        <div id="update-alert" class="update-alert" style="display:none">
            <div class="update-alert-title">App update available</div>
            <p>A new version of this app is available but hasn't loaded yet. To update, force-close and reopen:</p>
            <ul class="update-steps">
                <li><strong>iPhone / iPad:</strong> Swipe up from the bottom and hold — swipe this app upwards to close it — tap the icon to reopen.</li>
                <li><strong>Android:</strong> Tap the Recent Apps button — swipe this app away — tap the icon to reopen.</li>
            </ul>
        </div>
        ${pendingHtml}
        <div class="card" style="margin-bottom:14px">
            <div class="card-body">
                <div class="section-heading">Load application</div>
                <div class="search-wrap">
                    <input type="text" class="search-input" id="search-input"
                        placeholder="Search by reference or address…"
                        autocomplete="off" autocorrect="off" autocapitalize="off"
                        oninput="onSearch(this.value)">
                    <span class="search-spinner" id="search-spinner">⏳</span>
                </div>
                <div class="search-results" id="search-results"></div>
                <p class="hint" style="margin-top:6px;font-size:0.8rem;color:var(--text-muted)">
                    ${state.isOnline ? 'Connected — search live applications' : 'Offline — search unavailable, use loaded apps below'}
                </p>
            </div>
        </div>
        <div class="card">
            <div class="card-header">Loaded applications</div>
            ${appsHtml}
        </div>`;
    updateSyncBadge();
    checkForUpdate();
}

/* ── Render: App View ───────────────────────────────── */
async function renderAppView(app) {
    state.currentView = 'app';
    state.currentApp  = app;
    setTitle(app.appNumber);
    showBack(true);

    const isComplete = parseInt(app.appFlagStatus) === 52;
    const address    = [app.appAdd1, app.appAdd2, app.appTown, app.appPostcode].filter(Boolean).join(', ');
    const plots      = parseInt(app.appPlots) || 1;

    let defectsHtml = '';
    try {
        const resp = await fetch(`/api/get-defects.php?app=${encodeURIComponent(app.encryptedID)}`, { credentials: 'include' });
        if (resp.ok) {
            const defects = await resp.json();
            if (Array.isArray(defects) && defects.length > 0) {
                const rows = defects.map(d => {
                    const date    = new Date(d.date).toLocaleDateString('en-GB');
                    const badge   = d.resolved
                        ? '<span class="defect-badge resolved">Resolved</span>'
                        : '<span class="defect-badge unresolved">Unresolved</span>';
                    const fixedBy = d.fixedBy ? ` — Fixed by: ${esc(d.fixedBy)}` : '';
                    return `<div class="defect-item${d.resolved ? ' defect-item-resolved' : ''}">
                        <div class="defect-meta">${date} ${badge}</div>
                        <div class="defect-content">${esc(d.content)}${fixedBy}</div>
                    </div>`;
                }).join('');
                defectsHtml = `<div class="defects-box">
                    <div class="defects-box-header">Defects (${defects.length})</div>
                    ${rows}
                </div>`;
            }
        }
    } catch (e) { /* offline or error — skip */ }

    document.getElementById('app-main').innerHTML = `
        <div class="app-detail-header">
            <div class="app-detail-number">${esc(app.appNumber)}</div>
            <div class="app-detail-address">${esc(address)}</div>
            <div class="app-detail-meta">${plots} plot${plots > 1 ? 's' : ''} &middot; Plan check: ${esc(app.appPlanCheckLevel || 'standard')}
            ${app.hasCommenced ? ' &middot; Commenced' : ''}</div>
        </div>
        ${defectsHtml}
        ${isComplete ? `<div class="app-complete-warn">⚠ Application is complete — no further surveys can be added</div>` : ''}
        ${!isComplete ? `<button class="btn btn-primary btn-full" onclick="startNewSurvey()" style="margin-bottom:14px">
            + Start New Survey
        </button>` : ''}
        <button class="btn btn-outline btn-full btn-sm" onclick="confirmRemoveApp('${esc(app.encryptedID)}')">
            Remove from device
        </button>`;
}

/* ── Render: Pending View ───────────────────────────── */
async function showPendingView() {
    state.currentView = 'pending';
    setTitle('Pending Surveys');
    showBack(true);
    await renderPendingList();
}

async function renderPendingList() {
    if (state.currentView !== 'pending') return;
    const surveys = await getPendingSurveys();
    const pending = surveys.filter(s => s.status !== 'synced');
    const synced  = surveys.filter(s => s.status === 'synced');

    if (surveys.length === 0) {
        document.getElementById('app-main').innerHTML = `
            <div class="empty-state"><div class="empty-icon">✅</div><p>No pending surveys.</p></div>`;
        return;
    }

    const pendingHtml = pending.map(s => surveyPendingItemHtml(s)).join('') || '<div class="pending-item" style="color:var(--text-muted)">All surveys synced.</div>';
    const syncedHtml  = synced.map(s => surveyPendingItemHtml(s)).join('');

    document.getElementById('app-main').innerHTML = `
        ${pending.length > 0 ? `<button class="btn btn-primary btn-full" onclick="syncAll()" style="margin-bottom:14px">
            Sync all (${pending.length})</button>` : ''}
        <div class="card"><div class="card-header">Pending</div>${pendingHtml}</div>
        ${synced.length > 0 ? `<div class="card" style="margin-top:14px"><div class="card-header">Synced</div>${syncedHtml}</div>` : ''}`;
}

function surveyPendingItemHtml(s) {
    const statusClass = `status-${s.status}`;
    const date = new Date(s.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
    const f    = s.formData;
    return `<div class="pending-item" id="pending-${s.localID}">
        <strong>${esc(s.appNumber)}</strong>
        <div class="pending-meta">${date} &middot; ${esc(f.surveyDate || '')}</div>
        <div class="pending-status ${statusClass}">${s.status}</div>
        ${s.errorMsg ? `<div class="error-msg">${esc(s.errorMsg)}</div>` : ''}
        ${(s.status === 'pending' || s.status === 'error') ? `
            <button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="syncSurvey(${s.localID})">Sync</button>
            <button class="btn btn-outline btn-sm" style="margin-top:8px;margin-left:8px" onclick="confirmDelete(${s.localID})">Delete</button>
        ` : ''}
    </div>`;
}

/* ── Search ──────────────────────────────────────────── */
let searchTimer;
function onSearch(val) {
    clearTimeout(searchTimer);
    const res = document.getElementById('search-results');
    if (val.length < 2) { res.style.display = 'none'; return; }
    document.getElementById('search-spinner').style.display = 'block';
    searchTimer = setTimeout(() => doSearch(val), 400);
}

async function doSearch(q) {
    const res = document.getElementById('search-results');
    document.getElementById('search-spinner').style.display = 'block';
    res.style.display = 'none';
    try {
        const resp = await fetch(`/api/search-applications.php?q=${encodeURIComponent(q)}`, { credentials: 'include' });
        const text = await resp.text();
        document.getElementById('search-spinner').style.display = 'none';

        if (resp.status === 401) {
            res.innerHTML = '<div class="search-result-item" style="color:var(--red);font-weight:600">Session expired — please <a href="/login.html" style="color:var(--red)">sign in again</a>.</div>';
            res.style.display = 'block';
            return;
        }

        let data;
        try { data = JSON.parse(text); } catch {
            res.innerHTML = `<div class="search-result-item" style="color:var(--red)">Server error — check with your administrator.</div>`;
            res.style.display = 'block';
            return;
        }

        if (data.error) {
            res.innerHTML = `<div class="search-result-item" style="color:var(--red)">${esc(data.error)}</div>`;
            res.style.display = 'block';
            return;
        }

        if (!Array.isArray(data) || data.length === 0) {
            res.innerHTML = '<div class="search-result-item" style="color:var(--text-muted)">No results found</div>';
        } else {
            res.innerHTML = data.map(app => `
                <div class="search-result-item" onclick="loadApp('${esc(app.encryptedID)}')">
                    <div class="app-number">${esc(app.appNumber)}</div>
                    <div class="app-address">${esc(app.address)} &middot; ${app.appPlots} plot${app.appPlots != 1 ? 's' : ''}</div>
                </div>`).join('');
        }
        res.style.display = 'block';
    } catch (e) {
        document.getElementById('search-spinner').style.display = 'none';
        res.innerHTML = '<div class="search-result-item" style="color:var(--red)">Search unavailable — are you offline?</div>';
        res.style.display = 'block';
    }
}

/* ── Load / open app ─────────────────────────────────── */
async function loadApp(encryptedID) {
    document.getElementById('search-results').style.display = 'none';
    showToast('Loading application…');
    try {
        const [appResp, staticResp] = await Promise.all([
            fetch(`/api/load-application.php?app=${encodeURIComponent(encryptedID)}`, { credentials: 'include' }),
            fetch('/api/static-data.php', { credentials: 'include' })
        ]);
        if (!appResp.ok) { showToast('Failed to load application', true); return; }
        const app = await appResp.json();
        if (app.error) { showToast(app.error, true); return; }
        await saveApplication(app);
        if (staticResp.ok) {
            const sd = await staticResp.json();
            if (!sd.error) await saveStaticData('all', sd);
        }
        showToast('Application loaded for offline use ✓');
        openApp(encryptedID);
    } catch (e) {
        showToast('Failed: ' + e.message, true);
    }
}

async function openApp(encryptedID) {
    const app = await getApplication(encryptedID);
    if (!app) { showToast('Application not found in device', true); return; }
    renderAppView(app);
}

async function confirmRemoveApp(encryptedID) {
    if (!confirm('Remove this application from the device? This will not delete any pending surveys.')) return;
    await deleteApplication(encryptedID);
    renderHomeView();
}

/* ── Survey form ─────────────────────────────────────── */
async function startNewSurvey() {
    state.survey = {
        step: 1,
        formData: {},
        selectedDefects: new Set(),
        selectedAdvisories: new Set(),
        selectedPlots: new Set(),
        photos: []
    };

    let sd = await getStaticData('all');
    if (!sd && state.isOnline) {
        try {
            const resp = await fetch('/api/static-data.php', { credentials: 'include' });
            if (resp.ok) {
                sd = await resp.json();
                await saveStaticData('all', sd);
            }
        } catch {}
    }
    if (!sd) { showToast('Static data not available — please load while online', true); return; }
    state.staticData = sd;
    renderSurveyForm();
}

function renderSurveyForm() {
    state.currentView = 'survey';
    setTitle('New Survey');
    showBack(true);
    const main = document.getElementById('app-main');
    main.innerHTML = buildStepBar() + '<div id="step-content"></div>' + `
        <div class="step-nav" id="step-nav">
            <button class="btn btn-outline" id="btn-prev" onclick="prevStep()">← Back</button>
            <button class="btn btn-primary" id="btn-next" onclick="nextStep()">Next →</button>
        </div>`;
    renderStep(1);
}

function buildStepBar() {
    let html = '<div class="step-bar">';
    for (let i = 1; i <= TOTAL_STEPS; i++) {
        const s   = state.survey.step;
        const cls = i < s ? 'done' : i === s ? 'active' : '';
        html += `<div class="step-item ${cls}">
            <div class="step-circle">${i < s ? '✓' : i}</div>
            <div class="step-label">${STEP_LABELS[i-1]}</div>
        </div>`;
        if (i < TOTAL_STEPS) html += `<div class="step-connector ${i < s ? 'done' : ''}"></div>`;
    }
    return html + '</div>';
}

function refreshStepBar() {
    const main = document.getElementById('app-main');
    const old  = main.querySelector('.step-bar');
    if (old) {
        const newBar = document.createElement('div');
        newBar.innerHTML = buildStepBar();
        main.replaceChild(newBar.firstChild, old);
    }
}

function renderStep(n) {
    state.survey.step = n;
    refreshStepBar();
    const content = document.getElementById('step-content');
    document.getElementById('btn-prev').style.display = n === 1 ? 'none' : '';
    const nextBtn = document.getElementById('btn-next');
    nextBtn.textContent = n === TOTAL_STEPS ? 'Submit Survey' : 'Next →';

    switch (n) {
        case 1: content.innerHTML = buildStep1(); initStep1(); break;
        case 2: content.innerHTML = buildStep2(); break;
        case 3: content.innerHTML = buildStep3(); break;
        case 4: content.innerHTML = buildStep4(); initStep4(); break;
    }
    window.scrollTo(0, 0);
}

/* Step 1: Details */
function buildStep1() {
    const sd  = state.staticData;
    const f   = state.survey.formData;
    const app = state.currentApp;

    const staffOptions             = sd.staff.map(s => `<option value="${s.id}" ${f.supervisor == s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
    const supervisingMethodOptions = Object.entries(sd.supervising_methods).map(([k,v]) => `<option value="${k}" ${f.supervisor_method == k ? 'selected' : ''}>${v}</option>`).join('');
    const inspectionMethodOptions  = Object.entries(sd.inspection_methods).map(([k,v])  => `<option value="${k}" ${f.inspection_method == k ? 'selected' : ''}>${v}</option>`).join('');
    const appTypeOptions           = Object.entries(sd.application_types).map(([k,v])  => `<option value="${k}" ${f.application_type == k ? 'selected' : ''}>${v}</option>`).join('');
    const inspectionTypeOptions    = sd.inspection_types
        .filter(t => app.hasCommenced ? t.id != 13 : t.id == 13)
        .map(t => `<option value="${t.id}" ${f.inspection_type == t.id ? 'selected' : ''}>${esc(t.name)}</option>`)
        .join('');
    const weatherOptions = Object.entries(sd.weather).map(([k,v]) => `<option value="${k}" ${f.weather == k ? 'selected' : ''}>${v}</option>`).join('');

    const today = new Date().toISOString().split('T')[0];
    const plots = parseInt(app.appPlots) || 1;
    let plotsHtml = '<div class="plots-grid">';
    for (let i = 1; i <= plots; i++) {
        const label   = i === 1 ? 'Plot 1 (General)' : `Plot ${i}`;
        const checked = state.survey.selectedPlots.has(i) ? 'checked' : '';
        plotsHtml += `<label class="plot-cb ${checked ? 'checked' : ''}" id="plot-label-${i}">
            <input type="checkbox" value="${i}" ${checked} onchange="togglePlot(${i}, this.checked)"> ${label}
        </label>`;
    }
    plotsHtml += '</div>';

    return `
        <div class="section-heading">Supervision</div>
        <div class="form-grid">
            <div class="field"><label>Supervising Surveyor</label>
                <select name="supervisor" onchange="saveField('supervisor',this.value)">
                    <option value="0">No Supervision Required</option>${staffOptions}
                </select></div>
            <div class="field required"><label>Supervising Method</label>
                <select name="supervisor_method" onchange="saveField('supervisor_method',this.value)">
                    <option value="">Select...</option>${supervisingMethodOptions}
                </select></div>
            <div class="field required"><label>Inspection Method</label>
                <select name="inspection_method" onchange="saveField('inspection_method',this.value)">
                    <option value="">Select...</option>${inspectionMethodOptions}
                </select></div>
        </div>
        <div class="section-heading" style="margin-top:8px">Survey Details</div>
        <div class="form-grid">
            <div class="field required"><label>Application Type</label>
                <select name="application_type" onchange="saveField('application_type',this.value)">
                    <option value="">Select...</option>${appTypeOptions}
                </select></div>
            <div class="field required"><label>Inspection Type</label>
                <select name="inspection_type" onchange="saveField('inspection_type',this.value)">
                    <option value="">Select...</option>${inspectionTypeOptions}
                </select></div>
            <div class="field required"><label>Weather</label>
                <select name="weather" onchange="saveField('weather',this.value)">
                    <option value="">Select...</option>${weatherOptions}
                </select></div>
            <div class="field required"><label>Survey Date</label>
                <input type="date" name="surveyDate" max="${today}" value="${f.surveyDate || today}" onchange="saveField('surveyDate',this.value)"></div>
            <div class="field required"><label>Start Time</label>
                <select name="startTime" onchange="saveField('startTime',this.value)">
                    ${generateTimeOptions()}
                </select></div>
            <div class="field"><label>Set Reminder</label>
                <select name="reminder" onchange="saveField('reminder',this.value)">
                    <option value="7">1 week</option>
                    <option value="14">2 weeks</option>
                    <option value="21" selected>3 weeks</option>
                    <option value="90">12 weeks</option>
                </select></div>
        </div>
        <div class="section-heading" style="margin-top:8px">Affected Plots</div>
        ${plotsHtml}`;
}

function initStep1() {
    const f = state.survey.formData;
    ['supervisor','supervisor_method','inspection_method','application_type','inspection_type','weather','startTime','reminder'].forEach(name => {
        const el = document.querySelector(`[name="${name}"]`);
        if (el && f[name] !== undefined) el.value = f[name];
    });
    const dateEl = document.querySelector('[name="surveyDate"]');
    if (dateEl) {
        if (!f.surveyDate) {
            const today = new Date().toISOString().split('T')[0];
            saveField('surveyDate', today);
            dateEl.value = today;
        } else {
            dateEl.value = f.surveyDate;
        }
    }
}

function saveField(name, value) { state.survey.formData[name] = value; }

function togglePlot(n, checked) {
    if (checked) state.survey.selectedPlots.add(n);
    else state.survey.selectedPlots.delete(n);
    const lbl = document.getElementById(`plot-label-${n}`);
    if (lbl) lbl.classList.toggle('checked', checked);
}

/* Step 2: Report */
function buildStep2() {
    const f = state.survey.formData;
    return `
        <div class="section-heading">Survey Report</div>
        <div class="field required">
            <label>Report</label>
            <textarea name="surReport" rows="14" placeholder="Write your survey report here…"
                oninput="saveField('surReport',this.value)">${esc(f.surReport || '')}</textarea>
        </div>
        <div class="field">
            <label>Other defects (not listed)</label>
            <textarea name="surOtherDefect" rows="4" placeholder="Any defects not in the standard list…"
                oninput="saveField('surOtherDefect',this.value)">${esc(f.surOtherDefect || '')}</textarea>
        </div>`;
}

/* Step 3: Defects & Advisories */
function buildStep3() {
    const sd       = state.staticData;
    const defTree  = buildTree(sd.defects, 'id', 'pid');
    const advTree  = buildTree(sd.advisories, 'id', 'pid');
    const defCount = state.survey.selectedDefects.size;
    const advCount = state.survey.selectedAdvisories.size;
    return `
        <div class="section-heading">Non-Compliance Defects ${defCount > 0 ? `<span class="selected-count">${defCount}</span>` : ''}</div>
        <div id="defects-accordion">${renderAccordion(defTree, 'defect', state.survey.selectedDefects)}</div>
        <div class="section-heading" style="margin-top:20px">Advisory Notices ${advCount > 0 ? `<span class="selected-count">${advCount}</span>` : ''}</div>
        <div id="advisories-accordion">${renderAccordion(advTree, 'advisory', state.survey.selectedAdvisories)}</div>`;
}

function renderAccordion(tree, type, selection) {
    if (!tree.length) return '<p style="color:var(--text-muted);font-size:0.9rem">No items available.</p>';
    return tree.map(l1 => `
        <div class="accordion-l1">
            <div class="accordion-header" onclick="toggleAccordion(this)">
                <span class="accordion-icon">+</span>
                <span>${esc(l1.text)}</span>
            </div>
            <div class="accordion-body">
                ${l1.children.map(l2 => `
                    <div class="accordion-l2">
                        <div class="accordion-header l2" onclick="toggleAccordion(this)">
                            <span class="accordion-icon">+</span>
                            <span>${esc(l2.text)}</span>
                        </div>
                        <div class="accordion-body">
                            ${l2.children.map(l3 => {
                                const checked = selection.has(l3.id);
                                return `<label class="checkbox-item ${checked ? 'checked' : ''}">
                                    <input type="checkbox" value="${l3.id}" data-type="${type}"
                                        ${checked ? 'checked' : ''}
                                        onchange="toggleCheckItem(this, '${type}')">
                                    <span>${esc(l3.text)}</span>
                                </label>`;
                            }).join('')}
                        </div>
                    </div>`).join('')}
            </div>
        </div>`).join('');
}

function toggleAccordion(header) {
    const body = header.nextElementSibling;
    const icon = header.querySelector('.accordion-icon');
    const open = body.classList.toggle('open');
    if (icon) icon.textContent = open ? '−' : '+';
}

function toggleCheckItem(el, type) {
    const id    = parseInt(el.value);
    const set   = type === 'defect' ? state.survey.selectedDefects : state.survey.selectedAdvisories;
    const label = el.closest('.checkbox-item');
    if (el.checked) { set.add(id); label.classList.add('checked'); }
    else { set.delete(id); label.classList.remove('checked'); }

    const heading = type === 'defect'
        ? document.querySelector('#defects-accordion')?.previousElementSibling
        : document.querySelector('#advisories-accordion')?.previousElementSibling;
    if (heading) {
        const base  = type === 'defect' ? 'Non-Compliance Defects' : 'Advisory Notices';
        const count = set.size;
        heading.innerHTML = `${base} ${count > 0 ? `<span class="selected-count">${count}</span>` : ''}`;
    }
}

/* Step 4: Contractor + Photos + End Time */
function buildStep4() {
    const f      = state.survey.formData;
    const app    = state.currentApp;
    const photos = state.survey.photos;

    const photoThumbs = photos.map((p, i) => `
        <div class="photo-thumb">
            <img src="${p.previewURL}" alt="${esc(p.name)}">
            <button class="photo-remove" onclick="removePhoto(${i})" type="button">×</button>
        </div>`).join('');

    return `
        <div class="section-heading">Contractor / Client Details</div>
        <div class="form-grid">
            <div class="field"><label>Name</label>
                <input type="text" value="${esc(f.contName ?? app.contName ?? '')}" oninput="saveField('contName',this.value)"></div>
            <div class="field"><label>Email</label>
                <input type="email" value="${esc(f.contEmail ?? app.contEmail ?? '')}" oninput="saveField('contEmail',this.value)"></div>
            <div class="field"><label>Mobile</label>
                <input type="tel" value="${esc(f.contTelephone ?? app.contTelephone ?? '')}" oninput="saveField('contTelephone',this.value)"></div>
        </div>
        <div class="form-grid">
            <div class="field"><label>Address Line 1</label>
                <input type="text" value="${esc(f.contAdd1 ?? app.contAdd1 ?? '')}" oninput="saveField('contAdd1',this.value)"></div>
            <div class="field"><label>Address Line 2</label>
                <input type="text" value="${esc(f.contAdd2 ?? app.contAdd2 ?? '')}" oninput="saveField('contAdd2',this.value)"></div>
            <div class="field"><label>Town</label>
                <input type="text" value="${esc(f.contTown ?? app.contTown ?? '')}" oninput="saveField('contTown',this.value)"></div>
            <div class="field"><label>County</label>
                <input type="text" value="${esc(f.contCounty ?? app.contCounty ?? '')}" oninput="saveField('contCounty',this.value)"></div>
            <div class="field"><label>Postcode</label>
                <input type="text" value="${esc(f.contPostcode ?? app.contPostcode ?? '')}" oninput="saveField('contPostcode',this.value)"></div>
        </div>
        <div class="field">
            <label>Client email updates</label>
            <select onchange="saveField('appConductedEmail',this.value)">
                <option value="0" ${(f.appConductedEmail ?? app.appConductedEmail) == 0 ? 'selected' : ''}>Do not send client emails</option>
                <option value="1" ${(f.appConductedEmail ?? app.appConductedEmail) == 1 ? 'selected' : ''}>Send client emails</option>
            </select>
        </div>
        <div class="section-heading" style="margin-top:8px">Survey End Time</div>
        <div class="form-grid">
            <div class="field required"><label>End Time</label>
                <select name="surEnd" onchange="saveField('surEnd',this.value)">
                    ${generateTimeOptions()}
                </select></div>
            <div class="field"><label>Overtime notes</label>
                <input type="text" value="${esc(f.surOvertime || '')}" placeholder="Reason if over time…" oninput="saveField('surOvertime',this.value)"></div>
        </div>
        <div class="section-heading" style="margin-top:8px">Photos</div>
        <div class="photo-btn-wrap">
            <input type="file" id="photo-input" accept="image/*" capture="environment" multiple style="display:none" onchange="handlePhotoInput(this)">
            <button class="btn btn-secondary" type="button" onclick="document.getElementById('photo-input').click()">📷 Add Photo(s)</button>
        </div>
        <div class="photo-gallery" id="photo-gallery">${photoThumbs}</div>`;
}

function initStep4() {
    const surEndEl = document.querySelector('[name="surEnd"]');
    if (surEndEl && state.survey.formData.surEnd) surEndEl.value = state.survey.formData.surEnd;
}

function handlePhotoInput(input) {
    const files = Array.from(input.files);
    files.forEach(file => {
        state.survey.photos.push({ file, name: file.name, type: file.type, previewURL: URL.createObjectURL(file) });
    });
    input.value = '';
    const gallery = document.getElementById('photo-gallery');
    if (gallery) {
        gallery.innerHTML = state.survey.photos.map((p, i) => `
            <div class="photo-thumb">
                <img src="${p.previewURL}" alt="${esc(p.name)}">
                <button class="photo-remove" onclick="removePhoto(${i})" type="button">×</button>
            </div>`).join('');
    }
}

function removePhoto(i) {
    URL.revokeObjectURL(state.survey.photos[i].previewURL);
    state.survey.photos.splice(i, 1);
    const gallery = document.getElementById('photo-gallery');
    if (gallery) {
        gallery.innerHTML = state.survey.photos.map((p, idx) => `
            <div class="photo-thumb">
                <img src="${p.previewURL}" alt="${esc(p.name)}">
                <button class="photo-remove" onclick="removePhoto(${idx})" type="button">×</button>
            </div>`).join('');
    }
}

/* ── Step navigation ─────────────────────────────────── */
function prevStep() {
    if (state.survey.step > 1) renderStep(state.survey.step - 1);
    else { state.currentView = 'app'; renderAppView(state.currentApp); }
}

function nextStep() {
    if (state.survey.step < TOTAL_STEPS) {
        if (!validateStep(state.survey.step)) return;
        collectCurrentStep();
        renderStep(state.survey.step + 1);
    } else {
        submitSurvey();
    }
}

function validateStep(n) {
    if (n === 1) {
        ['application_type','inspection_type','weather','startTime','supervisor_method','inspection_method'].forEach(name => {
            const el = document.querySelector(`[name="${name}"]`);
            if (el && el.value !== '' && !state.survey.formData[name]) saveField(name, el.value);
        });
        const dateEl = document.querySelector('[name="surveyDate"]');
        if (dateEl && dateEl.value && !state.survey.formData.surveyDate) saveField('surveyDate', dateEl.value);

        const f = state.survey.formData;
        if (!f.application_type)  { showToast('Please select application type', true);  return false; }
        if (!f.inspection_type)   { showToast('Please select inspection type', true);   return false; }
        if (!f.weather)           { showToast('Please select weather', true);            return false; }
        if (!f.surveyDate)        { showToast('Please enter survey date', true);         return false; }
        if (!f.startTime)         { showToast('Please select start time', true);         return false; }
        if (!f.inspection_method) { showToast('Please select inspection method', true);  return false; }
        if (!f.supervisor_method) { showToast('Please select supervising method', true); return false; }
    }
    if (n === 2) {
        const f = state.survey.formData;
        if (!f.surReport || f.surReport.trim() === '') { showToast('Please write a survey report', true); return false; }
    }
    if (n === 4) {
        const f = state.survey.formData;
        if (!f.surEnd) { showToast('Please select survey end time', true); return false; }
    }
    return true;
}

function collectCurrentStep() {
    const n = state.survey.step;
    if (n === 1) {
        state.survey.formData.surPlots = [...state.survey.selectedPlots].sort((a,b) => a-b).join(',') || '1';
        if (!state.survey.formData.supervisor)         state.survey.formData.supervisor         = '0';
        if (!state.survey.formData.supervisor_method)  state.survey.formData.supervisor_method  = '0';
        if (!state.survey.formData.inspection_method)  state.survey.formData.inspection_method  = '0';
        if (!state.survey.formData.reminder)           state.survey.formData.reminder           = '21';
    }
    if (n === 3) {
        state.survey.formData.defItemID      = [...state.survey.selectedDefects].join(',');
        state.survey.formData.advisoryItemID = [...state.survey.selectedAdvisories].join(',');
    }
}

/* ── Submit survey ───────────────────────────────────── */
async function submitSurvey() {
    if (!validateStep(4)) return;
    collectCurrentStep();

    const f   = state.survey.formData;
    const app = state.currentApp;
    if (!f.surPlots) f.surPlots = [...state.survey.selectedPlots].sort((a,b)=>a-b).join(',') || '1';

    const nextBtn = document.getElementById('btn-next');
    nextBtn.disabled  = true;
    nextBtn.textContent = 'Saving…';

    try {
        const localID = await savePendingSurvey({
            encryptedAppID: app.encryptedID,
            appNumber: app.appNumber,
            appPlanCheckLevel: app.appPlanCheckLevel,
            formData: { ...f }
        });

        for (const p of state.survey.photos) {
            await savePhoto(localID, p.name, p.type, p.file);
        }

        showToast('Survey saved to device ✓');
        updateSyncBadge();

        if (state.isOnline) {
            await syncSurvey(localID);
        } else {
            showToast('Saved offline — will sync when connected');
        }

        state.currentView = 'app';
        renderAppView(app);
    } catch (e) {
        nextBtn.disabled    = false;
        nextBtn.textContent = 'Submit Survey';
        showToast('Failed to save: ' + e.message, true);
    }
}

/* ── Delete pending survey ───────────────────────────── */
async function confirmDelete(localID) {
    if (!confirm('Delete this pending survey? It has not been synced and will be lost.')) return;
    await deleteSurveyAndPhotos(localID);
    updateSyncBadge();
    renderPendingList();
}

/* ── Back navigation ─────────────────────────────────── */
document.getElementById('btn-back').addEventListener('click', () => {
    if (state.currentView === 'app') renderHomeView();
    else if (state.currentView === 'pending') renderHomeView();
    else if (state.currentView === 'survey') {
        if (confirm('Leave this survey? Unsaved progress will be lost.')) {
            renderAppView(state.currentApp);
        }
    }
});

/* ── Online/offline handling ─────────────────────────── */
function updateOnlineBar() {
    const bar     = document.getElementById('online-bar');
    state.isOnline = navigator.onLine;
    bar.textContent = state.isOnline ? 'Online' : 'Offline — surveys will sync when reconnected';
    bar.className   = state.isOnline ? 'online' : 'offline';
}

window.addEventListener('online',  () => { updateOnlineBar(); showToast('Back online — you can now sync'); });
window.addEventListener('offline', () => { updateOnlineBar(); showToast('Gone offline — surveys saved to device'); });

/* ── Service Worker registration ─────────────────────── */
if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('/sw.js')
        .catch(e => console.warn('SW registration failed:', e));
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hadController) window.location.reload();
    });
}

/* ── Init ────────────────────────────────────────────── */
updateOnlineBar();
renderHomeView();
const _vEl = document.getElementById('app-version-display');
if (_vEl) _vEl.textContent = 'v' + APP_VERSION + (IS_DEV ? ' (dev)' : '');
if (!isStandalone && isIOS) renderInstallBanner();
