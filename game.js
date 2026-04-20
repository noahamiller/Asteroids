// ====== BUILD INFO ======
const BUILD_NUMBER = 24;

// ====== TUNABLE CONSTANTS ======
const POWERUP_DURATION        = 8000;   // ms a powerup lasts per pickup
const POWERUP_MAX_DURATION    = 30000;  // ms hard cap regardless of refreshes
const POWERUP_SPAWN_MIN       = 12000;  // ms minimum time between spawns per type
const POWERUP_SPAWN_MAX       = 20000;  // ms maximum time between spawns per type
const POWERUP_STAGGER_RAPID   = 6000;   // ms before rapid-fire starts spawning
const POWERUP_STAGGER_PIERCE  = 11000;  // ms before pierce-laser starts spawning

const MULTI_LASER_INCREMENT   = 2;      // lasers added per pickup
const MULTI_LASER_MAX         = 9;      // max laser count

const RAPID_FIRE_MULTIPLIER   = 1.75;   // fire rate multiplier per stack
const RAPID_FIRE_MIN_COOLDOWN = 100;    // ms fastest possible fire rate
const BASE_SHOT_COOLDOWN      = 300;    // ms base fire rate

// Ship movement
const THRUST_FORCE   = 0.15;  // velocity added per frame when thrusting
const MAX_SPEED      = 7;     // maximum ship velocity magnitude
const ROTATION_RATE  = 0.05;  // radians rotated per frame

// Shield
const SHIELD_MAX_CHARGES = 3;
const SHIELD_REGEN_TIME  = 30000;  // ms between charge regenerations

// Asteroid spawning
const ASTEROID_SPAWN_MIN    = 800;    // ms minimum interval between spawns
const ASTEROID_SPAWN_MAX    = 1600;   // ms maximum interval between spawns
const ASTEROID_MIN_START    = 1;      // starting minimum asteroid count
const ASTEROID_MIN_INTERVAL = 30000;  // ms between minimum count increases
const ASTEROID_MIN_MAX      = 5;      // ceiling for the minimum count

// Screen wrapping
const WRAP_OVERLAP    = 10;   // px of object still visible before teleporting to other side
const SHIP_VISUAL_SIZE = 30;  // px radius used for ship wrap threshold

// Shield battery pickup
const BATTERY_SPAWN_CHANCE_LOW  = 0.15;  // chance to spawn when dropping from 2 → 1 charge
const BATTERY_SPAWN_CHANCE_HIGH = 0.35;  // chance to spawn when dropping from 1 → 0 charges
const BATTERY_DURATION          = 25000; // ms before battery despawns

// ====== DOM ELEMENTS ======
document.getElementById("build-number").textContent = "Build " + BUILD_NUMBER;
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const mainMenu = document.getElementById("main-menu");
const startBtn = document.getElementById("start-btn");
const highScoreList = document.getElementById("high-score-list");
const highScoreListAllTime = document.getElementById("high-score-list-alltime");
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

// Ship state
let shipX = 0, shipY = 0;
let shipVX = 0, shipVY = 0;
let shipAngle = 0; // radians; 0 = pointing up, increases clockwise

// Shield state
let shieldCharges = SHIELD_MAX_CHARGES;
let shieldRegenTimer = null;

// Shield battery pickup
let shieldBattery = null;
let shieldBatteryTimeout = null;

// Asteroid minimum enforcement
let asteroidMinCount = ASTEROID_MIN_START;
let asteroidMinIncTimer = null;
let asteroidSpawnTimeoutId = null;

// Keyboard input
const keys = {};

// Powerup state
let laserCount = 1;
let multiLaserTimer = null;
let multiLaserStartTime = 0;
let rapidFireMultiplier = 1.0;
let rapidFireTimer = null;
let rapidFireStartTime = 0;
let pierceActive = false;
let pierceTimer = null;
let pierceStartTime = 0;

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

