
import * as THREE from 'three';

export class Cursor {
  constructor(scene) {
    this.scene = scene;
    
    // 1. High Contrast Neon Material (Always on top)
    const mat = new THREE.MeshBasicMaterial({ 
        color: 0x00FFFF, // Neon Cyan
        side: THREE.DoubleSide,
        depthTest: false, // Disable depth testing to render through walls
        transparent: true, // Required for renderOrder to sort correctly against other transparents if any, and for depthTest false usually
        opacity: 1.0
    });

    // 2. Thicker Ring
    // Inner radius 1.3, Outer 1.8 -> Thickness of 0.5
    const ringGeo = new THREE.RingGeometry(1.3, 1.8, 32);
    this.mesh = new THREE.Mesh(ringGeo, mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.5;
    
    // Render Order to ensure it draws on top of scene objects
    this.mesh.renderOrder = 999;
    
    this.scene.add(this.mesh);

    // 3. Larger Center Dot
    const dotGeo = new THREE.CircleGeometry(0.4, 16);
    const dot = new THREE.Mesh(dotGeo, mat);
    dot.position.z = 0.01; // Slight offset
    this.mesh.add(dot);
    
    // Removed Laser Dots as requested
  }

  update(mousePos) {
    const time = performance.now() * 0.005;

    if (mousePos) {
        this.mesh.position.x = mousePos.x;
        this.mesh.position.z = mousePos.z;
        
        // Constant rotation
        this.mesh.rotation.z += 0.05;

        // Pulsing effect (Breathing)
        const scale = 1.0 + Math.sin(time) * 0.15;
        this.mesh.scale.set(scale, scale, 1);
    }
  }
}
