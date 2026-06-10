async function syncSurvey(localID) {
    const survey = await getSurvey(localID);
    if (!survey) return false;
    const photos = await getPhotos(localID);
    await updateSurveyStatus(localID, 'syncing');
    renderPendingList();

    const fd = new FormData();
    const f  = survey.formData;
    fd.append('method',            'add_survey');
    fd.append('supervisor',        f.supervisor || '0');
    fd.append('supervisor_method', f.supervisor_method || '0');
    fd.append('inspection_method', f.inspection_method || '0');
    fd.append('application_type',  f.application_type);
    fd.append('inspection_type',   f.inspection_type);
    fd.append('weather',           f.weather);
    fd.append('surveyDate',        f.surveyDate);
    fd.append('reminder',          f.reminder || '21');
    fd.append('startTime',         f.startTime);
    fd.append('surPlots',          f.surPlots || '1');
    fd.append('surReport',         f.surReport || '');
    fd.append('defItemID',         f.defItemID || '');
    fd.append('advisoryItemID',    f.advisoryItemID || '');
    fd.append('surOtherDefect',    f.surOtherDefect || '');
    fd.append('contName',          f.contName || '');
    fd.append('contEmail',         f.contEmail || '');
    fd.append('contTelephone',     f.contTelephone || '');
    fd.append('appConductedEmail', f.appConductedEmail || '0');
    fd.append('contAdd1',          f.contAdd1 || '');
    fd.append('contAdd2',          f.contAdd2 || '');
    fd.append('contTown',          f.contTown || '');
    fd.append('contCounty',        f.contCounty || '');
    fd.append('contPostcode',      f.contPostcode || '');
    fd.append('surEnd',            f.surEnd || '');
    fd.append('surOvertime',       f.surOvertime || '');
    fd.append('appID',             survey.encryptedAppID);
    fd.append('appPlanCheckLevel', survey.appPlanCheckLevel || 'low');

    photos.forEach(p => {
        fd.append('upload[]', new File([p.blob], p.name, { type: p.type }));
    });

    try {
        const tokenResp = await fetch('/api/csrf-token.php', { credentials: 'include' });
        if (!tokenResp.ok) throw new Error('Not authenticated — please sign in again');
        const tokenData = await tokenResp.json();
        if (tokenData.error) throw new Error(tokenData.error);
        fd.append('csrf_token', tokenData.csrf_token);

        const resp = await fetch('/api/sync-survey.php', {
            method: 'POST',
            body: fd,
            credentials: 'include'
        });
        const text = await resp.text();
        let data;
        try { data = JSON.parse(text); } catch { data = null; }

        if (!resp.ok || (data && data.error)) {
            throw new Error((data && data.error) || 'Server returned ' + resp.status);
        }

        await updateSurveyStatus(localID, 'synced');
        showToast('Survey synced successfully');
        renderPendingList();
        updateSyncBadge();
        return true;
    } catch (err) {
        await updateSurveyStatus(localID, 'error', err.message);
        showToast('Sync failed: ' + err.message, true);
        renderPendingList();
        return false;
    }
}

async function syncAll() {
    const surveys = await getPendingSurveys();
    const pending = surveys.filter(s => s.status === 'pending' || s.status === 'error');
    if (pending.length === 0) { showToast('Nothing to sync'); return; }
    for (const s of pending) {
        await syncSurvey(s.localID);
    }
}

async function updateSyncBadge() {
    const surveys = await getPendingSurveys();
    const count   = surveys.filter(s => s.status === 'pending' || s.status === 'error').length;
    const badge   = document.getElementById('sync-badge');
    if (badge) {
        badge.textContent   = count || '';
        badge.style.display = count > 0 ? 'flex' : 'none';
    }
}
