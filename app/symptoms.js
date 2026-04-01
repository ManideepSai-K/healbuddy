const symptoms=[
    'Cold','Cough','Sore Throat','Congestion','Runny Nose',
    'Fever','Chills','Body Pain','Headache','Fatigue','Weakness',
    'Stomach Pain','Nausea','Vomiting','Diarrhea','Acidity','Bloating','Loss of Appetite',
    'Burning Urination','Frequent Urination','Back Pain','Lower Abdominal Pain',
    'Chest Pain','Breathing Difficulty','Wheezing','Shortness of Breath',
    'Rash','Itching','Hives','Swelling','Redness',
    'Joint Pain','Muscle Stiffness','Dizziness','Brain Fog','Other'
    ];

const symptomGroups = {
    'Respiratory': ['Cold', 'Cough', 'Sore Throat', 'Congestion', 'Runny Nose', 'Breathing Difficulty', 'Wheezing', 'Shortness of Breath'],
    'Digestive': ['Stomach Pain', 'Nausea', 'Vomiting', 'Diarrhea', 'Acidity', 'Bloating', 'Loss of Appetite'],
    'Systemic': ['Fever', 'Chills', 'Body Pain', 'Headache', 'Fatigue', 'Weakness', 'Brain Fog', 'Dizziness'],
    'Urinary': ['Burning Urination', 'Frequent Urination', 'Back Pain', 'Lower Abdominal Pain'],
    'Chest': ['Chest Pain'],
    'Skin': ['Rash', 'Itching', 'Hives', 'Swelling', 'Redness'],
    'Musculoskeletal': ['Joint Pain', 'Muscle Stiffness'],
    'Other': ['Other']
};

const CATEGORY_ORDER = [
    'Respiratory',
    'Systemic',
    'Digestive',
    'Urinary',
    'Chest',
    'Skin',
    'Musculoskeletal',
    'Other'
];

const painAreaSymptomMap = {
    'Head': ['Headache', 'Dizziness', 'Brain Fog'],
    'Back of Head': ['Headache', 'Dizziness'],
    'Neck': ['Muscle Stiffness', 'Headache'],
    'Shoulders': ['Muscle Stiffness', 'Body Pain'],
    'Left Back Shoulder': ['Muscle Stiffness', 'Body Pain'],
    'Right Back Shoulder': ['Muscle Stiffness', 'Body Pain'],
    'Chest': ['Chest Pain', 'Cough', 'Breathing Difficulty', 'Shortness of Breath', 'Wheezing'],
    'Upper Abdomen': ['Stomach Pain', 'Acidity', 'Nausea', 'Bloating'],
    'Lower Abdomen': ['Lower Abdominal Pain', 'Stomach Pain', 'Diarrhea', 'Vomiting'],
    'Upper Back': ['Back Pain', 'Body Pain', 'Muscle Stiffness'],
    'Lower Back': ['Back Pain', 'Burning Urination', 'Frequent Urination'],
    'Left Arm': ['Body Pain', 'Muscle Stiffness'],
    'Right Arm': ['Body Pain', 'Muscle Stiffness'],
    'Left Hip': ['Joint Pain', 'Body Pain'],
    'Right Hip': ['Joint Pain', 'Body Pain'],
    'Left Leg': ['Joint Pain', 'Body Pain', 'Muscle Stiffness'],
    'Right Leg': ['Joint Pain', 'Body Pain', 'Muscle Stiffness'],
    'Back of Left Leg': ['Joint Pain', 'Body Pain', 'Muscle Stiffness'],
    'Back of Right Leg': ['Joint Pain', 'Body Pain', 'Muscle Stiffness']
};
    
const chipsDiv=document.getElementById('chips');
const searchInput=document.getElementById('symptomSearch');
const ageInput=document.getElementById('age');
const durationInput=document.getElementById('duration');
const notesInput=document.getElementById('notes');
const painAreaSummary=document.getElementById('painAreaSummary');
const painSuggestedSymptoms=document.getElementById('painSuggestedSymptoms');
const painAreaButtons=[...document.querySelectorAll('.body-hotspot')];
const mapToggleButtons=[...document.querySelectorAll('.map-toggle-btn')];
const mapPanels=[...document.querySelectorAll('.body-map-panel')];

function initializeMapViewToggle() {
    if (!mapToggleButtons.length || !mapPanels.length) return;

    mapToggleButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetView=button.dataset.mapView;
            mapToggleButtons.forEach(item => {
                item.classList.toggle('active', item === button);
            });
            mapPanels.forEach(panel => {
                panel.classList.toggle('active', panel.dataset.mapPanel === targetView);
            });
        });
    });
}

