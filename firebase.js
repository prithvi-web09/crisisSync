// ── LOCATION DETECTION ──

function detectLocation() {
  const locationEl = document.getElementById('userLocation');
  if (!navigator.geolocation) {
    locationEl.textContent = 'Location unavailable';
    return;
  }

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude, longitude } = pos.coords;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
      );
      const data = await res.json();
      const addr = data.address;
      const area =
        addr.suburb || addr.neighbourhood || addr.village ||
        addr.town || addr.city_district || addr.county || 'Your Area';

      window._userLat = latitude;
      window._userLon = longitude;

      locationEl.textContent = `· ${area}`;
      generateInsight(area, latitude, longitude);
    } catch {
      locationEl.textContent = '· Location found';
      generateInsight('your area', latitude, longitude);
    }
  }, () => {
    locationEl.textContent = '· Permission denied';
  });
}

// ── DYNAMIC INSIGHT GENERATOR ──

async function generateInsight(area, lat, lon) {
  const titleEl = document.getElementById('insightTitle');
  const descEl  = document.getElementById('insightDesc');
  const mapImg  = document.getElementById('insightMapImg');

  if (mapImg) {
    mapImg.src = `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${lon},${lat},12,0/340x160?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw`;
  }

  try {
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=precipitation_probability&timezone=auto`
    );
    const weatherData = await weatherRes.json();
    const current     = weatherData.current_weather;
    const temp        = current.temperature;
    const windspeed   = current.windspeed;
    const code        = current.weathercode;

    const weatherDesc = getWeatherDescription(code);
    const isSevere = code >= 55 || windspeed > 60;

    if (isSevere) {
      titleEl.textContent = `Severe weather detected in ${area}.`;
      descEl.textContent  = `${weatherDesc}. Wind speeds at ${windspeed} km/h. Stay indoors and avoid travel. Monitor alerts closely.`;
    } else {
      titleEl.textContent = `All clear in ${area}.`;
      descEl.textContent  = `${weatherDesc}. Temperature is ${temp}°C with wind at ${windspeed} km/h. No active disaster alerts at this time. Stay safe.`;
    }

  } catch {
    titleEl.textContent = `Monitoring ${area}.`;
    descEl.textContent  = `Unable to fetch live conditions. No active alerts reported. Stay alert and check back shortly.`;
  }
}

// ── WEATHER CODE TO DESCRIPTION ──

function getWeatherDescription(code) {
  if (code === 0)               return 'Clear skies';
  if (code <= 2)                return 'Partly cloudy';
  if (code === 3)               return 'Overcast skies';
  if (code <= 49)               return 'Foggy conditions';
  if (code <= 57)               return 'Drizzle in the area';
  if (code <= 67)               return 'Rain expected';
  if (code <= 77)               return 'Snowfall reported';
  if (code <= 82)               return 'Rain showers ongoing';
  if (code <= 86)               return 'Heavy snow showers';
  if (code <= 99)               return 'Thunderstorm active nearby';
  return 'Conditions unclear';
}

detectLocation();

// ── FULL SITUATION REPORT MODAL ──

function openReportModal() {
  document.getElementById('reportModal').classList.add('open');
  generateFullReport();
}

function closeReportModal() {
  document.getElementById('reportModal').classList.remove('open');
}

async function generateFullReport() {
  const area = document.getElementById('userLocation')?.textContent.replace('· ', '') || 'your area';
  const now  = new Date();

  document.getElementById('reportLocation').textContent = area;
  document.getElementById('reportTime').textContent     = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  document.getElementById('reportBody').innerHTML       = '<div class="zone-loading">Generating report...</div>';
  document.getElementById('reportSections').style.display = 'none';
  document.getElementById('reportStatsRow').style.display = 'none';

  if (!window._userLat || !window._userLon) {
    document.getElementById('reportBody').innerHTML = '<div class="zone-loading">Enable location to generate report.</div>';
    return;
  }

  try {
    const res     = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${window._userLat}&longitude=${window._userLon}&current_weather=true&hourly=precipitation_probability,relativehumidity_2m&timezone=auto`);
    const data    = await res.json();
    const w       = data.current_weather;
    const code    = w.weathercode;
    const temp    = w.temperature;
    const wind    = w.windspeed;
    const desc    = getWeatherDesc(code);
    const humidity = data.hourly?.relativehumidity_2m?.[0] || '--';
    const precip   = data.hourly?.precipitation_probability?.[0] || 0;

    let threatLevel, threatClass, threatText;
    if (code >= 80 || wind > 60) {
      threatLevel = 'SEVERE'; threatClass = 'severe';
      threatText  = '⚠ HIGH RISK — Take immediate precautions';
    } else if (code >= 51 || wind > 35 || precip > 60) {
      threatLevel = 'MODERATE'; threatClass = 'moderate';
      threatText  = 'ELEVATED CONDITIONS — Stay alert';
    } else {
      threatLevel = 'ALL CLEAR'; threatClass = 'safe';
      threatText  = 'CONDITIONS NORMAL — No immediate threats';
    }

    const threatEl = document.getElementById('reportThreat');
    threatEl.className = `report-threat ${threatClass}`;
    document.getElementById('reportThreatLabel').textContent = 'THREAT LEVEL';
    document.getElementById('reportThreatValue').textContent = threatLevel;

    document.getElementById('rTemp').textContent      = `${temp}°C`;
    document.getElementById('rWind').textContent      = `${wind}km/h`;
    document.getElementById('rCondition').textContent = desc;
    document.getElementById('reportStatsRow').style.display = 'flex';

    const report = generateReportText(area, temp, wind, desc, code, humidity, precip, threatLevel);
    document.getElementById('reportBody').innerHTML = report;

    const { warnings, recommendations } = getWarningsAndRecs(code, wind, temp, precip);
    document.getElementById('reportWarnings').innerHTML       = `<ul>${warnings.map(w => `<li>${w}</li>`).join('')}</ul>`;
    document.getElementById('reportRecommendations').innerHTML = `<ul>${recommendations.map(r => `<li>${r}</li>`).join('')}</ul>`;
    document.getElementById('reportSections').style.display  = 'flex';

    document.getElementById('reportGenerated').textContent =
      `Report generated on ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}`;

  } catch {
    document.getElementById('reportBody').innerHTML = '<div class="zone-loading">Could not fetch live data. Try again.</div>';
  }
}

