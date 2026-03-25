const symptoms = JSON.parse(localStorage.getItem('symptoms')) || [];
const notes = (localStorage.getItem('notes') || '').trim();
const age = localStorage.getItem('age') ? Number(localStorage.getItem('age')) : null;
const durationDays = localStorage.getItem('durationDays') ? Number(localStorage.getItem('durationDays')) : null;
const API_BASE_URL = localStorage.getItem('apiBaseUrl') || 'http://127.0.0.1:8001';
const API_FALLBACK_BASES = ['http://127.0.0.1:8001', 'http://127.0.0.1:8000'];
const HISTORY_KEY = 'healbuddyHistory';
const CHAT_HISTORY_KEY = 'healbuddyChatHistory';

function getApiBaseCandidates() {
	const candidates = [API_BASE_URL, ...API_FALLBACK_BASES];
	return [...new Set(candidates.filter(Boolean))];
}

async function postWithApiFallback(path, payload) {
	let lastError = null;

	for (const baseUrl of getApiBaseCandidates()) {
		try {
			const response = await fetch(`${baseUrl}${path}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(payload)
			});

			if (!response.ok) {
				lastError = new Error(`HTTP ${response.status}`);
				continue;
			}

			const body = await response.json();
			localStorage.setItem('apiBaseUrl', baseUrl);
			return body;
		} catch (error) {
			lastError = error;
		}
	}

	throw lastError || new Error('API unavailable');
}

function escapeHtml(value) {
return String(value ?? '')
	.replaceAll('&', '&amp;')
	.replaceAll('<', '&lt;')
	.replaceAll('>', '&gt;')
	.replaceAll('"', '&quot;')
	.replaceAll("'", '&#39;');
}

function toPlainLanguage(text) {
	const source = String(text ?? '');
	const replacements = [
		[/\bOTC\b/gi, 'over-the-counter'],
		[/\boral rehydration\b/gi, 'drinking water with salts/sugar'],
		[/\bdehydration\b/gi, 'low body fluids'],
		[/\bacute\b/gi, 'sudden'],
		[/\bchronic\b/gi, 'long-term'],
		[/\binflammation\b/gi, 'swelling/irritation'],
		[/\bviral\b/gi, 'caused by a virus'],
		[/\bbacterial\b/gi, 'caused by bacteria'],
		[/\bphlegm\b/gi, 'mucus'],
		[/\bpersistent\b/gi, 'ongoing'],
		[/\bcontagious\b/gi, 'can spread to others'],
		[/\bseverity\b/gi, 'seriousness']
	];

	return replacements.reduce((output, [pattern, replacement]) => output.replace(pattern, replacement), source);
}

function urgencyLabel(level) {
	if (level === 'URGENT') return 'Get urgent care now';
	if (level === 'DOCTOR SOON') return 'See a doctor soon';
	return 'Home care for now';
}

function bulletList(items) {
if (!items || !items.length) {
	return '<p>No details available.</p>';
}
return `<ul>${items.map(item => `<li>${escapeHtml(toPlainLanguage(item))}</li>`).join('')}</ul>`;
}

async function getMlPrediction(payload) {
	try {
		return await postWithApiFallback('/predict', payload);
	} catch (error) {
		return null;
	}
}

function evaluateTriage(selectedSymptoms, notesText, data, patientAge, symptomDays) {
const noteRedFlagKeywords = ['severe', 'worse', 'faint', 'unconscious', 'blood', 'pregnant'];
const notesLower = notesText.toLowerCase();
const hasUrgentSymptom = selectedSymptoms.some(symptom => data.urgentSymptoms.includes(symptom));
const hasRedFlagKeyword = noteRedFlagKeywords.some(keyword => notesLower.includes(keyword));
const reasons = [];

if (hasUrgentSymptom) {
	reasons.push('a warning symptom was selected');
}
if (hasRedFlagKeyword) {
	reasons.push('your notes include warning words');
}

if (hasUrgentSymptom || hasRedFlagKeyword) {
	return {
	level: 'URGENT',
	message: 'Some signs may need urgent in-person care. Please contact emergency services or go to the nearest hospital now.',
	className: 'badge urgent',
	reasons
	};
}

const hasHighRiskAge = patientAge !== null && (patientAge <= 5 || patientAge >= 65);
const hasFever = selectedSymptoms.includes('Fever');
const hasBurningUrination = selectedSymptoms.includes('Burning Urination');
const hasGastroCombo = selectedSymptoms.includes('Diarrhea') && selectedSymptoms.includes('Vomiting');
const hasManySymptoms = selectedSymptoms.length >= 3;
const prolongedSymptoms = symptomDays !== null && symptomDays >= 3;

if (hasHighRiskAge && (hasFever || selectedSymptoms.includes('Cough') || selectedSymptoms.includes('Breathing Difficulty'))) {
	reasons.push('age plus fever/breathing symptoms raises risk');
}
if (hasFever && symptomDays !== null && symptomDays >= 2) {
	reasons.push('fever has lasted 2 or more days');
}
if (hasBurningUrination) {
	reasons.push('urination symptoms may need medical review');
}
if (hasGastroCombo) {
	reasons.push('vomiting and diarrhea can lower body fluids quickly');
}
if (hasManySymptoms) {
	reasons.push('several symptoms are present');
}
if (prolongedSymptoms) {
	reasons.push('symptoms have continued for 3+ days');
}

if (reasons.length > 0) {
	return {
	level: 'DOCTOR SOON',
	message: 'A doctor visit is recommended within 24–48 hours, especially if symptoms are not improving.',
	className: 'badge soon',
	reasons
	};
}

return {
	level: 'SELF-CARE',
	message: 'Current symptoms may be manageable with home care. Monitor closely and seek care if symptoms worsen.',
	className: 'badge self',
	reasons: ['no immediate warning signs found from your selections']
};
}

function getHistory() {
try {
	const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
	return Array.isArray(parsed) ? parsed : [];
} catch (error) {
	return [];
}
}

function saveHistoryEntry(entry) {
	const existing = getHistory();
	const next = [entry, ...existing].slice(0, 10);
	localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

function formatDateTime(value) {
	if (!value) return 'Unknown time';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return 'Unknown time';
	return date.toLocaleString();
}

function getChatHistory() {
	try {
		const parsed = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) || '[]');
		return Array.isArray(parsed) ? parsed : [];
	} catch (error) {
		return [];
	}
}

function saveChatHistory(entries) {
	localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(entries.slice(-6)));
}

function appendChatMessage(role, content) {
	const next = [...getChatHistory(), { role, content: String(content || '') }].slice(-6);
	saveChatHistory(next);
}

function renderChatHistory(historyDiv) {
	if (!historyDiv) return;
	historyDiv.innerHTML = '';

	for (const item of getChatHistory()) {
		const msg = document.createElement('div');
		const isUser = item.role === 'user';
		msg.style.cssText = isUser
			? 'margin:8px 0; padding:8px 12px; background:rgba(37,99,235,0.1); border-radius:8px;'
			: 'margin:8px 0; padding:8px 12px; background:rgba(100,116,139,0.1); border-radius:8px;';
		msg.innerHTML = `<strong>${isUser ? 'You' : 'HealBuddy'}:</strong> ${escapeHtml(toPlainLanguage(item.content || ''))}`;
		historyDiv.appendChild(msg);
	}

	historyDiv.scrollTop = historyDiv.scrollHeight;
}

function renderLoading(resultNode) {
	resultNode.innerHTML = `
	<div class="card loading-card">
		<h3>Analyzing your symptoms...</h3>
		<p>Please wait while HealBuddy prepares your guidance.</p>
	</div>
	`;
}

async function analyze() {
const resultNode = document.getElementById('result');

if (!symptoms.length) {
	resultNode.innerHTML = "<div class='card'><h3>No symptoms selected</h3><p>Please go back and select symptoms first.</p><button class='btn' onclick=\"location.href='index.html'\">Back to Symptoms</button></div>";
	return;
}

renderLoading(resultNode);

try {
const response = await fetch('data.json');
const data = await response.json();

const scoredConditions = data.conditions
	.map(condition => {
	const overlap = condition.symptoms.filter(symptom => symptoms.includes(symptom));
	return {
		...condition,
		overlap,
		overlapCount: overlap.length,
		score: Math.round((overlap.length / condition.symptoms.length) * 100)
	};
	})
	.filter(condition => condition.overlapCount > 0)
	.sort((a, b) => b.overlapCount - a.overlapCount || b.score - a.score);

const topMatch = scoredConditions[0] || null;
const triage = evaluateTriage(symptoms, notes, data, age, durationDays);
const mlResponse = await getMlPrediction({
	symptoms,
	age,
	durationDays,
	notes
});

const mlTop = mlResponse?.predictedCondition
	? data.conditions.find(condition => condition.name === mlResponse.predictedCondition) || null
	: null;

const displayMatch = mlTop || topMatch;
const previousEntry = getHistory()[0] || null;
const currentEntry = {
	timestamp: new Date().toISOString(),
	symptoms,
	triageLevel: triage.level,
	predictedCondition: mlResponse?.predictedCondition || displayMatch?.name || 'Unknown',
	severity: mlResponse?.estimatedSeverity || displayMatch?.severity || 'unknown',
	confidence: mlResponse?.confidence ?? null
};

saveHistoryEntry(currentEntry);
localStorage.setItem('lastPrediction', JSON.stringify({
	condition: mlResponse?.predictedCondition || displayMatch?.name,
	context: `${symptoms.join(', ')}${age ? ` | Age: ${age}` : ''}${durationDays ? ` | ${durationDays} days` : ''}`
}));
const recentHistory = getHistory().slice(0, 5);

const addedSymptoms = previousEntry
	? symptoms.filter(symptom => !previousEntry.symptoms.includes(symptom))
	: [];
const removedSymptoms = previousEntry
	? previousEntry.symptoms.filter(symptom => !symptoms.includes(symptom))
	: [];

resultNode.innerHTML = `
<div class="card">
<h3>Your details</h3>
<p><strong>Symptoms:</strong> ${symptoms.map(escapeHtml).join(', ')}</p>
${age ? `<p><strong>Age:</strong> ${age}</p>` : ''}
${durationDays ? `<p><strong>Duration:</strong> ${durationDays <= 1 ? 'Less than 24 hours' : `${durationDays} days`}</p>` : ''}
${notes ? `<p><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : ''}
</div>

<div class="card">
<h3>How urgent is this?</h3>
<p><span class="${triage.className}">${urgencyLabel(triage.level)}</span></p>
<p>${escapeHtml(toPlainLanguage(triage.message))}</p>
${bulletList(triage.reasons)}
</div>

<div class="card">
<h3>What we found</h3>
<p><strong>Most likely cause:</strong> ${mlResponse ? escapeHtml(toPlainLanguage(mlResponse.predictedCondition)) : 'Not available (service is offline)'}</p>
<p><strong>Match strength:</strong> ${mlResponse ? `${mlResponse.confidence}%` : 'Not available'}</p>
${mlResponse?.estimatedSeverity ? `<p><strong>How serious this seems:</strong> <span class="severity-badge severity-${mlResponse.estimatedSeverity}">${mlResponse.estimatedSeverity.toUpperCase()}</span></p>` : ''}
<p><strong>Other possible causes:</strong></p>
${mlResponse ? bulletList(mlResponse.topPredictions.map(item => `${item.condition} (${item.confidence}%)`)) : '<p>ML API not reachable, showing rule-based estimate.</p>'}
<p class="muted">This is a guidance estimate, not a diagnosis.</p>
</div>

<div class="card">
<h3>${mlResponse ? `About ${escapeHtml(toPlainLanguage(mlResponse.predictedCondition))}` : (displayMatch ? `About ${escapeHtml(toPlainLanguage(displayMatch.name))}` : 'No close match found')}</h3>
${mlResponse && mlResponse.overview ? `<p>${escapeHtml(toPlainLanguage(mlResponse.overview))}</p>` : (displayMatch ? `<p>${escapeHtml(toPlainLanguage(displayMatch.overview))}</p>` : '<p>There is not enough matching data to suggest a clear cause.</p>')}
${mlResponse && mlResponse.durationExpected ? `<p><strong>How long it may last:</strong> ${escapeHtml(toPlainLanguage(mlResponse.durationExpected))}</p>` : ''}
</div>

${mlResponse && mlResponse.followUp && mlResponse.followUp.length > 0 ? `
<div class="card">
<h3>Questions to ask a doctor</h3>
${bulletList(mlResponse.followUp)}
</div>
` : ''}

<div class="card">
<h3>What you can do at home</h3>
${mlResponse && mlResponse.homeCare && mlResponse.homeCare.length > 0 ? bulletList(mlResponse.homeCare) : (displayMatch ? bulletList(displayMatch.homeCare) : '<p>Hydrate, rest, and monitor your symptoms.</p>')}
</div>

<div class="card">
<h3>When to get medical help</h3>
${mlResponse && mlResponse.doctorWhen && mlResponse.doctorWhen.length > 0 ? bulletList(mlResponse.doctorWhen) : (displayMatch ? bulletList(displayMatch.doctorWhen) : '<p>If symptoms worsen or continue for more than 1–2 days, seek medical care.</p>')}
</div>

${mlResponse && mlResponse.timeline ? `
<div class="card">
<h3>What to expect</h3>
<p>${escapeHtml(toPlainLanguage(mlResponse.timeline))}</p>
</div>
` : ''}

<div class="card">
<h3>Safety note</h3>
<p>${escapeHtml(toPlainLanguage(data.disclaimer))}</p>
</div>

${previousEntry ? `
<div class="card">
<h3>Compared with your last check</h3>
<p><strong>Previous:</strong> ${escapeHtml(previousEntry.predictedCondition)} (${escapeHtml(previousEntry.triageLevel)}) on ${escapeHtml(formatDateTime(previousEntry.timestamp))}</p>
<p><strong>Current:</strong> ${escapeHtml(currentEntry.predictedCondition)} (${escapeHtml(currentEntry.triageLevel)})</p>
${addedSymptoms.length ? `<p><strong>New Symptoms Added:</strong> ${addedSymptoms.map(escapeHtml).join(', ')}</p>` : '<p><strong>New Symptoms Added:</strong> None</p>'}
${removedSymptoms.length ? `<p><strong>Symptoms Removed:</strong> ${removedSymptoms.map(escapeHtml).join(', ')}</p>` : '<p><strong>Symptoms Removed:</strong> None</p>'}
</div>
` : ''}

<div class="card">
<h3>Recent checks</h3>
<ul>
${recentHistory.map(item => `<li><strong>${escapeHtml(formatDateTime(item.timestamp))}</strong> — ${escapeHtml(item.predictedCondition)} (${escapeHtml(item.triageLevel)})</li>`).join('')}
</ul>
</div>

<div class="card">
<h3>Got a question?</h3>
<p>Ask HealBuddy about your results, treatment, or when to see a doctor.</p>
<div style="display:flex; gap:8px; margin:12px 0;">
<input type="text" id="qaInput" placeholder="e.g., How long will this last? What should I take?" style="flex:1; padding:10px; border:1px solid var(--border); border-radius:var(--radius-sm);">
<button onclick="submitQuestion()" style="padding:10px 14px; background:var(--primary); color:white; border:none; border-radius:var(--radius-sm); cursor:pointer; font-weight:600;">Ask</button>
</div>
<div id="qaHistory"></div>
</div>

<button class="btn" onclick="location.href='index.html'">Check Another</button>
`;

renderChatHistory(document.getElementById('qaHistory'));
} catch (error) {
	resultNode.innerHTML = `
	<div class="card">
		<h3>Unable to complete analysis</h3>
		<p>Something went wrong while processing your result. Please try again.</p>
		<p class="muted">${escapeHtml(error?.message || 'Unknown error')}</p>
		<button class="btn" onclick="location.href='index.html'">Back to Symptoms</button>
	</div>
	`;
}
}

async function submitQuestion() {
const input = document.getElementById('qaInput');
const question = (input?.value || '').trim();
if (!question) return;

const historyDiv = document.getElementById('qaHistory');
const predicted = JSON.parse(localStorage.getItem('lastPrediction') || '{}');

// Show loading
const userMsg = document.createElement('div');
userMsg.style.cssText = 'margin:8px 0; padding:8px 12px; background:rgba(37,99,235,0.1); border-radius:8px;';
userMsg.innerHTML = `<strong>You:</strong> ${escapeHtml(question)}`;
historyDiv.appendChild(userMsg);
appendChatMessage('user', question);

const loadingMsg = document.createElement('div');
loadingMsg.style.cssText = 'margin:8px 0; padding:8px 12px; background:rgba(100,116,139,0.1); border-radius:8px; font-style:italic;';
loadingMsg.textContent = 'HealBuddy is thinking...';
historyDiv.appendChild(loadingMsg);

try {
	const result = await postWithApiFallback('/ask', {
		question,
		condition: predicted.condition,
		context: predicted.context,
		chatHistory: getChatHistory()
	});
	const answer = result.answer || 'I could not find an answer to that question.';
	loadingMsg.innerHTML = `<strong>HealBuddy:</strong> ${escapeHtml(toPlainLanguage(answer))}`;
	loadingMsg.style.fontStyle = 'normal';
	appendChatMessage('assistant', answer);
} catch (err) {
	const fallbackMessage = `I'm having trouble reaching my knowledge base. Please try again or check back later.`;
	loadingMsg.innerHTML = `<strong>HealBuddy:</strong> ${fallbackMessage}`;
	loadingMsg.style.fontStyle = 'normal';
	appendChatMessage('assistant', fallbackMessage);
}

input.value = '';
historyDiv.scrollTop = historyDiv.scrollHeight;
}

analyze();