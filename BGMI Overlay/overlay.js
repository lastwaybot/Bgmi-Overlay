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
  rowsEl.innerHTML = sorted.map((t, i)=>{
    const aliveCount = t.players.filter(p => getPlayerAlive(p)).length;
    const elim = aliveCount === 0;
    return `
      <div class="row${elim ? ' eliminated' : ''}">
        <div class="rank">${i+1}</div>
        <div class="logo">${t.logo || '🎯'}</div>
        <div class="name">${t.name}</div>
        <div class="alive-dots">
          ${t.players.map((p, pi) => `<div class="adot${getPlayerAlive(p) ? '' : ' dead'}"></div>`).join('')}
        </div>
        <div class="kills"><span class="ic">⚔</span>${t.kills}</div>
      </div>
    `;
  }).join('');
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
