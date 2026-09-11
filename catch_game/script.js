// Game State
let score = 0;
let highScore = localStorage.getItem('catchGameHighScore') || 0;
let lives = 3;
let isGameOver = false;
let gameSpeed = 0.1;
let spawnRate = 1200; // ms between spawns
let lastSpawnTime = 0;
let soundEnabled = true;

// Audio Context for simple synthesized sounds
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playSound(type) {
    if (!soundEnabled) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    // Base volume lowered from 0.5 to 0.1 for all sounds
    const maxVol = 0.1;
    
    if (type === 'good') {
        // Soft "bloop" or "pop"
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(maxVol, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'bad') {
        // Quick, low "thud"
        osc.type = 'square';
        osc.frequency.setValueAtTime(100, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.15);
        gainNode.gain.setValueAtTime(maxVol, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
    } else if (type === 'gameover') {
        // Slow descending hum
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.8);
        gainNode.gain.setValueAtTime(maxVol, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.8);
    }
}

// DOM Elements
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('high-score');
const livesContainer = document.getElementById('lives-container');
const gameOverModal = document.getElementById('game-over-modal');
const helpModal = document.getElementById('help-modal');
const finalScoreElement = document.getElementById('final-score');
const playAgainBtn = document.getElementById('play-again-btn');
const soundBtn = document.getElementById('sound-btn');
const helpBtn = document.getElementById('help-btn');
const closeHelpBtn = document.getElementById('close-help-btn');

highScoreElement.textContent = highScore;

// Three.js Setup (Voxel Style)
const container = document.getElementById('game-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Blue sky

// Isometric Orthographic Camera
const aspect = window.innerWidth / window.innerHeight;
let frustumSize = 40;
if (aspect < 1) {
    frustumSize = 40 / aspect; // Ensure width is always at least 40 on mobile
}
const camera = new THREE.OrthographicCamera(
    frustumSize * aspect / -2, frustumSize * aspect / 2,
    frustumSize / 2, frustumSize / -2,
    -100, 1000
);
// Isometric angle: rotate 45 deg Y, and 35.264 deg X
camera.position.set(30, 30, 30);
camera.lookAt(0, 0, 0);

// Crisp Renderer (no antialiasing for voxel look)
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(1); // Standard pixel ratio keeps things blocky
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // Slightly soft shadows look okay, but Basic is more blocky. Using PCF for decent performance
container.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(20, 40, 20);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.left = -30;
dirLight.shadow.camera.right = 30;
dirLight.shadow.camera.top = 30;
dirLight.shadow.camera.bottom = -30;
scene.add(dirLight);

// ==========================================
// Voxel Utility System
// ==========================================
const baseBoxGeo = new THREE.BoxGeometry(1, 1, 1);
const voxelMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });

