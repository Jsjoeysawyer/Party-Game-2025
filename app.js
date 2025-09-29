// FINAL Wicked Willow logic (harder puzzles + ritual + gallery)
const state = {
  content: null,
  progress: JSON.parse(localStorage.getItem('ww_progress') || '{}'),
  ritual: { stream:null, audioCtx:null, analyser:null, raf:0 }
};
function save(){ localStorage.setItem('ww_progress', JSON.stringify(state.progress)); }

async function loadContent(){
  const res = await fetch('content.json');
  state.content = await res.json();
  renderStations(); renderGallery();
  const s = new URLSearchParams(location.hash.replace('#?','')).get('station');
  if (s) openStation(s);
}
function setActive(view){
  document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active', b.dataset.view===view));
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-'+view).classList.add('active');
}
document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>setActive(b.dataset.view)));
document.getElementById('btn-start')?.addEventListener('click',()=>setActive('map'));

// Build stations list
function renderStations(){
  const wrap = document.getElementById('station-list'); wrap.innerHTML='';
  state.content.stations.forEach(st=>{
    const row = document.createElement('div'); row.className = 'item';
    row.innerHTML = `
      <div class="thumb">${st.thumb || 'challenge'}</div>
      <div style="flex:1">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
          <div>
            <h3 style="margin:.1rem 0">${st.title}</h3>
            <div class="small">${state.progress[st.id]?.done ? '✔ Completed' : 'Not solved'}</div>
          </div>
          <button class="btn" data-open="${st.id}">${state.progress[st.id]?.done?'Review':'Open'}</button>
        </div>
      </div>`;
    wrap.appendChild(row);
  });
  wrap.querySelectorAll('[data-open]').forEach(btn => btn.addEventListener('click', e=>openStation(e.target.dataset.open)));
}
// Gallery tiles
function renderGallery(){
  const g = document.getElementById('gallery-list'); g.innerHTML='';
  state.content.gallery.forEach(tile=>{
    const unlocked = state.progress[tile.unlockStation]?.done;
    g.innerHTML += `
      <div class="tile">
        <img alt="${tile.title}" src="${unlocked ? tile.unlockedMedia : tile.lockedMedia}">
        <div class="caption">${tile.title} ${unlocked ? '— Unlocked' : '— Locked'}</div>
      </div>`;
  });
}

// Modal controls
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');
document.getElementById('modal-close').addEventListener('click',()=>modal.classList.add('hidden'));
modal.addEventListener('click',(e)=>{ if(e.target===modal) modal.classList.add('hidden'); });

// Open station with puzzle UI
function openStation(id){
  const st = state.content.stations.find(s=>s.id===String(id));
  if(!st) return;
  const solved = state.progress[st.id]?.done;
  modalBody.innerHTML = `
    <h2 style="font-family:Creepster,cursive;letter-spacing:.5px">${st.title}</h2>
    <p>${st.story}</p>
    ${solved ? `<div class="card">Solved. ${st.id==='5' ? 'The curse is broken!' : 'Keep exploring.'}</div>` : puzzleUI(st)}
    ${!solved && localStorage.getItem('ww_bonus_hint')==='1' ? `<button class="btn" id="hint-btn">Hint</button>` : '' }
  `;
  modal.classList.remove('hidden');
  if (!solved) attachSubmit(st);
  const hintBtn = document.getElementById('hint-btn');
  if (hintBtn) hintBtn.onclick = ()=>{ alert('Hint: ' + (st.hint || 'Listen closely. Look around.')); localStorage.removeItem('ww_bonus_hint'); };
}
function puzzleUI(st){
  if (st.type==='anagram'){
    return `
      <p><em>Rearrange the letters to form the answer.</em></p>
      <div><input id="answer" type="text" placeholder="Type your solution"><button class="btn" id="submit">Submit</button></div>
      <div class="small" id="feedback"></div>`;
  }
  // default: text input (accepts synonyms configured in content)
  return `
    <div><input id="answer" type="text" placeholder="Type your answer"><button class="btn" id="submit">Submit</button></div>
    <div class="small" id="feedback"></div>`;
}
function normalize(s){ return s.toLowerCase().replace(/[’'"]/g,"").replace(/\s+/g," ").trim(); }

function attachSubmit(st){
  modal.addEventListener('click', onClick);
  function onClick(e){
    if(e.target.id!=='submit') return;
    const input = modal.querySelector('#answer'); if(!input) return;
    const ans = normalize(input.value);
    const fb = modal.querySelector('#feedback');

    let ok = false;
    if (st.type==='anagram'){
      ok = st.accept.some(a => normalize(a)===ans);
    } else {
      ok = st.accept.some(a => normalize(a)===ans);
    }

    if (ok){
      state.progress[st.id] = {done:true, ts:Date.now()};
      save(); renderStations(); renderGallery();
      fb.textContent = 'Correct!';
      setTimeout(()=>openStation(st.id), 300);
      modal.removeEventListener('click', onClick);
    } else {
      fb.textContent = 'Not quite — try again.';
    }
  }
}

// Ritual (mic volume meter)
const startBtn = document.getElementById('ritual-start');
const stopBtn  = document.getElementById('ritual-stop');
const meter    = document.getElementById('meter-fill');
const rStatus  = document.getElementById('ritual-status');

startBtn?.addEventListener('click', async ()=>{
  rStatus.textContent = 'Listening… clap or cheer!';
  startBtn.disabled = true; stopBtn.disabled = false;
  try{
    const stream = await navigator.mediaDevices.getUserMedia({audio:true});
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser(); analyser.fftSize = 256; src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let level = 0;
    const pump = ()=>{
      analyser.getByteFrequencyData(data);
      const vol = data.reduce((a,b)=>a+b,0)/data.length;
      level = Math.min(100, level + (vol/200));
      meter.style.width = level + '%';
      if (level>=100){
        rStatus.textContent = 'Ritual complete! Bonus hint unlocked.';
        localStorage.setItem('ww_bonus_hint','1');
        stopRitual();
        return;
      }
      state.ritual.raf = requestAnimationFrame(pump);
    };
    pump();
    state.ritual = {stream, audioCtx:ctx, analyser, raf:state.ritual.raf};
  }catch(e){
    rStatus.textContent = 'Microphone blocked. Check browser permissions.';
    startBtn.disabled = false; stopBtn.disabled = true;
  }
});
stopBtn?.addEventListener('click', stopRitual);
function stopRitual(){
  startBtn.disabled = false; stopBtn.disabled = true;
  if (state.ritual.raf) cancelAnimationFrame(state.ritual.raf);
  if (state.ritual.stream) state.ritual.stream.getTracks().forEach(t=>t.stop());
  if (state.ritual.audioCtx) state.ritual.audioCtx.close();
}

// Deep links
window.addEventListener('hashchange',()=>{
  const s = new URLSearchParams(location.hash.replace('#?','')).get('station');
  if (s) openStation(s);
});

// PWA
if ('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('service-worker.js')); }

loadContent();
