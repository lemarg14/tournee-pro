/* field.js — interface terrain (mobile) : par date OU par tournée
 * Navigation GPS directe + statut par arrêt synchronisé avec le CRM. */
const Field = (() => {
  const $ = s => document.querySelector(s);
  const esc = s => (s || '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  const frDate = d => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR');

  // Couleur d'un statut selon mot-clé
  function statusCls(key) {
    if (/gagné|vente|livré|signé/i.test(key)) return 'st-ok';
    if (/perdu|refus/i.test(key)) return 'st-bad';
    if (/absent/i.test(key)) return 'st-warn';
    return 'st-info';
  }
  // Liste de statuts contextuelle (depuis la config)
  function statusSet(c) {
    return Store.getStatuses()[c.stage === 'client' ? 'client' : 'prospect'];
  }

  let mode = 'date';
  const today = () => new Date().toISOString().slice(0, 10);

  function navLinks(c) {
    const hasGeo = c.lat != null && c.lng != null;
    const q = hasGeo ? `${c.lat},${c.lng}` : encodeURIComponent(c.address || c.name);
    const addr = encodeURIComponent(c.address || c.name);
    return {
      waze: hasGeo ? `https://waze.com/ul?ll=${c.lat},${c.lng}&navigate=yes` : `https://waze.com/ul?q=${addr}&navigate=yes`,
      apple: `https://maps.apple.com/?daddr=${q}&dirflg=d`,
      google: `https://www.google.com/maps/dir/?api=1&destination=${q}`
    };
  }

  function setMode(m) {
    mode = m;
    document.querySelectorAll('.fmode').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
    $('#fctrl-date').style.display = m === 'date' ? '' : 'none';
    $('#fctrl-tour').style.display = m === 'tour' ? '' : 'none';
    render();
  }

  function refreshTourSelect() {
    const sel = $('#field-tour-select');
    const cur = sel.value;
    const tours = Store.getTours().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    sel.innerHTML = '<option value="">— Choisir une tournée —</option>' +
      tours.map(t => `<option value="${t.id}">${esc(t.name)}${t.recurring ? ' ♻︎' : ''}</option>`).join('');
    if (cur) sel.value = cur;
  }

  // Liste des contacts à visiter pour une date donnée
  function dueContacts(date, stageFilter) {
    return Store.all().filter(c => {
      if (stageFilter !== 'all' && c.stage !== stageFilter) return false;
      const nr = Store.nextRelanceDate(c);
      const noVisit = !c.visits || !c.visits.length;
      // dû si relance <= date sélectionnée, ou jamais visité (à faire)
      return (nr && nr <= date) || noVisit;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }

  function cardHTML(c, i, visitDate) {
    const nav = navLinks(c);
    const visit = (c.visits || []).find(v => v.date === visitDate);
    const status = visit?.status;
    const biz = c.businessType + (c.businessSub ? ` (${c.businessSub})` : '');
    const nr = Store.nextRelanceDate(c);
    const btns = statusSet(c).map(k =>
      `<button class="st-btn ${statusCls(k)} ${status === k ? 'active' : ''}" data-status="${esc(k)}" data-cid="${c.id}">${esc(k)}</button>`).join('');
    return `<div class="field-card ${status ? 'is-done' : ''}">
      <div class="fc-head">
        <span class="fc-num">${i + 1}</span>
        <div class="fc-id">
          <strong>${esc(c.name)}</strong>
          <span class="fc-addr">${esc(biz)} · ${esc(c.address || '')}</span>
          ${c.phone ? `<a class="fc-phone" href="tel:${esc(c.phone)}">📞 ${esc(c.phone)}</a>` : ''}
          ${nr ? `<span class="fc-relance">↻ relance prévue ${frDate(nr)}</span>` : ''}
        </div>
        <span class="fc-tag ${c.stage}">${c.stage === 'client' ? 'Client' : 'Prospect'}</span>
      </div>
      <div class="nav-btns">
        <a class="nav-btn waze" href="${nav.waze}" target="_blank" rel="noopener">Waze</a>
        <a class="nav-btn apple" href="${nav.apple}" target="_blank" rel="noopener">Plans</a>
        <a class="nav-btn google" href="${nav.google}" target="_blank" rel="noopener">Maps</a>
      </div>
      <div class="st-btns">${btns}</div>
      ${visit?.note ? `<div class="fc-note">📝 ${esc(visit.note)}</div>` : ''}
      <div class="fc-comment">
        <input type="text" class="cmt-input" data-cid="${c.id}" placeholder="Ajouter un commentaire…" />
        <button class="btn small cmt-add" data-cid="${c.id}">💬</button>
      </div>
    </div>`;
  }

  const eur = v => (+v || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €';

  function updateBanner(all, date) {
    const done = all.filter(c => (c.visits || []).some(v => v.date === date)).length;
    const total = all.length, rest = total - done;
    const rate = total ? done / total * 100 : 0;
    $('#field-gauge-text').textContent = `${done} / ${total} points validés`;
    $('#field-gauge-rest').textContent = total ? `${rest} restant${rest > 1 ? 's' : ''}` : '';
    $('#field-gauge-fill').style.width = rate + '%';
    const pot = all.reduce((s, c) => s + (c.stage === 'prospect' ? (+c.potentiel || 0) : 0), 0);
    const contracted = all.reduce((s, c) => s + Store.dealsTotal(c), 0);
    $('#field-enjeu').textContent = total ? `${eur(pot)} pot. · ${eur(contracted)} contr.` : '—';
  }

  function render() {
    const list = $('#field-list');
    const hideDone = $('#field-hide-done').checked;
    let all, date;
    if (mode === 'date') {
      date = $('#field-date').value || today();
      all = dueContacts(date, $('#field-stage-filter').value);
    } else {
      const t = Store.getTour($('#field-tour-select').value);
      date = today();
      if (!t) {
        list.innerHTML = '<p class="empty-field">Sélectionnez une tournée enregistrée.</p>';
        updateBanner([], date); list.dataset.date = date; return;
      }
      all = t.stopIds.map(id => Store.get(id)).filter(Boolean);
    }
    list.dataset.date = date;
    updateBanner(all, date);
    const isDone = c => (c.visits || []).some(v => v.date === date);
    const shown = hideDone ? all.filter(c => !isDone(c)) : all;
    if (!all.length) {
      list.innerHTML = mode === 'date'
        ? '<p class="empty-field">Aucun point à visiter pour cette date 🎉</p>'
        : '<p class="empty-field">Cette tournée ne contient aucun arrêt.</p>';
    } else if (!shown.length) {
      list.innerHTML = '<p class="empty-field">✅ Tous les points sont validés ! Décochez « Masquer » pour les revoir.</p>';
    } else {
      list.innerHTML = shown.map((c, i) => cardHTML(c, i, date)).join('');
    }
  }

  // Clic sur un bouton de statut → enregistre/annule le passage à la date courante
  function handleStatusClick(cid, status) {
    const date = $('#field-list').dataset.date || today();
    const c = Store.get(cid);
    const existing = (c.visits || []).find(v => v.date === date);
    if (existing && existing.status === status) Store.clearVisit(cid, date); // re-clic = annule
    else Store.recordVisit(cid, date, status);
    render();
  }

  // Commentaire terrain → synchronisé dans la fiche (notes + passage du jour)
  function handleComment(cid, text) {
    if (!text.trim()) return;
    const date = $('#field-list').dataset.date || today();
    Store.addComment(cid, date, text.trim());
    render();
  }

  return { setMode, render, refreshTourSelect, handleStatusClick, handleComment };
})();