function updateAllTimeScoresDisplay(scores) {
    highScoreListAllTime.innerHTML = "";
    if (scores.length === 0) {
        const li = document.createElement("li");
        li.textContent = "No scores yet";
        li.style.color = "#666";
        li.style.listStyle = "none";
        highScoreListAllTime.appendChild(li);
        return;
    }
    scores.forEach((entry) => {
        const li = document.createElement("li");
        const buildTag = entry.build ? " (b" + entry.build + ")" : "";
        li.textContent = entry.name + "  " + entry.score.toLocaleString() + buildTag;
        highScoreListAllTime.appendChild(li);
    });
}

// ====== FIRESTORE HIGH SCORES ======
function loadHighScores() {
    db.collection("highscores")
        .where("build", "==", BUILD_NUMBER)
        .get()
        .then((snapshot) => {
            highScores = [];
            snapshot.forEach((doc) => highScores.push(doc.data()));
            highScores.sort((a, b) => b.score - a.score);
            highScores = highScores.slice(0, 10);
            updateHighScoresDisplay();
        })
        .catch((err) => {
            console.error("Failed to load high scores:", err);
        });
}

function loadHighScoresAllTime() {
    db.collection("highscores")
        .orderBy("score", "desc")
        .limit(10)
        .get()
        .then((snapshot) => {
            const scores = [];
            snapshot.forEach((doc) => scores.push(doc.data()));
            updateAllTimeScoresDisplay(scores);
        })
        .catch((err) => {
            console.error("Failed to load all-time high scores:", err);
        });
}

function saveScoreToFirestore(name, scoreVal) {
    return db.collection("highscores").add({
        name: name,
        score: scoreVal,
        build: BUILD_NUMBER,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        // Prune to top 10 for the current build only
        return db.collection("highscores")
            .where("build", "==", BUILD_NUMBER)
            .get()
            .then((snapshot) => {
                const docs = snapshot.docs.sort((a, b) => b.data().score - a.data().score);
                if (docs.length > 10) {
                    const batch = db.batch();
                    docs.slice(10).forEach((doc) => batch.delete(doc.ref));
                    return batch.commit();
                }
            });
    });
}

loadHighScores();
loadHighScoresAllTime();

// ====== EVENT LISTENERS ======
const GAME_KEYS = new Set([
    "ArrowUp","ArrowDown","ArrowLeft","ArrowRight",
    "KeyW","KeyA","KeyS","KeyD",
    "Numpad4","Numpad5","Numpad6","Numpad8",
    "Space"
]);

window.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (gameRunning && GAME_KEYS.has(e.code)) e.preventDefault();
});
window.addEventListener("keyup", (e) => { keys[e.code] = false; });

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

    // Ship
    shipX = canvas.width / 2;
    shipY = canvas.height / 2;
    shipVX = 0; shipVY = 0; shipAngle = 0;

    // Shield
    shieldCharges = SHIELD_MAX_CHARGES;
    if (shieldRegenTimer) clearTimeout(shieldRegenTimer);
    shieldRegenTimer = null;
    shieldBattery = null;
    if (shieldBatteryTimeout) clearTimeout(shieldBatteryTimeout);
    shieldBatteryTimeout = null;

    // Asteroid minimum
    asteroidMinCount = ASTEROID_MIN_START;
    if (asteroidMinIncTimer) clearInterval(asteroidMinIncTimer);
    asteroidMinIncTimer = setInterval(() => {
        if (asteroidMinCount < ASTEROID_MIN_MAX) asteroidMinCount++;
    }, ASTEROID_MIN_INTERVAL);
    if (asteroidSpawnTimeoutId) clearTimeout(asteroidSpawnTimeoutId);
    asteroidSpawnTimeoutId = null;

    // Powerups
    laserCount = 1;
    if (multiLaserTimer) clearTimeout(multiLaserTimer);
    rapidFireMultiplier = 1.0;
    if (rapidFireTimer) clearTimeout(rapidFireTimer);
    rapidFireStartTime = 0;
    pierceActive = false;
    if (pierceTimer) clearTimeout(pierceTimer);
    pierceStartTime = 0;
    multiLaserStartTime = 0;
    powerupIndicator.style.display = "none";
    gameRunning = true;

    createAsteroid();
    scheduleNextAsteroid();
    schedulePowerup("multi-laser");
    schedulePowerup("rapid-fire", POWERUP_STAGGER_RAPID + Math.random() * 2000);
    schedulePowerup("pierce-laser", POWERUP_STAGGER_PIERCE + Math.random() * 2000);
    requestAnimationFrame(gameLoop);
}

