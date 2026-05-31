/* app.js — orchestration : carte, navigation, tournée */
(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  // État de la tournée
  let depot = null;            // { lat, lng, label }
  let stops = [];              // [client]
  let map, routeLayer, markerLayer;
  let lastResult = null;       // pour l'export

  /* ---------- CARTE ---------- */
  function initMap() {
    map = L.map('map').setView([48.8566, 2.3522], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19
    }).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
    routeLayer = L.layerGroup().addTo(map);
  }

  function numIcon(txt, depotStyle) {
    return L.divIcon({
      className: '',
      html: `<div class="leaflet-marker-num ${depotStyle ? 'leaflet-marker-depot' : ''}">${txt}</div>`,
      iconSize: [26, 26], iconAnchor: [13, 13]
    });
  }

  function redrawMarkers() {
    markerLayer.clearLayers();
    const pts = [];
    if (depot) {
      L.marker([depot.lat, depot.lng], { icon: numIcon('D', true) })
        .bindPopup('<b>Dépôt</b><br>' + (depot.label || '')).addTo(markerLayer);
      pts.push([depot.lat, depot.lng]);
    }
    stops.forEach((s, i) => {
      if (s.lat) {
        L.marker([s.lat, s.lng], { icon: numIcon(i + 1) })
          .bindPopup(`<b>${i + 1}. ${s.name}</b><br>${s.address || ''}`).addTo(markerLayer);
        pts.push([s.lat, s.lng]);
      }
    });
    if (pts.length) map.fitBounds(pts, { padding: [40, 40] });
  }

  function drawRoute(geometry) {
    routeLayer.clearLayers();
    L.geoJSON(geometry, { style: { color: '#2563eb', weight: 5, opacity: .75 } }).addTo(routeLayer);
  }

  /* ---------- NAVIGATION ---------- */
  $$('.tab').forEach(t => t.addEventListener('click', () => {
    $$('.tab').forEach(x => x.classList.remove('active'));
    $$('.view').forEach(v => v.classList.remove('active'));
    t.classList.add('active');
    $('#view-' + t.dataset.view).classList.add('active');
    if (t.dataset.view === 'plan') setTimeout(() => map.invalidateSize(), 100);
    if (t.dataset.view === 'field') { Field.refreshTourSelect(); Field.render(); }
    if (t.dataset.view === 'crm') { CRM.fill(null); CRM.setStage(t.dataset.stage); }
    if (t.dataset.view === 'agenda') { Agenda.render(); }
    if (t.dataset.view === 'kpi') { KPI.render(); }
    if (t.dataset.view === 'settings') { Agenda.loadStatusEditors(); KPI.loadObjectives(); loadCostDefaults(); }
  }));

  /* ---------- PARAMÈTRES : coûts par défaut ---------- */
  function loadCostDefaults() {
    const s = Store.getSettings();
    $('#set-fuel').value = s.fuel;
    $('#set-consumption').value = s.consumption;
    $('#set-stoptime').value = s.stopTime;
    $('#set-hourly').value = s.hourly;
  }
  $('#set-save').addEventListener('click', () => {
    Store.saveSettings({
      fuel: +$('#set-fuel').value || 0,
      consumption: +$('#set-consumption').value || 0,
      stopTime: +$('#set-stoptime').value || 0,
      hourly: +$('#set-hourly').value || 0
    });
    // applique aussi aux champs de la tournée en cours
    const s = Store.getSettings();
    $('#fuel-price').value = s.fuel; $('#consumption').value = s.consumption;
    $('#stop-time').value = s.stopTime; $('#hourly-cost').value = s.hourly;
    alert('Valeurs par défaut enregistrées ✓');
  });

  /* ---------- KPI ---------- */
  document.querySelectorAll('#kpi-period .seg-btn').forEach(b =>
    b.addEventListener('click', () => KPI.setPeriod(b.dataset.p)));
  $('#obj-save').addEventListener('click', () => { KPI.saveObjectives(); alert('Objectifs enregistrés ✓'); });

  /* ---------- AGENDA / CA / STATUTS ---------- */
  $('#ca-from').addEventListener('change', () => Agenda.renderDashboard());
  $('#ca-to').addEventListener('change', () => Agenda.renderDashboard());
  $('#agenda-filter').addEventListener('change', () => Agenda.renderRelances());

  $('#st-save').addEventListener('click', () => {
    const parse = v => v.split('\n').map(s => s.trim()).filter(Boolean);
    const prospect = parse($('#st-prospect').value);
    const client = parse($('#st-client').value);
    if (!prospect.length || !client.length) { alert('Chaque liste doit contenir au moins un statut.'); return; }
    Store.saveStatuses({ prospect, client });
    alert('Statuts enregistrés ✓');
  });
  $('#st-reset').addEventListener('click', () => {
    if (!confirm('Réinitialiser les statuts par défaut ?')) return;
    Store.resetStatuses();
    Agenda.loadStatusEditors();
  });

  /* ---------- SAUVEGARDE / CHARGEMENT DE TOURNÉES ---------- */
  let currentTourId = null; // tournée en cours d'édition (vue Tournée)

  function refreshTourLoad() {
    const sel = $('#tour-load');
    const tours = Store.getTours().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    sel.innerHTML = '<option value="">— Sélectionner —</option>' +
      tours.map(t => `<option value="${t.id}">${t.name}${t.recurring ? ' ♻︎' : ''}</option>`).join('');
    if (currentTourId) sel.value = currentTourId;
  }

  $('#tour-save').addEventListener('click', () => {
    const name = $('#tour-name').value.trim();
    if (!name) { alert('Donnez un nom à la tournée.'); return; }
    if (!depot) { alert('Définissez le point de départ.'); return; }
    if (!stops.length) { alert('Ajoutez au moins un arrêt.'); return; }
    const existing = currentTourId ? Store.getTour(currentTourId) : null;
    const tour = Store.saveTour({
      id: currentTourId || '',
      name,
      recurring: $('#tour-recurring').checked,
      depot,
      stopIds: stops.map(s => s.id),
      returnDepot: $('#return-depot').checked,
      settings: readSettings()
    });
    currentTourId = tour.id;
    refreshTourLoad();
    alert('Tournée « ' + name + ' » enregistrée ✓');
  });

  $('#tour-load').addEventListener('change', e => {
    const t = Store.getTour(e.target.value);
    if (!t) { currentTourId = null; return; }
    currentTourId = t.id;
    depot = t.depot;
    $('#depot-input').value = t.depot.label || '';
    $('#depot-status').textContent = '✓ ' + (t.depot.label || '');
    stops = t.stopIds.map(id => Store.get(id)).filter(Boolean);
    $('#return-depot').checked = t.returnDepot;
    $('#tour-name').value = t.name;
    $('#tour-recurring').checked = !!t.recurring;
    if (t.settings) {
      $('#fuel-price').value = t.settings.fuel;
      $('#consumption').value = t.settings.consumption;
      $('#stop-time').value = t.settings.stopTime;
      $('#hourly-cost').value = t.settings.hourly;
    }
    renderStops();
  });

  $('#tour-delete').addEventListener('click', () => {
    const id = $('#tour-load').value;
    if (!id) return;
    if (!confirm('Supprimer cette tournée enregistrée ?')) return;
    Store.removeTour(id);
    if (currentTourId === id) currentTourId = null;
    refreshTourLoad();
    Field.refreshTourSelect();
  });

  /* ---------- VUE TERRAIN ---------- */
  $$('.fmode').forEach(b => b.addEventListener('click', () => Field.setMode(b.dataset.mode)));
  $('#field-date').addEventListener('change', () => Field.render());
  $('#field-stage-filter').addEventListener('change', () => Field.render());
  $('#field-tour-select').addEventListener('change', () => Field.render());
  $('#field-hide-done').addEventListener('change', () => Field.render());
  $('#field-list').addEventListener('click', e => {
    const st = e.target.closest('.st-btn');
    if (st) { Field.handleStatusClick(st.dataset.cid, st.dataset.status); return; }
    const cmt = e.target.closest('.cmt-add');
    if (cmt) {
      const input = cmt.parentElement.querySelector('.cmt-input');
      Field.handleComment(cmt.dataset.cid, input.value);
    }
  });
  $('#field-list').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.classList.contains('cmt-input')) {
      Field.handleComment(e.target.dataset.cid, e.target.value);
    }
  });

  /* ---------- CRM ---------- */
  function refreshClientPicker() {
    const sel = $('#client-picker');
    const f = ($('#client-search').value || '').toLowerCase();
    const list = Store.all()
      .filter(c => !f || (c.name + (c.address || '') + c.businessType).toLowerCase().includes(f))
      .sort((a, b) => a.name.localeCompare(b.name));
    sel.size = f && list.length > 1 ? Math.min(list.length, 6) : 1;
    sel.innerHTML = list.length
      ? list.map(c => `<option value="${c.id}">${c.name}${c.lat ? '' : ' (non localisé)'}</option>`).join('')
      : '<option value="">Aucun résultat</option>';
  }
  $('#client-search').addEventListener('input', refreshClientPicker);

  $('#c-btype').addEventListener('change', () => CRM.toggleSub());
  $('#c-relance').addEventListener('change', () => CRM.toggleRelance());

  $('#c-save').addEventListener('click', () => {
    const c = CRM.fields();
    if (!c.name || !c.address) { alert('Nom et adresse obligatoires.'); return; }
    const saved = Store.upsert(c);
    CRM.fill(saved);                  // recharge avec l'id pour gérer deals/passages
    CRM.render();
    refreshClientPicker();
    $('#c-save-status') && ($('#c-save-status').textContent = 'Enregistré ✓');
  });
  $('#c-reset').addEventListener('click', () => CRM.fill(null));

  $('#c-convert').addEventListener('click', () => {
    const id = CRM.getCurrentId();
    if (!id) return;
    if (!confirm('Basculer ce prospect en client ?')) return;
    Store.convertToClient(id);
    CRM.fill(null);
    CRM.setStage('client');
    // bascule l'onglet visuel
    $$('.tab').forEach(x => x.classList.toggle('active', x.dataset.stage === 'client'));
  });

  // Ajout / suppression de deals
  $('#d-add').addEventListener('click', () => {
    const deal = { date: $('#d-date').value || new Date().toISOString().slice(0, 10), amount: +$('#d-amount').value || 0, label: $('#d-label').value.trim() };
    if (!deal.amount) { alert('Indiquez un montant.'); return; }
    const id = CRM.getCurrentId();
    if (id) { Store.addDeal(id, deal); CRM.renderDeals(); CRM.render(); }
    else CRM.addDraftDeal(deal);
    $('#d-amount').value = ''; $('#d-label').value = '';
  });

  $('#deals-list').addEventListener('click', e => {
    const id = e.target.dataset.dealDel; if (!id) return;
    const cid = CRM.getCurrentId();
    if (cid) { Store.removeDeal(cid, id); CRM.renderDeals(); CRM.render(); }
    else CRM.rmDraftDeal(id);
  });

  $('#visits-list').addEventListener('click', e => {
    const id = e.target.dataset.visitDel; if (!id) return;
    const cid = CRM.getCurrentId();
    if (cid) { Store.removeVisit(cid, id); CRM.renderVisits(); CRM.render(); }
    else CRM.rmDraftVisit(id);
  });

  $('#c-geocode').addEventListener('click', async () => {
    const addr = $('#c-address').value.trim();
    if (!addr) return;
    $('#c-geo-status').textContent = '⏳ Localisation…';
    try {
      const g = await Geo.geocode(addr);
      $('#c-id').dataset.lat = g.lat;
      $('#c-id').dataset.lng = g.lng;
      $('#c-geo-status').textContent = `✓ ${g.label}`;
    } catch (e) { $('#c-geo-status').textContent = '✗ ' + e.message; }
  });

  $('#crm-body').addEventListener('click', e => {
    const ed = e.target.dataset.edit, dl = e.target.dataset.del;
    if (ed) { CRM.fill(Store.get(ed)); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    if (dl && confirm('Supprimer cette fiche ?')) {
      Store.remove(dl); CRM.fill(null); CRM.render(); refreshClientPicker();
    }
  });
  $('#crm-search').addEventListener('input', () => CRM.render());
  ['#f-priority', '#f-sort', '#f-ca-min', '#f-ca-max'].forEach(sel =>
    $(sel).addEventListener('input', () => CRM.render()));

  /* ---------- TOURNÉE : dépôt ---------- */
  $('#depot-set').addEventListener('click', async () => {
    const addr = $('#depot-input').value.trim();
    if (!addr) return;
    $('#depot-status').textContent = '⏳ Localisation…';
    try {
      depot = await Geo.geocode(addr);
      $('#depot-status').textContent = `✓ ${depot.label}`;
      redrawMarkers();
    } catch (e) { $('#depot-status').textContent = '✗ ' + e.message; }
  });

  /* ---------- TOURNÉE : arrêts ---------- */
  function renderStops() {
    $('#stop-count').textContent = stops.length;
    $('#stop-list').innerHTML = stops.map((s, i) => `
      <li>
        <span class="num">${i + 1}</span>
        <span class="nm">${s.name}${s.lat ? '' : ' ⚠️'}</span>
        <span class="ord">
          <button data-up="${i}">▲</button>
          <button data-down="${i}">▼</button>
        </span>
        <button class="rm" data-rm="${i}">×</button>
      </li>`).join('') || '<li class="muted">Aucun arrêt.</li>';
    redrawMarkers();
    updateEnjeu();
  }

  // Enjeu CA de la tournée : potentiel des prospects + CA déjà contracté des arrêts
  function updateEnjeu() {
    const eur = v => (+v || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €';
    const pot = stops.reduce((s, c) => s + (c.stage === 'prospect' ? (+c.potentiel || 0) : 0), 0);
    const contracted = stops.reduce((s, c) => s + Store.dealsTotal(c), 0);
    if (!stops.length) { $('#enjeu-pot').textContent = '—'; $('#enjeu-sub').textContent = 'ajoutez des arrêts'; return; }
    $('#enjeu-pot').textContent = eur(pot);
    $('#enjeu-sub').textContent = `potentiel à aller chercher · ${eur(contracted)} déjà contractés`;
  }

  $('#add-stop').addEventListener('click', () => {
    const id = $('#client-picker').value;
    const c = Store.get(id);
    if (!c) return;
    if (!c.lat) { alert('Ce client n\'est pas localisé. Géolocalisez-le dans le CRM.'); return; }
    if (stops.find(s => s.id === id)) { alert('Déjà dans la tournée.'); return; }
    stops.push(c);
    renderStops();
  });

  $('#stop-list').addEventListener('click', e => {
    const { up, down, rm } = e.target.dataset;
    if (rm !== undefined) stops.splice(+rm, 1);
    else if (up !== undefined && +up > 0) [stops[+up - 1], stops[+up]] = [stops[+up], stops[+up - 1]];
    else if (down !== undefined && +down < stops.length - 1) [stops[+down + 1], stops[+down]] = [stops[+down], stops[+down + 1]];
    else return;
    renderStops();
  });

  $('#optimize').addEventListener('click', () => {
    if (!depot) { alert('Définissez d\'abord le point de départ.'); return; }
    if (stops.length < 2) return;
    stops = Geo.optimizeOrder(depot, stops);
    renderStops();
  });

  /* ---------- TOURNÉE : calcul ---------- */
  function readSettings() {
    const s = {
      fuel: +$('#fuel-price').value || 0,
      consumption: +$('#consumption').value || 0,
      stopTime: +$('#stop-time').value || 0,
      hourly: +$('#hourly-cost').value || 0
    };
    Store.saveSettings(s);
    return s;
  }

  $('#calc').addEventListener('click', async () => {
    if (!depot) { alert('Définissez le point de départ.'); return; }
    if (!stops.length) { alert('Ajoutez au moins un arrêt.'); return; }

    const pts = [depot, ...stops.map(s => ({ lat: s.lat, lng: s.lng }))];
    if ($('#return-depot').checked) pts.push(depot);

    $('#calc').textContent = '⏳ Calcul en cours…';
    $('#calc').disabled = true;
    try {
      const rd = await Geo.route(pts);
      const settings = readSettings();
      const r = RouteCalc.compute(rd, settings, stops.length);
      lastResult = { rd, r, settings };

      drawRoute(rd.geometry);

      $('#r-distance').textContent = RouteCalc.fmtKmN(r.km);
      $('#r-driving').textContent = RouteCalc.fmtDuration(r.drivingMin);
      $('#r-total-time').textContent = RouteCalc.fmtDuration(r.totalMin);
      $('#r-stops').textContent = stops.length;
      $('#r-fuel').textContent = RouteCalc.fmtEur(r.fuelCost);
      $('#r-liters').textContent = RouteCalc.fmtL(r.liters);
      $('#r-labor').textContent = RouteCalc.fmtEur(r.laborCost);
      $('#r-total-cost').textContent = RouteCalc.fmtEur(r.totalCost);

      renderRoadbook(rd, settings);
    } catch (e) {
      alert('Erreur : ' + e.message + '\n(Vérifiez votre connexion internet — le routage utilise OSRM.)');
    } finally {
      $('#calc').textContent = '🧮 Calculer la tournée';
      $('#calc').disabled = false;
    }
  });

  // Calcule l'horaire de passage à chaque nœud (si heure de départ fournie)
  function computeSchedule(rd, settings) {
    const start = RouteCalc.parseClock($('#depart-time').value);
    if (start == null) return null;
    const ret = $('#return-depot').checked;
    const n = stops.length + (ret ? 1 : 0); // nœuds après le dépôt
    const arr = [start]; // arrivée/heure à chaque nœud (0 = dépôt départ)
    let t = start;
    for (let i = 0; i < n; i++) {
      t += (rd.legs[i]?.duration || 0) / 60;        // trajet
      arr.push(t);                                   // arrivée au nœud i+1
      const isClient = i < stops.length;             // dernier = dépôt retour
      if (isClient) t += settings.stopTime;          // temps sur place
    }
    return arr;
  }

  function renderRoadbook(rd, settings) {
    const ret = $('#return-depot').checked;
    const seq = [{ name: 'Dépôt (départ)' }, ...stops, ...(ret ? [{ name: 'Dépôt (retour)' }] : [])];
    const sched = computeSchedule(rd, settings);
    let html = '';
    seq.forEach((node, i) => {
      const clock = sched ? `<span class="slot">${RouteCalc.fmtClock(sched[i])}</span> ` : '';
      html += `<li>${clock}<strong>${node.name}</strong>`;
      if (i < seq.length - 1 && rd.legs[i]) {
        const leg = rd.legs[i];
        html += `<div class="leg">↓ ${RouteCalc.fmtKmN(leg.distance / 1000)} · ${RouteCalc.fmtDuration(leg.duration / 60)} de route`;
        if (i > 0 && i <= stops.length) html += ` · +${settings.stopTime} min sur place`;
        html += `</div>`;
      }
      html += `</li>`;
    });
    $('#roadbook').innerHTML = html;
  }

  /* ---------- EXPORT CSV ---------- */
  $('#export-csv').addEventListener('click', () => {
    if (!lastResult) { alert('Calculez d\'abord la tournée.'); return; }
    const { rd, r, settings } = lastResult;
    const ret = $('#return-depot').checked;
    const sched = computeSchedule(rd, settings);
    const rows = [['Ordre', 'Créneau', 'Client', 'Adresse', 'Distance segment (km)', 'Temps route (min)']];
    const seq = [{ name: 'Dépôt', address: depot.label }, ...stops, ...(ret ? [{ name: 'Dépôt (retour)', address: depot.label }] : [])];
    seq.forEach((n, i) => {
      const leg = rd.legs[i];
      rows.push([i, sched ? RouteCalc.fmtClock(sched[i]) : '', n.name, (n.address || '').replace(/[;,\n]/g, ' '),
        leg ? (leg.distance / 1000).toFixed(1) : '', leg ? Math.round(leg.duration / 60) : '']);
    });
    rows.push([]);
    rows.push(['TOTAL distance (km)', r.km.toFixed(1)]);
    rows.push(['Durée totale', RouteCalc.fmtDuration(r.totalMin)]);
    rows.push(['Litres consommés', r.liters.toFixed(2)]);
    rows.push(['Coût carburant (€)', r.fuelCost.toFixed(2)]);
    rows.push(['Coût main d\'œuvre (€)', r.laborCost.toFixed(2)]);
    rows.push(['COÛT TOTAL (€)', r.totalCost.toFixed(2)]);
    rows.push([]);
    rows.push(['Paramètres', `${settings.fuel} €/L · ${settings.consumption} L/100km · ${settings.stopTime} min/arrêt · ${settings.hourly} €/h`]);

    const csv = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tournee_' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
  });

  /* ---------- INIT ---------- */
  function init() {
    initMap();
    const s = Store.getSettings();
    $('#fuel-price').value = s.fuel;
    $('#consumption').value = s.consumption;
    $('#stop-time').value = s.stopTime;
    $('#hourly-cost').value = s.hourly;
    CRM.fill(null);
    CRM.setStage('prospect');
    const td = new Date().toISOString().slice(0, 10);
    $('#field-date').value = td;
    $('#ca-from').value = td.slice(0, 4) + '-01-01';
    $('#ca-to').value = td;
    refreshClientPicker();
    refreshTourLoad();
    Field.refreshTourSelect();
    renderStops();
  }
  init();
})();
