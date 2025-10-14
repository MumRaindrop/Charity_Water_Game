// Animate people walking toward drills
setInterval(() => {
  for (const p of people) {
    if (p.state === 'walking') {
      if (typeof p.targetX !== 'undefined') {
        if (p.x < p.targetX) {
          p.x += 0.2;
          if (p.x >= p.targetX) {
            p.x = p.targetX;
            p.state = 'waiting';
          }
        } else if (p.x > p.targetX) {
          p.x -= 0.2;
          if (p.x <= p.targetX) {
            p.x = p.targetX;
            p.state = 'waiting';
          }
        }
      }
    }
  }
  draw();
}, 60);

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gridSize = 12;
const cellSize = 40;
const groundLevel = 2;
let score = 0;
let money = 500;
let mode = 'sonar';
let deposits = [];
let revealed = [];
let sonarAnim = null;
let pipes = [];
let drills = [];
let selectedDrill = null;
let people = [];
let waterFlow = false;
let gameOver = false;
let leaderboard = [];
let requestedPipeMode = false;

function initGame() {
  deposits = [];
  revealed = [];
  pipes = [];
  drills = [];
  selectedDrill = null;
  people = [];
  waterFlow = false;
  score = 0;
  money = 500;
  for (let y = groundLevel; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (Math.random() < 0.12) {
        const size = Math.random() < 0.5 ? 1 : (Math.random() < 0.7 ? 2 : 3);
        const water = size * (20 + Math.floor(Math.random() * 30));
        deposits.push({ x, y, size, water, state: 'full', removeTime: null });
      }
    }
  }
  draw();
  updateScore();
  document.getElementById('gameOverScreen').style.display = 'none';
  document.getElementById('leaderboardScreen').style.display = 'none';
  document.getElementById('gameCanvas').style.filter = '';
  gameOver = false;
}

// Reveal duration now randomized between 25–35 seconds
function revealCell(x, y) {
  const now = Date.now();
  const revealDuration = 25000 + Math.random() * 10000;
  const expiresAt = now + revealDuration;

  const existing = revealed.find(r => r.x === x && r.y === y);
  if (existing) {
    existing.expiresAt = expiresAt;
  } else {
    revealed.push({ x, y, expiresAt });
  }
}

function isCellRevealed(x, y) {
  const now = Date.now();
  // Keep cells revealed if they have a deposit
  revealed = revealed.filter(r => {
    const dep = deposits.find(d => d.x === r.x && d.y === r.y);
    const hasDeposit = dep && (dep.water > 0 || (dep.state === 'empty' && dep.removeTime && now < dep.removeTime));
    return r.expiresAt > now || hasDeposit;
  });
  return revealed.some(r => r.x === x && r.y === y);
}

