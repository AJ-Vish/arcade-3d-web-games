// Sunset Hoops - Three.js Logic

// 1. Scene Setup
const scene = new THREE.Scene();

// Camera setup (Perspective for 3D feel)
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 3, 15);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('game-container').appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffddaa, 0.8);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);

// Audio Context for simple synthesized sounds
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

// Ensure audio context resumes on first interaction (required by iOS Safari)
function unlockAudio() {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 0;
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start(0);
    osc.stop(0.001);
    
    document.removeEventListener('touchstart', unlockAudio);
    document.removeEventListener('pointerdown', unlockAudio);
    document.removeEventListener('click', unlockAudio);
    document.removeEventListener('keydown', unlockAudio);
}
document.addEventListener('touchstart', unlockAudio);
document.addEventListener('pointerdown', unlockAudio);
document.addEventListener('click', unlockAudio);
document.addEventListener('keydown', unlockAudio);

function playSound(type) {
    if (!soundEnabled) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'bounce') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'swish') {
        const bufferSize = audioCtx.sampleRate * 0.2;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noiseSource = audioCtx.createBufferSource();
        noiseSource.buffer = buffer;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000;
        
        noiseSource.connect(filter);
        filter.connect(gainNode);
        
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        
        noiseSource.start();
    }
}


// 2. Procedural Environment (Sunset & Court)

// Background Canvas Texture
function createBackgroundTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Sunset Gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#ff7b54'); // Orange top
    gradient.addColorStop(0.5, '#ffd56b'); // Yellow middle
    gradient.addColorStop(1, '#ff9671'); // Pinkish bottom
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // City Skyline Silhouette
    ctx.fillStyle = 'rgba(150, 80, 80, 0.3)';
    for(let i=0; i<20; i++) {
        const w = 50 + Math.random() * 80;
        const h = 200 + Math.random() * 300;
        const x = i * 60 - 50;
        ctx.fillRect(x, canvas.height - h, w, h);
    }

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

const bgGeometry = new THREE.PlaneGeometry(100, 100);
const bgMaterial = new THREE.MeshBasicMaterial({ map: createBackgroundTexture(), depthWrite: false });
const background = new THREE.Mesh(bgGeometry, bgMaterial);
background.position.set(0, 20, -30);
scene.add(background);

// Court Floor
function createCourtTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#6a737d'; // Concrete grey
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Free throw area (red)
    ctx.fillStyle = '#d64132';
    ctx.beginPath();
    ctx.arc(256, 0, 150, 0, Math.PI);
    ctx.fill();

    // White lines
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(256, 0, 150, 0, Math.PI);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

const courtGeo = new THREE.PlaneGeometry(40, 40);
const courtMat = new THREE.MeshStandardMaterial({ map: createCourtTexture(), roughness: 0.8 });
const court = new THREE.Mesh(courtGeo, courtMat);
court.rotation.x = -Math.PI / 2;
scene.add(court);

// 3. The Hoop
const hoopGroup = new THREE.Group();
hoopGroup.position.set(0, 0, -5);

// Pole
const poleGeo = new THREE.CylinderGeometry(0.2, 0.2, 10);
const poleMat = new THREE.MeshStandardMaterial({ color: 0x1f78b4 }); // Blue pole
const pole = new THREE.Mesh(poleGeo, poleMat);
pole.position.y = 5;
hoopGroup.add(pole);

// Backboard Texture (Dynamic Highscore)
let highScore = localStorage.getItem('hoops_highscore') || 0;
const backboardCanvas = document.createElement('canvas');
backboardCanvas.width = 512;
backboardCanvas.height = 384;
const backboardCtx = backboardCanvas.getContext('2d');
let backboardTexture = new THREE.CanvasTexture(backboardCanvas);

function updateBackboardTexture() {
    // Board background
    backboardCtx.fillStyle = '#f5f5dc'; // Beige
    backboardCtx.fillRect(0, 0, 512, 384);
    
    // Inner target square
    backboardCtx.strokeStyle = '#d64132';
    backboardCtx.lineWidth = 10;
    backboardCtx.strokeRect(156, 150, 200, 150);

    // Text
    backboardCtx.fillStyle = '#000';
    backboardCtx.font = 'bold 40px "Fredoka One", Arial';
    backboardCtx.textAlign = 'center';
    backboardCtx.fillText('HighScore', 256, 60);
    
    backboardCtx.font = 'bold 50px Arial';
    backboardCtx.fillText(highScore.toString(), 256, 120);

    backboardTexture.needsUpdate = true;
}
updateBackboardTexture();

