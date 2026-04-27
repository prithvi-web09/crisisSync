// ═══════════════════════════════════════════
//  CrisisSync — AI Crisis Agent (Gemini)
// ═══════════════════════════════════════════

const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE'; // ← paste your key from aistudio.google.com
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-1.0-pro:generateContent?key=${GEMINI_API_KEY}`;

// ── Build system context from live app data ──
function buildAgentSystemPrompt() {
  const area    = document.getElementById('userLocation')?.textContent.replace('· ', '') || 'Unknown area';
  const lat     = window._userLat || 'unknown';
  const lon     = window._userLon || 'unknown';

  const hospitals = typeof hospitalData !== 'undefined' ? hospitalData : [];
  const shelters  = typeof shelterData  !== 'undefined' ? shelterData  : [];
  const police    = typeof policeData   !== 'undefined' ? policeData   : [];
  const food      = typeof foodData     !== 'undefined' ? foodData     : [];

  return `You are CrisisSync AI Agent — an emergency response assistant embedded in a real-time disaster management app.

CURRENT LOCATION: ${area} (lat: ${lat}, lon: ${lon})

LIVE HOSPITAL DATA:
${hospitals.map(h => `- ${h.name}: ${h.beds} beds free, ${h.waitTime} min wait, status: ${h.status}, ${h.dist}km away`).join('\n')}

LIVE SHELTER DATA:
${shelters.map(s => `- ${s.name}: ${s.dist}, capacity ${s.capacity}%, types: ${s.type.join(', ')}`).join('\n')}

LIVE POLICE DATA:
${police.map(p => `- ${p.name}: ${p.units} units, status: ${p.status}, ${p.dist}km away`).join('\n')}

FOOD & NGO DATA:
${food.map(f => `- ${f.name}: ${f.supply}, stock: ${f.stock}, ${f.dist} away`).join('\n')}

YOUR JOB:
1. Understand the user's emergency clearly
2. Recommend the BEST specific resource (name it, give distance, give action)
3. Give 2-3 immediate safety steps
4. Mention Indian emergency numbers if relevant: Police 100, Ambulance 108, Fire 101, NDRF 011-24363260
5. Be concise, calm, and actionable — max 4-5 sentences
6. End with a "DISPATCH:" line listing the top 1-2 resources to contact