function draw() {
  if (gameOver) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Ground
  ctx.fillStyle = '#a1887f';
  ctx.fillRect(0, groundLevel * cellSize, canvas.width, canvas.height - groundLevel * cellSize);

  // Grid
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (isCellRevealed(x, y)) {
        ctx.fillStyle = '#8d6e63';
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
      ctx.strokeStyle = '#bdbdbd';
      ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  }

  // Deposits
  for (const dep of deposits) {
  if (isCellRevealed(dep.x, dep.y)) {
    if (dep.water > 0) {
      dep.state = 'full';
      const maxRadius = cellSize / 4 + dep.size * 4;
      const radius = Math.max(cellSize / 6, maxRadius * (dep.water / (dep.size * 50)));
      ctx.fillStyle = '#2196f3';
      ctx.beginPath();
      ctx.arc(dep.x * cellSize + cellSize / 2, dep.y * cellSize + cellSize / 2, radius, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = '#1565c0';
      ctx.font = '12px Arial';
      ctx.fillText(dep.water, dep.x * cellSize + 4, dep.y * cellSize + cellSize - 4);
    } else {
      // Water drained -> grey empty
      if (dep.state !== 'empty') {
        dep.state = 'empty';
        dep.removeTime = Date.now() + 2000; // 2s grey empty
      }
      if (Date.now() < dep.removeTime) {
        ctx.fillStyle = '#bdbdbd';
        ctx.beginPath();
        ctx.arc(dep.x * cellSize + cellSize / 2, dep.y * cellSize + cellSize / 2, cellSize / 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = '#757575';
        ctx.font = '12px Arial';
        ctx.fillText('Empty', dep.x * cellSize + 4, dep.y * cellSize + cellSize - 4);
      }
    }
  }
}

  // Sonar animation
  if (sonarAnim) {
    ctx.save();
    ctx.strokeStyle = 'rgba(33,150,243,0.5)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(sonarAnim.x * cellSize + cellSize / 2, sonarAnim.y * cellSize + cellSize / 2, sonarAnim.radius, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.restore();
  }

  // Pipes
  for (const pipe of pipes) {
    ctx.strokeStyle = '#607d8b';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(pipe.from.x * cellSize + cellSize / 2, pipe.from.y * cellSize + cellSize / 2);
    ctx.lineTo(pipe.to.x * cellSize + cellSize / 2, pipe.to.y * cellSize + cellSize / 2);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  // Drills
  for (const d of drills) {
    ctx.fillStyle = (selectedDrill && d.x === selectedDrill.x && d.y === selectedDrill.y) ? '#ffd54f' : '#ffb300';
    ctx.fillRect(d.x * cellSize + cellSize / 4, (d.y - 1) * cellSize, cellSize / 2, cellSize);
    ctx.fillStyle = '#616161';
    ctx.fillRect(d.x * cellSize + cellSize / 3, d.y * cellSize, cellSize / 3, cellSize / 2);

    ctx.fillStyle = '#2196f3';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText((d.water || 0) + '/50', d.x * cellSize + cellSize / 2, (d.y - 1) * cellSize - 6);
    ctx.textAlign = 'start';
  }

  // People
  for (const p of people) {
    ctx.fillStyle = p.color || '#4caf50';
    ctx.beginPath();
    ctx.arc(p.x * cellSize + cellSize / 2, (p.y - 1) * cellSize + cellSize / 2, cellSize / 3, 0, 2 * Math.PI);
    ctx.fill();

    if (p.state === 'waiting') {
      ctx.fillStyle = '#ff9800';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('💧', p.x * cellSize + cellSize / 2, (p.y - 1) * cellSize + cellSize / 2 - 18);
      ctx.textAlign = 'start';
    }
  }
}

canvas.addEventListener('click', function (e) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / cellSize);
  const y = Math.floor((e.clientY - rect.top) / cellSize);

  const clickedDrill = drills.find(d => d.x === x && d.y === groundLevel);
  if (clickedDrill) {
    selectedDrill = clickedDrill;
    if (mode === 'drill' && requestedPipeMode) {
      mode = 'pipe';
      document.getElementById('pipeBtn').classList.add('active');
      document.getElementById('drillBtn').classList.remove('active');
      requestedPipeMode = false;
    }
    draw();
  }

  if (mode === 'sonar' && y >= groundLevel) {
    if (!isCellRevealed(x, y)) {
      if (money < 20) return;
      money -= 20;
      updateScore();
      sonarAnim = { x, y, radius: 0, max: cellSize / 2 };
      let animSteps = 12, step = 0;
      const animateSonar = () => {
        sonarAnim.radius = (step / animSteps) * sonarAnim.max;
        draw();
        step++;
        if (step <= animSteps) setTimeout(animateSonar, 30);
        else {
          revealCell(x, y);
          sonarAnim = null;
          draw();
        }
      };
      animateSonar();
    }
  } else if (mode === 'drill' && y === groundLevel - 1) {
    if (!drills.some(d => d.x === x && d.y === groundLevel)) {
      if (money < 100) return;
      money -= 100;
      updateScore();
      drills.push({ x, y: groundLevel, water: 0 });
      draw();
    }
  } else if (mode === 'pipe') {
    if (selectedDrill && isCellRevealed(x, y) && deposits.some(d => d.x === x && d.y === y)) {
      if (pipes.some(pipe => pipe.from.x === x && pipe.from.y === y && pipe.to.x === selectedDrill.x && pipe.to.y === selectedDrill.y)) return;
      const dx = Math.abs(x - selectedDrill.x);
      const dy = Math.abs(y - selectedDrill.y);
      const length = dx + dy;
      const cost = Math.ceil(length * 10 / 10) * 10;
      if (money < cost) return;
      money -= cost;
      updateScore();
      pipes.push({ from: { x, y }, to: { x: selectedDrill.x, y: selectedDrill.y } });
      waterFlow = true;
      draw();
    }
  }
});

function setMode(m) {
  if (m === 'pipe') {
    if (!selectedDrill) {
      requestedPipeMode = true;
      mode = 'drill';
      document.getElementById('sonarBtn').classList.remove('active');
      document.getElementById('drillBtn').classList.add('active');
      document.getElementById('pipeBtn').classList.remove('active');
      return;
    }
  }
  requestedPipeMode = false;
  mode = m;
  document.getElementById('sonarBtn').classList.toggle('active', m === 'sonar');
  document.getElementById('drillBtn').classList.toggle('active', m === 'drill');
  document.getElementById('pipeBtn').classList.toggle('active', m === 'pipe');
}

function updateScore() {
  document.getElementById('score').textContent = 'Thirst Quenched: ' + score;
  const moneyElem = document.getElementById('money');
  moneyElem.textContent = '$' + money;
  if (updateScore.lastMoney !== undefined && updateScore.lastMoney !== money) {
    moneyElem.style.transform = 'scale(1.2)';
    moneyElem.style.color = (money > updateScore.lastMoney) ? '#43a047' : '#e53935';
    setTimeout(() => {
      moneyElem.style.transform = '';
      moneyElem.style.color = '#1976d2';
    }, 300);
  }
  updateScore.lastMoney = money;
}

function spawnPerson() {
  if (drills.length > 0) {
    const d = drills[Math.floor(Math.random() * drills.length)];
    const fromLeft = Math.random() < 0.5;
    const startX = fromLeft ? -1 : gridSize;
    const thirst = Math.floor(Math.random() * 5) + 1;
    let color = '#4caf50';
    if (thirst === 2) color = '#8bc34a';
    if (thirst === 3) color = '#ffeb3b';
    if (thirst === 4) color = '#ff9800';
    if (thirst === 5) color = '#f44336';
    people.push({ x: startX, y: groundLevel, targetX: d.x, state: 'walking', thirst, color });
    draw();
  }
}

function serveWater() {
  for (const drill of drills) {
    const waiting = people.filter(p => p.x === drill.x && p.y === groundLevel && p.state === 'waiting');
    if (drill.water > 0 && waiting.length > 0) {
      const person = waiting[0];
      const drink = Math.min(person.thirst, drill.water);
      drill.water -= drink;
      score += 1;
      money += 50;
      updateScore();
      people.splice(people.indexOf(person), 1);
      draw();
    }
  }
}

// People spawn
setInterval(() => {
  const maxPeople = drills.length * 3;
  if (drills.length > 0 && Math.random() < 0.3 && people.length < maxPeople) spawnPerson();
}, 1200);

// Water flow update
setInterval(() => {
  deposits = deposits.filter(dep => dep.water > 0 || !dep.removeTime || Date.now() < dep.removeTime);

  pipes = pipes.filter(pipe => {
    const dep = deposits.find(d => d.x === pipe.from.x && d.y === pipe.from.y);
    return dep && dep.water > 0;
  });

  for (const pipe of pipes) {
    const dep = deposits.find(d => d.x === pipe.from.x && d.y === pipe.from.y);
    const drill = drills.find(dr => dr.x === pipe.to.x && dr.y === pipe.to.y);
    if (dep && drill && dep.water > 0 && drill.water < 50) {
      const transfer = Math.min(5, dep.water, 50 - drill.water);
      dep.water -= transfer;
      drill.water += transfer;
    }
  }

  draw();
}, 1000);

// Expire reveals & manage deposits
setInterval(() => {
  const now = Date.now();
  // Remove expired empty deposits
  deposits = deposits.filter(d => {
    if (d.state === 'empty') {
      return Date.now() < d.removeTime;
    }
    return true; // keep full deposits
  });

  // Remove expired reveals unless cell has a deposit
  revealed = revealed.filter(r => {
    const hasDeposit = deposits.some(d => d.x === r.x && d.y === r.y && d.water > 0);
    return r.expiresAt > now || hasDeposit;
  });

  // Keep around 15 deposits
  if (deposits.length < 15 && Math.random() < 0.1) {
    const candidates = [];
    for (let y = groundLevel; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const revealedCell = revealed.some(r => r.x === x && r.y === y);
        const hasDeposit = deposits.some(d => d.x === x && d.y === y);
        if (!revealedCell && !hasDeposit) candidates.push({ x, y });
      }
    }

    if (candidates.length > 0) {
      const pos = candidates[Math.floor(Math.random() * candidates.length)];
      const size = Math.random() < 0.5 ? 1 : (Math.random() < 0.7 ? 2 : 3);
      const water = size * (20 + Math.floor(Math.random() * 30));
      deposits.push({ x: pos.x, y: pos.y, size, water });
    }
  }

  // Trim excess deposits
  if (deposits.length > 15) {
    const empties = deposits.filter(d => d.water <= 0);
    while (deposits.length > 15 && empties.length > 0) {
      const d = empties.pop();
      deposits.splice(deposits.indexOf(d), 1);
    }
  }

  draw();
}, 4000);

