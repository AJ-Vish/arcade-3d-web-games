// Ball Basket - Three.js Logic

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 18);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// Add soft shadow map
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game-container').appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
scene.add(dirLight);

// Audio
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function unlockAudio() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
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
}
document.addEventListener('touchstart', unlockAudio);
document.addEventListener('pointerdown', unlockAudio);
document.addEventListener('click', unlockAudio);

function playSound(type) {
    if (!soundEnabled) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'bounce') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'swish') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(600, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'gameover') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(50, audioCtx.currentTime + 0.5);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    } else if (type === 'fail') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    }
}

// Environment (Wooden floor and radial background)
function createFloorTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#c19a6b'; // Wood base
    ctx.fillRect(0, 0, 512, 512);

    // Wood panels
    ctx.strokeStyle = '#a67b5b';
    ctx.lineWidth = 4;
    for(let i=0; i<512; i+=64) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 512);
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    return texture;
}

const floorGeo = new THREE.PlaneGeometry(100, 100);
const floorMat = new THREE.MeshStandardMaterial({ map: createFloorTexture(), roughness: 0.9 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Striped background matching reference
function createBgTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#f2f7f9'; // Off-white
    ctx.fillRect(0, 0, 1024, 1024);

    ctx.fillStyle = '#e4eff5'; // Light blue stripe
    const numStripes = 10;
    const stripeWidth = 1024 / numStripes;
    
    for(let i=0; i<numStripes; i+=2) {
        ctx.fillRect(i * stripeWidth, 0, stripeWidth, 1024);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 1);
    return tex;
}

const bgGeo = new THREE.PlaneGeometry(150, 150);
const bgMat = new THREE.MeshBasicMaterial({ map: createBgTexture(), depthWrite: false });
const bg = new THREE.Mesh(bgGeo, bgMat);
bg.position.set(0, 30, -30);
scene.add(bg);

// Red Shopping Basket
const basketGroup = new THREE.Group();
basketGroup.position.set(0, 0.5, -5);
basketGroup.rotation.x = 0.2; // Tilt slightly forward so the inside is more visible

function createGridTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#b71c1c'; 
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#ef5350'; 
    ctx.lineWidth = 6;
    ctx.beginPath();
    for(let i = -128; i < 256; i += 32) {
        ctx.moveTo(i, 0);
        ctx.lineTo(i + 128, 128);
        ctx.moveTo(i + 128, 0);
        ctx.lineTo(i, 128);
    }
    ctx.stroke();
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 1.5);
    return tex;
}

const redMat = new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.6 });
const darkRedMat = new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: 0.6 });
const gridMat = new THREE.MeshStandardMaterial({ map: createGridTexture(), roughness: 0.8, side: THREE.DoubleSide });
const handleMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });

const radiusTop = 4.2;
const radiusBot = 3.5;
const height = 2.5;
const scaleZ = 0.67;

// Body
const bodyGeo = new THREE.CylinderGeometry(radiusTop, radiusBot, height, 4, 1, true);
bodyGeo.rotateY(Math.PI / 4);
const body = new THREE.Mesh(bodyGeo, gridMat);
body.scale.set(1, 1, scaleZ);
body.position.y = height/2;
body.castShadow = true;
basketGroup.add(body);

// Base
const baseGeo = new THREE.CylinderGeometry(radiusBot, radiusBot, 0.2, 4);
baseGeo.rotateY(Math.PI / 4);
const base = new THREE.Mesh(baseGeo, redMat);
base.scale.set(1, 1, scaleZ);
base.position.y = 0.1;
base.receiveShadow = true;
basketGroup.add(base);

// Rim (Hollow using 4 boxes)
const topW = radiusTop * Math.SQRT2; 
const topD = topW * scaleZ;
const rT = 0.4; 

const rimFB = new THREE.BoxGeometry(topW + rT, 0.4, rT);
const rimLR = new THREE.BoxGeometry(rT, 0.4, topD + rT);

const rFront = new THREE.Mesh(rimFB, darkRedMat);
rFront.position.set(0, height, topD/2);
rFront.castShadow = true;
basketGroup.add(rFront);

const rBack = new THREE.Mesh(rimFB, darkRedMat);
rBack.position.set(0, height, -topD/2);
rBack.castShadow = true;
basketGroup.add(rBack);

const rLeft = new THREE.Mesh(rimLR, darkRedMat);
rLeft.position.set(-topW/2, height, 0);
rLeft.castShadow = true;
basketGroup.add(rLeft);

const rRight = new THREE.Mesh(rimLR, darkRedMat);
rRight.position.set(topW/2, height, 0);
rRight.castShadow = true;
basketGroup.add(rRight);

scene.add(basketGroup);

// Ball (Red Cricket/Leather Ball style)
function createBallTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#d32f2f'; // Red base
    ctx.fillRect(0, 0, 512, 256);

    // Stitches
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 8]);
    
    ctx.beginPath();
    ctx.moveTo(0, 110);
    ctx.lineTo(512, 110);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, 146);
    ctx.lineTo(512, 146);
    ctx.stroke();
    ctx.setLineDash([]); // reset

    return new THREE.CanvasTexture(canvas);
}

