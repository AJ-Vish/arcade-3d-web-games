import * as THREE from 'three';

export type ProceduralModelOptions = {
  castShadow?: boolean;
  receiveShadow?: boolean;
};

// Generates a starburst wood pattern for the table top
function createStarburstTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext('2d');
  
  if (context) {
    const cx = 512;
    const cy = 512;
    const numWedges = 16; 
    
    // Base wood color
    context.fillStyle = '#b3825a';
    context.fillRect(0, 0, 1024, 1024);
    
    for (let i = 0; i < numWedges; i++) {
      const angle1 = (i * Math.PI * 2) / numWedges;
      const angle2 = ((i + 1) * Math.PI * 2) / numWedges;
      
      context.beginPath();
      context.moveTo(cx, cy);
      context.arc(cx, cy, 600, angle1, angle2);
      context.lineTo(cx, cy);
      
      // Alternate wood wedge shades slightly
      context.fillStyle = i % 2 === 0 ? '#b3825a' : '#bc8b60';
      context.fill();
      
      // Draw seam between wedges
      context.strokeStyle = '#855734';
      context.lineWidth = 3;
      context.stroke();
      
      // Add linear grain inside the wedge radiating outwards
      context.save();
      context.clip();
      
      for (let j = 0; j < 40; j++) {
        const radius = Math.random() * 600;
        context.beginPath();
        context.arc(cx, cy, radius, angle1, angle2);
        context.strokeStyle = `rgba(133, 87, 52, ${0.1 + Math.random() * 0.15})`;
        context.lineWidth = 1 + Math.random() * 4;
        context.stroke();
      }
      
      context.restore();
    }
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Rotate texture so wedges align nicely
  texture.rotation = Math.PI / 4;
  texture.center.set(0.5, 0.5);
  return texture;
}

// Generates a vertical linear wood grain for the legs
function createLinearWoodTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  
  if (context) {
    context.fillStyle = '#b3825a';
    context.fillRect(0, 0, 512, 512);
    
    // Draw vertical grain lines
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * 512;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, 512);
      context.strokeStyle = `rgba(133, 87, 52, ${0.1 + Math.random() * 0.15})`;
      context.lineWidth = 1 + Math.random() * 6;
      context.stroke();
    }
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function createTableModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "Table";

  const topTexture = createStarburstTexture();
  const legTexture = createLinearWoodTexture();

  // Material for the top
  const topMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, // Let texture drive the color
    map: topTexture,
    roughness: 0.7,
    metalness: 0.05,
  });

  // Material for legs
  const legMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: legTexture,
    roughness: 0.8,
    metalness: 0.05,
  });

  // Table Top
  const topGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.03, 64);
  const tableTop = new THREE.Mesh(topGeo, topMat);
  tableTop.position.y = 0.75;
  tableTop.castShadow = options.castShadow ?? true;
  tableTop.receiveShadow = options.receiveShadow ?? true;
  root.add(tableTop);

  // Center support structure / brace
  const centerGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.1, 16);
  const centerPost = new THREE.Mesh(centerGeo, legMat);
  centerPost.position.y = 0.7;
  centerPost.castShadow = options.castShadow ?? true;
  root.add(centerPost);

  // 4 Legs
  const legHeight = 0.72;
  const legSpread = 0.7;
  const legLength = Math.hypot(legHeight, legSpread);
  
  const legGeo = new THREE.BoxGeometry(0.08, legLength, 0.12);
  
  for (let i = 0; i < 4; i++) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.castShadow = options.castShadow ?? true;
    
    const pivot = new THREE.Group();
    pivot.rotation.y = (Math.PI / 2) * i;
    
    leg.position.set(0, legHeight / 2, legSpread / 2);
    leg.rotation.x = -Math.atan2(legSpread, legHeight); 
    
    pivot.add(leg);
    root.add(pivot);
  }

  return root;
}