const boardGeo = new THREE.PlaneGeometry(4, 3);
const boardMat = new THREE.MeshStandardMaterial({ map: backboardTexture });
const backboard = new THREE.Mesh(boardGeo, boardMat);
backboard.position.set(0, 8.5, 0.5);
hoopGroup.add(backboard);

// Rim
const rimGeo = new THREE.TorusGeometry(1.0, 0.05, 16, 32);
const rimMat = new THREE.MeshStandardMaterial({ color: 0xff5500 }); // Orange rim
const rim = new THREE.Mesh(rimGeo, rimMat);
rim.rotation.x = Math.PI / 2;
rim.position.set(0, 7.5, 1.5); // Attached to backboard, moved slightly forward
hoopGroup.add(rim);

// Net
const netGeo = new THREE.CylinderGeometry(1.0, 0.6, 1.5, 16, 1, true); // Open ended
const netMat = new THREE.MeshBasicMaterial({ 
    color: 0xffffff, 
    wireframe: true, 
    transparent: true, 
    opacity: 0.5 
});
const net = new THREE.Mesh(netGeo, netMat);
net.position.set(0, 6.75, 1.5); // Match rim position
hoopGroup.add(net);

scene.add(hoopGroup);

// 4. The Basketball
// Function to generate a realistic basketball texture
function createBasketballTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    // Base leather color
    ctx.fillStyle = '#c44a0e';
    ctx.fillRect(0, 0, 512, 256);
    
    // Add noise for "pebbled" leather look
    const imgData = ctx.getImageData(0, 0, 512, 256);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 30; // Random variance
        data[i] = Math.max(0, Math.min(255, data[i] + noise));
        data[i+1] = Math.max(0, Math.min(255, data[i+1] + noise));
        data[i+2] = Math.max(0, Math.min(255, data[i+2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    // Black lines
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 6;
    
    // Horizontal cross line (Equator)
    ctx.beginPath();
    ctx.moveTo(0, 128);
    ctx.lineTo(512, 128);
    ctx.stroke();

    // Vertical cross line (Front and Back)
    ctx.beginPath();
    ctx.moveTo(256, 0);
    ctx.lineTo(256, 256);
    ctx.moveTo(0, 0); // Back seam
    ctx.lineTo(0, 256);
    ctx.moveTo(512, 0); // Back seam (wraps)
    ctx.lineTo(512, 256);
    ctx.stroke();

    // Side curved lines (Full continuous loops)
    ctx.beginPath();
    ctx.ellipse(128, 128, 70, 110, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(384, 128, 70, 110, 0, 0, Math.PI * 2);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; // Ensures clean seam
    return tex;
}

const ballRadius = 0.5;
const ballGroup = new THREE.Group();

const ballGeo = new THREE.SphereGeometry(ballRadius, 64, 64);
const ballMat = new THREE.MeshStandardMaterial({ 
    map: createBasketballTexture(),
    roughness: 0.85,
    metalness: 0.1
});
const ballMesh = new THREE.Mesh(ballGeo, ballMat);
ballGroup.add(ballMesh);

scene.add(ballGroup);

// Point `ball` variable to `ballGroup` so physics continues to work seamlessly
const ball = ballGroup;

// 5. Game State & Physics
const START_POS = new THREE.Vector3(0, ballRadius, 8);
let ballVelocity = new THREE.Vector3(0, 0, 0);
let isShooting = false;
let score = 0;
let hasScoredThisShot = false;

// Reset Ball
function resetBall() {
    ball.position.copy(START_POS);
    ballVelocity.set(0, 0, 0);
    isShooting = false;
    hasScoredThisShot = false;
}
resetBall();

// Interaction Variables
let isDragging = false;
let startY = 0;
let startTime = 0;

// Input Handling
const uiOverlay = document.getElementById('ui-overlay');
const instructionText = document.getElementById('instruction-text');
const playIcon = document.getElementById('play-icon-overlay');

window.addEventListener('pointerdown', (e) => {
    if (isShooting) return;
    
    // Hide UI on first interaction
    if(playIcon.style.display !== 'none') {
        playIcon.style.display = 'none';
        instructionText.style.display = 'none';
        document.getElementById('score-display').classList.remove('hidden');
    }

    isDragging = true;
    startY = e.clientY;
    startTime = performance.now();
});

window.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
});

window.addEventListener('pointerup', (e) => {
    if (!isDragging || isShooting) return;
    isDragging = false;
    
    const endY = e.clientY;
    const endTime = performance.now();
    const dragDistance = startY - endY; // Positive if dragged UP
    const dragTime = (endTime - startTime) / 1000; // in seconds

    if (dragDistance > 50 && dragTime > 0.05) {
        // Shoot!
        isShooting = true;
        
        // Calculate velocity based on swipe
        // PERFECT SWISH values: Forward 15, Upward 20.7
        let forwardSpeed = (dragDistance / dragTime) * 0.035;
        let upwardSpeed = forwardSpeed * 1.35; 

        // Clamp to a wider range so it's possible to airball or hit the rim hard
        forwardSpeed = THREE.MathUtils.clamp(forwardSpeed, 10.0, 20.0);
        upwardSpeed = THREE.MathUtils.clamp(upwardSpeed, 15.0, 26.0);
        
        // Add a gentle "auto-aim" assist (pulls speeds 40% towards the perfect shot)
        // This provides a "medium" difficulty where you must flick somewhat correctly
        forwardSpeed = THREE.MathUtils.lerp(forwardSpeed, 15.0, 0.4);
        upwardSpeed = THREE.MathUtils.lerp(upwardSpeed, 20.7, 0.4);

        // Add variance based on horizontal swipe so aiming left/right matters
        const swipeX = e.clientX - (window.innerWidth / 2);
        const sideSpeed = THREE.MathUtils.clamp(swipeX * 0.015, -2.5, 2.5);

        ballVelocity.set(sideSpeed, upwardSpeed, -forwardSpeed);
    }
});

// Sound (Dummy toggle)
let soundEnabled = true;
document.getElementById('sound-btn').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    document.getElementById('sound-btn').innerText = soundEnabled ? '🔊' : '🔇';
});