function getSelectedPainAreas() {
    return painAreaButtons
        .filter(button => button.classList.contains('active'))
        .map(button => button.dataset.area)
        .filter(Boolean);
}

function getSuggestedSymptomsFromPainAreas() {
    const selectedAreas=getSelectedPainAreas();
    const suggested=new Set();
    selectedAreas.forEach(area => {
        const mapped=painAreaSymptomMap[area] || [];
        mapped.forEach(symptom => suggested.add(symptom));
    });
    return [...suggested];
}

function updateSuggestedSymptomsHint() {
    if (!painSuggestedSymptoms) return;
    const suggested=getSuggestedSymptomsFromPainAreas();
    painSuggestedSymptoms.textContent=suggested.length
        ? `Suggested symptoms from pain map: ${suggested.join(', ')}`
        : '';
}

function getSavedPainAreas() {
    try {
        const parsed=JSON.parse(localStorage.getItem('painAreas') || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function updatePainAreaSummary() {
    if (!painAreaSummary) return;
    const selected=getSelectedPainAreas();

    painAreaSummary.textContent=selected.length
        ? `Selected areas: ${selected.join(', ')}`
        : 'No pain areas selected yet.';
}

function initializePainAreaMap() {
    const savedAreas=getSavedPainAreas();
    painAreaButtons.forEach(button => {
        const area=button.dataset.area;
        if (savedAreas.includes(area)) {
            button.classList.add('active');
        }
        button.addEventListener('click', () => {
            button.classList.toggle('active');
            updatePainAreaSummary();
            updateSuggestedSymptomsHint();
            renderSymptomChips(searchInput?.value || '');
        });
    });
    updatePainAreaSummary();
    updateSuggestedSymptomsHint();
}

ageInput.value=localStorage.getItem('age')||'';
durationInput.value=localStorage.getItem('durationDays')||'';
notesInput.value=localStorage.getItem('notes')||'';

function renderSymptomChips(filter='') {
    chipsDiv.innerHTML='';
    const filterLower=filter.toLowerCase();
    const suggestedSymptoms=new Set(getSuggestedSymptomsFromPainAreas());
    const savedSymptoms=JSON.parse(localStorage.getItem('symptoms'))||[];
    const orderedGroups = [
        ...CATEGORY_ORDER.filter(group => symptomGroups[group]),
        ...Object.keys(symptomGroups).filter(group => !CATEGORY_ORDER.includes(group))
    ];
    
    for (const group of orderedGroups) {
        const syms = symptomGroups[group];
        const filtered=syms.filter(s => s.toLowerCase().includes(filterLower));
        if (filtered.length===0) continue;

        const groupSection=document.createElement('section');
        groupSection.className='symptom-group';
        
        const groupHeader=document.createElement('div');
        groupHeader.className='group-header';
        groupHeader.textContent=group;
        groupSection.appendChild(groupHeader);

        const groupGrid=document.createElement('div');
        groupGrid.className='symptom-grid';
        
        filtered.forEach(s => {
            const d=document.createElement('button');
            d.type='button';
            d.className='chip';
            d.textContent=s;
            if (savedSymptoms.includes(s)) d.classList.add('active');
            if (suggestedSymptoms.has(s)) d.classList.add('suggested');
            d.onclick=()=>d.classList.toggle('active');
            groupGrid.appendChild(d);
        });

        groupSection.appendChild(groupGrid);
        chipsDiv.appendChild(groupSection);
    }
}

renderSymptomChips();
initializePainAreaMap();
initializeMapViewToggle();

if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        renderSymptomChips(e.target.value);
    });
}
    
function goResult(){
    
    const selected=[...document.querySelectorAll('.chip.active')]
    .map(c=>c.textContent);
    
    const notes=document.getElementById('notes').value;
    const painAreas=getSelectedPainAreas();
    const ageValue=Number(ageInput.value)||null;
    const durationDays=Number(durationInput.value)||null;
    
    if(!selected.length && !notes.trim()){
    alert('Please select at least one symptom or describe your issue in the notes box.');
    return;
    }

    if(ageValue && (ageValue<1 || ageValue>120)){
    alert('Please enter a valid age between 1 and 120.');
    return;
    }

    localStorage.setItem('symptoms',JSON.stringify(selected));
    localStorage.setItem('notes',notes);
    localStorage.setItem('painAreas',JSON.stringify(painAreas));
    if (ageValue) localStorage.setItem('age',String(ageValue));
    if (durationDays) localStorage.setItem('durationDays',String(durationDays));
    
    location.href='result.html';
}