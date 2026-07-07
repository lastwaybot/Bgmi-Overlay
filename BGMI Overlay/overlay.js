const STORAGE_KEY = 'bgmiStats';

// Handle both old object format and simple boolean format
function getPlayerAlive(p){
  return typeof p === 'object' ? p.alive : !!p;
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return { teams: [] };
}

function renderLogo(logo){
  if(!logo) return '🎯';
  if(logo.startsWith('data:image/') || logo.startsWith('http://') || logo.startsWith('https://') || logo.includes('.')){
    return `<img src="${logo}" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;" />`;
  }
  return logo;
}

function render(stateOverride){
  const state = stateOverride || loadState();
  const teams = state.teams || [];

  let teamsAlive = 0, playersAlive = 0, matchKills = 0;
  teams.forEach(t=>{
    const alive = t.players.filter(p => getPlayerAlive(p)).length;
    if(alive > 0) teamsAlive++;
    playersAlive += alive;
    matchKills += t.kills;
  });
  document.getElementById('oTeams').textContent = teamsAlive;
  document.getElementById('oPlayers').textContent = playersAlive;
  document.getElementById('oKills').textContent = matchKills;

  const sorted = [...teams].sort((a,b)=>{
    const aAlive = a.players.filter(p => getPlayerAlive(p)).length > 0 ? 1 : 0;
    const bAlive = b.players.filter(p => getPlayerAlive(p)).length > 0 ? 1 : 0;
    if(aAlive !== bAlive) return bAlive - aAlive;
    return b.kills - a.kills;
  });

  const rowsEl = document.getElementById('rows');
  const existingRows = {};
  rowsEl.querySelectorAll('.row').forEach(row => {
    const tid = row.getAttribute('data-team-id');
    if(tid) existingRows[tid] = row;
  });

  const activeIds = new Set();

  sorted.forEach((t, i)=>{
    const aliveCount = t.players.filter(p => getPlayerAlive(p)).length;
    const elim = aliveCount === 0;
    const tid = String(t.id);
    activeIds.add(tid);

    let row = existingRows[tid];
    if(!row){
      row = document.createElement('div');
      row.className = 'row new-row';
      row.setAttribute('data-team-id', tid);
      row.innerHTML = `
        <div class="rank"></div>
        <div class="logo"></div>
        <div class="name"></div>
        <div class="alive-dots"></div>
        <div class="kills"></div>
      `;
    }else{
      row.classList.remove('new-row');
    }

    if(elim){
      row.classList.add('eliminated');
    }else{
      row.classList.remove('eliminated');
    }

    const rankEl = row.querySelector('.rank');
    const newRank = String(i+1);
    if(rankEl.textContent !== newRank) rankEl.textContent = newRank;

    const logoEl = row.querySelector('.logo');
    const logoHTML = renderLogo(t.logo);
    if(logoEl.innerHTML !== logoHTML) logoEl.innerHTML = logoHTML;

    const nameEl = row.querySelector('.name');
    if(nameEl.textContent !== t.name) nameEl.textContent = t.name;

    const dotsEl = row.querySelector('.alive-dots');
    const dotsHTML = t.players.map((p, pi) => `<div class="adot${getPlayerAlive(p) ? '' : ' dead'}"></div>`).join('');
    if(dotsEl.innerHTML !== dotsHTML) dotsEl.innerHTML = dotsHTML;

    const killsEl = row.querySelector('.kills');
    const killsHTML = `<span class="ic">⚔</span>${t.kills}`;
    if(killsEl.innerHTML !== killsHTML) killsEl.innerHTML = killsHTML;

    if(rowsEl.children[i] !== row){
      rowsEl.insertBefore(row, rowsEl.children[i] || null);
    }
  });

  Object.keys(existingRows).forEach(tid => {
    if(!activeIds.has(tid)) existingRows[tid].remove();
  });
}

// Real-time sync: instant updates from control panel via BroadcastChannel
const channel = new BroadcastChannel('bgmi-sync');
channel.onmessage = (e) => {
  if(e.data && e.data.type === 'stateUpdate'){
    render(e.data.state);
  }
};

// Live sync: fires when control-panel.html (another tab, same origin) updates localStorage
window.addEventListener('storage', (e)=>{
  if(e.key === STORAGE_KEY) render();
});

// Fallback poll in case the storage event is missed by OBS's browser source
setInterval(render, 1000);

render();