// ====== EXIT GAME ======
function exitGame() {
    gameRunning = false;

    // Clear timers
    if (shieldRegenTimer) clearTimeout(shieldRegenTimer);
    shieldRegenTimer = null;
    if (asteroidMinIncTimer) clearInterval(asteroidMinIncTimer);
    asteroidMinIncTimer = null;
    if (asteroidSpawnTimeoutId) clearTimeout(asteroidSpawnTimeoutId);
    asteroidSpawnTimeoutId = null;
    laserCount = 1;
    if (multiLaserTimer) clearTimeout(multiLaserTimer);
    multiLaserStartTime = 0;
    rapidFireMultiplier = 1.0;
    if (rapidFireTimer) clearTimeout(rapidFireTimer);
    rapidFireStartTime = 0;
    pierceActive = false;
    if (pierceTimer) clearTimeout(pierceTimer);
    pierceStartTime = 0;
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
        .then(() => { loadHighScores(); loadHighScoresAllTime(); })
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
    const spreadAngle = 0.15;
    const totalSpread = (laserCount - 1) * spreadAngle;
    const startOffset = -totalSpread / 2;
    for (let i = 0; i < laserCount; i++) {
        const a = shipAngle + startOffset + i * spreadAngle;
        bullets.push({ x: shipX, y: shipY, size: 20, speed: 12, dx: Math.sin(a), dy: -Math.cos(a) });
    }
}

// ====== POWERUPS ======
function schedulePowerup(type, initialDelay) {
    if (!gameRunning) return;
    const delay = initialDelay !== undefined ? initialDelay : POWERUP_SPAWN_MIN + Math.random() * (POWERUP_SPAWN_MAX - POWERUP_SPAWN_MIN);
    setTimeout(() => {
        if (!gameRunning) return;
        spawnPowerup(type);
        schedulePowerup(type);
    }, delay);
}

function spawnPowerup(type) {
    const margin = 80;
    const x = margin + Math.random() * (canvas.width - margin * 2);
    const y = margin + Math.random() * (canvas.height - margin * 2);
    powerups.push({ x, y, size: 18, type, spawnTime: Date.now() });
}

function drawPowerup(p) {
    const pulse = 1 + 0.15 * Math.sin(Date.now() / 200);
    const drawSize = p.size * pulse;

    ctx.save();
    ctx.translate(p.x, p.y);

    if (p.type === "multi-laser") {
        ctx.rotate(Date.now() / 800);
        // 5-pointed star in lime
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
    } else if (p.type === "rapid-fire") {
        ctx.rotate(-Date.now() / 600);
        // 4-pointed star in gold, counter-clockwise rotation
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
            const outerAngle = (i * 90 - 90) * Math.PI / 180;
            const innerAngle = ((i * 90) + 45 - 90) * Math.PI / 180;
            ctx.lineTo(Math.cos(outerAngle) * drawSize, Math.sin(outerAngle) * drawSize);
            ctx.lineTo(Math.cos(innerAngle) * drawSize * 0.4, Math.sin(innerAngle) * drawSize * 0.4);
        }
        ctx.closePath();
        ctx.fillStyle = "#ffcc00";
        ctx.shadowColor = "#ffcc00";
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.shadowBlur = 0;
    } else {
        ctx.rotate(Date.now() / 1000);
        // 3-pointed star in magenta (pierce-laser)
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
            const outerAngle = (i * 120 - 90) * Math.PI / 180;
            const innerAngle = ((i * 120) + 60 - 90) * Math.PI / 180;
            ctx.lineTo(Math.cos(outerAngle) * drawSize, Math.sin(outerAngle) * drawSize);
            ctx.lineTo(Math.cos(innerAngle) * drawSize * 0.4, Math.sin(innerAngle) * drawSize * 0.4);
        }
        ctx.closePath();
        ctx.fillStyle = "#ff00ff";
        ctx.shadowColor = "#ff00ff";
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    ctx.restore();
}