function createVoxelMesh(voxels, scale = 1) {
    const mesh = new THREE.InstancedMesh(baseBoxGeo, voxelMaterial, voxels.length);
    const matrix = new THREE.Matrix4();
    const colorObj = new THREE.Color();
    
    voxels.forEach((v, i) => {
        matrix.makeTranslation(v.x * scale, v.y * scale, v.z * scale);
        matrix.scale(new THREE.Vector3(scale, scale, scale));
        mesh.setMatrixAt(i, matrix);
        colorObj.setHex(v.color);
        mesh.setColorAt(i, colorObj);
    });
    
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

// Generate Spheres
function generateVoxelSphere(radius, type) {
    const voxels = [];
    for (let x = -radius; x <= radius; x++) {
        for (let y = -radius; y <= radius; y++) {
            for (let z = -radius; z <= radius; z++) {
                if (x*x + y*y + z*z <= radius*radius + radius) { // +radius softens the mathematical cut
                    let col = 0xffffff;
                    if (type === 'cricket') {
                        col = 0xdc143c; // Red
                        // Seam
                        if (x === 0 || z === 0) col = 0xffffff; 
                    } else if (type === 'basketball') {
                        col = 0xff8c00; // Orange
                        // Lines
                        if (x === 0 || y === 0 || z === 0 || Math.abs(x) === Math.abs(y)) col = 0x111111; 
                    } else if (type === 'bomb') {
                        col = 0x222222; // Black
                    }
                    voxels.push({x, y, z, color: col});
                }
            }
        }
    }
    
    // Add Fuse for bomb
    if (type === 'bomb') {
        for (let y = radius; y <= radius + 3; y++) {
            voxels.push({x: 0, y, z: 0, color: 0x888888});
        }
        // Spark
        voxels.push({x: 0, y: radius + 4, z: 0, color: 0xffaa00});
        voxels.push({x: 1, y: radius + 4, z: 0, color: 0xff4400});
    }
    
    return voxels;
}

// Generate Basket
function generateBasketVoxels() {
    const voxels = [];
    const width = 6;
    const height = 4;
    const depth = 4;
    const color1 = 0x8b4513; // Brown
    const color2 = 0xa0522d; // Light Brown (Wicker effect)
    
    for (let x = -width; x <= width; x++) {
        for (let y = 0; y <= height; y++) {
            for (let z = -depth; z <= depth; z++) {
                // Hollow out center
                if (y > 0 && x > -width && x < width && z > -depth && z < depth) continue;
                
                let col = ((x+y+z) % 2 === 0) ? color1 : color2;
                voxels.push({x, y, z, color: col});
            }
        }
    }
    return voxels;
}

// Generate Tree
function generateTreeVoxels() {
    const voxels = [];
    // Trunk
    for (let y = 0; y < 6; y++) {
        voxels.push({x:0, y, z:0, color: 0x5c4033});
    }
    // Leaves (cloud-like)
    for (let x = -2; x <= 2; x++) {
        for (let y = 4; y <= 8; y++) {
            for (let z = -2; z <= 2; z++) {
                if (Math.abs(x)+Math.abs(y-6)+Math.abs(z) <= 3) {
                    voxels.push({x, y, z, color: 0x228b22}); // Green
                }
            }
        }
    }
    return voxels;
}

// ==========================================
// Environment Setup
// ==========================================

// Court Floor Texture
const canvas = document.createElement('canvas');
canvas.width = 256;
canvas.height = 256;
const ctx = canvas.getContext('2d');
// Court wood
ctx.fillStyle = '#d2b48c';
ctx.fillRect(0, 0, 256, 256);
// White lines
ctx.fillStyle = '#fff';
ctx.fillRect(10, 10, 236, 10); // Top
ctx.fillRect(10, 236, 236, 10); // Bottom
ctx.fillRect(10, 10, 10, 236); // Left
ctx.fillRect(236, 10, 10, 236); // Right
ctx.fillRect(123, 10, 10, 236); // Center line
// Center circle
ctx.beginPath();
ctx.arc(128, 128, 40, 0, Math.PI*2);
ctx.lineWidth = 10;
ctx.strokeStyle = '#fff';
ctx.stroke();

const courtTexture = new THREE.CanvasTexture(canvas);
courtTexture.magFilter = THREE.NearestFilter; // Crisp pixels
const courtMat = new THREE.MeshLambertMaterial({ map: courtTexture });
const courtGeo = new THREE.PlaneGeometry(60, 60);
const court = new THREE.Mesh(courtGeo, courtMat);
court.rotation.x = -Math.PI / 2;
court.position.y = -0.5;
court.receiveShadow = true;
scene.add(court);

// Background Hills
const hillGeo = new THREE.BoxGeometry(100, 10, 20);
const hillMat = new THREE.MeshLambertMaterial({ color: 0x3cb371 }); // Green
const hill1 = new THREE.Mesh(hillGeo, hillMat);
hill1.position.set(-10, -5, -30);
hill1.receiveShadow = true;
scene.add(hill1);

// City Skyline (Background)
const cityGroup = new THREE.Group();
const buildingColors = [0x708090, 0x778899, 0xa9a9a9, 0x808080];
for (let i = 0; i < 15; i++) {
    const w = 4 + Math.random() * 4;
    const h = 10 + Math.random() * 20;
    const d = 4 + Math.random() * 4;
    const bMat = new THREE.MeshLambertMaterial({ color: buildingColors[Math.floor(Math.random()*buildingColors.length)] });
    const bGeo = new THREE.BoxGeometry(w, h, d);
    const building = new THREE.Mesh(bGeo, bMat);
    building.position.set(-40 + i * 6, h/2 - 5, -50 + (Math.random()*10));
    building.castShadow = true;
    building.receiveShadow = true;
    cityGroup.add(building);
}
scene.add(cityGroup);

// Trees
const treeMesh = createVoxelMesh(generateTreeVoxels(), 0.8);
treeMesh.position.set(-15, 0, -15);
scene.add(treeMesh);
const treeMesh2 = createVoxelMesh(generateTreeVoxels(), 1);
treeMesh2.position.set(20, 0, -20);
scene.add(treeMesh2);

// Signage: Floating Text
function createTextPlane(text, w, h, bg, fg) {
    const cvs = document.createElement('canvas');
    cvs.width = 256;
    cvs.height = 64;
    const ct = cvs.getContext('2d');
    ct.fillStyle = bg;
    ct.fillRect(0,0,256,64);
    ct.fillStyle = fg;
    ct.font = '24px "Press Start 2P"';
    ct.textAlign = 'center';
    ct.textBaseline = 'middle';
    ct.fillText(text, 128, 32);
    
    const tex = new THREE.CanvasTexture(cvs);
    tex.magFilter = THREE.NearestFilter;
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

const banner = createTextPlane("GOTTA CATCH 'EM ALL!", 30, 8, '#ff0044', '#ffffff');
banner.position.set(0, 25, -20);
// Make it face camera somewhat
banner.rotation.x = -Math.PI / 6;
scene.add(banner);

const groundSign = createTextPlane("BALL BASKET", 15, 4, '#8b4513', '#ffd700');
groundSign.position.set(0, 1, 10);
groundSign.rotation.x = -Math.PI / 4;
scene.add(groundSign);


// ==========================================
// Player Basket Setup
// ==========================================
const basketVoxels = generateBasketVoxels();
const basketMesh = createVoxelMesh(basketVoxels, 0.4); // Scale down voxel size
const basketGroup = new THREE.Group();
basketGroup.add(basketMesh);
basketGroup.position.set(0, 0, 5); // Z axis line of play
scene.add(basketGroup);


// ==========================================
// Game Objects Setup
// ==========================================
let activeObjects = [];

const OBJECT_TYPES = {
    CRICKET_BALL: {
        points: 1,
        type: 'good',
        voxels: generateVoxelSphere(3, 'cricket')
    },
    BASKETBALL: {
        points: 2,
        type: 'good',
        voxels: generateVoxelSphere(4, 'basketball')
    },
    BOMB: {
        points: 0,
        type: 'bad',
        voxels: generateVoxelSphere(3, 'bomb')
    }
};

function spawnObject() {
    if (isGameOver) return;

    const rand = Math.random();
    let objDef;
    if (rand < 0.2) {
        objDef = OBJECT_TYPES.BOMB;
    } else if (rand < 0.5) {
        objDef = OBJECT_TYPES.BASKETBALL;
    } else {
        objDef = OBJECT_TYPES.CRICKET_BALL;
    }

    const mesh = createVoxelMesh(objDef.voxels, 0.3); // Voxel scale 0.3
    
    // Play axis limits (Isometric space maps X slightly differently visually, but mechanics are linear)
    const minX = -15;
    const maxX = 15;
    const spawnX = Math.random() * (maxX - minX) + minX;
    
    mesh.position.set(spawnX, 30, 5);
    
    scene.add(mesh);
    
    activeObjects.push({
        mesh: mesh,
        data: objDef
    });
}


// ==========================================
// Input Handling
// ==========================================
const keys = { ArrowLeft: false, ArrowRight: false, a: false, d: false };

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
    if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true;
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
    if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false;
});