Format your response as plain text. Do NOT use markdown headers or bullet symbols. Write in short clear paragraphs.`;
}

// ── Agent state ──
let agentMessages = [];

// ── Open/close modal ──
function openAgentModal() {
  document.getElementById('agentOverlay').classList.add('open');
  updateAgentContextStrip();
  if (agentMessages.length === 0) {
    if (window._lastSOSSpeech) {
      setTimeout(() => agentQuickSend(`I said: "${window._lastSOSSpeech}"`), 400);
    }
  }
}

function closeAgentModal() {
  document.getElementById('agentOverlay').classList.remove('open');
}

// ── Update context strip ──
function updateAgentContextStrip() {
  const area = document.getElementById('userLocation')?.textContent.replace('· ', '') || 'Location unknown';
  document.getElementById('agentCtxLocation').textContent = `📍 ${area}`;

  const desc = document.getElementById('insightDesc')?.textContent || '';
  document.getElementById('agentCtxWeather').textContent = desc.split('.')[0] || '🌤 Conditions loading';

  const threatVal = document.getElementById('reportThreatValue')?.textContent;
  if (threatVal && threatVal !== '--') {
    document.getElementById('agentCtxThreat').textContent = `🛡 ${threatVal}`;
  } else {
    document.getElementById('agentCtxThreat').textContent = '🛡 Assessing...';
  }
}

// ── Quick prompt sender ──
function agentQuickSend(text) {
  document.getElementById('agentQuickPrompts').style.display = 'none';
  document.getElementById('agentTextInput').value = text;
  agentSendMessage();
}

// ── Send message ──
async function agentSendMessage() {
  const input = document.getElementById('agentTextInput');
  const text  = input.value.trim();
  if (!text) return;

  input.value = '';
  appendAgentMessage('user', text);
  const thinkingId = appendAgentThinking();

  agentMessages.push({ role: 'user', parts: [{ text }] });

  // Hinglish check — key nahi daali
  if (GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    removeThinking(thinkingId);
    appendAgentMessage('agent',
      '⚠️ Arre bhai! API key nahi daali abhi tak. ' +
      'agent.js file kholo aur uper GEMINI_API_KEY mein apni key past karo. ' +
      'Free key milegi: aistudio.google.com pe jao → "Get API Key" click karo. Bilkul free hai!'
    );
    return;
  }

  try {
    const systemPrompt = buildAgentSystemPrompt();

    const body = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: agentMessages,
      generationConfig: { temperature: 0.4, maxOutputTokens: 400 }
    };

    const res  = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    if (data.error) {
      removeThinking(thinkingId);
      appendAgentMessage('agent',
        `😬 Yaar kuch toh gadbad hai! API bol raha hai: "${data.error.message}". ` +
        'Shayad key galat hai ya exprired ho gayi. ' +
        'Ek baar aistudio.google.com pe check karo aur nayi key banao.'
      );
      return;
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response received.';
    agentMessages.push({ role: 'model', parts: [{ text: reply }] });

    removeThinking(thinkingId);
    appendAgentMessage('agent', reply);
    parseAndShowDispatch(reply);

  } catch (err) {
    removeThinking(thinkingId);
    appendAgentMessage('agent',
      '📡 Net nahi chal raha bhai! Intenet conection check karo. ' +
      'Wifi ya data on hai? Ek baar page refresh karke dobara try karo. ' +
      `(Techincal error: ${err.message})`
    );
  }
}

// ── Render messages ──
function appendAgentMessage(role, text) {
  const wrap = document.getElementById('agentChatWrap');
  const div  = document.createElement('div');
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
  const id   = 'thinking_' + Date.now();
  const div  = document.createElement('div');
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

function removeThinking(id) { document.getElementById(id)?.remove(); }

function escapeHtml(text) {
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Parse DISPATCH line ──
function parseAndShowDispatch(reply) {
  const match = reply.match(/DISPATCH:\s*(.*)/i);
  if (!match) return;
  const line = match[1].toLowerCase();
  if (/hospital|medical|ambulance/.test(line)) flashQuickCard(0);
  if (/police|station/.test(line))             flashQuickCard(1);
  if (/shelter|relief|hub/.test(line))         flashQuickCard(2);
}

function flashQuickCard(index) {
  const cards = document.querySelectorAll('.quick-card');
  if (cards[index]) {
    cards[index].style.boxShadow = '0 0 0 2px #6366f1';
    setTimeout(() => cards[index].style.boxShadow = '', 3000);
  }
}

// ── Voice input ──
function agentStartMic() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    appendAgentMessage('agent',
      '🎙️ Arre yaar! Tera browser voice ko suport nahi karta. ' +
      'Chrome ya Edge use karo — wahan mic kaam karta hai. ' +
      'Ya phir type karke message bhej do, wohi theek hai!'
    );
    return;
  }

  const rec = new SpeechRecognition();
  rec.lang = 'en-IN';
  rec.interimResults = false;

  const btn = document.getElementById('agentMicBtn');
  btn.textContent = '🔴';
  btn.style.background = '#e03030';

  rec.start();

  rec.onresult = (e) => {
    const text = e.results[0][0].transcript;
    window._lastSOSSpeech = text;
    document.getElementById('agentTextInput').value = text;
    btn.textContent = '🎙';
    btn.style.background = '';
    agentSendMessage();
  };

  rec.onerror = () => {
    btn.textContent = '🎙';
    btn.style.background = '';
    appendAgentMessage('agent',
      '😅 Mic access nahi mila bhai! Browser ne permision block kar diya. ' +
      'Address bar mein lock icon pe click karo → Microphone → Allow karo. ' +
      'Phir dobara try karna!'
    );
  };

  rec.onend = () => {
    btn.textContent = '🎙';
    btn.style.background = '';
  };
}

// ── Hook into existing SOS ──
const _originalAnalyzeAndRespond = analyzeAndRespond;
window.analyzeAndRespond = function(speech) {
  window._lastSOSSpeech = speech;
  return _originalAnalyzeAndRespond(speech);
};