function updatePowerupIndicator() {
    const parts = [];
    if (laserCount > 1) parts.push("\u2733 MULTI-LASER x" + laserCount);
    if (rapidFireMultiplier > 1) parts.push("\u26a1 RAPID FIRE x" + rapidFireMultiplier.toFixed(2));
    if (pierceActive) parts.push("\u25c6 PIERCE");
    if (parts.length > 0) {
        powerupIndicator.textContent = parts.join("  |  ");
        powerupIndicator.style.display = "block";
    } else {
        powerupIndicator.style.display = "none";
    }
}

function refreshPowerupTimer(type) {
    if (type === "multi-laser" && laserCount > 1) {
        if (multiLaserTimer) clearTimeout(multiLaserTimer);
        const remaining = Math.min(POWERUP_DURATION, POWERUP_MAX_DURATION - (Date.now() - multiLaserStartTime));
        if (remaining <= 0) { laserCount = 1; updatePowerupIndicator(); return; }
        multiLaserTimer = setTimeout(() => { laserCount = 1; updatePowerupIndicator(); }, remaining);
    } else if (type === "rapid-fire" && rapidFireMultiplier > 1) {
        if (rapidFireTimer) clearTimeout(rapidFireTimer);
        const remaining = Math.min(POWERUP_DURATION, POWERUP_MAX_DURATION - (Date.now() - rapidFireStartTime));
        if (remaining <= 0) { rapidFireMultiplier = 1.0; updatePowerupIndicator(); return; }
        rapidFireTimer = setTimeout(() => { rapidFireMultiplier = 1.0; updatePowerupIndicator(); }, remaining);
    } else if (type === "pierce-laser" && pierceActive) {
        if (pierceTimer) clearTimeout(pierceTimer);
        const remaining = Math.min(POWERUP_DURATION, POWERUP_MAX_DURATION - (Date.now() - pierceStartTime));
        if (remaining <= 0) { pierceActive = false; updatePowerupIndicator(); return; }
        pierceTimer = setTimeout(() => { pierceActive = false; updatePowerupIndicator(); }, remaining);
    }
}

function collectPowerup(p) {
    // Apply effect, recording start time only on fresh activation
    if (p.type === "multi-laser") {
        if (laserCount === 1) multiLaserStartTime = Date.now();
        laserCount = Math.min(laserCount + MULTI_LASER_INCREMENT, MULTI_LASER_MAX);
    } else if (p.type === "rapid-fire") {
        if (rapidFireMultiplier === 1.0) rapidFireStartTime = Date.now();
        rapidFireMultiplier *= RAPID_FIRE_MULTIPLIER;
    } else {
        if (!pierceActive) pierceStartTime = Date.now();
        pierceActive = true;
    }

    // Refresh ALL active timers, each capped by its own hard limit
    refreshPowerupTimer("multi-laser");
    refreshPowerupTimer("rapid-fire");
    refreshPowerupTimer("pierce-laser");

    updatePowerupIndicator();
}

// ====== ASTEROIDS ======
function createAsteroid() {
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
        dx: Math.cos(angle), dy: Math.sin(angle),
        rotation: 0, rotationSpeed: (Math.random() - 0.5) * 0.2,
        shape: generateAsteroidShape(size)
    });
}

