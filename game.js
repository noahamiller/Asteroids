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
    // Hide cursor
    canvas.style.cursor = "none";

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
        speed: 1 + (40 - size) / 30 * 3, // Smaller asteroids are faster
        dx: Math.cos(angle),
        dy: Math.sin(angle),
        rotation: 0, // Rotation angle
        rotationSpeed: (Math.random() - 0.5) * 0.2, // Spin speed
        shape: generateAsteroidShape(size) // Pre-generated shape
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
    // Main body - blue
    ctx.fillStyle = "blue";
    ctx.fillRect(x - 10, y - 6, 20, 12);
    // Wings - red
    ctx.fillStyle = "red";
    ctx.fillRect(x - 15, y - 3, 5, 6);
    ctx.fillRect(x + 10, y - 3, 5, 6);
    // Cockpit - light blue
    ctx.fillStyle = "lightblue";
    ctx.fillRect(x - 4, y - 4, 8, 4);
    // Thruster - orange
    ctx.fillStyle = "orange";
    ctx.fillRect(x - 3, y + 6, 6, 4);
    // Thruster flame - yellow
    ctx.fillStyle = "yellow";
    ctx.fillRect(x - 2, y + 10, 4, 3);
}

// ====== DRAW ASTEROID ======
function drawAsteroid(x, y, size, rotation, shape) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    // Draw irregular rocky shape
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

// Generate irregular shape points
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
        a.rotation += a.rotationSpeed; // Spin

        // Check collisions with other asteroids
        for (let j = i + 1; j < asteroids.length; j++) {
            const b = asteroids[j];
            if (isColliding(a, b)) {
                // Split both if large enough
                if (a.size > 15) {
                    const numPieces = 2;
                    for (let k = 0; k < numPieces; k++) {
                        const newSize = a.size / 2;
                        const newAngle = Math.random() * Math.PI * 2;
                        asteroids.push({
                            x: a.x,
                            y: a.y,
                            size: newSize,
                            speed: 1 + (40 - newSize) / 30 * 3,
                            dx: Math.cos(newAngle),
                            dy: Math.sin(newAngle),
                            rotation: 0,
                            rotationSpeed: (Math.random() - 0.5) * 0.2,
                            shape: generateAsteroidShape(newSize)
                        });
                    }
                    asteroids.splice(i, 1);
                    i--; // Adjust index
                    break;
                }
                if (b.size > 15) {
                    const numPieces = 2;
                    for (let k = 0; k < numPieces; k++) {
                        const newSize = b.size / 2;
                        const newAngle = Math.random() * Math.PI * 2;
                        asteroids.push({
                            x: b.x,
                            y: b.y,
                            size: newSize,
                            speed: 1 + (40 - newSize) / 30 * 3,
                            dx: Math.cos(newAngle),
                            dy: Math.sin(newAngle),
                            rotation: 0,
                            rotationSpeed: (Math.random() - 0.5) * 0.2,
                            shape: generateAsteroidShape(newSize)
                        });
                    }
                    asteroids.splice(j, 1);
                    j--; // Adjust index
                }
            }
        }

        // Draw irregular shape with rotation
        drawAsteroid(a.x, a.y, a.size, a.rotation, a.shape);

        // Check spaceship collision
        if (isColliding({ x: mouse.x, y: mouse.y, size: 10 }, a)) {
            exitGame(); // End game if hit
            return;
        }

        // Bullet collisions
        bullets.forEach((b, j) => {
            if (isColliding({ x: b.x, y: b.y, size: b.size / 2 }, a)) {
                score += Math.floor(100 - a.size);
                // Split asteroid if large enough
                if (a.size > 15) {
                    const numPieces = 2 + Math.floor(Math.random() * 2); // 2-3 pieces
                    for (let k = 0; k < numPieces; k++) {
                        const newSize = a.size / 2;
                        const newAngle = Math.random() * Math.PI * 2;
                        asteroids.push({
                            x: a.x,
                            y: a.y,
                            size: newSize,
                            speed: 1 + (40 - newSize) / 30 * 3,
                            dx: Math.cos(newAngle),
                            dy: Math.sin(newAngle),
                            rotation: 0,
                            rotationSpeed: (Math.random() - 0.5) * 0.2,
                            shape: generateAsteroidShape(newSize)
                        });
                    }
                }
                asteroids.splice(i, 1);
                bullets.splice(j, 1);
                return; // Exit inner loop
            }
        });
    });

    // Draw score
    ctx.fillStyle = "white";
    ctx.font = "20px Arial";
    ctx.fillText("Score: " + score, 10, 25);

    requestAnimationFrame(gameLoop);
}
