/* crm.js — CRM Prospection & Clients : formulaire enrichi, deals, passages, tableau */
const CRM = (() => {
  const $ = s => document.querySelector(s);
  const esc = s => (s || '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  const eur = v => (+v || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €';
  const frDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR') : '—';
  const slug = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');

  let stage = 'prospect';   // vue courante
  let currentId = '';       // contact en cours d'édition
  let draftDeals = [];      // deals avant 1er enregistrement
  let draftVisits = [];

  function setStage(s) {
    stage = s;
    $('#crm-form-title').textContent = currentId
      ? (s === 'prospect' ? 'Modifier le prospect' : 'Modifier le client')
      : (s === 'prospect' ? 'Nouveau prospect' : 'Nouveau client');
    $('#crm-list-title').textContent = s === 'prospect' ? 'Fichier prospects' : 'Fichier clients';
    $('#th-status').textContent = s === 'prospect' ? 'Statut' : 'Type';
    $('#c-pstatus-wrap').style.display = s === 'prospect' ? '' : 'none';
    render();
  }
  const getStage = () => stage;
  const getCurrentId = () => currentId;

  function toggleSub() {
    $('#c-sub-wrap').style.display = $('#c-btype').value === 'Hôtellerie' ? '' : 'none';
  }

  // Positionne le sélecteur de relance (gère le mode personnalisé)
  function setRelance(days) {
    const sel = $('#c-relance');
    const preset = [...sel.options].some(o => o.value === String(days) && o.value !== 'custom');
    if (preset) { sel.value = String(days); $('#c-relance-custom').style.display = 'none'; }
    else { sel.value = 'custom'; const ci = $('#c-relance-custom'); ci.style.display = ''; ci.value = days; }
  }
  function toggleRelance() {
    $('#c-relance-custom').style.display = $('#c-relance').value === 'custom' ? '' : 'none';
  }

  function fields() {
    const existing = currentId ? Store.get(currentId) : null;
    return {
      id: currentId || '',
      name: $('#c-name').value.trim(),
      contact: $('#c-contact').value.trim(),
      phone: $('#c-phone').value.trim(),
      email: $('#c-email').value.trim(),
      address: $('#c-address').value.trim(),
      lat: $('#c-id').dataset.lat ? +$('#c-id').dataset.lat : (existing?.lat ?? null),
      lng: $('#c-id').dataset.lng ? +$('#c-id').dataset.lng : (existing?.lng ?? null),
      stage: existing?.stage || stage,
      businessType: $('#c-btype').value,
      businessSub: $('#c-btype').value === 'Hôtellerie' ? $('#c-bsub').value : '',
      priority: $('#c-priority').value,
      prospectStatus: $('#c-pstatus').value,
      relanceInterval: $('#c-relance').value === 'custom'
        ? (+$('#c-relance-custom').value || 30) : +$('#c-relance').value,
      potentiel: +$('#c-potentiel').value || 0,
      notes: $('#c-notes').value.trim(),
      deals: existing ? existing.deals : draftDeals,
      visits: existing ? existing.visits : draftVisits
    };
  }

  function populateStatusOptions(selected) {
    const list = Store.getStatuses().prospect;
    $('#c-pstatus').innerHTML = list.map(s => `<option ${s === selected ? 'selected' : ''}>${s}</option>`).join('');
  }

  function fill(c) {
    currentId = c?.id || '';
    draftDeals = []; draftVisits = [];
    populateStatusOptions(c?.prospectStatus || Store.getStatuses().prospect[0]);
    $('#c-id').dataset.lat = c?.lat ?? '';
    $('#c-id').dataset.lng = c?.lng ?? '';
    $('#c-name').value = c?.name || '';
    $('#c-contact').value = c?.contact || '';
    $('#c-phone').value = c?.phone || '';
    $('#c-email').value = c?.email || '';
    $('#c-address').value = c?.address || '';
    $('#c-btype').value = c?.businessType || 'Commerce';
    $('#c-bsub').value = c?.businessSub || 'Hôtel';
    $('#c-priority').value = c?.priority || 'Normale';
    $('#c-pstatus').value = c?.prospectStatus || 'À contacter';
    setRelance(c?.relanceInterval || 30);
    $('#c-potentiel').value = c?.potentiel || '';
    $('#c-notes').value = c?.notes || '';
    $('#c-geo-status').textContent = c?.lat ? `✓ Géolocalisé` : '';
    $('#c-convert').style.display = (c && c.stage === 'prospect') ? '' : 'none';
    toggleSub();
    setStage(stage);
    renderDeals();
    renderVisits();
  }

  function renderDeals() {
    const c = currentId ? Store.get(currentId) : null;
    const deals = c ? c.deals : draftDeals;
    const total = deals.reduce((s, d) => s + (+d.amount || 0), 0);
    $('#deals-total').textContent = deals.length ? eur(total) : '';
    $('#deals-list').innerHTML = deals.length ? deals.map(d => `
      <div class="mini-row">
        <span>${frDate(d.date)} · <strong>${eur(d.amount)}</strong> ${esc(d.label || '')}</span>
        <button class="tbtn" data-deal-del="${d.id}">🗑️</button>
      </div>`).join('') : '<span class="muted">Aucun deal.</span>';
  }

  function renderVisits() {
    const c = currentId ? Store.get(currentId) : null;
    const visits = (c ? c.visits : draftVisits).slice().sort((a, b) => b.date.localeCompare(a.date));
    $('#visits-list').innerHTML = visits.length ? visits.map(v => `
      <div class="mini-row">
        <span>${frDate(v.date)} · <strong>${esc(v.status)}</strong> ${v.note ? '· ' + esc(v.note) : ''}</span>
        <button class="tbtn" data-visit-del="${v.id}">🗑️</button>
      </div>`).join('') : '<span class="muted">Aucun passage enregistré.</span>';
    if (c) {
      const nr = Store.nextRelanceDate(c);
      $('#relance-info').textContent = nr
        ? `Dernier passage : ${frDate(Store.lastVisitDate(c))} · Prochaine relance : ${frDate(nr)} (+${c.relanceInterval} j)`
        : 'Aucun passage : la relance se calculera dès le 1er passage.';
    } else $('#relance-info').textContent = '';
  }

  function render(filter = '') {
    const f = (filter || $('#crm-search').value || '').toLowerCase();
    const fPrio = $('#f-priority')?.value || '';
    const sort = $('#f-sort')?.value || 'name';
    const caMin = $('#f-ca-min')?.value ? +$('#f-ca-min').value : null;
    const caMax = $('#f-ca-max')?.value ? +$('#f-ca-max').value : null;
    const rows = Store.byStage(stage)
      .filter(c => !f || (c.name + c.address + c.businessType + (c.prospectStatus || '')).toLowerCase().includes(f))
      .filter(c => !fPrio || (c.priority || 'Normale') === fPrio)
      .filter(c => {
        const ca = Store.dealsTotal(c);
        return (caMin == null || ca >= caMin) && (caMax == null || ca <= caMax);
      })
      .sort((a, b) => {
        if (sort === 'ca-desc') return Store.dealsTotal(b) - Store.dealsTotal(a);
        if (sort === 'ca-asc') return Store.dealsTotal(a) - Store.dealsTotal(b);
        if (sort === 'relance') return (Store.nextRelanceDate(a) || '9999').localeCompare(Store.nextRelanceDate(b) || '9999');
        return a.name.localeCompare(b.name);
      })
      .map(c => {
        const biz = c.businessType + (c.businessSub ? ` (${c.businessSub})` : '');
        const nr = Store.nextRelanceDate(c);
        const overdue = nr && nr <= new Date().toISOString().slice(0, 10);
        const statusCol = stage === 'prospect'
          ? `<span class="pill ps-${slug(c.prospectStatus)}">${esc(c.prospectStatus)}</span>`
          : `<span class="pill">${esc(biz)}</span>`;
        const prio = `<span class="prio-dot prio-${slug(c.priority || 'Normale')}" title="Priorité ${esc(c.priority || 'Normale')}"></span>`;
        return `<tr>
          <td data-label="Nom">${prio}<strong>${esc(c.name)}</strong><br><small class="muted">${esc(c.contact || '')}</small></td>
          <td data-label="Commerce">${esc(biz)}</td>
          <td data-label="Statut">${statusCol}</td>
          <td data-label="Adresse">${esc(c.address || '')}</td>
          <td data-label="Relance" class="${overdue ? 'overdue' : ''}">${nr ? frDate(nr) : '—'}</td>
          <td data-label="CA">${eur(Store.dealsTotal(c))}</td>
          <td style="white-space:nowrap">
            <button class="tbtn" data-edit="${c.id}" title="Modifier">✏️</button>
            <button class="tbtn" data-del="${c.id}" title="Supprimer">🗑️</button>
          </td></tr>`;
      }).join('');
    $('#crm-body').innerHTML = rows ||
      `<tr><td colspan="7" class="muted">Aucun ${stage === 'prospect' ? 'prospect' : 'client'}.</td></tr>`;
  }

  // Gestion des deals/visites en brouillon (avant 1er enregistrement)
  function addDraftDeal(d) { d.id = Store.newId(); draftDeals.push(d); renderDeals(); }
  function rmDraftDeal(id) { draftDeals = draftDeals.filter(x => x.id !== id); renderDeals(); }
  function rmDraftVisit(id) { draftVisits = draftVisits.filter(x => x.id !== id); renderVisits(); }

  return { setStage, getStage, getCurrentId, fields, fill, render, renderDeals, renderVisits, toggleSub, toggleRelance, addDraftDeal, rmDraftDeal, rmDraftVisit };
})();