function scheduleNextAsteroid(delay) {
    if (asteroidSpawnTimeoutId) clearTimeout(asteroidSpawnTimeoutId);
    const wait = delay !== undefined ? delay : ASTEROID_SPAWN_MIN + Math.random() * (ASTEROID_SPAWN_MAX - ASTEROID_SPAWN_MIN);
    asteroidSpawnTimeoutId = setTimeout(() => {
        if (!gameRunning) return;
        createAsteroid();
        // If still below minimum after spawning, respawn immediately (resets timer)
        scheduleNextAsteroid(asteroids.length < asteroidMinCount ? 0 : undefined);
    }, wait);
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
    ctx.rotate(shipAngle);

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

// ====== SHIELD ======
function regenShield() {
    if (!gameRunning) return;
    if (shieldCharges < SHIELD_MAX_CHARGES) {
        shieldCharges++;
        if (shieldCharges < SHIELD_MAX_CHARGES) {
            shieldRegenTimer = setTimeout(regenShield, SHIELD_REGEN_TIME);
        } else {
            shieldRegenTimer = null;
        }
    }
}

function drawShieldHUD() {
    const barW = 30, barH = 8, gap = 10;
    const totalW = SHIELD_MAX_CHARGES * barW + (SHIELD_MAX_CHARGES - 1) * gap;
    const sx = (canvas.width - totalW) / 2;
    const sy = canvas.height - 30;
    ctx.lineWidth = 2;
    for (let i = 0; i < SHIELD_MAX_CHARGES; i++) {
        const bx = sx + i * (barW + gap);
        ctx.strokeStyle = "#4488ff";
        ctx.strokeRect(bx, sy, barW, barH);
        if (i < shieldCharges) {
            ctx.fillStyle = "#4488ff";
            ctx.fillRect(bx + 1, sy + 1, barW - 2, barH - 2);
        }
    }
}

// ====== SHIELD BATTERY PICKUP ======
function spawnShieldBattery(x, y) {
    if (shieldBattery) return; // only one at a time
    shieldBattery = { x, y, spawnTime: Date.now() };
    if (shieldBatteryTimeout) clearTimeout(shieldBatteryTimeout);
    shieldBatteryTimeout = setTimeout(() => { shieldBattery = null; }, BATTERY_DURATION);
}

function drawShieldBattery(b) {
    const w = 28, h = 16;
    const bx = b.x - w / 2, by = b.y - h / 2;
    const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 300);
    ctx.save();
    ctx.shadowColor = `rgba(50,150,255,${pulse})`;
    ctx.shadowBlur = 12;
    // Body
    ctx.strokeStyle = "#55aaff";
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, w, h);
    ctx.fillStyle = `rgba(50,120,255,0.25)`;
    ctx.fillRect(bx, by, w, h);
    // Positive terminal nub
    ctx.fillStyle = "#55aaff";
    ctx.fillRect(b.x + w / 2, b.y - 3, 4, 6);
    // Three vertical cell lines inside
    for (let i = 1; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(bx + (w / 3) * i, by + 2);
        ctx.lineTo(bx + (w / 3) * i, by + h - 2);
        ctx.strokeStyle = `rgba(100,180,255,0.7)`;
        ctx.lineWidth = 1;
        ctx.stroke();
    }
    ctx.restore();
}