setInterval(() => { serveWater(); }, 1500);

setInterval(() => {
  for (const drill of drills) {
    const waiting = people.filter(p => p.x === drill.x && p.y === groundLevel && p.state === 'waiting');
    if (drill.water <= 0 && waiting.length > 0) {
      for (const person of waiting) {
        if (!person.waitingSince) person.waitingSince = Date.now();
        if (Date.now() - person.waitingSince > 3000) {
          people.splice(people.indexOf(person), 1);
          draw();
        }
      }
    } else {
      for (const person of waiting) { person.waitingSince = undefined; }
    }
  }
}, 500);

function endGame() {
  gameOver = true;
  document.getElementById('gameOverScreen').style.display = 'flex';
  document.getElementById('gameCanvas').style.filter = 'blur(2px) brightness(0.7)';
  let anim = document.getElementById('gameOverAnim');
  anim.style.transform = 'scale(1.3)';
  anim.style.transition = 'transform 0.5s';
  setTimeout(() => { anim.style.transform = 'scale(1)'; }, 500);
}

function showLeaderboardPrompt() {
  document.getElementById('gameOverScreen').style.display = 'none';
  document.getElementById('leaderboardScreen').style.display = 'flex';
}

function submitScore() {
  const name = document.getElementById('playerName').value.trim();
  if (name === '') return;
  leaderboard.push({ name, score });
  leaderboard.sort((a, b) => b.score - a.score);
  const lb = document.getElementById('leaderboardList');
  lb.innerHTML = '';
  for (const e of leaderboard.slice(0, 5)) {
    const li = document.createElement('li');
    li.textContent = e.name + ': ' + e.score;
    lb.appendChild(li);
  }
  document.getElementById('submitScoreBtn').style.display = 'none';
}

initGame();