const ballRadius = 0.6;
const ballGeo = new THREE.SphereGeometry(ballRadius, 32, 32);
const ballMat = new THREE.MeshStandardMaterial({ 
    map: createBallTexture(),
    roughness: 0.3,
    metalness: 0.2
});
const ball = new THREE.Mesh(ballGeo, ballMat);
ball.castShadow = true;
scene.add(ball);


// Game State
const START_POS = new THREE.Vector3(0, ballRadius, 10);
let ballVelocity = new THREE.Vector3(0, 0, 0);
let isShooting = false;
let score = 0;
let lives = 3;
let hasScoredThisShot = false;
let gameOver = false;

function updateLivesDisplay() {
    let hearts = '';
    for(let i=0; i<lives; i++) hearts += '❤️';
    document.getElementById('lives-display').innerText = `Lives: ${hearts}`;
}

function resetBall() {
    if (gameOver) return;
    ball.position.copy(START_POS);
    ballVelocity.set(0, 0, 0);
    isShooting = false;
    hasScoredThisShot = false;
    ball.rotation.set(0,0,0);
}
resetBall();

function triggerGameOver() {
    gameOver = true;
    playSound('gameover');
    document.getElementById('final-score').innerText = score;
    document.getElementById('game-over-overlay').classList.remove('hidden');
}

document.getElementById('restart-btn').addEventListener('click', () => {
    score = 0;
    lives = 3;
    gameOver = false;
    document.getElementById('current-score').innerText = score;
    updateLivesDisplay();
    document.getElementById('game-over-overlay').classList.add('hidden');
    resetBall();
});

// Input
let isDragging = false;
let startY = 0;
let startTime = 0;

const uiOverlay = document.getElementById('ui-overlay');
const instructionText = document.getElementById('instruction-text');
const playIcon = document.getElementById('play-icon-overlay');

window.addEventListener('pointerdown', (e) => {
    if (isShooting || gameOver) return;
    
    if(playIcon.style.display !== 'none') {
        playIcon.style.display = 'none';
        instructionText.style.display = 'none';
        document.getElementById('score-display').classList.remove('hidden');
    }

    isDragging = true;
    startY = e.clientY;
    startTime = performance.now();
});

window.addEventListener('pointerup', (e) => {
    if (!isDragging || isShooting || gameOver) return;
    isDragging = false;
    
    const endY = e.clientY;
    const endTime = performance.now();
    const dragDistance = startY - endY;
    const dragTime = (endTime - startTime) / 1000;

    if (dragDistance > 50 && dragTime > 0.05) {
        isShooting = true;
        
        let forwardSpeed = (dragDistance / dragTime) * 0.025;
        let upwardSpeed = forwardSpeed * 1.5; 

        forwardSpeed = THREE.MathUtils.clamp(forwardSpeed, 12.0, 25.0);
        upwardSpeed = THREE.MathUtils.clamp(upwardSpeed, 15.0, 30.0);
        
        // Auto-aim assist
        forwardSpeed = THREE.MathUtils.lerp(forwardSpeed, 18.0, 0.3);
        upwardSpeed = THREE.MathUtils.lerp(upwardSpeed, 22.0, 0.3);

        const swipeX = e.clientX - (window.innerWidth / 2);
        const sideSpeed = THREE.MathUtils.clamp(swipeX * 0.015, -3.0, 3.0);

        ballVelocity.set(sideSpeed, upwardSpeed, -forwardSpeed);
    }
});

let soundEnabled = true;
document.getElementById('sound-btn').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    document.getElementById('sound-btn').innerText = soundEnabled ? '🔊' : '🔇';
});


// Physics Loop
const gravity = -35;
let lastTime = 0;

