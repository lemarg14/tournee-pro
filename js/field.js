/* field.js — interface terrain (mobile) : navigation GPS + statut par arrêt */
const Field = (() => {
  const $ = s => document.querySelector(s);

  // Statuts possibles sur le terrain
  const STATUSES = [
    { key: 'Livré',    label: '📦 Livré',    cls: 'st-ok' },
    { key: 'Vente',    label: '💶 Vente',    cls: 'st-ok' },
    { key: 'RDV pris', label: '📅 RDV pris', cls: 'st-info' },
    { key: 'Visité',   label: '✓ Visité',    cls: 'st-info' },
    { key: 'Absent',   label: '🚫 Absent',   cls: 'st-warn' },
    { key: 'Refus',    label: '✗ Refus',     cls: 'st-bad' }
  ];

  let currentTourId = null;

  const esc = s => (s || '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

  // Liens de navigation directs (coordonnées si dispo, sinon adresse)
  function navLinks(c) {
    const hasGeo = c.lat != null && c.lng != null;
    const q = hasGeo ? `${c.lat},${c.lng}` : encodeURIComponent(c.address || c.name);
    const addr = encodeURIComponent(c.address || c.name);
    return {
      waze: hasGeo ? `https://waze.com/ul?ll=${c.lat},${c.lng}&navigate=yes`
                   : `https://waze.com/ul?q=${addr}&navigate=yes`,
      apple: `https://maps.apple.com/?daddr=${q}&dirflg=d`,
      google: `https://www.google.com/maps/dir/?api=1&destination=${q}`
    };
  }

  // Remplit le sélecteur de tournées
  function refreshSelector() {
    const sel = $('#field-tour-select');
    const tours = Store.getTours().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const cur = sel.value;
    sel.innerHTML = '<option value="">— Choisir une tournée —</option>' +
      tours.map(t => `<option value="${t.id}">${esc(t.name)}${t.recurring ? ' ♻︎' : ''}</option>`).join('');
    if (cur && tours.find(t => t.id === cur)) sel.value = cur;
  }

  // Affiche les arrêts d'une tournée
  function render(tourId) {
    currentTourId = tourId;
    const list = $('#field-list');
    const t = Store.getTour(tourId);
    if (!t) {
      list.innerHTML = '<p class="empty-field">Sélectionnez une tournée enregistrée pour démarrer sur le terrain.</p>';
      $('#field-progress').textContent = '';
      $('#field-reset').style.display = 'none';
      return;
    }
    $('#field-reset').style.display = '';
    const progress = t.progress || {};
    const stops = t.stopIds.map(id => Store.getClient(id)).filter(Boolean);
    const done = stops.filter(s => progress[s.id]).length;
    $('#field-progress').textContent = `${done}/${stops.length} fait${done > 1 ? 's' : ''}`;

    list.innerHTML = stops.map((c, i) => {
      const nav = navLinks(c);
      const status = progress[c.id];
      const statusBtns = STATUSES.map(s =>
        `<button class="st-btn ${s.cls} ${status === s.key ? 'active' : ''}"
                 data-status="${s.key}" data-cid="${c.id}">${s.label}</button>`).join('');
      return `<div class="field-card ${status ? 'is-done' : ''}">
        <div class="fc-head">
          <span class="fc-num">${i + 1}</span>
          <div class="fc-id">
            <strong>${esc(c.name)}</strong>
            <span class="fc-addr">${esc(c.address || '')}</span>
            ${c.phone ? `<a class="fc-phone" href="tel:${esc(c.phone)}">📞 ${esc(c.phone)}</a>` : ''}
          </div>
          ${status ? `<span class="fc-badge">${esc(status)}</span>` : ''}
        </div>
        <div class="nav-btns">
          <a class="nav-btn waze" href="${nav.waze}" target="_blank" rel="noopener">Waze</a>
          <a class="nav-btn apple" href="${nav.apple}" target="_blank" rel="noopener">Plans</a>
          <a class="nav-btn google" href="${nav.google}" target="_blank" rel="noopener">Maps</a>
        </div>
        <div class="st-btns">${statusBtns}</div>
      </div>`;
    }).join('') || '<p class="empty-field">Cette tournée ne contient aucun arrêt.</p>';
  }

  return { STATUSES, refreshSelector, render, getCurrentTour: () => currentTourId };
})();
