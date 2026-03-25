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
    
const chipsDiv=document.getElementById('chips');
const searchInput=document.getElementById('symptomSearch');
const ageInput=document.getElementById('age');
const durationInput=document.getElementById('duration');

ageInput.value=localStorage.getItem('age')||'';
durationInput.value=localStorage.getItem('durationDays')||'';

function renderSymptomChips(filter='') {
    chipsDiv.innerHTML='';
    const filterLower=filter.toLowerCase();
    const orderedGroups = [
        ...CATEGORY_ORDER.filter(group => symptomGroups[group]),
        ...Object.keys(symptomGroups).filter(group => !CATEGORY_ORDER.includes(group))
    ];
    
    for (const group of orderedGroups) {
        const syms = symptomGroups[group];
        const filtered=syms.filter(s => s.toLowerCase().includes(filterLower));
        if (filtered.length===0) continue;
        
        const groupHeader=document.createElement('div');
        groupHeader.className='group-header';
        groupHeader.textContent=group;
        chipsDiv.appendChild(groupHeader);
        
        filtered.forEach(s => {
            const d=document.createElement('div');
            d.className='chip';
            d.textContent=s;
            const savedSymptoms=JSON.parse(localStorage.getItem('symptoms'))||[];
            if (savedSymptoms.includes(s)) d.classList.add('active');
            d.onclick=()=>d.classList.toggle('active');
            chipsDiv.appendChild(d);
        });
    }
}

renderSymptomChips();

if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        renderSymptomChips(e.target.value);
    });
}
    
function goResult(){
    
    const selected=[...document.querySelectorAll('.chip.active')]
    .map(c=>c.textContent);
    
    const notes=document.getElementById('notes').value;
    const ageValue=Number(ageInput.value)||null;
    const durationDays=Number(durationInput.value)||null;
    
    if(!selected.length){
    alert('Please select at least one symptom.');
    return;
    }

    if(ageValue && (ageValue<1 || ageValue>120)){
    alert('Please enter a valid age between 1 and 120.');
    return;
    }

    localStorage.setItem('symptoms',JSON.stringify(selected));
    localStorage.setItem('notes',notes);
    if (ageValue) localStorage.setItem('age',String(ageValue));
    if (durationDays) localStorage.setItem('durationDays',String(durationDays));
    
    location.href='result.html';
}