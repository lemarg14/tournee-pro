/* route.js — moteur de calcul : heures, km et coût (carburant + main d'œuvre) */
const RouteCalc = (() => {

  // Calcule l'ensemble des indicateurs d'une tournée.
  // routeData : résultat de Geo.route (distance m, duration s, legs[])
  // settings : { fuel €/L, consumption L/100km, stopTime min, hourly €/h }
  // nbStops : nombre d'arrêts clients
  function compute(routeData, settings, nbStops) {
    const km = routeData.distance / 1000;
    const drivingMin = routeData.duration / 60;
    const serviceMin = nbStops * settings.stopTime;
    const totalMin = drivingMin + serviceMin;

    const liters = km * (settings.consumption / 100);
    const fuelCost = liters * settings.fuel;
    const laborCost = (totalMin / 60) * settings.hourly;
    const totalCost = fuelCost + laborCost;

    return {
      km,
      drivingMin,
      serviceMin,
      totalMin,
      liters,
      fuelCost,
      laborCost,
      totalCost
    };
  }

  // Formatage
  const fmtKm = m => (m / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' km';
  const fmtKmN = km => km.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' km';
  const fmtEur = v => v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const fmtL = v => v.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' L';

  function fmtDuration(min) {
    const h = Math.floor(min / 60), m = Math.round(min % 60);
    return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m} min`;
  }

  return { compute, fmtKm, fmtKmN, fmtEur, fmtL, fmtDuration };
})();
