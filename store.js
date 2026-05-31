/* store.js — persistance locale (localStorage) + modèle de données
 *
 * Modèle "contact" (prospect OU client) :
 * {
 *   id, name, contact, phone, email, address, lat, lng, notes,
 *   stage: 'prospect' | 'client',
 *   businessType: 'Commerce'|'Restaurant'|'Hôtellerie'|'Garage'|'Salon de beauté'|'Autre',
 *   businessSub: ''|'Airbnb'|'Gîte'|'Hôtel',     // si Hôtellerie
 *   priority: 'Basse'|'Normale'|'Haute',
 *   prospectStatus: 'À contacter'|'Contacté'|'RDV pris'|'En négociation'|'Gagné'|'Perdu',
 *   relanceInterval: 15|30|45,                   // jours
 *   deals:  [{ id, date, amount, label }],       // deals financiers réalisés
 *   visits: [{ id, date, status, note }]         // historique des passages
 * }
 */
const Store = (() => {
  const KEY = 'tp_contacts';
  const KEY_SETTINGS = 'tp_settings';
  const KEY_TOURS = 'tp_tours';
  const KEY_STATUSES = 'tp_statuses';
  const KEY_OBJ = 'tp_objectives';

  const DEFAULT_STATUSES = {
    prospect: ['À contacter', 'À visiter', 'Contacté', 'RDV pris', 'En négociation', 'Gagné', 'Perdu'],
    client: ['Livré', 'Vente', 'Visité', 'Absent']
  };

  const load = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  function id() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // ---- Chargement + migration depuis l'ancien format ----
  let contacts = load(KEY, null);
  if (contacts === null) {
    const old = load('tp_clients', null); // migration v1
    if (old) {
      contacts = old.map(c => migrate(c));
      save(KEY, contacts);
    } else {
      contacts = demo();
      save(KEY, contacts);
    }
  }

  function migrate(c) {
    const isClient = ['Client', 'Livraison', 'VIP'].includes(c.type);
    return {
      id: c.id || id(), name: c.name, contact: c.contact || '', phone: c.phone || '',
      email: c.email || '', address: c.address || '', lat: c.lat ?? null, lng: c.lng ?? null,
      notes: c.notes || '', stage: isClient ? 'client' : 'prospect',
      businessType: 'Commerce', businessSub: '', priority: c.priority || 'Normale',
      prospectStatus: isClient ? 'Gagné' : 'À contacter', relanceInterval: 30,
      potentiel: 0, deals: [], visits: []
    };
  }

  function demo() {
    const base = (o) => Object.assign({
      id: id(), contact: '', phone: '', email: '', notes: '', businessSub: '',
      priority: 'Normale', relanceInterval: 30, potentiel: 0, deals: [], visits: []
    }, o);
    return [
      base({ name: 'Boulangerie Martin', address: '15 Rue de Rivoli, 75004 Paris', lat: 48.8558, lng: 2.3588, stage: 'client', businessType: 'Commerce', prospectStatus: 'Gagné', phone: '0142001122', deals: [{ id: id(), date: '2026-04-10', amount: 1200, label: 'Contrat annuel' }], visits: [{ id: id(), date: '2026-05-15', status: 'Livré', note: '' }] }),
      base({ name: 'Restaurant Bellevue', address: '2 Place du Trocadéro, 75116 Paris', lat: 48.8629, lng: 2.2876, stage: 'client', businessType: 'Restaurant', prospectStatus: 'Gagné', priority: 'Haute', deals: [{ id: id(), date: '2026-03-22', amount: 3400, label: 'Équipement cuisine' }], visits: [{ id: id(), date: '2026-05-20', status: 'Visité', note: '' }], relanceInterval: 15 }),
      base({ name: 'Hôtel des Voyageurs', address: '20 Boulevard Saint-Germain, 75005 Paris', lat: 48.8487, lng: 2.3536, stage: 'client', businessType: 'Hôtellerie', businessSub: 'Hôtel', prospectStatus: 'Gagné', visits: [{ id: id(), date: '2026-05-05', status: 'Livré', note: '' }] }),
      base({ name: 'Café Le Central', address: '50 Avenue des Champs-Élysées, 75008 Paris', lat: 48.8708, lng: 2.3050, stage: 'prospect', businessType: 'Restaurant', prospectStatus: 'RDV pris', phone: '0143003344', potentiel: 2500, visits: [{ id: id(), date: '2026-05-18', status: 'RDV pris', note: 'Revoir le gérant' }], relanceInterval: 15 }),
      base({ name: 'Épicerie Bio Nature', address: '10 Rue Mouffetard, 75005 Paris', lat: 48.8434, lng: 2.3499, stage: 'prospect', businessType: 'Commerce', prospectStatus: 'À contacter', potentiel: 800, notes: 'À relancer' }),
      base({ name: 'Garage Auto Plus', address: '8 Rue de la Roquette, 75011 Paris', lat: 48.8551, lng: 2.3736, stage: 'prospect', businessType: 'Garage', prospectStatus: 'Contacté', potentiel: 1500, visits: [{ id: id(), date: '2026-05-10', status: 'Absent', note: '' }], relanceInterval: 45 })
    ];
  }

  // ---- Calculs dérivés ----
  function lastVisitDate(c) {
    if (!c.visits?.length) return null;
    return c.visits.map(v => v.date).sort().slice(-1)[0];
  }
  function firstVisitDate(c) {
    if (!c.visits?.length) return null;
    return c.visits.map(v => v.date).sort()[0];
  }
  function nextRelanceDate(c) {
    const last = lastVisitDate(c);
    if (!last) return null;
    const d = new Date(last + 'T00:00:00');
    d.setDate(d.getDate() + (c.relanceInterval || 30));
    return d.toISOString().slice(0, 10);
  }
  function dealsTotal(c) { return (c.deals || []).reduce((s, d) => s + (+d.amount || 0), 0); }

  return {
    newId: id,
    all: () => contacts,
    byStage: (stage) => contacts.filter(c => c.stage === stage),
    get: (cid) => contacts.find(c => c.id === cid),
    upsert(c) {
      if (c.id && contacts.find(x => x.id === c.id)) {
        contacts[contacts.findIndex(x => x.id === c.id)] = c;
      } else { c.id = c.id || id(); contacts.push(c); }
      save(KEY, contacts); return c;
    },
    remove(cid) { contacts = contacts.filter(c => c.id !== cid); save(KEY, contacts); },

    addDeal(cid, deal) { const c = this.get(cid); if (!c) return; c.deals = c.deals || []; deal.id = id(); c.deals.push(deal); save(KEY, contacts); },
    removeDeal(cid, dealId) { const c = this.get(cid); if (!c) return; c.deals = (c.deals || []).filter(d => d.id !== dealId); save(KEY, contacts); },

    addVisit(cid, visit) { const c = this.get(cid); if (!c) return; c.visits = c.visits || []; visit.id = id(); c.visits.push(visit); save(KEY, contacts); return c; },
    removeVisit(cid, vId) { const c = this.get(cid); if (!c) return; c.visits = (c.visits || []).filter(v => v.id !== vId); save(KEY, contacts); },

    // Upsert d'un passage par date (terrain) + mise à jour du statut prospection + relance auto
    recordVisit(cid, date, status) {
      const c = this.get(cid); if (!c) return;
      c.visits = c.visits || [];
      const v = c.visits.find(x => x.date === date);
      if (v) v.status = status; else c.visits.push({ id: id(), date, status, note: '' });
      // Sync statut prospection (selon la liste de statuts configurée)
      const PSTATUS = this.getStatuses().prospect;
      if (c.stage === 'prospect' && PSTATUS.includes(status)) c.prospectStatus = status;
      if (status === 'Gagné') { c.stage = 'client'; c.prospectStatus = 'Gagné'; }
      save(KEY, contacts); return c;
    },
    clearVisit(cid, date) {
      const c = this.get(cid); if (!c) return;
      c.visits = (c.visits || []).filter(v => v.date !== date); save(KEY, contacts);
    },
    // Commentaire terrain : enregistré sur le passage du jour ET ajouté aux notes de la fiche
    addComment(cid, date, text) {
      const c = this.get(cid); if (!c || !text) return;
      c.visits = c.visits || [];
      let v = c.visits.find(x => x.date === date);
      if (!v) { v = { id: id(), date, status: '', note: '' }; c.visits.push(v); }
      v.note = v.note ? v.note + ' | ' + text : text;
      const line = `[${date}] ${text}`;
      c.notes = c.notes ? c.notes + '\n' + line : line;
      save(KEY, contacts); return c;
    },
    convertToClient(cid) { const c = this.get(cid); if (!c) return; c.stage = 'client'; c.prospectStatus = 'Gagné'; save(KEY, contacts); return c; },

    lastVisitDate, firstVisitDate, nextRelanceDate, dealsTotal,

    // ---- Statuts personnalisables ----
    getStatuses: () => Object.assign({}, DEFAULT_STATUSES, load(KEY_STATUSES, {})),
    saveStatuses: (s) => save(KEY_STATUSES, s),
    resetStatuses() { localStorage.removeItem(KEY_STATUSES); },

    // ---- Chiffre d'affaires ----
    // CA contracté = deals réalisés dans la période [from, to]
    contractedInRange(from, to) {
      return contacts.reduce((s, c) => s + (c.deals || [])
        .filter(d => (!from || d.date >= from) && (!to || d.date <= to))
        .reduce((a, d) => a + (+d.amount || 0), 0), 0);
    },
    // CA potentiel = somme des potentiels des prospects encore ouverts (hors Perdu)
    potentialTotal() {
      return contacts.filter(c => c.stage === 'prospect' && c.prospectStatus !== 'Perdu')
        .reduce((s, c) => s + (+c.potentiel || 0), 0);
    },
    // Statistiques d'activité sur une période [from, to]
    // points = nb de passages ; ventes = nb de deals ; ca = somme des deals
    statsInRange(from, to) {
      const inRange = d => (!from || d >= from) && (!to || d <= to);
      let points = 0, ventes = 0, ca = 0;
      for (const c of contacts) {
        (c.visits || []).forEach(v => { if (inRange(v.date)) points++; });
        (c.deals || []).forEach(d => { if (inRange(d.date)) { ventes++; ca += (+d.amount || 0); } });
      }
      const conversion = points ? ventes / points : 0;
      return { points, ventes, ca, conversion };
    },
    getObjectives: () => load(KEY_OBJ, { day: { points: 10, ventes: 2, ca: 1000 }, week: { points: 40, ventes: 8, ca: 5000 }, month: { points: 160, ventes: 30, ca: 20000 } }),
    saveObjectives: (o) => save(KEY_OBJ, o),

    // Liste des relances à venir, triée par date
    upcomingRelances() {
      return contacts
        .map(c => ({ c, date: this.nextRelanceDate(c) }))
        .filter(x => x.date)
        .sort((a, b) => a.date.localeCompare(b.date));
    },

    // ---- Paramètres ----
    getSettings: () => load(KEY_SETTINGS, { fuel: 1.85, consumption: 7.5, stopTime: 15, hourly: 0 }),
    saveSettings: (s) => save(KEY_SETTINGS, s),

    // ---- Tournées enregistrées ----
    getTours: () => load(KEY_TOURS, []),
    getTour(tid) { return load(KEY_TOURS, []).find(t => t.id === tid); },
    saveTour(tour) {
      const tours = load(KEY_TOURS, []); tour.updatedAt = Date.now();
      if (tour.id && tours.find(t => t.id === tour.id)) tours[tours.findIndex(t => t.id === tour.id)] = tour;
      else { tour.id = 't' + id(); tours.push(tour); }
      save(KEY_TOURS, tours); return tour;
    },
    removeTour(tid) { save(KEY_TOURS, load(KEY_TOURS, []).filter(t => t.id !== tid)); }
  };
})();
