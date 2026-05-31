/* kpi.js — tableau de bord KPI : objectif / réalisé / taux d'accomplissement */
const KPI = (() => {
  const $ = s => document.querySelector(s);
  const eur = v => (+v || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €';
  const pct = v => Math.round(v * 100) + ' %';

  let period = 'day';

  // Bornes [from, to] de la période courante
  function range(p) {
    const now = new Date();
    const iso = d => d.toISOString().slice(0, 10);
    if (p === 'day') return [iso(now), iso(now)];
    if (p === 'week') {
      const d = new Date(now); const day = (d.getDay() + 6) % 7; // lundi=0
      const mon = new Date(d); mon.setDate(d.getDate() - day);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return [iso(mon), iso(sun)];
    }
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return [iso(first), iso(last)];
  }
  const labelOf = p => ({ day: 'aujourd\'hui', week: 'cette semaine', month: 'ce mois-ci' }[p]);

  function setPeriod(p) {
    period = p;
    document.querySelectorAll('#kpi-period .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.p === p));
    render();
  }

  function gauge(label, real, target, fmt) {
    const rate = target > 0 ? real / target : 0;
    const clamped = Math.min(rate, 1) * 100;
    const cls = rate >= 1 ? 'ok' : rate >= 0.6 ? 'mid' : 'low';
    return `<div class="kpi-card">
      <div class="kpi-name">${label}</div>
      <div class="kpi-real">${fmt(real)}</div>
      <div class="kpi-target">Objectif : ${fmt(target)}</div>
      <div class="kpi-bar"><span class="${cls}" style="width:${clamped}%"></span></div>
      <div class="kpi-rate ${cls}">${pct(rate)}</div>
    </div>`;
  }

  function render() {
    const [from, to] = range(period);
    const s = Store.statsInRange(from, to);
    const obj = Store.getObjectives()[period] || { points: 0, ventes: 0, ca: 0 };
    const frDate = d => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR');
    $('#kpi-range').textContent = `Période (${labelOf(period)}) : ${frDate(from)} → ${frDate(to)}`;
    $('#kpi-cards').innerHTML =
      gauge('Points de contact', s.points, obj.points, v => v) +
      gauge('Chiffre d\'affaires', s.ca, obj.ca, eur) +
      gauge('Ventes', s.ventes, obj.ventes, v => v) +
      `<div class="kpi-card">
        <div class="kpi-name">Taux de conversion</div>
        <div class="kpi-real">${pct(s.conversion)}</div>
        <div class="kpi-target">${s.ventes} vente(s) / ${s.points} passage(s)</div>
        <div class="kpi-bar"><span class="${s.conversion >= 0.3 ? 'ok' : s.conversion >= 0.15 ? 'mid' : 'low'}" style="width:${Math.min(s.conversion, 1) * 100}%"></span></div>
        <div class="kpi-rate">&nbsp;</div>
      </div>`;
  }

  function loadObjectives() {
    const o = Store.getObjectives();
    ['day', 'week', 'month'].forEach(p => {
      $('#obj-' + p + '-points').value = o[p].points;
      $('#obj-' + p + '-ventes').value = o[p].ventes;
      $('#obj-' + p + '-ca').value = o[p].ca;
    });
  }

  function saveObjectives() {
    const get = (p, k) => +$('#obj-' + p + '-' + k).value || 0;
    const o = {};
    ['day', 'week', 'month'].forEach(p => o[p] = { points: get(p, 'points'), ventes: get(p, 'ventes'), ca: get(p, 'ca') });
    Store.saveObjectives(o);
    render();
  }

  return { setPeriod, render, loadObjectives, saveObjectives };
})();
