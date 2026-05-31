/* crm.js — mini CRM : formulaire, tableau, recherche */
const CRM = (() => {
  const $ = s => document.querySelector(s);

  function fields() {
    return {
      id: $('#c-id').value || '',
      name: $('#c-name').value.trim(),
      contact: $('#c-contact').value.trim(),
      phone: $('#c-phone').value.trim(),
      email: $('#c-email').value.trim(),
      address: $('#c-address').value.trim(),
      type: $('#c-type').value,
      priority: $('#c-priority').value,
      notes: $('#c-notes').value.trim(),
      lat: $('#c-id').dataset.lat ? +$('#c-id').dataset.lat : null,
      lng: $('#c-id').dataset.lng ? +$('#c-id').dataset.lng : null
    };
  }

  function fill(c) {
    $('#crm-form-title').textContent = c ? 'Modifier le client' : 'Nouveau client';
    $('#c-id').value = c?.id || '';
    $('#c-id').dataset.lat = c?.lat ?? '';
    $('#c-id').dataset.lng = c?.lng ?? '';
    $('#c-name').value = c?.name || '';
    $('#c-contact').value = c?.contact || '';
    $('#c-phone').value = c?.phone || '';
    $('#c-email').value = c?.email || '';
    $('#c-address').value = c?.address || '';
    $('#c-type').value = c?.type || 'Prospect';
    $('#c-priority').value = c?.priority || 'Normale';
    $('#c-notes').value = c?.notes || '';
    $('#c-geo-status').textContent = c?.lat
      ? `✓ Géolocalisé (${c.lat.toFixed(4)}, ${c.lng.toFixed(4)})` : '';
  }

  function render(filter = '') {
    const body = $('#crm-body');
    const f = filter.toLowerCase();
    const rows = Store.getClients()
      .filter(c => !f || (c.name + c.address + c.contact + c.type).toLowerCase().includes(f))
      .map(c => {
        const geo = c.lat ? '<span class="geo-ok">●</span>' : '<span class="geo-no">○</span>';
        return `<tr>
          <td data-label="Nom"><strong>${esc(c.name)}</strong><br><small class="muted">${esc(c.contact || '')}</small></td>
          <td data-label="Type"><span class="pill ${c.type}">${c.type}</span></td>
          <td data-label="Adresse">${esc(c.address || '')}</td>
          <td data-label="Tél">${esc(c.phone || '')}</td>
          <td data-label="Géo" style="text-align:center">${geo}</td>
          <td style="white-space:nowrap">
            <button class="tbtn" data-edit="${c.id}" title="Modifier">✏️</button>
            <button class="tbtn" data-del="${c.id}" title="Supprimer">🗑️</button>
          </td></tr>`;
      }).join('');
    body.innerHTML = rows || '<tr><td colspan="6" class="muted">Aucun client.</td></tr>';
  }

  const esc = s => (s || '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

  return { fields, fill, render };
})();
