const GEMINI_API_KEY = 'AIzaSyBKMMbHxXk-dDLynNl4fTKygf0ngp5RzPk';
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const AGENT_REQUEST_TIMEOUT_MS = 12000;

let agentMessages = [];
let agentLiveNearest = {
  hospital: null,
  police: null,
  shelter: null,
  food: null
};
let crisisState = {
  active: false,
  dispatched: false,
  type: null,
  summary: '',
  institutionName: '',
  location: '',
  lastQuestion: '',
  lastAdvice: '',
  notes: []
};

function getAgentResources() {
  const hospitals =
    typeof getHospitalData === 'function' ? getHospitalData() :
    typeof hospitalData !== 'undefined' ? hospitalData : [];

  const shelters =
    typeof getShelterData === 'function' ? getShelterData() :
    typeof shelterData !== 'undefined' ? shelterData : [];

  const police =
    typeof getPoliceData === 'function' ? getPoliceData() :
    typeof policeData !== 'undefined' ? policeData : [];

  const food =
    typeof getFoodData === 'function' ? getFoodData() :
    typeof foodData !== 'undefined' ? foodData : [];

  return { hospitals, shelters, police, food };
}

function getVerifiedResources() {
  const { hospitals, shelters, police, food } = getAgentResources();

  return {
    hospital: hospitals[0] || null,
    police: police[0] || null,
    shelter: shelters[0] || null,
    food: food[0] || null
  };
}

function formatResource(item) {
  if (!item) return 'none';

  const extras = [
    item.dist || '',
    item.status || item.stock || '',
    item.address || item.sub || item.supply || ''
  ].filter(Boolean).join(', ');

  return extras ? `${item.name} (${extras})` : item.name;
}