// Drag Handling
let isDragging = false;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const playPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -5); // Z=5 plane

renderer.domElement.addEventListener('pointerdown', (e) => { isDragging = true; });

renderer.domElement.addEventListener('pointermove', (e) => {
    if (!isDragging || isGameOver) return;
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersectPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(playPlane, intersectPoint);
    
    if (intersectPoint) {
        basketGroup.position.x = Math.max(-15, Math.min(15, intersectPoint.x));
    }
});

window.addEventListener('pointerup', () => { isDragging = false; });

// Buttons
soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundBtn.textContent = soundEnabled ? '🔊' : '🔇';
});

helpBtn.addEventListener('click', () => { helpModal.classList.remove('hidden'); });
closeHelpBtn.addEventListener('click', () => { helpModal.classList.add('hidden'); });


// ==========================================
// Game Logic
// ==========================================
function updateBasket() {
    if (isDragging) return;
    const speed = 0.5;
    const limit = 15;
    if (keys.ArrowLeft || keys.a) basketGroup.position.x -= speed;
    if (keys.ArrowRight || keys.d) basketGroup.position.x += speed;
    basketGroup.position.x = Math.max(-limit, Math.min(limit, basketGroup.position.x));
}

function updateObjects(deltaTime) {
    for (let i = activeObjects.length - 1; i >= 0; i--) {
        const obj = activeObjects[i];
        
        obj.mesh.position.y -= gameSpeed * (deltaTime / 16);
        
        // Voxel rotation looks cool if snapped, but smooth is okay too. Let's do smooth.
        obj.mesh.rotation.x += 0.05;
        obj.mesh.rotation.y += 0.05;

        // Simple AABB / Distance Collision
        const dist = obj.mesh.position.distanceTo(basketGroup.position);
        
        if (dist < 3 && obj.mesh.position.y > 0 && obj.mesh.position.y < 4) {
            handleCatch(obj);
            scene.remove(obj.mesh);
            activeObjects.splice(i, 1);
            continue;
        }

        if (obj.mesh.position.y < -5) {
            scene.remove(obj.mesh);
            activeObjects.splice(i, 1);
        }
    }
}

