import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

async function init() {
  const container = document.getElementById('app');
  if (!container) return;

  // Scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a14); // Dark moody blue/black
  scene.fog = new THREE.FogExp2(0x0a0a14, 0.015); // Lighter fog so we can see the environment

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  // Camera
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 5);
  
  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);
  
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(5, 10, 7);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0xccddff, 0.5);
  fillLight.position.set(-5, 3, -5);
  scene.add(fillLight);

  // Shared state
  let envModel: THREE.Group | null = null;
  let loadedModel: THREE.Group | null = null;
  let mixer: THREE.AnimationMixer | null = null;
  let initialY = 0;

  // Load 3D Environment (Low Poly Street)
  const envLoader = new GLTFLoader();
  envLoader.load('/street_env/scene.gltf', (gltf) => {
    envModel = gltf.scene;
    envModel.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.receiveShadow = true;
        child.castShadow = true;
      }
    });
    scene.add(envModel);
  }, undefined, (error) => {
    console.error('Error loading environment:', error);
  });

  // Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // Post-processing for Glow (Bloom)
  const renderScene = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
  bloomPass.threshold = 0.9; // Slightly lower so it catches the mask texture
  bloomPass.strength = 0.3; // Very subtle, just a soft aura
  bloomPass.radius = 0.15; // Keep it tight

  const composer = new EffectComposer(renderer);
  composer.addPass(renderScene);
  composer.addPass(bloomPass);

  // Load GLB
  const loader = new GLTFLoader();
  const textureLoader = new THREE.TextureLoader();
  
  // Load external textures provided by user
  const texBody = textureLoader.load('/textures/BODY DIFUSE_3.png');
  texBody.colorSpace = THREE.SRGBColorSpace;
  texBody.flipY = false;

  const texDress = textureLoader.load('/textures/DRESS DIFUSE_1.png');
  texDress.colorSpace = THREE.SRGBColorSpace;
  texDress.flipY = false;

  const texHead = textureLoader.load('/textures/HEAD DIFUSE_2.png');
  texHead.colorSpace = THREE.SRGBColorSpace;
  texHead.flipY = false;

  const texNeedle = textureLoader.load('/textures/NEEDLE DIFUSE_0.png');
  texNeedle.colorSpace = THREE.SRGBColorSpace;
  texNeedle.flipY = false;
  
  const texShadow = textureLoader.load('/textures/shadow difuse_4.png');
  texShadow.colorSpace = THREE.SRGBColorSpace;
  texShadow.flipY = false;

  loader.load(
    '/HORNET.glb',
    (gltf) => {
      loadedModel = gltf.scene;
      
      // Enable shadows on the loaded model and make the HEAD glow
      loadedModel.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          
          // Check material name to assign external textures
          if (mesh.material && (mesh.material as THREE.Material).name) {
            const matName = (mesh.material as THREE.Material).name.toUpperCase();
            const stdMat = mesh.material as THREE.MeshStandardMaterial;

            if (matName === 'BODY') {
              stdMat.map = texBody;
            } else if (matName === 'DRESS') {
              stdMat.map = texDress;
            } else if (matName === 'HEAD') {
              stdMat.map = texHead;
              // Re-apply emissive map logic with the new texture
              stdMat.emissiveMap = texHead;
              stdMat.emissive = new THREE.Color(0xffffff);
              stdMat.emissiveIntensity = 1.2;
            } else if (matName === 'NEEDLE') {
              stdMat.map = texNeedle;
            } else if (matName === 'SHADOW') {
              stdMat.map = texShadow;
              stdMat.transparent = true;
            }
            stdMat.needsUpdate = true;
          }
        }
      });
      
      // Scale Hornet up massively so she fits the street environment scale
      loadedModel.scale.set(15, 15, 15);
      
      // Move Hornet out of the fenced corner into the open street
      loadedModel.position.set(-25, 0, 20);
      
      scene.add(loadedModel);

      // Setup animations if present
      if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(loadedModel);
        // Play all animations available in the file
        gltf.animations.forEach((clip) => {
          mixer!.clipAction(clip).play();
        });
      } else {
        // Save initial Y for procedural animation fallback
        initialY = loadedModel.position.y;
      }

      // Compute bounding box to frame camera perfectly
      const box = new THREE.Box3().setFromObject(loadedModel);
      
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
      cameraZ *= 1.5; // padding

      camera.position.set(center.x, center.y + size.y / 4, center.z + cameraZ);
      camera.lookAt(center);
      
      controls.target.copy(center);
      controls.update();

      // Hide loading
      const loading = document.getElementById('loading');
      if (loading) loading.style.display = 'none';
    },
    undefined,
    (error) => {
      console.error('Error loading GLB:', error);
      const loading = document.getElementById('loading');
      if (loading) loading.innerText = 'Error loading model';
    }
  );

  // Click-to-move Raycaster
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  window.addEventListener('dblclick', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    
    if (envModel) {
      const intersects = raycaster.intersectObject(envModel, true);
      if (intersects.length > 0) {
        const point = intersects[0].point;
        if (loadedModel) {
          loadedModel.position.set(point.x, point.y, point.z);
          initialY = point.y;
          
          // Update camera target to smoothly follow her
          const box = new THREE.Box3().setFromObject(loadedModel);
          const center = box.getCenter(new THREE.Vector3());
          controls.target.copy(center);
        }
      }
    }
  });

  // Resize handler
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  });

  // Animation Loop
  const clock = new THREE.Clock();
  
  function animate() {
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta();
    
    if (loadedModel) {
      // Always add a very subtle slow rotation so the model feels alive and 3D
      loadedModel.rotation.y += 0.2 * delta;
      
      if (mixer) {
        // Play GLB animation
        mixer.update(delta);
      } else {
        // Procedural "breathing" / floating animation if no baked animation exists
        const time = clock.getElapsedTime();
        // Calculate a visible amplitude based on the camera distance or an absolute value
        const amplitude = 0.15; // increased amplitude to make it visible
        loadedModel.position.y = initialY + Math.sin(time * 2) * amplitude;
      }
    }

    controls.update();
    composer.render();
  }
  
  animate();
}

init().catch(console.error);