// Collision & Scoring Logic
function checkScore() {
    if (hasScoredThisShot) return;

    const rimPos = new THREE.Vector3();
    rim.getWorldPosition(rimPos);

    // If ball is passing down through the rim level
    if (ballVelocity.y < 0 && Math.abs(ball.position.y - rimPos.y) < 0.5) {
        // Check X and Z distance to center of rim
        const dist = Math.hypot(ball.position.x - rimPos.x, ball.position.z - rimPos.z);
        // INCREASED HITBOX: Was 0.7, now 1.2 makes it extremely generous
        if (dist < 1.2) { 
            // Swish!
            score++;
            playSound('swish');
            document.getElementById('current-score').innerText = score;
            hasScoredThisShot = true;

            if (score > highScore) {
                highScore = score;
                localStorage.setItem('hoops_highscore', highScore);
                updateBackboardTexture();
            }
        }
    }
}

// 6. Animation Loop
const gravity = -30; // Custom gravity
let lastTime = 0;

function animate(time) {
    requestAnimationFrame(animate);
    
    const dt = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    if (isShooting) {
        // Apply gravity
        ballVelocity.y += gravity * dt;
        
        // Apply velocity to position
        ball.position.addScaledVector(ballVelocity, dt);
        
        // Rotate ball while flying
        ball.rotation.x -= ballVelocity.z * dt * 0.5;

        // Check for score
        checkScore();

        // Check for ground bounce or miss (y < 0)
        if (ball.position.y < ballRadius) {
            // Very simple bounce logic to settle
            ball.position.y = ballRadius;
            
            if (Math.abs(ballVelocity.y) > 2) {
                playSound('bounce');
            }

            ballVelocity.y *= -0.5; // lose energy
            ballVelocity.z *= 0.8; 
            ballVelocity.x *= 0.8;

            // If it's basically stopped, reset
            if (Math.abs(ballVelocity.y) < 1 && Math.abs(ballVelocity.z) < 1) {
                setTimeout(() => resetBall(), 500);
            }
        }
        
        // Backboard bounce
        const boardPos = new THREE.Vector3();
        backboard.getWorldPosition(boardPos);
        if (ball.position.z <= boardPos.z + 0.5 && ball.position.y > 7 && ball.position.y < 10) {
            if(Math.abs(ball.position.x) < 2.5) {
                ball.position.z = boardPos.z + 0.5;
                if (Math.abs(ballVelocity.z) > 2) playSound('bounce');
                // Drop straight down into the hoop on backboard hit
                ballVelocity.z *= -0.1; 
                ballVelocity.x *= 0.5;
            }
        }
    }

    renderer.render(scene, camera);
}
requestAnimationFrame(animate);

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