function handleCatch(obj) {
    if (obj.data.type === 'good') {
        playSound('good');
        score += obj.data.points;
        scoreElement.textContent = score;
        
        if (score % 10 === 0) {
            gameSpeed += 0.02;
            spawnRate = Math.max(400, spawnRate - 100);
        }
        
    } else if (obj.data.type === 'bad') {
        playSound('bad');
        lives--;
        updateLivesUI();
        if (lives <= 0) gameOver();
    }
}

function updateLivesUI() {
    const hearts = livesContainer.querySelectorAll('.pixel-heart');
    hearts.forEach((heart, index) => {
        if (index >= lives) heart.classList.add('lost');
        else heart.classList.remove('lost');
    });
}

function gameOver() {
    playSound('gameover');
    isGameOver = true;
    finalScoreElement.textContent = score;
    gameOverModal.classList.remove('hidden');
    
    if (score > highScore) {
        highScore = score;
        highScoreElement.textContent = highScore;
        localStorage.setItem('catchGameHighScore', highScore);
    }
}

playAgainBtn.addEventListener('click', () => {
    activeObjects.forEach(obj => scene.remove(obj.mesh));
    activeObjects = [];
    score = 0;
    lives = 3;
    gameSpeed = 0.1;
    spawnRate = 1200;
    isGameOver = false;
    scoreElement.textContent = score;
    updateLivesUI();
    gameOverModal.classList.add('hidden');
    basketGroup.position.x = 0;
});


// ==========================================
// Main Loop & Resize
// ==========================================
window.addEventListener('resize', () => {
    const aspect = window.innerWidth / window.innerHeight;
    let currentFrustum = 40;
    if (aspect < 1) {
        currentFrustum = 40 / aspect;
    }
    camera.left = -currentFrustum * aspect / 2;
    camera.right = currentFrustum * aspect / 2;
    camera.top = currentFrustum / 2;
    camera.bottom = -currentFrustum / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

let lastTime = performance.now();

function animate(time) {
    requestAnimationFrame(animate);
    const deltaTime = time - lastTime;
    lastTime = time;

    if (!isGameOver) {
        updateBasket();
        updateObjects(deltaTime);
        
        if (time - lastSpawnTime > spawnRate) {
            spawnObject();
            lastSpawnTime = time;
        }
    }

    renderer.render(scene, camera);
}

animate(performance.now());
