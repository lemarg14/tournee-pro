/* store.js — persistance locale (localStorage) + état applicatif */
const Store = (() => {
  const KEY_CLIENTS = 'tp_clients';
  const KEY_SETTINGS = 'tp_settings';
  const KEY_TOURS = 'tp_tours';

  const load = (k, def) => {
    try { return JSON.parse(localStorage.getItem(k)) ?? def; }
    catch { return def; }
  };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  let clients = load(KEY_CLIENTS, null);

  // Jeu de données de démonstration au premier lancement
  if (clients === null) {
    clients = [
      { id: id(), name: 'Boulangerie Martin', contact: 'P. Martin', phone: '01 42 00 11 22', email: 'contact@martin.fr', address: '15 Rue de Rivoli, 75004 Paris', type: 'Client', priority: 'Haute', notes: 'Livraison le matin', lat: 48.8558, lng: 2.3588 },
      { id: id(), name: 'Café Le Central', contact: 'M. Dubois', phone: '01 43 00 33 44', email: 'central@cafe.fr', address: '50 Avenue des Champs-Élysées, 75008 Paris', type: 'Client', priority: 'Normale', notes: '', lat: 48.8708, lng: 2.3050 },
      { id: id(), name: 'Restaurant Bellevue', contact: 'S. Leroy', phone: '01 44 00 55 66', email: 'bellevue@resto.fr', address: '2 Place du Trocadéro, 75116 Paris', type: 'VIP', priority: 'Haute', notes: 'Demander la cuisine', lat: 48.8629, lng: 2.2876 },
      { id: id(), name: 'Épicerie Bio Nature', contact: 'A. Petit', phone: '01 45 00 77 88', email: 'bio@nature.fr', address: '10 Rue Mouffetard, 75005 Paris', type: 'Prospect', priority: 'Normale', notes: 'À relancer', lat: 48.8434, lng: 2.3499 },
      { id: id(), name: 'Hôtel des Voyageurs', contact: 'L. Moreau', phone: '01 46 00 99 00', email: 'hotel@voyageurs.fr', address: '20 Boulevard Saint-Germain, 75005 Paris', type: 'Livraison', priority: 'Basse', notes: '', lat: 48.8487, lng: 2.3536 }
    ];
    save(KEY_CLIENTS, clients);
  }

  function id() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  return {
    getClients: () => clients,
    getClient: (cid) => clients.find(c => c.id === cid),
    upsert(c) {
      if (c.id) {
        const i = clients.findIndex(x => x.id === c.id);
        if (i >= 0) clients[i] = c;
      } else {
        c.id = id();
        clients.push(c);
      }
      save(KEY_CLIENTS, clients);
      return c;
    },
    remove(cid) { clients = clients.filter(c => c.id !== cid); save(KEY_CLIENTS, clients); },
    newId: id,
    getSettings: () => load(KEY_SETTINGS, { fuel: 1.85, consumption: 7.5, stopTime: 15, hourly: 0 }),
    saveSettings: (s) => save(KEY_SETTINGS, s),

    /* ---- Tournées sauvegardées ---- */
    // tour : { id, name, recurring, depot, stopIds[], returnDepot, settings, progress:{stopId:status}, updatedAt }
    getTours: () => load(KEY_TOURS, []),
    getTour(tid) { return load(KEY_TOURS, []).find(t => t.id === tid); },
    saveTour(tour) {
      const tours = load(KEY_TOURS, []);
      tour.updatedAt = Date.now();
      if (tour.id) {
        const i = tours.findIndex(t => t.id === tour.id);
        if (i >= 0) tours[i] = tour; else tours.push(tour);
      } else {
        tour.id = 't' + id();
        tours.push(tour);
      }
      save(KEY_TOURS, tours);
      return tour;
    },
    removeTour(tid) { save(KEY_TOURS, load(KEY_TOURS, []).filter(t => t.id !== tid)); },
    // Met à jour le statut terrain d'un arrêt d'une tournée
    setStopStatus(tid, stopId, status) {
      const tours = load(KEY_TOURS, []);
      const t = tours.find(x => x.id === tid);
      if (!t) return;
      t.progress = t.progress || {};
      if (status) t.progress[stopId] = status; else delete t.progress[stopId];
      save(KEY_TOURS, tours);
    },
    resetTourProgress(tid) {
      const tours = load(KEY_TOURS, []);
      const t = tours.find(x => x.id === tid);
      if (t) { t.progress = {}; save(KEY_TOURS, tours); }
    }
  };
})();
