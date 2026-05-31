/* geo.js — géocodage (Nominatim) + itinéraire routier réel (OSRM) */
const Geo = (() => {
  const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
  const OSRM = 'https://router.project-osrm.org/route/v1/driving';

  // Adresse -> { lat, lng, label }
  async function geocode(address) {
    const url = `${NOMINATIM}?format=json&limit=1&q=${encodeURIComponent(address)}`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'fr' } });
    if (!res.ok) throw new Error('Géocodage indisponible');
    const data = await res.json();
    if (!data.length) throw new Error('Adresse introuvable');
    return { lat: +data[0].lat, lng: +data[0].lon, label: data[0].display_name };
  }

  // Liste de points [{lat,lng}] -> itinéraire routier réel via OSRM
  // Retourne { distance (m), duration (s), geometry (GeoJSON), legs:[{distance,duration}] }
  async function route(points) {
    if (points.length < 2) throw new Error('Au moins 2 points requis');
    const coords = points.map(p => `${p.lng},${p.lat}`).join(';');
    const url = `${OSRM}/${coords}?overview=full&geometries=geojson&annotations=duration,distance`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Service de routage indisponible');
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes.length) throw new Error('Itinéraire introuvable');
    const r = data.routes[0];
    return {
      distance: r.distance,
      duration: r.duration,
      geometry: r.geometry,
      legs: r.legs.map(l => ({ distance: l.distance, duration: l.duration }))
    };
  }

  // Distance à vol d'oiseau (Haversine, mètres) — utilisée pour l'optimisation
  function haversine(a, b) {
    const R = 6371000, toRad = x => x * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  // Optimisation simple : algorithme du plus proche voisin
  function optimizeOrder(depot, stops) {
    const remaining = [...stops];
    const ordered = [];
    let current = depot;
    while (remaining.length) {
      let bi = 0, bd = Infinity;
      remaining.forEach((s, i) => {
        const d = haversine(current, s);
        if (d < bd) { bd = d; bi = i; }
      });
      current = remaining[bi];
      ordered.push(remaining.splice(bi, 1)[0]);
    }
    return ordered;
  }

  return { geocode, route, haversine, optimizeOrder };
})();
