const STORAGE_KEY = 'bgmiStats';
const TEAM_COUNT = 16;
const LOGO_EMOJIS = ['🐉','🐺','🦅','🐯','🦁','🐍','🦂','⚔️','🛡️','🔥','⚡','💀','🎯','🏹','👑','🌙'];

function defaultState(){
  const teams = [];
  for(let i=0;i<TEAM_COUNT;i++){
    teams.push({
      id: i+1,
      name: 'Team ' + (i+1),
      logo: LOGO_EMOJIS[i % LOGO_EMOJIS.length],
      kills: 0,
      players: [true,true,true,true]
    });
  }
  return { teams };
}

// Migrate object player format back to simple booleans
function migrateState(data){
  if(data && data.teams){
    data.teams.forEach(t => {
      if(t.players && t.players.length > 0 && typeof t.players[0] === 'object'){
        t.players = t.players.map(p => !!p.alive);
      }
    });
  }
  return data;
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw) return migrateState(JSON.parse(raw));
  }catch(e){}
  return defaultState();
}

let state = loadState();

// Real-time sync channel to overlay
const channel = new BroadcastChannel('bgmi-sync');

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  // Broadcast to overlay instantly
  channel.postMessage({ type: 'stateUpdate', state: state });
  renderStats();
}

function isEliminated(team){
  return team.players.every(p => !p);
}

function renderStats(){
  let teamsAlive = 0, playersAlive = 0, matchKills = 0;
  state.teams.forEach(t=>{
    const alive = t.players.filter(Boolean).length;
    if(alive > 0) teamsAlive++;
    playersAlive += alive;
    matchKills += t.kills;
  });
  document.getElementById('statTeams').textContent = teamsAlive;
  document.getElementById('statPlayers').textContent = playersAlive;
  document.getElementById('statKills').textContent = matchKills;
  document.getElementById('teamCount').textContent = state.teams.length + ' Teams';
}

function renderGrid(){
  const grid = document.getElementById('teamGrid');
  grid.innerHTML = '';
  state.teams.forEach((team, idx)=>{
    const aliveCount = team.players.filter(Boolean).length;
    const elim = aliveCount === 0;

    const card = document.createElement('div');
    card.className = 'team-card' + (elim ? ' eliminated' : '');

    card.innerHTML = `
      <div class="team-top">
        <span>#${String(team.id).padStart(2,'0')}</span>
        <span class="${elim ? 'badge-elim' : 'badge-alive'}">${elim ? 'ELIMINATED' : 'ALIVE (' + aliveCount + '/4)'}</span>
      </div>
      <div class="team-id">
        <div class="logo">${team.logo}<span class="dot"></span></div>
        <input class="team-name" value="${team.name}" data-idx="${idx}" />
      </div>
      <div class="kills-row">
        <span class="kills-label">KILLS</span>
        <div class="kills-ctrl">
          <button class="kbtn minus" data-act="kminus" data-idx="${idx}">−</button>
          <span class="kills-val">${team.kills}</span>
          <button class="kbtn plus" data-act="kplus" data-idx="${idx}">+</button>
        </div>
      </div>
      <div class="players">
        ${team.players.map((alive,pi)=>`<div class="pbtn${alive?'':' dead'}" data-act="toggle" data-idx="${idx}" data-p="${pi}">P${pi+1}</div>`).join('')}
      </div>
    `;
    grid.appendChild(card);
  });
}

document.getElementById('teamGrid').addEventListener('click', (e)=>{
  const el = e.target.closest('[data-act]');
  if(!el) return;
  const idx = parseInt(el.dataset.idx);
  const act = el.dataset.act;
  const team = state.teams[idx];
  if(act === 'kplus'){ team.kills++; }
  else if(act === 'kminus'){ team.kills = Math.max(0, team.kills-1); }
  else if(act === 'toggle'){ const p = parseInt(el.dataset.p); team.players[p] = !team.players[p]; }
  saveState();
  renderGrid();
});

document.getElementById('teamGrid').addEventListener('change', (e)=>{
  if(e.target.classList.contains('team-name')){
    const idx = parseInt(e.target.dataset.idx);
    state.teams[idx].name = e.target.value || ('Team ' + (idx+1));
    saveState();
  }
});

// Reset Round: only resets kills and alive status, keeps team names and logos
document.getElementById('resetRoundBtn').addEventListener('click', ()=>{
  if(confirm('Reset round? Kills will be set to 0 and all players revived. Team names stay.')){
    state.teams.forEach(t => {
      t.kills = 0;
      t.players = [true,true,true,true];
    });
    saveState();
    renderGrid();
  }
});

// Reset All: removes all teams completely
document.getElementById('resetAllBtn').addEventListener('click', ()=>{
  if(confirm('Reset ALL data? This will remove all teams, names and kills.')){
    state = { teams: [] };
    saveState();
    renderGrid();
  }
});

document.getElementById('exportBtn').addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bgmi-match-' + Date.now() + '.json';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('importBtn').addEventListener('click', ()=>{
  document.getElementById('importFile').click();
});
document.getElementById('importFile').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (ev)=>{
    try{
      const data = JSON.parse(ev.target.result);
      if(data.teams){
        state = migrateState(data);
        saveState();
        renderGrid();
      }else{
        alert('Invalid file: missing "teams" array.');
      }
    }catch(err){
      alert('Could not parse JSON file.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

function addTeam(){
  const nextId = state.teams.length + 1;
  state.teams.push({
    id: nextId,
    name: 'Team ' + nextId,
    logo: LOGO_EMOJIS[(nextId - 1) % LOGO_EMOJIS.length],
    kills: 0,
    players: [true,true,true,true]
  });
  saveState();
  renderGrid();
}

document.getElementById('addTeamBtn').addEventListener('click', addTeam);

renderGrid();
renderStats();
