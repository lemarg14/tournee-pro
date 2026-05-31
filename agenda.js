/* agenda.js — dashboard CA + tableau des relances à venir */
const Agenda = (() => {
  const $ = s => document.querySelector(s);
  const esc = s => (s || '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  const eur = v => (+v || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €';
  const frDate = d => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });
  const slug = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');

  function bucket(date, today) {
    if (date < today) return { k: 0, label: '⚠️ En retard', cls: 'bk-late' };
    const d = (new Date(date) - new Date(today)) / 86400000;
    if (d <= 7) return { k: 1, label: 'Cette semaine', cls: 'bk-week' };
    if (d <= 14) return { k: 2, label: 'Sous 2 semaines', cls: 'bk-2w' };
    if (d <= 31) return { k: 3, label: 'Ce mois-ci', cls: 'bk-month' };
    return { k: 4, label: 'Plus tard', cls: 'bk-later' };
  }

  function renderDashboard() {
    const from = $('#ca-from').value, to = $('#ca-to').value;
    $('#ca-contracted').textContent = eur(Store.contractedInRange(from, to));
    const pot = Store.potentialTotal();
    const totalContracted = Store.contractedInRange('', '');
    $('#ca-potential').textContent = eur(pot);
    $('#ca-total-contracted').textContent = eur(totalContracted);
    $('#ca-pipeline').textContent = eur(totalContracted + pot);
  }

  function renderRelances() {
    const filter = $('#agenda-filter').value;
    const today = new Date().toISOString().slice(0, 10);
    let items = Store.upcomingRelances();
    if (filter !== 'all') items = items.filter(x => x.c.stage === filter);

    // groupement par période
    const groups = {};
    items.forEach(x => {
      const b = bucket(x.date, today);
      (groups[b.k] = groups[b.k] || { b, rows: [] }).rows.push(x);
    });

    const order = Object.values(groups).sort((a, b) => a.b.k - b.b.k);
    const html = order.map(g => `
      <div class="bk ${g.b.cls}">${g.b.label} <span class="bk-count">${g.rows.length}</span></div>
      <table class="crm-table"><tbody>
        ${g.rows.map(({ c, date }) => {
          const biz = c.businessType + (c.businessSub ? ` (${c.businessSub})` : '');
          const st = c.stage === 'prospect'
            ? `<span class="pill ps-${slug(c.prospectStatus)}">${esc(c.prospectStatus)}</span>`
            : `<span class="fc-tag client">Client</span>`;
          return `<tr>
            <td data-label="Relance"><strong>${frDate(date)}</strong></td>
            <td data-label="Nom">${esc(c.name)}<br><small class="muted">${esc(biz)}</small></td>
            <td data-label="Statut">${st}</td>
            <td data-label="Tél">${c.phone ? `<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : ''}</td>
            <td data-label="CA">${eur(Store.dealsTotal(c))}${c.potentiel ? ` <small class="muted">/ ${eur(c.potentiel)} pot.</small>` : ''}</td>
          </tr>`;
        }).join('')}
      </tbody></table>`).join('');
    $('#agenda-table').innerHTML = items.length ? html
      : '<p class="muted">Aucune relance programmée (les relances apparaissent dès le 1er passage enregistré).</p>';
  }

  function render() { renderDashboard(); renderRelances(); }

  function loadStatusEditors() {
    const s = Store.getStatuses();
    $('#st-prospect').value = s.prospect.join('\n');
    $('#st-client').value = s.client.join('\n');
  }

  return { render, renderDashboard, renderRelances, loadStatusEditors };
})();