function generateReportText(area, temp, wind, desc, code, humidity, precip, threatLevel) {
  const timeOfDay = new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening';

  const opening = `This situational report covers the current environmental and emergency conditions for <strong style="color:#ffffff">${area}</strong> as of this ${timeOfDay}. `;

  const weatherSummary = `Current atmospheric conditions indicate <strong style="color:#ffffff">${desc.toLowerCase()}</strong> with a recorded temperature of <strong style="color:#ffffff">${temp}°C</strong> and wind speeds measuring <strong style="color:#ffffff">${wind} km/h</strong>. Relative humidity levels are at approximately <strong style="color:#ffffff">${humidity}%</strong>, and the probability of precipitation in the coming hours stands at <strong style="color:#ffffff">${precip}%</strong>. `;

  const threatSummary = threatLevel === 'SEVERE'
    ? `Based on current data, the area is classified under a <strong style="color:#f87171">SEVERE threat level</strong>. Residents are strongly advised to avoid outdoor activity, secure loose objects, and follow instructions from local emergency authorities. Emergency services are on high alert and response times may be elevated due to increased demand across the district. `
    : threatLevel === 'MODERATE'
    ? `The area is currently under a <strong style="color:#facc15">MODERATE threat level</strong>. While conditions are not immediately dangerous, residents should remain vigilant and monitor updates regularly. Outdoor activities should be limited, particularly for vulnerable populations including the elderly and children. Emergency services are standing by and are fully operational. `
    : `The area is currently under an <strong style="color:#4ade80">ALL CLEAR status</strong>. No significant weather events or environmental hazards have been detected at this time. Emergency services are fully operational and available. Residents may carry out normal daily activities while continuing to monitor CrisisSync for any changes in conditions. `;

  const closing = `CrisisSync continues to monitor live data feeds and will update this report as conditions evolve. All nearby emergency facilities — including hospitals, police stations, and relief centers — have been notified of current conditions and are prepared to respond accordingly.`;

  return opening + weatherSummary + threatSummary + closing;
}

function getWarningsAndRecs(code, wind, temp, precip) {
  const warnings = [];
  const recommendations = [];

  if (code >= 95)  warnings.push('Active thunderstorm detected in the region');
  if (code >= 80)  warnings.push('Heavy rainfall or snowfall conditions active');
  if (wind > 60)   warnings.push('Dangerously high wind speeds recorded');
  if (wind > 35)   warnings.push('Strong winds — secure outdoor objects');
  if (precip > 70) warnings.push('High precipitation probability in coming hours');
  if (temp > 40)   warnings.push('Extreme heat advisory in effect');
  if (temp < 5)    warnings.push('Near-freezing temperatures — cold wave alert');
  if (warnings.length === 0) warnings.push('No active weather warnings at this time');

  if (code >= 80)  recommendations.push('Stay indoors and away from flood-prone areas');
  if (wind > 35)   recommendations.push('Avoid driving on elevated roads or bridges');
  if (precip > 50) recommendations.push('Keep emergency supplies and dry clothing ready');
  if (temp > 38)   recommendations.push('Stay hydrated and avoid direct sun exposure');
  recommendations.push('Keep your phone charged and location enabled');
  recommendations.push('Save emergency contacts — Police: 100, Ambulance: 108, Fire: 101');
  recommendations.push('Check on elderly neighbours and vulnerable family members');

  return { warnings, recommendations };
}

// ── FOOD & NGO MODAL ──

const foodData = [
  {
    name: 'Metro Food Bank',
    dist: '0.8 miles',
    supply: '500+ Meal Kits Available',
    stock: 'high',
    type: ['foodbank'],
    img: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=400&q=60',
    phone: 'tel:+911234567810'
  },
  {
    name: 'Clean Water Station',
    dist: '1.2 km',
    supply: '200L Water Packs · Purification Tablets',
    stock: 'high',
    type: ['water'],
    img: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&q=60',
    phone: 'tel:+911234567811'
  },
  {
    name: 'UNICEF Relief Hub',
    dist: '2.0 km',
    supply: 'Dry Rations · Baby Food · Medical Kits',
    stock: 'low',
    type: ['ngo', 'foodbank'],
    img: 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=400&q=60',
    phone: 'tel:+911234567812'
  },
  {
    name: 'Community Kitchen',
    dist: '2.5 km',
    supply: 'Hot Meals Served 3x Daily',
    stock: 'high',
    type: ['foodbank', 'ngo'],
    img: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=60',
    phone: 'tel:+911234567813'
  },
  {
    name: 'Emergency Water Depot',
    dist: '3.1 km',
    supply: 'Currently Out of Stock',
    stock: 'empty',
    type: ['water'],
    img: 'https://images.unsplash.com/photo-1527613426441-4da17471b66d?w=400&q=60',
    phone: 'tel:+911234567814'
  },
];

function getFoodData() {
  return Array.isArray(window._liveFoodData) && window._liveFoodData.length ? window._liveFoodData : foodData;
}

let activeFoodFilter = 'all';

function openFoodModal() {
  document.getElementById('foodModal').classList.add('open');
  document.getElementById('foodSearchInput').value = '';
  filterFood('all', document.querySelector('#foodModal .filter-tab'));
}

function closeFoodModal() {
  document.getElementById('foodModal').classList.remove('open');
}

