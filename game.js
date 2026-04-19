// ====== BUILD INFO ======
const BUILD_NUMBER = 18;

// ====== DOM ELEMENTS ======
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const mainMenu = document.getElementById("main-menu");
const startBtn = document.getElementById("start-btn");
const highScoreList = document.getElementById("high-score-list");
const exitBtn = document.getElementById("exit-btn");
const powerupIndicator = document.getElementById("powerup-indicator");
const initialsOverlay = document.getElementById("initials-overlay");
const initialsInput = document.getElementById("initials-input");
const initialsSubmit = document.getElementById("initials-submit");
const finalScoreText = document.getElementById("final-score-text");

// ====== GAME STATE ======
let bullets = [];
let asteroids = [];
let powerups = [];
let mouse = { x: 0, y: 0, down: false };
let score = 0;
let highScores = [];
let gameRunning = false;
let lastShot = 0;

// Powerup state
let laserCount = 1; // How many lasers fired per shot
let multiLaserTimer = null;

// Background scroll
let bgOffset = 0;
let earthImg = null;
let earthLoaded = false;

// ====== GENERATE EARTH BACKGROUND ======
function generateEarthBackground() {
    // Create an offscreen canvas to draw a procedural orbital Earth view
    const offscreen = document.createElement("canvas");
    offscreen.width = 2048;
    offscreen.height = 2048;
    const oc = offscreen.getContext("2d");

    // Deep space base
    oc.fillStyle = "#000814";
    oc.fillRect(0, 0, 2048, 2048);

    // Draw stars
    for (let i = 0; i < 300; i++) {
        const sx = Math.random() * 2048;
        const sy = Math.random() * 2048;
        const sr = Math.random() * 1.5 + 0.3;
        const brightness = Math.floor(Math.random() * 100 + 155);
        oc.fillStyle = `rgba(${brightness},${brightness},${brightness + 30},${Math.random() * 0.5 + 0.5})`;
        oc.beginPath();
        oc.arc(sx, sy, sr, 0, Math.PI * 2);
        oc.fill();
    }

    // Draw a large curved Earth surface across the bottom portion
    const gradient = oc.createLinearGradient(0, 1200, 0, 2048);
    gradient.addColorStop(0, "#0066cc");
    gradient.addColorStop(0.3, "#1a8a3f");
    gradient.addColorStop(0.5, "#2d7d3f");
    gradient.addColorStop(0.7, "#1a6633");
    gradient.addColorStop(1, "#0d3d1f");

    // Draw curved horizon
    oc.beginPath();
    oc.moveTo(0, 1500);
    oc.quadraticCurveTo(1024, 1200, 2048, 1500);
    oc.lineTo(2048, 2048);
    oc.lineTo(0, 2048);
    oc.closePath();
    oc.fillStyle = gradient;
    oc.fill();

    // Atmosphere glow along the horizon
    const atmosGrad = oc.createLinearGradient(0, 1300, 0, 1550);
    atmosGrad.addColorStop(0, "rgba(100,180,255,0)");
    atmosGrad.addColorStop(0.5, "rgba(100,180,255,0.15)");
    atmosGrad.addColorStop(1, "rgba(100,180,255,0)");
    oc.fillStyle = atmosGrad;
    oc.beginPath();
    oc.moveTo(0, 1400);
    oc.quadraticCurveTo(1024, 1100, 2048, 1400);
    oc.lineTo(2048, 1600);
    oc.quadraticCurveTo(1024, 1300, 0, 1600);
    oc.closePath();
    oc.fill();

    // Add some continent-like patches (green/brown shapes)
    const landColors = ["#2a7d3f", "#3a8d4a", "#1e6b30", "#4d9955"];
    for (let i = 0; i < 8; i++) {
        const lx = Math.random() * 2048;
        const ly = 1400 + Math.random() * 400;
        const lw = 80 + Math.random() * 200;
        const lh = 40 + Math.random() * 100;
        oc.fillStyle = landColors[Math.floor(Math.random() * landColors.length)];
        oc.beginPath();
        oc.ellipse(lx, ly, lw, lh, Math.random() * Math.PI, 0, Math.PI * 2);
        oc.fill();
    }

    // Ocean patches
    for (let i = 0; i < 5; i++) {
        const ox = Math.random() * 2048;
        const oy = 1450 + Math.random() * 350;
        const ow = 60 + Math.random() * 150;
        const oh = 30 + Math.random() * 80;
        oc.fillStyle = "rgba(0,80,180,0.4)";
        oc.beginPath();
        oc.ellipse(ox, oy, ow, oh, Math.random() * Math.PI, 0, Math.PI * 2);
        oc.fill();
    }

    // Cloud wisps across the surface
    for (let i = 0; i < 12; i++) {
        const cx = Math.random() * 2048;
        const cy = 1350 + Math.random() * 400;
        const cw = 60 + Math.random() * 180;
        const ch = 15 + Math.random() * 40;
        oc.fillStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.1})`;
        oc.beginPath();
        oc.ellipse(cx, cy, cw, ch, Math.random() * 0.5, 0, Math.PI * 2);
        oc.fill();
    }

    earthImg = offscreen;
    earthLoaded = true;
}

function drawBackground() {
    if (!earthLoaded) return;
    // Slowly scroll the background downward
    bgOffset = (bgOffset + 0.3) % earthImg.height;

    // Tile the background to fill the canvas
    const startY = -bgOffset;
    for (let y = startY; y < canvas.height; y += earthImg.height) {
        for (let x = 0; x < canvas.width; x += earthImg.width) {
            ctx.drawImage(earthImg, x, y);
        }
    }
}

// Generate on load
generateEarthBackground();

// ====== HIGH SCORE BOARD ======
function updateHighScoresDisplay() {
    highScoreList.innerHTML = "";
    if (highScores.length === 0) {
        const li = document.createElement("li");
        li.textContent = "No scores yet";
        li.style.color = "#666";
        li.style.listStyle = "none";
        highScoreList.appendChild(li);
        return;
    }
    highScores.slice(0, 10).forEach((entry) => {
        const li = document.createElement("li");
        const buildTag = entry.build ? " (b" + entry.build + ")" : "";
        li.textContent = entry.name + "  " + entry.score.toLocaleString() + buildTag;
        highScoreList.appendChild(li);
    });
}

// ====== FIRESTORE HIGH SCORES ======
function loadHighScores() {
    db.collection("highscores")
        .orderBy("score", "desc")
        .limit(10)
        .get()
        .then((snapshot) => {
            highScores = [];
            snapshot.forEach((doc) => {
                highScores.push(doc.data());
            });
            updateHighScoresDisplay();
        })
        .catch((err) => {
            console.error("Failed to load high scores:", err);
        });
}

function saveScoreToFirestore(name, scoreVal) {
    return db.collection("highscores").add({
        name: name,
        score: scoreVal,
        build: BUILD_NUMBER,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        // After saving, prune to top 10
        return db.collection("highscores")
            .orderBy("score", "desc")
            .get()
            .then((snapshot) => {
                const docs = snapshot.docs;
                if (docs.length > 10) {
                    const batch = db.batch();
                    docs.slice(10).forEach((doc) => batch.delete(doc.ref));
                    return batch.commit();
                }
            });
    });
}

loadHighScores();

// ====== EVENT LISTENERS ======
canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
});

canvas.addEventListener("mousedown", (e) => {
    e.preventDefault();
    mouse.down = true;
});
canvas.addEventListener("mouseup", () => mouse.down = false);

startBtn.addEventListener("click", startGame);
exitBtn.addEventListener("click", exitGame);

// ====== GAME START ======
function startGame() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.cursor = "none";

    mainMenu.style.display = "none";
    canvas.style.display = "block";
    exitBtn.style.display = "block";

    score = 0;
    bullets = [];
    asteroids = [];
    powerups = [];
    laserCount = 1;
    if (multiLaserTimer) clearTimeout(multiLaserTimer);
    powerupIndicator.style.display = "none";
    gameRunning = true;

    spawnAsteroid();
    schedulePowerup();
    requestAnimationFrame(gameLoop);
}

// ====== EXIT GAME ======
function exitGame() {
    gameRunning = false;

    // Clear powerup state
    laserCount = 1;
    if (multiLaserTimer) clearTimeout(multiLaserTimer);
    powerupIndicator.style.display = "none";

    canvas.style.display = "none";
    exitBtn.style.display = "none";

    if (score > 0) {
        // Show initials prompt
        finalScoreText.textContent = "Score: " + score.toLocaleString();
        initialsInput.value = "XX";
        initialsOverlay.style.display = "flex";
        initialsInput.focus();
    } else {
        mainMenu.style.display = "flex";
    }
}

function saveScoreWithInitials(initials) {
    initials = initials.toUpperCase().replace(/[^A-Z]/g, "").substring(0, 2);
    if (!initials) initials = "XX";
    while (initials.length < 2) initials += "X";

    initialsOverlay.style.display = "none";
    mainMenu.style.display = "flex";

    saveScoreToFirestore(initials, score)
        .then(() => loadHighScores())
        .catch((err) => {
            console.error("Failed to save score:", err);
            // Fallback: update local display anyway
            highScores.push({ name: initials, score: score, build: BUILD_NUMBER });
            highScores.sort((a, b) => b.score - a.score);
            highScores = highScores.slice(0, 10);
            updateHighScoresDisplay();
        });
}

initialsSubmit.addEventListener("click", () => {
    saveScoreWithInitials(initialsInput.value);
});

initialsInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        saveScoreWithInitials(initialsInput.value);
    }
});

// ====== SHOOTING ======
function shoot() {
    if (laserCount === 1) {
        bullets.push({
            x: mouse.x, y: mouse.y,
            size: 20, speed: 12
        });
    } else {
        // Multi-laser: spread evenly
        const spreadAngle = 0.15;
        const totalSpread = (laserCount - 1) * spreadAngle;
        const startAngle = -totalSpread / 2;
        for (let i = 0; i < laserCount; i++) {
            const angle = startAngle + i * spreadAngle;
            bullets.push({
                x: mouse.x, y: mouse.y,
                size: 20, speed: 12,
                dx: Math.sin(angle),
                dy: -Math.cos(angle)
            });
        }
    }
}

// ====== POWERUPS ======
function schedulePowerup() {
    if (!gameRunning) return;
    // Spawn a powerup every 12–22 seconds
    setTimeout(() => {
        if (!gameRunning) return;
        spawnPowerup();
        schedulePowerup();
    }, 12000 + Math.random() * 10000);
}

function spawnPowerup() {
    const margin = 80;
    const x = margin + Math.random() * (canvas.width - margin * 2);
    const y = margin + Math.random() * (canvas.height - margin * 2);
    powerups.push({ x, y, size: 18, type: "multi-laser", spawnTime: Date.now() });
}

function drawPowerup(p) {
    const pulse = 1 + 0.15 * Math.sin(Date.now() / 200);
    const drawSize = p.size * pulse;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Date.now() / 800);

    // Draw a 5-pointed star
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        const outerAngle = (i * 72 - 90) * Math.PI / 180;
        const innerAngle = ((i * 72) + 36 - 90) * Math.PI / 180;
        ctx.lineTo(Math.cos(outerAngle) * drawSize, Math.sin(outerAngle) * drawSize);
        ctx.lineTo(Math.cos(innerAngle) * drawSize * 0.45, Math.sin(innerAngle) * drawSize * 0.45);
    }
    ctx.closePath();
    ctx.fillStyle = "lime";
    ctx.shadowColor = "lime";
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();
}

function collectPowerup(p) {
    laserCount = Math.min(laserCount + 2, 7); // Add 2 lasers, max 7
    powerupIndicator.textContent = "\u2733 MULTI-LASER x" + laserCount + " \u2733";
    powerupIndicator.style.display = "block";

    // Reset timer: effect lasts 8 seconds from last pickup
    if (multiLaserTimer) clearTimeout(multiLaserTimer);
    multiLaserTimer = setTimeout(() => {
        laserCount = 1;
        powerupIndicator.style.display = "none";
    }, 8000);
}

// ====== ASTEROIDS ======
function spawnAsteroid() {
    if (!gameRunning) return;

    const size = Math.random() * 30 + 10;
    const edge = Math.floor(Math.random() * 4);

    let x, y;
    if (edge === 0) { x = Math.random() * canvas.width; y = -size; }
    if (edge === 1) { x = canvas.width + size; y = Math.random() * canvas.height; }
    if (edge === 2) { x = Math.random() * canvas.width; y = canvas.height + size; }
    if (edge === 3) { x = -size; y = Math.random() * canvas.height; }

    const angle = Math.atan2(canvas.height / 2 - y, canvas.width / 2 - x);

    asteroids.push({
        x, y, size,
        speed: 1 + (40 - size) / 30 * 3,
        dx: Math.cos(angle),
        dy: Math.sin(angle),
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        shape: generateAsteroidShape(size)
    });

    setTimeout(spawnAsteroid, 800 + Math.random() * 800);
}

// ====== COLLISION CHECK ======
function isColliding(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < a.size + b.size;
}

// ====== DRAW SPACESHIP ======
function drawSpaceship(x, y) {
    ctx.save();
    ctx.translate(x, y);

    const flicker = 0.7 + Math.random() * 0.3;

    // === ENGINE GLOW (drawn first, behind everything) ===
    // Main thruster flame
    const mainFlame = ctx.createRadialGradient(0, 20, 1, 0, 24, 14 * flicker);
    mainFlame.addColorStop(0, "rgba(255,120,30,0.9)");
    mainFlame.addColorStop(0.3, "rgba(255,60,10,0.6)");
    mainFlame.addColorStop(0.7, "rgba(200,30,0,0.2)");
    mainFlame.addColorStop(1, "rgba(100,0,0,0)");
    ctx.fillStyle = mainFlame;
    ctx.beginPath();
    ctx.ellipse(0, 24, 5 * flicker, 14 * flicker, 0, 0, Math.PI * 2);
    ctx.fill();

    // Side thruster flames
    [-12, 12].forEach(sx => {
        const sideFlame = ctx.createRadialGradient(sx, 14, 0, sx, 16, 7 * flicker);
        sideFlame.addColorStop(0, "rgba(255,150,50,0.8)");
        sideFlame.addColorStop(0.5, "rgba(255,60,10,0.3)");
        sideFlame.addColorStop(1, "rgba(100,0,0,0)");
        ctx.fillStyle = sideFlame;
        ctx.beginPath();
        ctx.ellipse(sx, 16, 3 * flicker, 7 * flicker, 0, 0, Math.PI * 2);
        ctx.fill();
    });

    // === FORWARD-SWEPT WINGS (X-wing style, angled forward) ===
    // Left upper wing (sweeps forward-left)
    ctx.beginPath();
    ctx.moveTo(-4, -4);
    ctx.lineTo(-26, -18);
    ctx.lineTo(-28, -16);
    ctx.lineTo(-24, -12);
    ctx.lineTo(-6, 2);
    ctx.closePath();
    const luwGrad = ctx.createLinearGradient(-28, -18, -4, 0);
    luwGrad.addColorStop(0, "#1a3355");
    luwGrad.addColorStop(1, "#3366aa");
    ctx.fillStyle = luwGrad;
    ctx.fill();
    ctx.strokeStyle = "#5588cc";
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Right upper wing
    ctx.beginPath();
    ctx.moveTo(4, -4);
    ctx.lineTo(26, -18);
    ctx.lineTo(28, -16);
    ctx.lineTo(24, -12);
    ctx.lineTo(6, 2);
    ctx.closePath();
    const ruwGrad = ctx.createLinearGradient(28, -18, 4, 0);
    ruwGrad.addColorStop(0, "#1a3355");
    ruwGrad.addColorStop(1, "#3366aa");
    ctx.fillStyle = ruwGrad;
    ctx.fill();
    ctx.stroke();

    // Left lower wing (sweeps back)
    ctx.beginPath();
    ctx.moveTo(-5, 4);
    ctx.lineTo(-20, 12);
    ctx.lineTo(-18, 14);
    ctx.lineTo(-12, 14);
    ctx.lineTo(-5, 8);
    ctx.closePath();
    ctx.fillStyle = "#223366";
    ctx.fill();

    // Right lower wing
    ctx.beginPath();
    ctx.moveTo(5, 4);
    ctx.lineTo(20, 12);
    ctx.lineTo(18, 14);
    ctx.lineTo(12, 14);
    ctx.lineTo(5, 8);
    ctx.closePath();
    ctx.fillStyle = "#223366";
    ctx.fill();

    // Wing-tip cannons (left)
    ctx.fillStyle = "#99aacc";
    ctx.fillRect(-29, -19, 5, 2);
    // Wing-tip cannons (right)
    ctx.fillRect(24, -19, 5, 2);

    // === MAIN FUSELAGE - angular diamond shape ===
    ctx.beginPath();
    ctx.moveTo(0, -24);       // Nose
    ctx.lineTo(7, -8);        // Widen
    ctx.lineTo(6, 8);
    ctx.lineTo(4, 16);        // Tail taper
    ctx.lineTo(-4, 16);
    ctx.lineTo(-6, 8);
    ctx.lineTo(-7, -8);
    ctx.closePath();
    const bodyGrad = ctx.createLinearGradient(-7, 0, 7, 0);
    bodyGrad.addColorStop(0, "#1a2a44");
    bodyGrad.addColorStop(0.35, "#335577");
    bodyGrad.addColorStop(0.5, "#4477aa");
    bodyGrad.addColorStop(0.65, "#335577");
    bodyGrad.addColorStop(1, "#1a2a44");
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = "#5588bb";
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Hull panel lines
    ctx.strokeStyle = "rgba(100,160,220,0.3)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-3, -18); ctx.lineTo(-4, 14);
    ctx.moveTo(3, -18); ctx.lineTo(4, 14);
    ctx.moveTo(-6, 0); ctx.lineTo(6, 0);
    ctx.stroke();

    // Orange accent stripes
    ctx.fillStyle = "#ff6600";
    ctx.beginPath();
    ctx.moveTo(-2, -20); ctx.lineTo(-1.5, 14); ctx.lineTo(-3, 14); ctx.lineTo(-3.5, -20);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(2, -20); ctx.lineTo(1.5, 14); ctx.lineTo(3, 14); ctx.lineTo(3.5, -20);
    ctx.closePath();
    ctx.fill();

    // === COCKPIT ===
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(4, -12);
    ctx.lineTo(0, -8);
    ctx.lineTo(-4, -12);
    ctx.closePath();
    const cockpitGrad = ctx.createLinearGradient(0, -22, 0, -8);
    cockpitGrad.addColorStop(0, "#aaddff");
    cockpitGrad.addColorStop(0.5, "#44aaee");
    cockpitGrad.addColorStop(1, "#2266aa");
    ctx.fillStyle = cockpitGrad;
    ctx.shadowColor = "#66ccff";
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
    // Cockpit frame
    ctx.strokeStyle = "#88bbdd";
    ctx.lineWidth = 0.7;
    ctx.stroke();

    // === ENGINE PODS (side-mounted) ===
    [-12, 12].forEach(sx => {
        ctx.beginPath();
        ctx.moveTo(sx - 2, 6);
        ctx.lineTo(sx + 2, 6);
        ctx.lineTo(sx + 3, 14);
        ctx.lineTo(sx - 3, 14);
        ctx.closePath();
        ctx.fillStyle = "#2a3a55";
        ctx.fill();
        ctx.strokeStyle = "#5577aa";
        ctx.lineWidth = 0.5;
        ctx.stroke();
        // engine nozzle glow ring
        ctx.beginPath();
        ctx.arc(sx, 14, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,100,20,${0.4 + flicker * 0.3})`;
        ctx.fill();
    });

    // Main engine nozzle
    ctx.beginPath();
    ctx.arc(0, 17, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,120,30,${0.5 + flicker * 0.3})`;
    ctx.fill();

    ctx.restore();
}

// ====== DRAW ASTEROID ======
function drawAsteroid(x, y, size, rotation, shape) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.beginPath();
    for (let i = 0; i < shape.length; i++) {
        const px = shape[i].x;
        const py = shape[i].y;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = "gray";
    ctx.fill();
    ctx.restore();
}

function generateAsteroidShape(size) {
    const points = [];
    const numPoints = 6 + Math.floor(Math.random() * 4);
    for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        const radius = size * (0.7 + Math.random() * 0.6);
        points.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
    }
    return points;
}

// ====== GAME LOOP ======
function gameLoop() {
    if (!gameRunning) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw scrolling background
    drawBackground();

    // Draw spaceship at mouse position
    drawSpaceship(mouse.x, mouse.y);

    // Shoot lasers if mouse down and cooldown passed
    if (mouse.down && Date.now() - lastShot > 300) {
        shoot();
        lastShot = Date.now();
    }

    // Update bullets
    bullets.forEach((b, i) => {
        if (b.dx !== undefined && b.dy !== undefined) {
            b.x += b.dx * b.speed;
            b.y += b.dy * b.speed;
        } else {
            b.y -= b.speed;
        }
        ctx.fillStyle = "cyan";
        ctx.shadowColor = "cyan";
        ctx.shadowBlur = 6;
        ctx.fillRect(b.x - 1, b.y, 2, b.size);
        ctx.shadowBlur = 0;

        // Remove off-screen bullets
        if (b.y < -b.size || b.x < -b.size || b.x > canvas.width + b.size) {
            bullets.splice(i, 1);
        }
    });

    // Update asteroids
    asteroids.forEach((a, i) => {
        a.x += a.dx * a.speed;
        a.y += a.dy * a.speed;
        a.rotation += a.rotationSpeed;

        // Check collisions with other asteroids
        for (let j = i + 1; j < asteroids.length; j++) {
            const b = asteroids[j];
            if (isColliding(a, b)) {
                if (a.size > 15) {
                    const numPieces = 2;
                    for (let k = 0; k < numPieces; k++) {
                        const newSize = a.size / 2;
                        const newAngle = Math.random() * Math.PI * 2;
                        asteroids.push({
                            x: a.x, y: a.y, size: newSize,
                            speed: 1 + (40 - newSize) / 30 * 3,
                            dx: Math.cos(newAngle), dy: Math.sin(newAngle),
                            rotation: 0,
                            rotationSpeed: (Math.random() - 0.5) * 0.2,
                            shape: generateAsteroidShape(newSize)
                        });
                    }
                    asteroids.splice(i, 1);
                    i--;
                    break;
                }
                if (b.size > 15) {
                    const numPieces = 2;
                    for (let k = 0; k < numPieces; k++) {
                        const newSize = b.size / 2;
                        const newAngle = Math.random() * Math.PI * 2;
                        asteroids.push({
                            x: b.x, y: b.y, size: newSize,
                            speed: 1 + (40 - newSize) / 30 * 3,
                            dx: Math.cos(newAngle), dy: Math.sin(newAngle),
                            rotation: 0,
                            rotationSpeed: (Math.random() - 0.5) * 0.2,
                            shape: generateAsteroidShape(newSize)
                        });
                    }
                    asteroids.splice(j, 1);
                    j--;
                }
            }
        }

        drawAsteroid(a.x, a.y, a.size, a.rotation, a.shape);

        // Check spaceship collision
        if (isColliding({ x: mouse.x, y: mouse.y, size: 10 }, a)) {
            exitGame();
            return;
        }

        // Bullet collisions
        bullets.forEach((b, j) => {
            if (isColliding({ x: b.x, y: b.y, size: b.size / 2 }, a)) {
                score += Math.floor(100 - a.size);
                if (a.size > 15) {
                    const numPieces = 2 + Math.floor(Math.random() * 2);
                    for (let k = 0; k < numPieces; k++) {
                        const newSize = a.size / 2;
                        const newAngle = Math.random() * Math.PI * 2;
                        asteroids.push({
                            x: a.x, y: a.y, size: newSize,
                            speed: 1 + (40 - newSize) / 30 * 3,
                            dx: Math.cos(newAngle), dy: Math.sin(newAngle),
                            rotation: 0,
                            rotationSpeed: (Math.random() - 0.5) * 0.2,
                            shape: generateAsteroidShape(newSize)
                        });
                    }
                }
                asteroids.splice(i, 1);
                bullets.splice(j, 1);
                return;
            }
        });
    });

    // Draw and check powerups
    powerups.forEach((p, i) => {
        drawPowerup(p);

        // Despawn after 10 seconds
        if (Date.now() - p.spawnTime > 10000) {
            powerups.splice(i, 1);
            return;
        }

        // Check collection
        if (isColliding({ x: mouse.x, y: mouse.y, size: 12 }, p)) {
            collectPowerup(p);
            powerups.splice(i, 1);
        }
    });

    // Draw score
    ctx.fillStyle = "white";
    ctx.font = "20px Arial";
    ctx.fillText("Score: " + score, 10, 25);

    // Show laser count during powerup
    if (laserCount > 1) {
        ctx.fillStyle = "lime";
        ctx.font = "16px Arial";
        ctx.fillText("Lasers: " + laserCount, 10, 50);
    }

    requestAnimationFrame(gameLoop);
}
