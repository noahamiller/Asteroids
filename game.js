// ====== DOM ELEMENTS ======
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const mainMenu = document.getElementById("main-menu");
const startBtn = document.getElementById("start-btn");
const highScoreDisplay = document.getElementById("high-score");
const exitBtn = document.getElementById("exit-btn");

// ====== GAME STATE ======
let bullets = [];
let asteroids = [];
let mouse = { x: 0, y: 0, down: false };
let score = 0;
let highScore = localStorage.getItem("asteroidHighScore") || 0;
let gameRunning = false;
let lastShot = 0; // For laser firing rate

// Display high score on menu
highScoreDisplay.textContent = "High Score: " + highScore;

// ====== EVENT LISTENERS ======
canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
});

canvas.addEventListener("mousedown", () => mouse.down = true);
canvas.addEventListener("mouseup", () => mouse.down = false);

startBtn.addEventListener("click", startGame);
exitBtn.addEventListener("click", exitGame);

// ====== GAME START ======
function startGame() {
    // Set canvas to full screen
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    mainMenu.style.display = "none";
    canvas.style.display = "block";
    exitBtn.style.display = "block";

    score = 0;
    bullets = [];
    asteroids = [];
    gameRunning = true;

    spawnAsteroid();
    requestAnimationFrame(gameLoop);
}

// ====== EXIT GAME ======
function exitGame() {
    gameRunning = false;

    canvas.style.display = "none";
    exitBtn.style.display = "none";
    mainMenu.style.display = "flex";

    // Save high score
    if (score > highScore) {
        highScore = score;
        localStorage.setItem("asteroidHighScore", highScore);
    }

    highScoreDisplay.textContent = "High Score: " + highScore;
}

// ====== SHOOTING ======
function shoot() {
    bullets.push({
        x: mouse.x,
        y: mouse.y,
        size: 20, // Longer laser
        speed: 12 // Faster
    });
}

// ====== ASTEROIDS ======
function spawnAsteroid() {
    if (!gameRunning) return;

    const size = Math.random() * 30 + 10; // 10–40 px
    const edge = Math.floor(Math.random() * 4);

    let x, y;

    // Spawn from edges
    if (edge === 0) { x = Math.random() * canvas.width; y = -size; }
    if (edge === 1) { x = canvas.width + size; y = Math.random() * canvas.height; }
    if (edge === 2) { x = Math.random() * canvas.width; y = canvas.height + size; }
    if (edge === 3) { x = -size; y = Math.random() * canvas.height; }

    const angle = Math.atan2(canvas.height / 2 - y, canvas.width / 2 - x);

    asteroids.push({
        x,
        y,
        size,
        speed: 1 + Math.random() * 1.5,
        dx: Math.cos(angle),
        dy: Math.sin(angle)
    });

    // Spawn new asteroid every 1–2 seconds
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
    ctx.fillStyle = "white";
    // Main body
    ctx.fillRect(x - 8, y - 5, 16, 10);
    // Wings
    ctx.fillRect(x - 12, y - 2, 4, 4);
    ctx.fillRect(x + 8, y - 2, 4, 4);
    // Thruster
    ctx.fillStyle = "orange";
    ctx.fillRect(x - 2, y + 5, 4, 3);
}

// ====== GAME LOOP ======
function gameLoop() {
    if (!gameRunning) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw spaceship at mouse position
    drawSpaceship(mouse.x, mouse.y);

    // Shoot lasers if mouse down and cooldown passed
    if (mouse.down && Date.now() - lastShot > 300) { // 300ms cooldown for slower firing
        shoot();
        lastShot = Date.now();
    }

    // Update bullets
    bullets.forEach((b, i) => {
        b.y -= b.speed;
        // Draw laser as thin rectangle
        ctx.fillStyle = "cyan";
        ctx.fillRect(b.x - 1, b.y, 2, b.size); // Thin vertical laser

        // Remove off-screen bullets
        if (b.y < 0) bullets.splice(i, 1);
    });

    // Update asteroids
    asteroids.forEach((a, i) => {
        a.x += a.dx * a.speed;
        a.y += a.dy * a.speed;

        ctx.beginPath();
        ctx.fillStyle = "gray";
        ctx.arc(a.x, a.y, a.size, 0, Math.PI * 2);
        ctx.fill();

        // Bullet collisions
        bullets.forEach((b, j) => {
            if (isColliding({ x: b.x, y: b.y, size: b.size / 2 }, a)) {
                score += Math.floor(100 - a.size);
                asteroids.splice(i, 1);
                bullets.splice(j, 1);
            }
        });
    });

    // Draw score
    ctx.fillStyle = "white";
    ctx.font = "20px Arial";
    ctx.fillText("Score: " + score, 10, 25);

    requestAnimationFrame(gameLoop);
}