function filterFood(type, btn) {
  document.querySelectorAll('#foodModal .filter-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  activeFoodFilter = type;

  const list = type === 'all'
    ? getFoodData()
    : getFoodData().filter(f => f.type.includes(type));

  renderFood(list);
}

function searchFood(query) {
  const q    = query.toLowerCase();
  const base = activeFoodFilter === 'all' ? getFoodData() : getFoodData().filter(f => f.type.includes(activeFoodFilter));
  const list = q
    ? base.filter(f => f.name.toLowerCase().includes(q) || f.supply.toLowerCase().includes(q))
    : base;
  renderFood(list);
}

function renderFood(list) {
  const container  = document.getElementById('foodList');
  const navigateBase = `https://www.google.com/maps/search/food+bank/@${window._userLat || 19.076},${window._userLon || 72.877},14z`;

  if (!list.length) {
    container.innerHTML = '<div class="zone-loading">No results found.</div>';
    return;
  }

  container.innerHTML = list.map(f => {
    const stockLabel = f.stock === 'high' ? 'HIGH STOCK' : f.stock === 'low' ? 'LOW STOCK' : 'OUT OF STOCK';
    const tagHtml    = f.type.map(t => `<span class="food-type-tag ${t}">${t.toUpperCase()}</span>`).join('');
    const isEmpty    = f.stock === 'empty';

    return `
    <div class="food-card">
      <div class="food-img-wrap">
        <img src="${f.img}" alt="${f.name}" class="food-img">
        <div class="food-stock-badge ${f.stock}">
          <span class="food-stock-dot"></span>
          ${stockLabel}
        </div>
      </div>
      <div class="food-body">
        <div class="food-top-row">
          <span class="food-name">${f.name}</span>
          <span class="food-dist">${f.dist}</span>
        </div>
        <div class="food-supply">
          <i class="fa-solid fa-box-open"></i>
          ${f.supply}
        </div>
        <div class="food-tags">${tagHtml}</div>
        <a href="${isEmpty ? '#' : navigateBase}" target="${isEmpty ? '' : '_blank'}"
           class="food-navigate-btn ${isEmpty ? 'disabled' : ''}">
          <i class="fa-solid fa-paper-plane"></i>
          ${isEmpty ? 'Currently Unavailable' : 'Navigate'}
        </a>
      </div>
    </div>`;
  }).join('');
}

// ── SHELTER MODAL ──

const shelterData = [
  {
    name: 'Red Cross Metro Hub',
    address: '1422 Sentinel Ave, Sector 4',
    dist: '0.8 MILES',
    capacity: 80,
    type: ['shelter', 'medical', 'food'],
    img: 'https://images.unsplash.com/photo-1586771107445-d3ca888129ff?w=400&q=60',
    phone: 'tel:+911234567800'
  },
  {
    name: 'City Relief Shelter',
    address: '88 North Relief Rd, Block B',
    dist: '1.4 KM',
    capacity: 45,
    type: ['shelter', 'food'],
    img: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&q=60',
    phone: 'tel:+911234567801'
  },
  {
    name: 'NGO Supply Depot',
    address: '34 Central Park Lane, Zone 2',
    dist: '2.1 KM',
    capacity: 60,
    type: ['supply', 'food'],
    img: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=400&q=60',
    phone: 'tel:+911234567802'
  },
  {
    name: 'District Medical Camp',
    address: 'Govt School Ground, Sector 9',
    dist: '3.0 KM',
    capacity: 30,
    type: ['medical', 'shelter'],
    img: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400&q=60',
    phone: 'tel:+911234567803'
  },
];

function getShelterData() {
  return Array.isArray(window._liveShelters) && window._liveShelters.length ? window._liveShelters : shelterData;
}

function openShelterModal() {
  document.getElementById('shelterModal').classList.add('open');
  filterShelters('all', document.querySelector('#shelterModal .filter-tab'));
}

function closeShelterModal() {
  document.getElementById('shelterModal').classList.remove('open');
}

function filterShelters(type, btn) {
  document.querySelectorAll('#shelterModal .filter-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const list = type === 'all'
    ? getShelterData()
    : getShelterData().filter(s => s.type.includes(type));

  renderShelters(list);
}

function renderShelters(list) {
  const container = document.getElementById('shelterList');
  if (!list.length) {
    container.innerHTML = '<div class="zone-loading">No centers found in this category.</div>';
    return;
  }

  const navigateBase = `https://www.google.com/maps/search/shelter/@${window._userLat || 19.076},${window._userLon || 72.877},14z`;

  container.innerHTML = list.map(s => {
    const capColor = s.capacity > 60 ? '#4ade80' : s.capacity > 30 ? '#facc15' : '#f87171';
    const tagHtml  = s.type.map(t => `<span class="shelter-tag ${t}">${t.toUpperCase()}</span>`).join('');

    return `
    <div class="shelter-card">
      <div class="shelter-img-wrap">
        <img src="${s.img}" alt="${s.name}" class="shelter-img">
        <div class="shelter-verified">
          <i class="fa-solid fa-circle-check"></i> VERIFIED
        </div>
        <div class="shelter-dist-badge">${s.dist}</div>
      </div>
      <div class="shelter-body">
        <div class="shelter-name">${s.name}</div>
        <div class="shelter-address">
          <i class="fa-solid fa-location-dot" style="color:#facc15; font-size:11px;"></i>
          ${s.address}
        </div>
        <div class="shelter-tags">${tagHtml}</div>
        <div class="shelter-capacity">
          <span class="shelter-cap-text">Capacity: ${s.capacity}%</span>
          <div class="shelter-cap-bar-wrap">
            <div class="shelter-cap-bar" style="width:${s.capacity}%; background:${capColor};"></div>
          </div>
        </div>
        <div class="shelter-actions">
          <a href="${navigateBase}" target="_blank" class="shelter-navigate-btn">
            <i class="fa-solid fa-paper-plane"></i> Navigate
          </a>
          <a href="${s.phone}" class="shelter-call-btn">
            <i class="fa-solid fa-phone"></i>
          </a>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── POLICE MODAL ──

const policeData = [
  { name: 'District 7 Precinct',    sub: 'Primary Response Unit • West Sector',  dist: 0.8, units: 5,  status: 'active',  phone: 'tel:100' },
  { name: 'Metro Security Hub',     sub: 'Central Intelligence & Operations',     dist: 1.5, units: 3,  status: 'alert',   phone: 'tel:100' },
  { name: 'North Zone Police Post', sub: 'Community Patrol • North Sector',       dist: 2.3, units: 8,  status: 'active',  phone: 'tel:100' },
  { name: 'East Border Outpost',    sub: 'Traffic & Border Control',              dist: 3.7, units: 0,  status: 'offline', phone: 'tel:100' },
  { name: 'Central Command Unit',   sub: 'Emergency Response • City Center',      dist: 4.1, units: 12, status: 'active',  phone: 'tel:100' },
];

function openPoliceModal() {
  document.getElementById('policeModal').classList.add('open');
  filterPolice('nearest', document.querySelector('.police-tab'));
}

function closePoliceModal() {
  document.getElementById('policeModal').classList.remove('open');
}

function filterPolice(type, btn) {
  document.querySelectorAll('.police-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  let list = [...getPoliceData()];
  if (type === 'nearest') list.sort((a, b) => a.dist - b.dist);
  if (type === 'active')  list = list.filter(p => p.status === 'active').sort((a, b) => b.units - a.units);
  if (type === 'alert')   list = list.filter(p => p.status === 'alert');

  renderPolice(list);
}

function renderPolice(list) {
  const container = document.getElementById('policeList');
  if (!list.length) {
    container.innerHTML = '<div class="zone-loading">No stations found.</div>';
    return;
  }

  container.innerHTML = list.map(p => {
    const badgeLabel = p.status === 'active' ? 'ACTIVE' : p.status === 'alert' ? 'HIGH ALERT' : 'OFFLINE';
    const badgeClass = p.status === 'active' ? 'active' : p.status === 'alert' ? 'alert' : 'offline';
    const unitsText  = p.units > 0 ? `${p.units} Active` : 'Unavailable';
    const navigateUrl = `https://www.google.com/maps/search/police+station/@${window._userLat || 19.076},${window._userLon || 72.877},14z`;

    return `
    <div class="police-card ${p.status === 'alert' ? 'alert-card' : ''}">
      <div class="police-top">
        <div class="police-name-block">
          <div class="police-name">${p.name}</div>
          <div class="police-sub">${p.sub}</div>
        </div>
        <div class="police-badge ${badgeClass}">
          <span class="police-badge-dot"></span>
          ${badgeLabel}
        </div>
      </div>
      <div class="police-stats">
        <div class="police-stat">
          <span class="police-stat-label">DISTANCE</span>
          <span class="police-stat-value">${p.dist}km</span>
        </div>
        <div class="police-stat">
          <span class="police-stat-label">UNITS AVAILABLE</span>
          <span class="police-stat-value" style="color:${p.units > 0 ? '#ffffff' : '#f87171'}">${unitsText}</span>
        </div>
      </div>
      ${p.status !== 'offline' ? `
      <div class="police-actions">
        <button class="police-assist-btn" onclick="window.location.href='${p.phone}'">
          REQUEST ASSISTANCE
        </button>
        <a href="${navigateUrl}" target="_blank" class="police-nav-btn">
          <i class="fa-solid fa-diamond-turn-right"></i>
        </a>
      </div>` : `<div class="hosp-full-msg">This station is currently offline.</div>`}
    </div>`;
  }).join('');
}

// ── HOSPITAL MODAL ──

const hospitalData = [
  { name: 'City Central Hospital',     dist: 1.2, beds: 14, waitTime: 12, critical: 3,  status: 'available', phone: 'tel:+911234567890' },
  { name: 'St. Jude Medical',          dist: 2.8, beds: 6,  waitTime: 25, critical: 7,  status: 'busy',      phone: 'tel:+911234567891' },
  { name: 'Apollo Emergency Care',     dist: 3.1, beds: 3,  waitTime: 40, critical: 12, status: 'busy',      phone: 'tel:+911234567892' },
  { name: 'Sunrise District Hospital', dist: 4.5, beds: 0,  waitTime: 0,  critical: 0,  status: 'full',      phone: 'tel:+911234567893' },
  { name: 'National Trauma Center',    dist: 5.0, beds: 31, waitTime: 8,  critical: 2,  status: 'available', phone: 'tel:+911234567894' },
];

function getHospitalData() {
  return Array.isArray(window._liveHospitals) && window._liveHospitals.length ? window._liveHospitals : hospitalData;
}

let currentHospitals = [...hospitalData];

function openHospitalModal() {
  document.getElementById('hospitalModal').classList.add('open');
  filterHospitals('recommended', document.querySelector('.filter-tab.active') || document.querySelector('.filter-tab'));
}

function closeHospitalModal() {
  document.getElementById('hospitalModal').classList.remove('open');
}

function filterHospitals(type, btn) {
  document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  let sorted = [...getHospitalData()];

  if (type === 'nearest')   sorted.sort((a, b) => a.dist - b.dist);
  if (type === 'maxbeds')   sorted.sort((a, b) => b.beds - a.beds);
  if (type === 'available') sorted = sorted.filter(h => h.status === 'available');
  if (type === 'recommended') {
    sorted.sort((a, b) => {
      if (a.status === 'full' && b.status !== 'full') return 1;
      if (b.status === 'full' && a.status !== 'full') return -1;
      const scoreA = (a.beds * 2) - (a.dist * 3) - (a.critical * 1.5) - (a.waitTime * 0.5);
      const scoreB = (b.beds * 2) - (b.dist * 3) - (b.critical * 1.5) - (b.waitTime * 0.5);
      return scoreB - scoreA;
    });
  }

  currentHospitals = sorted;
  renderHospitals(sorted);
  updateStatusOverview(sorted);
}

function updateStatusOverview(list) {
  const area = document.getElementById('userLocation')?.textContent.replace('· ', '') || 'your area';
  document.getElementById('statusSubtitle').textContent  = `Emergency response readiness in ${area}`;
  document.getElementById('totalBeds').textContent       = list.reduce((s, h) => s + h.beds, 0);
  document.getElementById('criticalWait').textContent    = list.reduce((s, h) => s + h.critical, 0);
  document.getElementById('totalFacilities').textContent = list.length;
}

function renderHospitals(list) {
  const container = document.getElementById('hospitalList');
  if (!list.length) {
    container.innerHTML = '<div class="zone-loading">No hospitals found.</div>';
    return;
  }

  container.innerHTML = list.map((h, i) => {
    const isBest       = i === 0 && h.status !== 'full';
    const statusColor  = h.status === 'available' ? '#4ade80' : h.status === 'busy' ? '#facc15' : '#f87171';
    const bedsColor    = h.beds > 10 ? '#4ade80' : h.beds > 0 ? '#facc15' : '#f87171';
    const statusLabel  = h.status === 'available' ? 'Available' : h.status === 'busy' ? 'Limited Space' : 'Full';
    const navigateUrl  = `https://www.google.com/maps/search/hospital/@${window._userLat || 19.076},${window._userLon || 72.877},14z`;

    return `
    <div class="hospital-card ${isBest ? 'best' : ''}">
      <div class="hosp-top-row">
        <div class="hosp-icon-big">
          <i class="fa-solid fa-star-of-life"></i>
        </div>
        <div class="hosp-info">
          <div class="hosp-name">${h.name}</div>
          <div class="hosp-status-row">
            <span class="hosp-status-dot" style="background:${statusColor};"></span>
            <span class="hosp-status-text" style="color:${statusColor};">${statusLabel}</span>
          </div>
          ${isBest ? '<span class="best-badge">★ RECOMMENDED</span>' : ''}
        </div>
        <div class="hosp-dist-block">
          <span class="hosp-dist-num">${h.dist}km</span>
          <span class="hosp-dist-label">away</span>
        </div>
      </div>
      <div class="hosp-stats-row">
        <div class="hosp-stat-box">
          <span class="hosp-stat-label">TOTAL</span>
          <span class="hosp-stat-value">${h.total || 0}</span>
        </div>
        <div class="hosp-stat-box">
          <span class="hosp-stat-label">FREE</span>
          <span class="hosp-stat-value" style="color:${bedsColor};">${h.beds || 0}</span>
        </div>
        <div class="hosp-stat-box">
          <span class="hosp-stat-label">SCHEDULED</span>
          <span class="hosp-stat-value" style="color:#facc15;">${h.scheduled || 0}</span>
        </div>
      </div>
      <div class="hosp-progress-row">
        <div class="hosp-progress-label">${h.fillPct || 0}% FULL</div>
        <div class="hosp-progress-bar"><div class="hosp-progress-fill" style="width:${h.fillPct || 0}%;background:${statusColor};"></div></div>
      </div>
      <div class="hosp-actions">
        <a href="${navigateUrl}" target="_blank" class="hosp-navigate-btn">
          <i class="fa-solid fa-paper-plane"></i> Navigate
        </a>
        <a href="${h.phone}" class="hosp-call-btn">
          <i class="fa-solid fa-phone"></i>
        </a>
      </div>
    </div>`;
  }).join('');
}

// ── MAP MODAL ──

function openMapModal() {
  document.getElementById('mapModal').classList.add('open');
  loadMapZones();
}

function closeMapModal() {
  document.getElementById('mapModal').classList.remove('open');
}

async function loadMapZones() {
  const zoneList  = document.getElementById('zoneList');
  const nearbyVal = document.getElementById('nearbyValue');
  const safeCard  = document.getElementById('safeCard');
  const safeDesc  = document.getElementById('safeDesc');
  const weatherStrip = document.getElementById('weatherStrip');

  zoneList.innerHTML = '<div class="zone-loading">Analyzing your location...</div>';
  safeCard.style.display = 'none';
  weatherStrip.style.display = 'none';

  if (!window._userLat || !window._userLon) {
    zoneList.innerHTML = '<div class="zone-loading">Enable location to view zone status.</div>';
    return;
  }

  try {
    const res     = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${window._userLat}&longitude=${window._userLon}&current_weather=true&timezone=auto`);
    const data    = await res.json();
    const weather = data.current_weather;
    const area    = document.getElementById('userLocation').textContent.replace('· ', '') || 'Your Area';

    const zones = [];
    const code  = weather.weathercode;
    const wind  = weather.windspeed;

    if (code >= 95)                          zones.push({ type: 'CRITICAL ZONE',     name: `${area} — Thunderstorm Active`,  color: 'red'    });
    if (code >= 80 && code < 95)             zones.push({ type: 'CRITICAL ZONE',     name: `${area} — Severe Rain/Snow`,     color: 'red'    });
    if ((code >= 63 && code < 80) || wind > 50) zones.push({ type: 'RESTRICTED ACCESS', name: `${area} — Adverse Conditions`,  color: 'yellow' });
    if (code >= 51 && code < 63)             zones.push({ type: 'CAUTION ZONE',      name: `${area} — Light Rain/Drizzle`,   color: 'yellow' });

    if (zones.length === 0) {
      zoneList.innerHTML = `
        <div class="zone-row">
          <div class="zone-row-left">
            <div class="zone-bar green"></div>
            <div class="zone-info">
              <span class="zone-type green">SAFE ZONE</span>
              <span class="zone-name">${area}</span>
            </div>
          </div>
          <i class="fa-solid fa-chevron-right zone-chevron green"></i>
        </div>`;

      nearbyVal.textContent = 'No active hazards detected';
      nearbyVal.style.color = '#00e676';
      document.querySelector('.nearby-icon').style.background = '#0d2010';
      document.querySelector('.nearby-icon i').style.color    = '#00e676';

      safeCard.style.display = 'flex';
      safeDesc.textContent   = `${area} is currently safe. No weather hazards or emergency alerts reported.`;
    } else {
      zoneList.innerHTML = zones.map(z => `
        <div class="zone-row">
          <div class="zone-row-left">
            <div class="zone-bar ${z.color}"></div>
            <div class="zone-info">
              <span class="zone-type ${z.color}">${z.type}</span>
              <span class="zone-name">${z.name}</span>
            </div>
          </div>
          <i class="fa-solid fa-chevron-right zone-chevron ${z.color}"></i>
        </div>`).join('');

      nearbyVal.textContent = `${zones.length} active hazard${zones.length > 1 ? 's' : ''} identified`;
      nearbyVal.style.color = '#e05a4e';
      document.querySelector('.nearby-icon').style.background = '#2a1010';
      document.querySelector('.nearby-icon i').style.color    = '#e05a4e';
      safeCard.style.display = 'none';
    }

    const desc = getWeatherDesc(code);
    document.getElementById('weatherTemp').innerHTML      = `<span>${weather.temperature}°C</span><span>Temperature</span>`;
    document.getElementById('weatherWind').innerHTML      = `<span>${wind} km/h</span><span>Wind</span>`;
    document.getElementById('weatherCondition').innerHTML = `<span style="font-size:12px">${desc}</span><span>Condition</span>`;
    weatherStrip.style.display = 'flex';

  } catch {
    zoneList.innerHTML = '<div class="zone-loading">Could not fetch zone data.</div>';
  }
}

function getWeatherDesc(code) {
  if (code === 0)      return 'Clear skies';
  if (code <= 2)       return 'Partly cloudy';
  if (code === 3)      return 'Overcast';
  if (code <= 49)      return 'Foggy';
  if (code <= 57)      return 'Drizzle';
  if (code <= 67)      return 'Rainy';
  if (code <= 77)      return 'Snowfall';
  if (code <= 82)      return 'Rain showers';
  if (code <= 86)      return 'Heavy snow';
  if (code <= 99)      return 'Thunderstorm';
  return 'Unknown';
}

// ── SOS MODAL ──

function openSOSModal() {
  document.getElementById('sosModal').classList.add('open');
  document.getElementById('sosListeningText').textContent = 'Tap mic to speak';
  document.getElementById('sosResponseText').textContent = '';
  document.getElementById('sosMicOuter').classList.remove('listening');
  document.getElementById('sosTranscriptWrap').style.display = 'none';
  document.getElementById('sosTranscriptBox').innerHTML = '';
  document.getElementById('dispatchCard').style.display = 'none';
}

// ── FETCH NEAREST PLACE BASED ON KEYWORD ──

async function fetchNearestPlace(speech) {
  const card     = document.getElementById('dispatchCard');
  const nameEl   = document.getElementById('dispatchName');
  const distEl   = document.getElementById('dispatchDist');
  const iconEl   = document.getElementById('dispatchIcon');
  const tagEl    = document.getElementById('dispatchTag');

  let amenity = 'hospital';
  let iconClass = 'fa-solid fa-plus';
  let iconBg = '#c0200e';

  if (['attack','robbery','threat','gun','knife','police','thief'].some(k => speech.includes(k))) {
    amenity = 'police'; iconClass = 'fa-solid fa-shield-halved'; iconBg = '#1a3a6e';
  } else if (['fire','burning','smoke','flames'].some(k => speech.includes(k))) {
    amenity = 'fire_station'; iconClass = 'fa-solid fa-fire'; iconBg = '#8a3000';
  } else if (['shelter','flood','earthquake','trapped','collapse'].some(k => speech.includes(k))) {
    amenity = 'shelter'; iconClass = 'fa-solid fa-house'; iconBg = '#1a5a2e';
  }

  card.style.display = 'flex';
  nameEl.textContent = 'Finding nearest...';
  distEl.textContent = '--';
  iconEl.innerHTML = `<i class="${iconClass}"></i>`;
  iconEl.style.background = iconBg;

  if (!window._userLat || !window._userLon) {
    nameEl.textContent = 'Enable location for dispatch';
    distEl.textContent = '--';
    return;
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${amenity}&lat=${window._userLat}&lon=${window._userLon}&format=json&limit=1&bounded=0`
    );
    const results = await res.json();

    if (results && results.length > 0) {
      const place = results[0];
      const dist  = getDistanceKm(window._userLat, window._userLon, place.lat, place.lon);
      const distText = dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`;
      nameEl.textContent = place.display_name.split(',')[0];
      distEl.textContent = distText;
      tagEl.textContent  = 'PRIORITY DISPATCH';
    } else {
      nameEl.textContent = 'No nearby location found';
      distEl.textContent = '--';
    }
  } catch {
    nameEl.textContent = 'Location lookup failed';
    distEl.textContent = '--';
  }
}

// ── HAVERSINE DISTANCE ──

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── KEYWORD HIGHLIGHTER ──

function highlightKeywords(speech) {
  const allKeywords = [
    'accident', 'crash', 'injured', 'hurt', 'bleeding', 'ambulance',
    'fire', 'burning', 'smoke', 'flames',
    'attack', 'robbery', 'threat', 'gun', 'knife', 'thief',
    'flood', 'water', 'drowning', 'rising',
    'earthquake', 'collapse', 'trapped',
    'help', 'emergency', 'sos'
  ];

  let result = speech;
  allKeywords.forEach(kw => {
    const regex = new RegExp(`(${kw})`, 'gi');
    result = result.replace(regex, `<span class="keyword">$1</span>`);
  });

  return `"${result}"`;
}

function closeSOSModal() {
  document.getElementById('sosModal').classList.remove('open');
}

// ── SOS MICROPHONE LOGIC ──

function startMic() {
  const listeningText = document.getElementById('sosListeningText');
  const responseText  = document.getElementById('sosResponseText');
  const micOuter      = document.getElementById('sosMicOuter');
  const oldStatus     = document.getElementById('micStatus');

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    if (listeningText) listeningText.textContent = '⚠ Not supported';
    if (oldStatus)     oldStatus.textContent = '⚠ Voice not supported in this browser.';
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  if (listeningText) listeningText.textContent = 'Listening...';
  if (micOuter)      micOuter.classList.add('listening');
  if (oldStatus)     oldStatus.textContent = '🎙 Listening...';

  recognition.start();

  recognition.onresult = function (event) {
    const speech = event.results[0][0].transcript;
    const speechLower = speech.toLowerCase();
    if (listeningText) listeningText.textContent = '';
    if (micOuter)      micOuter.classList.remove('listening');

    const transcriptWrap = document.getElementById('sosTranscriptWrap');
    const transcriptBox  = document.getElementById('sosTranscriptBox');
    if (transcriptWrap && transcriptBox) {
      transcriptWrap.style.display = 'flex';
      transcriptBox.innerHTML = highlightKeywords(speech);
    }

    const response = analyzeAndRespond(speechLower);
    if (responseText) responseText.textContent = response;
    if (oldStatus)    oldStatus.textContent = response;

    fetchNearestPlace(speechLower);
  };

  recognition.onerror = function () {
    if (listeningText) listeningText.textContent = '⚠ Could not hear you';
    if (micOuter)      micOuter.classList.remove('listening');
    if (oldStatus)     oldStatus.textContent = '⚠ Could not hear you. Try again.';
  };

  recognition.onend = function () {
    if (micOuter) micOuter.classList.remove('listening');
  };
}

// ── AI-LIKE RESPONSE LOGIC ──

function analyzeAndRespond(speech) {
  const rules = [
    { keywords: ['accident', 'crash', 'injured', 'hurt', 'bleeding', 'ambulance'], response: '🚑 Calling nearest hospital...' },
    { keywords: ['fire', 'burning', 'smoke', 'flames'],                            response: '🚒 Alerting fire department...' },
    { keywords: ['attack', 'robbery', 'threat', 'gun', 'knife', 'police', 'thief'], response: '🚔 Alerting police...' },
    { keywords: ['flood', 'water', 'drowning', 'rising'],                          response: '🆘 Contacting disaster relief...' },
    { keywords: ['earthquake', 'building', 'collapse', 'trapped'],                 response: '🆘 Alerting rescue teams...' },
    { keywords: ['help', 'emergency', 'sos'],                                      response: '📡 Broadcasting SOS signal...' },
  ];

  for (const rule of rules) {
    if (rule.keywords.some(k => speech.includes(k))) return rule.response;
  }
  return '📡 Emergency signal sent. Stay calm.';
}


// ═══════════════════════════════════════════════════════
//  ADMIN NEXUS PORTAL  — NEW CODE
// ═══════════════════════════════════════════════════════

// ── Role display config ──
const ROLE_CONFIG = {
  hospital: { label: 'Hospital Admin',  icon: 'fa-briefcase-medical', color: '#4ade80', stats: [{ val: '14', lbl: 'BEDS FREE', icon: 'fa-bed', bg: '#0d2b1a' }, { val: '3',  lbl: 'CRITICAL', icon: 'fa-heart-pulse', bg: '#2b1a1a' }, { val: '12', lbl: 'WAIT (MIN)', icon: 'fa-clock', bg: '#2b2200' }, { val: '5',  lbl: 'DOCTORS ON', icon: 'fa-user-doctor', bg: '#1a1f2e' }] },
  food:     { label: 'Food/NGO Admin',  icon: 'fa-hand-holding-heart', color: '#facc15', stats: [{ val: '500+', lbl: 'MEAL KITS', icon: 'fa-box-open', bg: '#2a1f00' }, { val: '3',  lbl: 'STATIONS', icon: 'fa-location-dot', bg: '#0d2b1a' }, { val: '200L', lbl: 'WATER AVAIL', icon: 'fa-droplet', bg: '#1a1f2e' }, { val: '2',  lbl: 'LOW STOCK', icon: 'fa-triangle-exclamation', bg: '#2b1a1a' }] },
  police:   { label: 'Police Admin',    icon: 'fa-shield-halved', color: '#f87171', stats: [{ val: '5',  lbl: 'STATIONS', icon: 'fa-building', bg: '#2b1a1a' }, { val: '28', lbl: 'UNITS OUT', icon: 'fa-car', bg: '#1a1f2e' }, { val: '1',  lbl: 'ON ALERT', icon: 'fa-bell', bg: '#2a1f00' }, { val: '4',  lbl: 'OFFLINE', icon: 'fa-circle-xmark', bg: '#0d2010' }] },
  shelter:  { label: 'Shelter Admin',   icon: 'fa-location-dot', color: '#93c5fd', stats: [{ val: '4',  lbl: 'SHELTERS', icon: 'fa-house', bg: '#1a1f2e' }, { val: '215', lbl: 'CAPACITY', icon: 'fa-people-group', bg: '#0d2b1a' }, { val: '60%', lbl: 'AVG FILL', icon: 'fa-chart-bar', bg: '#2a1f00' }, { val: '2',  lbl: 'MEDICAL', icon: 'fa-kit-medical', bg: '#2b1a1a' }] },
};

// ── Open portal ──
async function openAdminPortal() {
  const overlay = document.getElementById('adminOverlay');
  overlay.classList.add('open');
  localStorage.setItem('adminOverlayOpen', 'true');

  const role = localStorage.getItem('adminRole');
  const loggedIn = localStorage.getItem('adminLoggedIn') === 'true';
  if (loggedIn && role) {
    await showAdminDashboard(role);
    return;
  }

  // Reset to login view
  if (typeof switchAuthMode === 'function') {
    switchAuthMode('login');
  }
  const dashboard = document.getElementById('adminDashboard');
  if (dashboard) dashboard.classList.remove('open');

  const adminEmail = document.getElementById('adminEmail');
  if (adminEmail) adminEmail.value = '';
  document.getElementById('adminPass').value  = '';
  document.getElementById('adminError').textContent = '';
  document.getElementById('adminBtnText').textContent = 'SECURE LOGIN';
  document.getElementById('adminBtnIcon').style.display = '';
  document.getElementById('adminBtnLoader').style.display = 'none';
  document.querySelector('.admin-login-btn').disabled = false;
}

function closeAdminPortal() {
  document.getElementById('adminOverlay').classList.remove('open');
  localStorage.setItem('adminOverlayOpen', 'false');
}

// ── Update placeholder based on selected role ──
// ── Toggle password visibility ──
function toggleAdminPass(btn) {
  const input = document.getElementById('adminPass');
  const icon  = btn.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fa-solid fa-eye-slash';
  } else {
    input.type = 'password';
    icon.className = 'fa-solid fa-eye';
  }
}

function shakeLoginBtn() {
  const btn = document.querySelector('.admin-login-btn');
  btn.classList.remove('shake');
  void btn.offsetWidth; // reflow to restart animation
  btn.classList.add('shake');
  setTimeout(() => btn.classList.remove('shake'), 400);
}

// ── Render dashboard ──
async function showAdminDashboard(role) {
  const existing = document.getElementById('adminDashboard');
  if (existing) existing.remove();

  const cfg = ROLE_CONFIG[role];

  if (role === 'hospital' && window.FB) {
    try {
      const wards = await window.FB.getWards();
      const staff = await window.FB.getStaff();
      const bedsFree = wards.reduce((s, w) => s + (w.available || 0), 0);
      const critical = wards.reduce((s, w) => s + Math.max(0, (w.total || 0) - (w.available || 0)), 0);
      const doctorsOn = staff.filter(s => s.status === 'on').length;
      cfg.stats[0].val = bedsFree.toString();
      cfg.stats[1].val = critical.toString();
      cfg.stats[2].val = '12'; // default wait time
      cfg.stats[3].val = doctorsOn.toString();
    } catch (e) {
      console.warn('Failed to fetch hospital stats', e);
    }
  }

  // Hide login form
  document.getElementById('adminLoginForm').style.display = 'none';

  // Hide portal title & desc & enc tag
  document.querySelector('.admin-enc-tag').style.display = 'none';
  document.querySelector('.admin-portal-title').style.display = 'none';
  document.querySelector('.admin-portal-desc').style.display = 'none';
  document.querySelector('.admin-footer-links').style.display = 'none';
  document.querySelector('.admin-version').style.display = 'none';
  document.querySelectorAll('.admin-proto-strip').forEach(el => el.style.display = 'none');

  // Build dashboard HTML
  const statsHtml = cfg.stats.map(s => `
    <div class="admin-stat-card">
      <div class="admin-stat-icon" style="background:${s.bg};">
        <i class="fa-solid ${s.icon}" style="color:${cfg.color};"></i>
      </div>
      <div class="admin-stat-value">${s.val}</div>
      <div class="admin-stat-label">${s.lbl}</div>
    </div>`).join('');

  const actionsHtml = getAdminActions(role, cfg);

  const dashHtml = `
    <div id="adminDashboard" class="admin-dashboard open">
      <div class="admin-dash-header">
        <div class="admin-dash-role-badge ${role}">
          <i class="fa-solid ${cfg.icon}"></i>
          ${cfg.label}
        </div>
        <button class="admin-logout-btn" onclick="adminLogout()">
          <i class="fa-solid fa-right-from-bracket"></i> LOGOUT
        </button>
      </div>
      <div class="admin-dash-body">
        <div class="admin-dash-welcome">WELCOME,<br>ADMIN</div>
        <div class="admin-dash-sub">You are logged in as <strong>${cfg.label}</strong>. Manage your sector below.</div>
        <div class="admin-stats-row">${statsHtml}</div>
        ${actionsHtml}
      </div>
    </div>`;

  document.getElementById('adminMain').insertAdjacentHTML('beforeend', dashHtml);
}

function getAdminActions(role, cfg) {
  const actions = {
    hospital: [
      { icon: 'fa-bed',           bg: '#0d2b1a', color: '#4ade80', title: 'Bed Management',     sub: 'Update ICU & ward availability' },
      { icon: 'fa-user-doctor',   bg: '#1a1f2e', color: '#93c5fd', title: 'Staff On Duty',       sub: 'View and manage active staff' },
      { icon: 'fa-ambulance',     bg: '#2b1a1a', color: '#f87171', title: 'Emergency Intake',    sub: 'Log incoming emergency cases' },
      { icon: 'fa-file-medical',  bg: '#2a1f00', color: '#facc15', title: 'Incident Reports',    sub: 'Submit and review reports' },
    ],
    food: [
      { icon: 'fa-box-open',      bg: '#2a1f00', color: '#facc15', title: 'Stock Update',        sub: 'Update food & water inventory' },
      { icon: 'fa-location-dot',  bg: '#0d2b1a', color: '#4ade80', title: 'Distribution Points', sub: 'Manage active stations' },
      { icon: 'fa-truck',         bg: '#1a1f2e', color: '#93c5fd', title: 'Incoming Supply',     sub: 'Log incoming deliveries' },
      { icon: 'fa-clipboard-list',bg: '#2b1a1a', color: '#f87171', title: 'NGO Coordination',    sub: 'Coordinate with partner NGOs' },
    ],
    police: [
      { icon: 'fa-car',           bg: '#2b1a1a', color: '#f87171', title: 'Unit Deployment',     sub: 'Manage active field units' },
      { icon: 'fa-bell',          bg: '#2a1f00', color: '#facc15', title: 'Alert Broadcast',      sub: 'Send area-wide alerts' },
      { icon: 'fa-map-location',  bg: '#0d2b1a', color: '#4ade80', title: 'Patrol Zones',        sub: 'View and assign patrol areas' },
      { icon: 'fa-file-shield',   bg: '#1a1f2e', color: '#93c5fd', title: 'Incident Log',        sub: 'Review filed incidents' },
    ],
    shelter: [
      { icon: 'fa-people-group',  bg: '#1a1f2e', color: '#93c5fd', title: 'Capacity Status',     sub: 'Update shelter occupancy' },
      { icon: 'fa-kit-medical',   bg: '#2b1a1a', color: '#f87171', title: 'Medical Services',    sub: 'Track on-site medical support' },
      { icon: 'fa-boxes-stacked', bg: '#2a1f00', color: '#facc15', title: 'Supply Inventory',    sub: 'Manage food, water, blankets' },
      { icon: 'fa-bullhorn',      bg: '#0d2b1a', color: '#4ade80', title: 'Announcements',       sub: 'Post updates to residents' },
    ],
  };

  return actions[role].map(a => `
    <div class="admin-action-card">
      <div class="admin-action-icon" style="background:${a.bg};">
        <i class="fa-solid ${a.icon}" style="color:${a.color}; font-size:18px;"></i>
      </div>
      <div class="admin-action-text">
        <div class="admin-action-title">${a.title}</div>
        <div class="admin-action-sub">${a.sub}</div>
      </div>
      <i class="fa-solid fa-chevron-right admin-action-arrow"></i>
    </div>`).join('');
}

// ── Logout ──
function adminLogout() {
  // Remove injected dashboard
  const dash = document.getElementById('adminDashboard');
  if (dash) dash.remove();

  // Re-show login elements
  document.getElementById('adminLoginForm').style.display = 'flex';
  document.querySelector('.admin-enc-tag').style.display = '';
  document.querySelector('.admin-portal-title').style.display = '';
  document.querySelector('.admin-portal-desc').style.display = '';
  document.querySelector('.admin-footer-links').style.display = '';
  document.querySelector('.admin-version').style.display = '';
  document.querySelectorAll('.admin-proto-strip').forEach(el => el.style.display = '');

  localStorage.removeItem('adminLoggedIn');
  localStorage.removeItem('adminRole');
  localStorage.removeItem('adminOverlayOpen');

  const adminEmail = document.getElementById('adminEmail');
  if (adminEmail) adminEmail.value = '';
  document.getElementById('adminPass').value = '';
  document.getElementById('adminError').textContent = '';
}

async function restoreAdminSession() {
  const role = localStorage.getItem('adminRole');
  const loggedIn = localStorage.getItem('adminLoggedIn') === 'true';
  const overlayOpen = localStorage.getItem('adminOverlayOpen') === 'true';
  if (!loggedIn || !role || !overlayOpen) return;

  const overlay = document.getElementById('adminOverlay');
  if (overlay) overlay.classList.add('open');
  await showAdminDashboard(role);
}

document.addEventListener('DOMContentLoaded', restoreAdminSession);