function animate(time) {
    requestAnimationFrame(animate);
    const dt = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    if (isShooting && !gameOver) {
        ballVelocity.y += gravity * dt;
        ball.position.addScaledVector(ballVelocity, dt);
        ball.rotation.x -= ballVelocity.z * dt * 0.3;

        // Check basket score (passed down through rim level)
        const bCenter = new THREE.Vector3(0, 0.5, -5);
        const bInnerX = 2.7; // (bw/2 - bt)
        const bInnerZ = 1.7; // (bd/2 - bt)
        const bOuterX = 3.0; // bw/2
        const bOuterZ = 2.0; // bd/2
        const bHeight = 0.5 + 2.5 + 0.3; // base.y + bh + bt => 3.3
        const bBaseY = 0.8; // bt

        if (ballVelocity.y < 0 && Math.abs(ball.position.y - bHeight) < 0.8 && !hasScoredThisShot) {
            if (Math.abs(ball.position.x) < bInnerX && Math.abs(ball.position.z - bCenter.z) < bInnerZ) {
                score++;
                playSound('swish');
                document.getElementById('current-score').innerText = score;
                hasScoredThisShot = true;
                
                // slow down to drop in basket
                ballVelocity.x *= 0.3;
                ballVelocity.z *= 0.3;
            }
        }

        // Wall collisions (AABB vs sphere approximation)
        if (ball.position.y < bHeight && ball.position.y > bBaseY) {
            // X-axis walls (left and right)
            if (Math.abs(ball.position.z - bCenter.z) < bOuterZ + ballRadius) {
                // Right wall
                if (ball.position.x > bInnerX - ballRadius && ball.position.x < bOuterX + ballRadius) {
                    if (Math.abs(ballVelocity.x) > 1) playSound('bounce');
                    if (ballVelocity.x > 0 && ball.position.x < bInnerX) { 
                        ballVelocity.x *= -0.7;
                        ball.position.x = bInnerX - ballRadius;
                    } else if (ballVelocity.x < 0 && ball.position.x > bOuterX) {
                        ballVelocity.x *= -0.7;
                        ball.position.x = bOuterX + ballRadius;
                    }
                }
                // Left wall
                if (ball.position.x < -bInnerX + ballRadius && ball.position.x > -bOuterX - ballRadius) {
                    if (Math.abs(ballVelocity.x) > 1) playSound('bounce');
                    if (ballVelocity.x < 0 && ball.position.x > -bInnerX) { 
                        ballVelocity.x *= -0.7;
                        ball.position.x = -bInnerX + ballRadius;
                    } else if (ballVelocity.x > 0 && ball.position.x < -bOuterX) {
                        ballVelocity.x *= -0.7;
                        ball.position.x = -bOuterX - ballRadius;
                    }
                }
            }
            
            // Z-axis walls (front and back)
            if (Math.abs(ball.position.x) < bOuterX + ballRadius) {
                const dz = ball.position.z - bCenter.z;
                // Back wall
                if (dz < -bInnerZ + ballRadius && dz > -bOuterZ - ballRadius) {
                    if (Math.abs(ballVelocity.z) > 1) playSound('bounce');
                    if (ballVelocity.z < 0 && dz > -bInnerZ) { 
                        ballVelocity.z *= -0.7;
                        ball.position.z = bCenter.z - bInnerZ + ballRadius;
                    } else if (ballVelocity.z > 0 && dz < -bOuterZ) {
                        ballVelocity.z *= -0.7;
                        ball.position.z = bCenter.z - bOuterZ - ballRadius;
                    }
                }
                // Front wall
                if (dz > bInnerZ - ballRadius && dz < bOuterZ + ballRadius) {
                    if (Math.abs(ballVelocity.z) > 1) playSound('bounce');
                    if (ballVelocity.z > 0 && dz < bInnerZ) { 
                        ballVelocity.z *= -0.7;
                        ball.position.z = bCenter.z + bInnerZ - ballRadius;
                    } else if (ballVelocity.z < 0 && dz > bOuterZ) {
                        ballVelocity.z *= -0.7;
                        ball.position.z = bCenter.z + bOuterZ + ballRadius;
                    }
                }
            }
        }
        
        // Rim collision
        if (ball.position.y > bHeight - ballRadius && ball.position.y < bHeight + ballRadius) {
            if ((Math.abs(ball.position.x) > bInnerX - ballRadius && Math.abs(ball.position.x) < bOuterX + ballRadius && Math.abs(ball.position.z - bCenter.z) < bOuterZ) ||
                (Math.abs(ball.position.z - bCenter.z) > bInnerZ - ballRadius && Math.abs(ball.position.z - bCenter.z) < bOuterZ + ballRadius && Math.abs(ball.position.x) < bOuterX)) {
                
                if (Math.abs(ballVelocity.y) > 2) {
                    playSound('bounce');
                    ballVelocity.y *= -0.6;
                    ballVelocity.x *= 0.8;
                    ballVelocity.z *= 0.8;
                    ball.position.y = bHeight + ballRadius; // push up
                }
            }
        }

        // Floor / Basket Bottom collision
        if (ball.position.y < ballRadius) {
            ball.position.y = ballRadius;
            
            if (Math.abs(ballVelocity.y) > 2) {
                playSound('bounce');
            }

            ballVelocity.y *= -0.6; 
            ballVelocity.z *= 0.7; 
            ballVelocity.x *= 0.7;

            // Stop moving
            if (Math.abs(ballVelocity.y) < 1.5 && Math.abs(ballVelocity.z) < 1.5) {
                if (!hasScoredThisShot) {
                    lives--;
                    playSound('fail');
                    updateLivesDisplay();
                    if (lives <= 0) {
                        triggerGameOver();
                    } else {
                        setTimeout(() => resetBall(), 500);
                    }
                } else {
                    setTimeout(() => resetBall(), 500);
                }
                isShooting = false; // Stop physics to avoid repeated calls
            }
        }
    }

    renderer.render(scene, camera);
}
requestAnimationFrame(animate);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