async function fetchNearestPlaceByType(type) {
  if (!window._userLat || !window._userLon) return null;

  const config = {
    hospital: { q: 'hospital', fallbackName: 'Nearby Hospital' },
    police: { q: 'police station', fallbackName: 'Nearby Police Station' },
    shelter: { q: 'shelter', fallbackName: 'Nearby Shelter' },
    food: { q: 'food bank', fallbackName: 'Nearby Food Point' }
  };

  const current = config[type];
  if (!current) return null;

  try {
    const delta = 0.08;
    const left = window._userLon - delta;
    const right = window._userLon + delta;
    const top = window._userLat + delta;
    const bottom = window._userLat - delta;

    const url =
      `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(current.q)}` +
      `&format=jsonv2&limit=10&bounded=1` +
      `&viewbox=${left},${top},${right},${bottom}`;

    const res = await fetch(url, {
      headers: {
        Accept: 'application/json'
      }
    });

    if (!res.ok) return null;

    const results = await res.json();
    if (!Array.isArray(results) || !results.length) return null;

    const nearest = results
      .map((place) => {
        const dist = typeof getDistanceKm === 'function'
          ? getDistanceKm(
              window._userLat,
              window._userLon,
              parseFloat(place.lat),
              parseFloat(place.lon)
            )
          : null;

        return {
          name: place.display_name?.split(',')[0] || current.fallbackName,
          dist: dist == null ? 'unknown distance' : (dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`),
          status: 'live nearest',
          address: place.display_name || ''
        };
      })
      .sort((a, b) => {
        const aDist = typeof parseDistance === 'function' ? parseDistance(a.dist) : 999999;
        const bDist = typeof parseDistance === 'function' ? parseDistance(b.dist) : 999999;
        return aDist - bDist;
      })[0];

    return nearest || null;
  } catch {
    return null;
  }
}

async function refreshLiveNearestResources() {
  const [hospital, police, shelter, food] = await Promise.all([
    fetchNearestPlaceByType('hospital'),
    fetchNearestPlaceByType('police'),
    fetchNearestPlaceByType('shelter'),
    fetchNearestPlaceByType('food')
  ]);

  agentLiveNearest = { hospital, police, shelter, food };
}

function buildAgentSystemPrompt() {
  const area = document.getElementById('userLocation')?.textContent.replace('· ', '') || 'Unknown area';
  const verified = getVerifiedResources();
  const threatVal = document.getElementById('reportThreatValue')?.textContent;
  const threat = threatVal && threatVal !== '--' ? threatVal : 'Unknown';
  const preciseLocation = window._userExactLocation || (window._userLat && window._userLon
    ? `GPS: ${Number(window._userLat).toFixed(6)}, ${Number(window._userLon).toFixed(6)}`
    : 'Unknown');

  return `You are CrisisSync AI Crisis Agent, a real-time emergency-support chatbot.

You must judge the user's situation intelligently and decide which kind of help is most appropriate:
- hospital
- police
- shelter
- food/NGO

You are given two kinds of institutions:
1. Suggestion = nearest real institution from the user's live location
2. Verified = institution stored inside CrisisSync

Use the nearest real institution as the primary operational suggestion when relevant.
Mention the verified institution separately when it adds trust or clarity.
Do not invent institutions outside the data below.

User location: ${area}
Precise victim location: ${preciseLocation}
Threat level: ${threat}

Nearest hospital suggestion: ${formatResource(agentLiveNearest.hospital)}
Verified hospital: ${formatResource(verified.hospital)}

Nearest police suggestion: ${formatResource(agentLiveNearest.police)}
Verified police: ${formatResource(verified.police)}

Nearest shelter suggestion: ${formatResource(agentLiveNearest.shelter)}
Verified shelter: ${formatResource(verified.shelter)}

Nearest food/NGO suggestion: ${formatResource(agentLiveNearest.food)}
Verified food/NGO: ${formatResource(verified.food)}

Instructions:
- Write a natural chatbot response, not a template.
- Decide the best type of help based on the user’s message.
- If the situation is dangerous, state the immediate action first.
- In SOS mode, do not begin with sympathy-only lines.
- In SOS mode, the first sentence must tell the victim what kind of help they need right now.
- For accidents, injuries, bleeding, burns, breathing trouble, chest pain, or fainting, direct them to hospital help immediately.
- For assault, threats, stalking, kidnapping, robbery, harassment, or danger from another person, direct them to police help immediately.
- Mention the nearest recommended institution by name when available.
- Tell the victim to use DISPATCH NOW if they cannot safely travel.
- Be calm, clear, practical, and concise.
- Do not use markdown bullets unless necessary.
- End with exactly these final 3 lines:
ALERT: one-line summary of the victim's issue in plain English, under 120 characters.
DISPATCH_TYPE: one of hospital, police, shelter, food.
DISPATCH: the single best institution or resource recommendation.`;
}

async function fetchGeminiReply(userText) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AGENT_REQUEST_TIMEOUT_MS);

  try {
    const recentMessages = agentMessages.slice(-8).map((msg) => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: msg.parts
    }));

    const body = {
      systemInstruction: {
        parts: [{ text: buildAgentSystemPrompt() }]
      },
      contents: [
        ...recentMessages,
        { role: 'user', parts: [{ text: userText }] }
      ],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 280,
        topP: 0.9,
        topK: 32
      }
    };

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message = data?.error?.message || `HTTP ${res.status}`;
      const err = new Error(message);
      err.status = res.status;
      throw err;
    }

    const reply = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('')
      .trim();

    if (!reply) {
      throw new Error('Empty Gemini response');
    }

    return reply;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchGeminiReplyWithRetry(userText) {
  try {
    return await fetchGeminiReply(userText);
  } catch (error) {
    const message = (error.message || '').toLowerCase();
    const isQuotaError = error.status === 429 || /quota|rate limit|limit/i.test(message);
    const shouldRetry =
      !isQuotaError &&
      (error.name === 'AbortError' || error.status === 500 || error.status === 503);

    if (isQuotaError) {
      throw new Error('Gemini quota or rate-limit reached. AI is temporarily unavailable. Please try again later.');
    }

    if (!shouldRetry) {
      throw error;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
    return fetchGeminiReply(userText);
  }
}

function openAgentModal(allowAutoSend = true) {
  document.getElementById('agentOverlay').classList.add('open');
  updateAgentContextStrip();

  if (allowAutoSend && agentMessages.length === 0 && window._lastSOSSpeech) {
    setTimeout(() => agentQuickSend(`I said: "${window._lastSOSSpeech}"`), 400);
  }
}

function closeAgentModal() {
  document.getElementById('agentOverlay').classList.remove('open');
}

function updateAgentContextStrip() {
  const verified = getVerifiedResources();

  const locationEl = document.getElementById('agentCtxLocation');
  const weatherEl = document.getElementById('agentCtxWeather');
  const threatEl = document.getElementById('agentCtxThreat');

  if (locationEl) {
    locationEl.textContent = agentLiveNearest.hospital
      ? `🏥 Suggestion: ${agentLiveNearest.hospital.name}`
      : '🏥 Suggestion loading';
  }

  if (weatherEl) {
    weatherEl.textContent = verified.hospital
      ? `✅ Verified: ${verified.hospital.name}`
      : '✅ Verified loading';
  }

  const threatVal = document.getElementById('reportThreatValue')?.textContent;
  if (threatEl) {
    threatEl.textContent =
      threatVal && threatVal !== '--' ? `🛡 ${threatVal}` : '🛡 Assessing...';
  }
}

function agentQuickSend(text) {
  document.getElementById('agentQuickPrompts').style.display = 'none';
  document.getElementById('agentTextInput').value = text;
  agentSendMessage();
}

function getFallbackDispatchType(userText) {
  const detected = typeof analyzeAndRespond === 'function'
    ? analyzeAndRespond(String(userText || '').toLowerCase())
    : null;
  if (!detected) return 'hospital';
  if (detected.type === 'police') return 'police';
  if (detected.type === 'hospital') return 'hospital';
  if (detected.type === 'fire' || detected.type === 'disaster' || detected.type === 'rescue') return 'shelter';
  return 'hospital';
}

function getNearestInstitutionForType(type) {
  return getFirebaseDispatchInstitution(type) || agentLiveNearest[type] || null;
}

function buildVictimGuidance(type, institutionName, summary) {
  if (type === 'police') {
    return `You need police help right now for ${summary}. Go to or contact ${institutionName} immediately, move to the safest public place you can reach, and use DISPATCH NOW if you cannot get there safely.`;
  }
  if (type === 'hospital') {
    return `You need hospital care right now for ${summary}. Go to or contact ${institutionName} immediately, avoid unnecessary movement if you are badly hurt, and use DISPATCH NOW if you cannot travel safely.`;
  }
  if (type === 'shelter') {
    return `You need safe shelter support right now. Go to or contact ${institutionName} and use DISPATCH NOW if you need responders to reach your location.`;
  }
  return `You need urgent relief support right now. Go to or contact ${institutionName} and use DISPATCH NOW if you cannot safely reach help yourself.`;
}

function buildVictimFollowUp(type, institutionName) {
  const location = getPreciseVictimLocation();
  if (type === 'police') {
    return `Your exact location is ${location}. If the threat is still nearby, avoid confrontation and keep your phone with you while ${institutionName} is contacted.`;
  }
  if (type === 'hospital') {
    return `Your exact location is ${location}. If there is heavy bleeding, unconsciousness, or trouble breathing, stay where you are and use DISPATCH NOW so ${institutionName} receives your SOS alert.`;
  }
  if (type === 'shelter') {
    return `Your exact location is ${location}. Stay in the safest covered place you can find until ${institutionName} or local responders can assist.`;
  }
  return `Your exact location is ${location}. Keep your phone with you and be ready to receive support from ${institutionName}.`;
}

function buildStructuredSOSReply(aiResponse, userText) {
  const aiSummary = extractTaggedLine(aiResponse, 'ALERT:');
  const aiType = extractTaggedLine(aiResponse, 'DISPATCH_TYPE:').toLowerCase();
  const recommendation = extractTaggedLine(aiResponse, 'DISPATCH:');
  const fallbackType = getFallbackDispatchType(userText);
  const type = aiType || fallbackType;
  const institution = getNearestInstitutionForType(type);
  const institutionName = (institution && institution.name) || recommendation || ('nearest ' + type);
  const summary = String(aiSummary || userText || 'emergency')
    .replace(/^i said:\s*/i, '')
    .replace(/^["']|["']$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 120);
  setPendingCrisisCase(type, summary, institutionName);

  return [
    buildVictimGuidance(type, institutionName, summary),
    buildVictimFollowUp(type, institutionName),
    `ALERT: ${summary}`,
    `DISPATCH_TYPE: ${type}`,
    `DISPATCH: ${institutionName}`
  ].join('\n');
}

function buildHospitalReliefGuidance(summary, originalText) {
  const combined = `${summary} ${originalText}`.toLowerCase();
  if (/bleed|bleeding|blood|cut|wound|injury/.test(combined)) {
    return 'Tell me whether the person is bleeding, where the bleeding is from, and whether it is heavy or slow. Apply firm pressure with a clean cloth, keep the injured area raised if possible, and do not remove the cloth if it soaks through; add another cloth on top.';
  }
  if (/burn|fire|scald/.test(combined)) {
    return 'Tell me where the burn is and whether the skin is blistering. Cool the burn with clean running water for up to 20 minutes, remove tight items nearby if safe, and do not apply ice, toothpaste, or oil.';
  }
  if (/breath|breathing|choking|chest pain|faint|unconscious/.test(combined)) {
    return 'Tell me whether the person is breathing normally, conscious, and able to speak. Keep them on their side if unconscious but breathing, loosen tight clothing, and do not give food or water.';
  }
  if (/fracture|broken|bone|leg|arm|head|accident|crash/.test(combined)) {
    return 'Tell me where the person is hurt and whether they can move that body part. Keep them still, support the injured area without forcing movement, and do not try to straighten a suspected fracture.';
  }
  return 'Tell me where the person is injured, whether they are bleeding, and whether they are conscious and breathing normally. Keep them still, reassure them, and avoid giving food or water until hospital help arrives.';
}

function buildPoliceReliefGuidance() {
  return 'Tell me whether the threat is still nearby, whether the victim is alone, and whether there are visible injuries. Move to the safest public place you can reach, stay on call if possible, and avoid confronting the attacker.';
}

function buildPostDispatchFollowUp(institutionType, summaryText, issueText, institutionName) {
  if (institutionType === 'hospital') {
    return `Hospital dispatch has been sent to ${institutionName}. ${buildHospitalReliefGuidance(summaryText, issueText)}`;
  }
  if (institutionType === 'police') {
    return `Police dispatch has been sent to ${institutionName}. ${buildPoliceReliefGuidance()}`;
  }
  if (institutionType === 'shelter') {
    return `Shelter support has been alerted. Tell me whether you are trapped, injured, or with children or elders so I can guide you while support is on the way.`;
  }
  return `Relief support has been alerted. Tell me whether you need food, water, medicine, or transport first so I can guide you while help is on the way.`;
}

function updateCrisisState(patch) {
  crisisState = Object.assign({}, crisisState, patch || {});
}

function rememberCrisisNote(text) {
  const clean = String(text || '').trim();
  if (!clean) return;
  crisisState.notes = (crisisState.notes || []).concat(clean).slice(-8);
}

function setPendingCrisisCase(type, summary, institutionName) {
  updateCrisisState({
    active: true,
    dispatched: false,
    type: type || 'hospital',
    summary: summary || '',
    institutionName: institutionName || '',
    location: getPreciseVictimLocation(),
    lastQuestion: '',
    lastAdvice: '',
    notes: []
  });
}

function containsAny(text, patterns) {
  return patterns.some(pattern => pattern.test(text));
}

function buildHospitalCrisisReply(text) {
  const lower = String(text || '').toLowerCase();
  let advice = '';
  let question = '';

  if (containsAny(lower, [/head/, /face/, /neck/])) {
    advice = 'Head, face, or neck bleeding is high risk. Keep the person still, apply gentle but firm pressure with a clean cloth unless something is stuck in the wound, and watch for vomiting, confusion, or drowsiness.';
    question = 'Is the person conscious, breathing normally, and bleeding heavily or slowly?';
  } else if (containsAny(lower, [/arm/, /hand/, /leg/, /foot/, /thigh/])) {
    advice = 'For limb bleeding, press firmly with a clean cloth and raise the injured limb if it does not cause severe pain. If bleeding is severe and not stopping, keep constant pressure and do not keep checking the wound every few seconds.';
    question = 'Can the person move that arm or leg, and is the bleeding soaking through the cloth?';
  } else if (containsAny(lower, [/chest/, /abdomen/, /stomach/, /back/])) {
    advice = 'Chest, abdomen, or back injuries can become serious very quickly. Keep the person still, do not give food or water, and do not press deeply into the wound.';
    question = 'Is the person having trouble breathing, severe pain, or becoming sleepy?';
  } else if (containsAny(lower, [/heavy/, /a lot/, /spurting/, /fast/])) {
    advice = 'Heavy bleeding needs uninterrupted pressure right now. Use the cleanest thick cloth available, press directly on the wound, and add more cloth on top if blood comes through.';
    question = 'Where exactly is the bleeding from, and is the person conscious?';
  } else if (containsAny(lower, [/slow/, /little/, /minor/])) {
    advice = 'If bleeding is slow, keep steady pressure and avoid unnecessary movement. Keep the person warm and calm until responders arrive.';
    question = 'Where is the injury, and do they have pain, swelling, or difficulty moving?';
  } else if (containsAny(lower, [/not breathing/, /can\'t breathe/, /cannot breathe/, /breathing hard/, /trouble breathing/])) {
    advice = 'Breathing trouble is life-threatening. Keep the airway clear, loosen tight clothing, and if the person becomes unresponsive and is not breathing, call for immediate resuscitation help nearby.';
    question = 'Is the person awake, and are they able to speak full sentences?';
  } else if (containsAny(lower, [/unconscious/, /not conscious/, /fainted/, /passed out/])) {
    advice = 'If the person is unconscious but breathing, place them on their side and keep the airway clear. Do not give anything by mouth.';
    question = 'Are they breathing normally, and is there bleeding from the head or mouth?';
  } else if (containsAny(lower, [/burn/, /blister/, /scald/])) {
    advice = 'Cool the burn under clean running water for up to 20 minutes. Remove tight items nearby if safe, but do not peel off stuck clothing and do not apply ice, butter, oil, or toothpaste.';
    question = 'Which body part is burned, and are there blisters or blackened skin?';
  } else if (containsAny(lower, [/broken/, /fracture/, /bone/, /cannot move/])) {
    advice = 'Keep the injured area still and supported exactly as found. Do not try to straighten a suspected fracture.';
    question = 'Which body part is injured, and is there swelling, severe pain, or deformity?';
  } else {
    advice = 'Keep the person still, monitor breathing, and control any bleeding with firm pressure using a clean cloth. Do not give food or water until medical help arrives.';
    question = 'Tell me where the injury is, whether they are bleeding, and whether they are conscious and breathing normally.';
  }

  updateCrisisState({ lastQuestion: question, lastAdvice: advice });
  rememberCrisisNote(text);
  return `${advice} ${question}`;
}

function buildPoliceCrisisReply(text) {
  const lower = String(text || '').toLowerCase();
  let advice = '';
  let question = '';

  if (containsAny(lower, [/nearby/, /outside/, /following/, /chasing/, /inside/, /here/])) {
    advice = 'If the threat is still nearby, move to the nearest locked or public safe place immediately, stay quiet if hiding, and avoid direct confrontation.';
    question = 'Are you alone, and can you safely move to a locked room, shop, guard post, or crowd?';
  } else if (containsAny(lower, [/weapon/, /knife/, /gun/, /armed/])) {
    advice = 'An armed threat is extremely dangerous. Put distance and barriers between you and the attacker, stay low if needed, and do not try to disarm them yourself.';
    question = 'Can you still see the attacker, and are there other people with you?';
  } else if (containsAny(lower, [/injured/, /bleeding/, /hurt/])) {
    advice = 'Your safety comes first. Move to a safe place before giving first aid if the attacker is nearby, then control bleeding with firm pressure using a clean cloth.';
    question = 'Are you safe right now, and where is the injury?';
  } else if (containsAny(lower, [/kidnap/, /forced/, /locked/, /trapped/])) {
    advice = 'If you are being confined or forced, keep communication silent if possible, avoid provoking the attacker, and share any landmark or building clue you can.';
    question = 'Can you text or whisper your building, floor, vehicle, or landmark?';
  } else {
    advice = 'Stay in the safest place you can reach, keep your phone with you, and avoid confronting the threat.';
    question = 'Is the threat still nearby, are you alone, and do you have any injuries?';
  }

  updateCrisisState({ lastQuestion: question, lastAdvice: advice });
  rememberCrisisNote(text);
  return `${advice} ${question}`;
}

function buildShelterCrisisReply(text) {
  const lower = String(text || '').toLowerCase();
  let advice = 'Stay in the safest sheltered place you can reach and conserve phone battery.';
  let question = 'Are you trapped, injured, or with children, elders, or disabled persons?';

  if (containsAny(lower, [/flood/, /water/])) {
    advice = 'Move to higher ground immediately, avoid walking through moving water, and keep away from electrical sources.';
    question = 'Are you above water level now, and is anyone with you unable to move?';
  } else if (containsAny(lower, [/fire/, /smoke/])) {
    advice = 'Move away from smoke, stay low to the ground, and cover your nose and mouth with cloth if needed.';
    question = 'Can you exit safely, or are you trapped inside?';
  } else if (containsAny(lower, [/building/, /collapse/, /earthquake/])) {
    advice = 'Move away from cracked walls, glass, and unstable structures. If trapped, protect your airway and make noise at intervals to help rescuers locate you.';
    question = 'Are you trapped under debris, and are you injured?';
  }

  updateCrisisState({ lastQuestion: question, lastAdvice: advice });
  rememberCrisisNote(text);
  return `${advice} ${question}`;
}

function buildFoodCrisisReply(text) {
  const lower = String(text || '').toLowerCase();
  let advice = 'Conserve water, stay in a safe place, and keep essential medicines with you.';
  let question = 'Tell me whether you need water, food, medicine, baby supplies, or transport first.';

  if (containsAny(lower, [/baby/, /child/])) {
    advice = 'Keep children warm, hydrated, and close to you. Prioritize clean water, milk or baby food, and any essential medicines first.';
  } else if (containsAny(lower, [/medicine/, /insulin/, /tablet/, /asthma/])) {
    advice = 'Keep essential medicines separated and easy to reach. If doses may be missed, tell me which medicine is urgent first.';
    question = 'Which medicine is urgently needed, and for how many people?';
  }

  updateCrisisState({ lastQuestion: question, lastAdvice: advice });
  rememberCrisisNote(text);
  return `${advice} ${question}`;
}

function buildCrisisCoachingReply(text) {
  if (!crisisState.active || !crisisState.dispatched || !crisisState.type) return null;
  if (crisisState.type === 'hospital') return buildHospitalCrisisReply(text);
  if (crisisState.type === 'police') return buildPoliceCrisisReply(text);
  if (crisisState.type === 'shelter') return buildShelterCrisisReply(text);
  return buildFoodCrisisReply(text);
}

async function agentSendMessage() {
  const input = document.getElementById('agentTextInput');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  appendAgentMessage('user', text);
  const thinkingId = appendAgentThinking();

  agentMessages.push({ role: 'user', parts: [{ text }] });
  if (agentMessages.length > 12) {
    agentMessages = agentMessages.slice(-12);
  }

  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    removeThinking(thinkingId);
    appendAgentMessage('agent', 'The AI service is not configured yet. Add your Gemini API key in agent.js and try again.');
    return;
  }

  const localCrisisReply = buildCrisisCoachingReply(text);
  if (localCrisisReply) {
    removeThinking(thinkingId);
    agentMessages.push({ role: 'model', parts: [{ text: localCrisisReply }] });
    appendAgentMessage('agent', localCrisisReply);
    return;
  }

  try {
    await refreshLiveNearestResources();
    updateAgentContextStrip();

    const reply = await fetchGeminiReplyWithRetry(text);
    const normalizedReply = buildStructuredSOSReply(reply, text);
    agentMessages.push({ role: 'model', parts: [{ text: normalizedReply }] });

    removeThinking(thinkingId);
    appendAgentMessage('agent', normalizedReply);
    parseAndShowDispatch(normalizedReply);
  } catch (error) {
    console.error('Gemini agent error:', error);
    removeThinking(thinkingId);
    const msg = /quota|rate limit|limit/i.test(error.message)
      ? 'AI is temporarily unavailable due to API quota. Please wait and try again later.'
      : `AI error: ${error.message || 'Unknown error'}`;
    appendAgentMessage('agent', msg);
  }
}

function appendAgentMessage(role, text) {
  const wrap = document.getElementById('agentChatWrap');
  const div = document.createElement('div');
  div.className = role === 'user' ? 'agent-msg agent-msg-user' : 'agent-msg agent-msg-agent';

  if (role === 'agent') {
    const formatted = text.replace(/DISPATCH:\s*(.*)/gi, '<div class="agent-dispatch-line">🚨 $1</div>');
    div.innerHTML = `<div class="agent-msg-bubble">${formatted.replace(/\n/g, '<br>')}</div>`;
  } else {
    div.innerHTML = `<div class="agent-msg-bubble">${escapeHtml(text)}</div>`;
  }

  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
  return div;
}

function appendAgentThinking() {
  const wrap = document.getElementById('agentChatWrap');
  const id = 'thinking_' + Date.now();
  const div = document.createElement('div');
  div.className = 'agent-msg agent-msg-agent';
  div.id = id;
  div.innerHTML = `<div class="agent-msg-bubble agent-thinking">
    <span class="thinking-dot"></span>
    <span class="thinking-dot"></span>
    <span class="thinking-dot"></span>
  </div>`;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
  return id;
}

function removeThinking(id) {
  document.getElementById(id)?.remove();
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function flashQuickCard(index) {
  const cards = document.querySelectorAll('.quick-card');
  if (cards[index]) {
    cards[index].style.boxShadow = '0 0 0 2px #6366f1';
    setTimeout(() => {
      cards[index].style.boxShadow = '';
    }, 3000);
  }
}

// Function to send message from text (for SOS integration)
window.agentSendMessageFromText = async function(text) {
  appendAgentMessage('user', text);
  const thinkingId = appendAgentThinking();

  agentMessages.push({ role: 'user', parts: [{ text }] });
  if (agentMessages.length > 12) {
    agentMessages = agentMessages.slice(-12);
  }

  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    removeThinking(thinkingId);
    appendAgentMessage('agent', 'The AI service is not configured yet. Add your Gemini API key in agent.js and try again.');
    return;
  }

  const localCrisisReply = buildCrisisCoachingReply(text);
  if (localCrisisReply) {
    removeThinking(thinkingId);
    agentMessages.push({ role: 'model', parts: [{ text: localCrisisReply }] });
    appendAgentMessage('agent', localCrisisReply);
    return;
  }

  try {
    await refreshLiveNearestResources();
    updateAgentContextStrip();

    const reply = await fetchGeminiReplyWithRetry(text);
    const normalizedReply = buildStructuredSOSReply(reply, text);
    agentMessages.push({ role: 'model', parts: [{ text: normalizedReply }] });

    removeThinking(thinkingId);
    appendAgentMessage('agent', normalizedReply);
    parseAndShowDispatch(normalizedReply);
  } catch (error) {
    console.error('Gemini agent error:', error);
    removeThinking(thinkingId);
    const msg = /quota|rate limit|limit/i.test(error.message)
      ? 'AI is temporarily unavailable due to API quota. Please wait and try again later.'
      : `AI error: ${error.message || 'Unknown error'}`;
    appendAgentMessage('agent', msg);
  }
};

function agentStartMic() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    appendAgentMessage('agent', 'Your browser does not support voice input here. Please type your message instead.');
    return;
  }

  const rec = new SpeechRecognition();
  rec.lang = 'en-IN';
  rec.interimResults = false;

  const btn = document.getElementById('agentMicBtn');
  btn.textContent = '🔴';
  btn.style.background = '#e03030';

  rec.start();

  rec.onresult = (event) => {
    const text = event.results[0][0].transcript;
    window._lastSOSSpeech = text;
    document.getElementById('agentTextInput').value = text;
    btn.textContent = '🎙';
    btn.style.background = '';
    agentSendMessage();
  };

  rec.onerror = () => {
    btn.textContent = '🎙';
    btn.style.background = '';
    appendAgentMessage('agent', 'Microphone access failed. Allow microphone permission in the browser and try again.');
  };

  rec.onend = () => {
    btn.textContent = '🎙';
    btn.style.background = '';
  };
}

const _originalAnalyzeAndRespond = analyzeAndRespond;
window.analyzeAndRespond = function (speech) {
  window._lastSOSSpeech = speech;
  return _originalAnalyzeAndRespond(speech);
};

// ══════════════════════════════════════════════════════════════
//  SOS DISPATCH TO ADMIN PORTAL
// ══════════════════════════════════════════════════════════════

function extractTaggedLine(aiResponse, tag) {
  const normalizedTag = tag.replace(':', '').trim().toUpperCase();
  const line = aiResponse.split('\n').find(entry => {
    const trimmed = entry.trim();
    return trimmed.toUpperCase().startsWith(normalizedTag + ':') || trimmed.toUpperCase().startsWith(normalizedTag + ' :');
  });
  if (!line) return '';
  const match = line.match(/^[A-Z_]+\s*:\s*(.*)$/i);
  return match ? match[1].trim() : '';
}

function getPreciseVictimLocation() {
  if (window._userExactLocation) return window._userExactLocation;
  if (window._userLat && window._userLon) {
    return `GPS: ${Number(window._userLat).toFixed(6)}, ${Number(window._userLon).toFixed(6)}`;
  }
  return 'Location unavailable';
}

function getFirebaseDispatchInstitution(type) {
  const resources = getAgentResources();
  const list = resources[`${type}s`] || resources[type] || [];
  const session = window._adminSession || {};

  if (session.uid && session.role === type) {
    const ownInstitution = (Array.isArray(list) ? list : []).find(item =>
      item && (item.id === session.institutionId || item.uid === session.uid)
    );

    if (ownInstitution) return ownInstitution;

    return {
      id: session.institutionId,
      uid: session.uid,
      name: 'Current Institution',
      type
    };
  }

  if (Array.isArray(list) && list.length) return list[0];
  return null;
}

function parseAndShowDispatch(aiResponse) {
  const recommendation = extractTaggedLine(aiResponse, 'DISPATCH:');
  const aiSummary = extractTaggedLine(aiResponse, 'ALERT:');
  const aiType = extractTaggedLine(aiResponse, 'DISPATCH_TYPE:').toLowerCase();
  if (!recommendation && !aiType) {
    console.warn('AI response did not include structured dispatch tags');
    return;
  }

  const lastUserMsg = agentMessages
    .filter(msg => msg.role === 'user')
    .map(msg => msg.parts?.[0]?.text || '')
    .pop() || 'Emergency SOS';

  const fallbackType = getFallbackDispatchType(lastUserMsg);

  let institutionType = aiType || fallbackType;
  let firebaseInstitution = getFirebaseDispatchInstitution(institutionType);
  let nearest = firebaseInstitution || agentLiveNearest[institutionType] || null;

  if (!nearest && recommendation.toLowerCase().includes('police')) {
    institutionType = 'police';
    firebaseInstitution = getFirebaseDispatchInstitution('police');
    nearest = firebaseInstitution || agentLiveNearest.police;
  } else if (!nearest && recommendation.toLowerCase().includes('shelter')) {
    institutionType = 'shelter';
    firebaseInstitution = getFirebaseDispatchInstitution('shelter');
    nearest = firebaseInstitution || agentLiveNearest.shelter;
  } else if (!nearest && (recommendation.toLowerCase().includes('food') || recommendation.toLowerCase().includes('ngo'))) {
    institutionType = 'food';
    firebaseInstitution = getFirebaseDispatchInstitution('food');
    nearest = firebaseInstitution || agentLiveNearest.food;
  } else if (!nearest) {
    institutionType = 'hospital';
    firebaseInstitution = getFirebaseDispatchInstitution('hospital');
    nearest = firebaseInstitution || agentLiveNearest.hospital;
  }

  if (!nearest) {
    const fallbackInstitution = getFirebaseDispatchInstitution(fallbackType);
    if (fallbackInstitution) {
      institutionType = fallbackType;
      nearest = fallbackInstitution;
    }
  }

  if (!nearest) {
    console.warn('No nearest institution found for dispatch');
    return;
  }

  console.log('Dispatch decision', {
    institutionType,
    recommendation,
    aiType,
    aiSummary,
    nearest
  });

  showDispatchConfirmation(lastUserMsg, aiSummary || lastUserMsg, institutionType, nearest);
}

function showDispatchConfirmation(issueText, summaryText, institutionType, institutionData) {
  const card = document.getElementById('dispatchConfirmCard');
  if (!card) {
    console.warn('Dispatch confirmation card not found in DOM');
    return;
  }

  const location = document.getElementById('userLocation')?.textContent.replace('· ', '') || 'Unknown location';
  const distance = institutionData.dist || 'unknown distance';
  
  const issuePreview = summaryText.substring(0, 90) + (summaryText.length > 90 ? '...' : '');
  const institutionName = institutionData.name || 'Nearest ' + institutionType;
  
  const iconMap = {
    hospital: 'fa-plus',
    police: 'fa-shield-halved',
    shelter: 'fa-house',
    food: 'fa-utensils'
  };
  
  const colorMap = {
    hospital: '#c0200e',
    police: '#1a3a6e',
    shelter: '#1a5a2e',
    food: '#8a3000'
  };

  card.innerHTML = `
    <div style="display:flex;gap:12px;padding:12px;background:#0d0d0d;border:1px solid #222;border-radius:12px;">
      <div style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:${colorMap[institutionType]};flex-shrink:0;">
        <i class="fa-solid ${iconMap[institutionType]}" style="color:#fff;font-size:18px;"></i>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;color:#fff;font-size:12px;margin-bottom:4px;">CONFIRM DISPATCH</div>
        <div style="font-size:11px;color:#ccc;margin-bottom:6px;line-height:1.4;">
          <strong>Issue:</strong> ${escapeHtml(issuePreview)}<br>
          <strong>To:</strong> ${escapeHtml(institutionName)}<br>
          <strong>Distance:</strong> ${distance}
        </div>
        <div style="display:flex;gap:6px;">
          <button 
            class="dispatch-confirm-btn" 
            onclick="sendSOSDispatch('${escapeHtml(JSON.stringify({id: institutionData.id || '', uid: institutionData.uid || '', name: institutionData.name, type: institutionType, dist: institutionData.dist}))}', '${issueText.substring(0, 180)}', '${summaryText.substring(0, 140)}', '${getPreciseVictimLocation()}')"
            style="flex:1;padding:8px 12px;background:#4ade80;border:none;border-radius:6px;color:#000;font-weight:600;font-size:11px;cursor:pointer;letter-spacing:0.5px;">
            ✓ DISPATCH NOW
          </button>
          <button 
            onclick="document.getElementById('dispatchConfirmCard').style.display='none';"
            style="padding:8px 12px;background:#222;border:1px solid #333;border-radius:6px;color:#ccc;font-weight:600;font-size:11px;cursor:pointer;">
            Cancel
          </button>
        </div>
      </div>
    </div>
  `;
  
  card.style.display = 'block';
  console.log('Dispatch card rendered', { institutionType, institutionData, summaryText });
}

async function sendSOSDispatch(institutionDataJson, issueText, summaryText, location) {
  const institutionData = JSON.parse(institutionDataJson);
  const dispatchCard = document.getElementById('dispatchConfirmCard');
  
  if (!dispatchCard) return;

  try {
    // Show loading state
    dispatchCard.innerHTML = '<div style="padding:12px;color:#facc15;text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Dispatching...</div>';
    
    // Wait for Firebase
    await waitForFB(5000);

    const db = firebase.firestore();
    const timestamp = new Date();
    const distance = institutionData.dist || 'unknown distance';

    // Format alert message
    const issueSummary = (summaryText || issueText || 'Emergency SOS')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 140);
    const alertMessage = formatSOSAlert(issueSummary, location, distance);

    // Build alert document
    const alertDoc = {
      alertId: 'sos_' + Date.now(),
      issue: issueSummary,
      transcript: issueText,
      message: alertMessage,
      location: location,
      exactLocationText: location,
      latitude: window._userLat || null,
      longitude: window._userLon || null,
      distance: distance,
      timestamp: timestamp,
      status: 'pending',
      victimId: window._userLat && window._userLon ? `${window._userLat},${window._userLon}` : 'unknown'
    };

    // Determine collection based on institution type
    let collectionName = 'hospitals';
    if (institutionData.type === 'police') collectionName = 'police';
    else if (institutionData.type === 'shelter') collectionName = 'shelters';
    else if (institutionData.type === 'food') collectionName = 'food_ngos';

    let institutionRef = null;
    if (institutionData.id) {
      institutionRef = db.collection(collectionName).doc(institutionData.id);
    } else if (institutionData.uid) {
      institutionRef = db.collection(collectionName).doc(institutionData.uid);
    } else {
      const querySnapshot = await db.collection(collectionName).limit(1).get();
      if (!querySnapshot.empty) institutionRef = querySnapshot.docs[0].ref;
    }

    if (institutionRef) {
      await institutionRef.set({
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      await institutionRef.update({
        sos_alerts: firebase.firestore.FieldValue.arrayUnion(alertDoc)
      });

      if (institutionData.type === 'hospital') {
        await institutionRef.collection('reports').add({
          title: issueSummary,
          type: 'SOS',
          desc: `${issueSummary} | ${location}`,
          transcript: issueText,
          location: location,
          exactLocationText: location,
          distance: distance,
          source: 'sos',
          status: 'pending',
          time: timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } else if (institutionData.type === 'police') {
        await db.collection('incidents').add({
          title: issueSummary,
          desc: `${issueSummary} | ${location}`,
          transcript: issueText,
          location: location,
          exactLocationText: location,
          distance: distance,
          source: 'sos',
          priority: 1,
          status: 'ACTIVE',
          unit: institutionData.name || 'Dispatch pending',
          targetInstitutionId: institutionRef.id,
          time: timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      dispatchCard.innerHTML = `
        <div style="padding:12px;background:#0d2010;border:1px solid #4ade80;border-radius:8px;color:#4ade80;text-align:center;font-weight:600;font-size:12px;">
          ✓ Alert dispatched to ${institutionData.name}
          <div style="font-size:10px;color:#888;margin-top:4px;font-weight:normal;">Message sent to admin portal</div>
        </div>
      `;

      const followUp = buildPostDispatchFollowUp(
        institutionData.type,
        issueSummary,
        issueText,
        institutionData.name || ('nearest ' + institutionData.type)
      );
      updateCrisisState({
        active: true,
        dispatched: true,
        type: institutionData.type,
        summary: issueSummary,
        institutionName: institutionData.name || ('nearest ' + institutionData.type),
        location: location,
        lastAdvice: followUp
      });
      rememberCrisisNote(issueText);
      appendAgentMessage('agent', followUp);
      agentMessages.push({ role: 'model', parts: [{ text: followUp }] });
      
      setTimeout(() => {
        dispatchCard.style.display = 'none';
      }, 3000);
    } else {
      throw new Error('No institutions found for dispatch');
    }

  } catch (error) {
    console.error('Dispatch error:', error);
    dispatchCard.innerHTML = `
      <div style="padding:12px;background:#2a1010;border:1px solid #f87171;border-radius:8px;color:#f87171;font-weight:600;font-size:12px;text-align:center;">
        ✗ Dispatch failed: ${error.message || 'Try again'}
      </div>
    `;
  }
}

function formatSOSAlert(issueText, location, distance) {
  const cleanIssue = issueText.substring(0, 120).trim();
  return `Issue: ${cleanIssue} | Victim location: ${location} | Distance: ${distance}`;
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function waitForFB(ms) {
  ms = ms || 6000;
  return new Promise(function(resolve) {
    if (window._fbReady && window.FB) { resolve(); return; }
    const h = function() { document.removeEventListener('fbReady', h); resolve(); };
    document.addEventListener('fbReady', h);
    setTimeout(function() { document.removeEventListener('fbReady', h); resolve(); }, ms);
  });
}