// ====== GAME LOOP ======
function gameLoop() {
    if (!gameRunning) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();

    // ---- Ship movement ----
    const thrusting = keys["KeyW"] || keys["ArrowUp"]    || keys["Numpad8"];
    const rotLeft   = keys["KeyA"] || keys["ArrowLeft"]  || keys["Numpad4"];
    const rotRight  = keys["KeyD"] || keys["ArrowRight"] || keys["Numpad6"];
    const braking   = keys["KeyS"] || keys["ArrowDown"]  || keys["Numpad5"];

    if (rotLeft)  shipAngle -= ROTATION_RATE;
    if (rotRight) shipAngle += ROTATION_RATE;

    if (braking) {
        const spd = Math.sqrt(shipVX * shipVX + shipVY * shipVY);
        if (spd > 0.1) {
            let target = Math.atan2(-shipVX, shipVY);
            let diff = target - shipAngle;
            while (diff >  Math.PI) diff -= 2 * Math.PI;
            while (diff < -Math.PI) diff += 2 * Math.PI;
            shipAngle += Math.abs(diff) <= ROTATION_RATE ? diff : Math.sign(diff) * ROTATION_RATE;
        }
    }

    if (thrusting) {
        shipVX += Math.sin(shipAngle) * THRUST_FORCE;
        shipVY -= Math.cos(shipAngle) * THRUST_FORCE;
        const spd = Math.sqrt(shipVX * shipVX + shipVY * shipVY);
        if (spd > MAX_SPEED) { shipVX = shipVX / spd * MAX_SPEED; shipVY = shipVY / spd * MAX_SPEED; }
    }

    shipX += shipVX;
    shipY += shipVY;
    // Wrap edges — teleport only once SHIP_VISUAL_SIZE px have disappeared off-screen
    if (shipX + SHIP_VISUAL_SIZE < WRAP_OVERLAP) shipX += canvas.width;
    if (shipX - SHIP_VISUAL_SIZE > canvas.width  - WRAP_OVERLAP) shipX -= canvas.width;
    if (shipY + SHIP_VISUAL_SIZE < WRAP_OVERLAP) shipY += canvas.height;
    if (shipY - SHIP_VISUAL_SIZE > canvas.height - WRAP_OVERLAP) shipY -= canvas.height;

    // ---- Shield glow ----
    if (shieldCharges > 0) {
        const alpha = 0.05 * shieldCharges;
        const sg = ctx.createRadialGradient(shipX, shipY, 15, shipX, shipY, 50);
        sg.addColorStop(0,   `rgba(50,120,255,0)`);
        sg.addColorStop(0.6, `rgba(50,120,255,${alpha})`);
        sg.addColorStop(1,   `rgba(50,120,255,0)`);
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.arc(shipX, shipY, 50, 0, Math.PI * 2);
        ctx.fill();
    }

    drawSpaceship(shipX, shipY);

    // ---- Shoot ----
    if ((mouse.down || keys["Space"]) && Date.now() - lastShot > Math.max(RAPID_FIRE_MIN_COOLDOWN, Math.round(BASE_SHOT_COOLDOWN / rapidFireMultiplier))) {
        shoot();
        lastShot = Date.now();
    }

    // ---- Bullets ----
    bullets.forEach((b, i) => {
        b.x += b.dx * b.speed;
        b.y += b.dy * b.speed;
        const laserColor = pierceActive ? "#ff00ff" : "cyan";
        ctx.fillStyle = laserColor;
        ctx.shadowColor = laserColor;
        ctx.shadowBlur = 6;
        ctx.fillRect(b.x - 1, b.y, 2, b.size);
        ctx.shadowBlur = 0;
        if (b.y < -b.size || b.y > canvas.height + b.size || b.x < -b.size || b.x > canvas.width + b.size) {
            bullets.splice(i, 1);
        }
    });

    // ---- Asteroids ----
    asteroids.forEach((a, i) => {
        a.x += a.dx * a.speed;
        a.y += a.dy * a.speed;
        a.rotation += a.rotationSpeed;

        // Wrap — asteroid must be mostly off-screen (leaving WRAP_OVERLAP px visible) before teleporting
        if (a.x + a.size < WRAP_OVERLAP) a.x += canvas.width;
        else if (a.x - a.size > canvas.width  - WRAP_OVERLAP) a.x -= canvas.width;
        if (a.y + a.size < WRAP_OVERLAP) a.y += canvas.height;
        else if (a.y - a.size > canvas.height - WRAP_OVERLAP) a.y -= canvas.height;

        // Asteroid-asteroid collisions
        for (let j = i + 1; j < asteroids.length; j++) {
            const b = asteroids[j];
            if (isColliding(a, b)) {
                if (a.size > 15) {
                    for (let k = 0; k < 2; k++) {
                        const ns = a.size / 2, na = Math.random() * Math.PI * 2;
                        asteroids.push({ x: a.x, y: a.y, size: ns, speed: 1 + (40 - ns) / 30 * 3, dx: Math.cos(na), dy: Math.sin(na), rotation: 0, rotationSpeed: (Math.random() - 0.5) * 0.2, shape: generateAsteroidShape(ns) });
                    }
                    asteroids.splice(i, 1); i--; break;
                }
                if (b.size > 15) {
                    for (let k = 0; k < 2; k++) {
                        const ns = b.size / 2, na = Math.random() * Math.PI * 2;
                        asteroids.push({ x: b.x, y: b.y, size: ns, speed: 1 + (40 - ns) / 30 * 3, dx: Math.cos(na), dy: Math.sin(na), rotation: 0, rotationSpeed: (Math.random() - 0.5) * 0.2, shape: generateAsteroidShape(ns) });
                    }
                    asteroids.splice(j, 1); j--;
                }
            }
        }

        drawAsteroid(a.x, a.y, a.size, a.rotation, a.shape);

        // Ship collision
        if (isColliding({ x: shipX, y: shipY, size: 14 }, a)) {
            if (shieldCharges > 0) {
                const prevCharges = shieldCharges;
                shieldCharges--;
                if (shieldRegenTimer) clearTimeout(shieldRegenTimer);
                shieldRegenTimer = setTimeout(regenShield, SHIELD_REGEN_TIME);
                asteroids.splice(i, 1);
                // Maybe spawn a battery pickup
                const roll = Math.random();
                if (prevCharges === 2 && roll < BATTERY_SPAWN_CHANCE_LOW) {
                    spawnShieldBattery(a.x, a.y);
                } else if (prevCharges === 1 && roll < BATTERY_SPAWN_CHANCE_HIGH) {
                    spawnShieldBattery(a.x, a.y);
                }
                return; // skip bullet check for this asteroid
            } else {
                exitGame();
                return;
            }
        }

        // Bullet collisions
        bullets.forEach((b, j) => {
            if (isColliding({ x: b.x, y: b.y, size: b.size / 2 }, a)) {
                score += Math.floor(100 - a.size);
                if (a.size > 15) {
                    const numPieces = 2 + Math.floor(Math.random() * 2);
                    for (let k = 0; k < numPieces; k++) {
                        const ns = a.size / 2, na = Math.random() * Math.PI * 2;
                        asteroids.push({ x: a.x, y: a.y, size: ns, speed: 1 + (40 - ns) / 30 * 3, dx: Math.cos(na), dy: Math.sin(na), rotation: 0, rotationSpeed: (Math.random() - 0.5) * 0.2, shape: generateAsteroidShape(ns) });
                    }
                }
                asteroids.splice(i, 1);
                if (!pierceActive) bullets.splice(j, 1);
                return;
            }
        });
    });

    // ---- Powerups ----
    powerups.forEach((p, i) => {
        drawPowerup(p);
        if (Date.now() - p.spawnTime > 10000) { powerups.splice(i, 1); return; }
        if (isColliding({ x: shipX, y: shipY, size: 20 }, p)) {
            collectPowerup(p);
            powerups.splice(i, 1);
        }
    });

    // ---- Shield Battery ----
    if (shieldBattery) {
        drawShieldBattery(shieldBattery);
        if (isColliding({ x: shipX, y: shipY, size: 20 }, { x: shieldBattery.x, y: shieldBattery.y, size: 14 })) {
            shieldCharges = SHIELD_MAX_CHARGES;
            if (shieldRegenTimer) { clearTimeout(shieldRegenTimer); shieldRegenTimer = null; }
            if (shieldBatteryTimeout) { clearTimeout(shieldBatteryTimeout); shieldBatteryTimeout = null; }
            shieldBattery = null;
        }
    }

    // ---- HUD ----
    ctx.fillStyle = "white";
    ctx.font = "20px Arial";
    ctx.fillText("Score: " + score, 10, 25);
    drawShieldHUD();

    requestAnimationFrame(gameLoop);
}
