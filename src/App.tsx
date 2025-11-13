import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Use refs to store the mutable Three.js objects outside of the React render cycle
  const airplaneRef = useRef<THREE.Object3D | THREE.Mesh>();
  const controlsRef = useRef<OrbitControls>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const curveRef = useRef<THREE.CatmullRomCurve3>();
  const trailPointsRef = useRef<THREE.Vector3[]>([]);
  const trailGeometryRef = useRef<THREE.BufferGeometry>();
  const previousPositionRef = useRef(new THREE.Vector3());

  useEffect(() => {
    if (!containerRef.current) return;

    // --- 1. SCENE SETUP ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);

    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );
    camera.position.set(0, 80, 120);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer; // Store renderer in ref

    // LIGHTING
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const loader = new GLTFLoader();

    // --- 2. MAP MODEL LOADING (with Placeholder Fallback) ---
    loader.load('/models/india_map.glb', (gltf) => {
      const mapMesh = gltf.scene;
      mapMesh.receiveShadow = true;
      mapMesh.traverse((child) => {
        if ('receiveShadow' in child) child.receiveShadow = true;
      });
      scene.add(mapMesh);
    }, undefined, (error) => {
      console.warn('Failed to load india_map.glb, using placeholder:', error);
      // Placeholder: Extruded plane for basic 3D map shape
      const mapGeometry = new THREE.PlaneGeometry(200, 200, 100, 100);
      const mapMaterial = new THREE.MeshStandardMaterial({
        color: 0x2d5016,
        roughness: 0.8,
        metalness: 0.2,
      });
      const mapMesh = new THREE.Mesh(mapGeometry, mapMaterial);
      mapMesh.rotation.x = -Math.PI / 2;
      mapMesh.receiveShadow = true;
      scene.add(mapMesh);
    });

    // --- 3. AIRPLANE MODEL LOADING (with Placeholder Fallback) ---
    loader.load('/models/airplane.glb', (gltf) => {
      const airplane = gltf.scene;
      airplane.castShadow = true;
      airplane.traverse((child) => {
        if ('castShadow' in child) child.castShadow = true;
      });
      scene.add(airplane);
      airplaneRef.current = airplane; // Store the loaded object in the ref
    }, undefined, (error) => {
      console.warn('Failed to load airplane.glb, using placeholder:', error);
      // Placeholder: Cone geometry for airplane
      const airplaneGeometry = new THREE.ConeGeometry(1, 4, 8);
      const airplaneMaterial = new THREE.MeshStandardMaterial({
        color: 0xff3333,
        metalness: 0.6,
        roughness: 0.3,
      });
      const airplane = new THREE.Mesh(airplaneGeometry, airplaneMaterial);
      airplane.castShadow = true;
      scene.add(airplane);
      airplaneRef.current = airplane; // Store the placeholder in the ref
    });

    // --- 4. FLIGHT PATH AND TRAIL SETUP ---
    const pathPoints = [
      new THREE.Vector3(-60, 8, -40),
      new THREE.Vector3(-40, 12, -10),
      new THREE.Vector3(0, 18, 35),
      new THREE.Vector3(25, 16, 40),
      new THREE.Vector3(55, 10, 10),
      new THREE.Vector3(35, 10, -35),
      new THREE.Vector3(-20, 14, -50),
      new THREE.Vector3(-60, 8, -40), // Loop back
    ];

    const curve = new THREE.CatmullRomCurve3(pathPoints);
    curve.closed = true; // Use true if you want a continuous loop
    curveRef.current = curve;

    const trailGeometry = new THREE.BufferGeometry();
    const trailMaterial = new THREE.LineDashedMaterial({
      color: 0x00ffff,
      linewidth: 2,
      dashSize: 2, // Larger dash for visibility
      gapSize: 1,
    });
    const trailLine = new THREE.Line(trailGeometry, trailMaterial);
    trailGeometryRef.current = trailGeometry;
    scene.add(trailLine);

    // --- 5. CONTROLS ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.1; // Restrict camera below horizon
    controlsRef.current = controls; // Store controls in ref

    let t = 0; // Animation progress

    // --- 6. ANIMATION LOOP ---
    const animate = () => {
      requestAnimationFrame(animate);

      const airplane = airplaneRef.current;
      const controls = controlsRef.current;
      const curve = curveRef.current;
      const trailPoints = trailPointsRef.current;
      const trailGeometry = trailGeometryRef.current;
      const previousPosition = previousPositionRef.current;

      // 🚨 CRITICAL FIX: Ensure the airplane object exists before trying to animate it
      if (airplane && controls && curve) {
        t += 0.0008;
        if (t > 1) t = 0;

        const position = curve.getPoint(t);
        
        // Update airplane position
        airplane.position.copy(position);

        // Update airplane orientation (LookAt or Quaternion for better banking)
        const tangent = curve.getTangent(t).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const matrix = new THREE.Matrix4().lookAt(position, position.clone().add(tangent), up);
        airplane.quaternion.setFromRotationMatrix(matrix);
        airplane.rotateZ(Math.PI / 2); // Adjust for model orientation (if placeholder is cone)
        
        // Update trail
        if (previousPosition.distanceTo(position) > 0.5) {
          trailPoints.push(position.clone());
          
          const positions = new Float32Array(trailPoints.length * 3);
          trailPoints.forEach((point, i) => {
            positions[i * 3] = point.x;
            positions[i * 3 + 1] = point.y;
            positions[i * 3 + 2] = point.z;
          });
          
          trailGeometry.setAttribute(
            'position',
            new THREE.BufferAttribute(positions, 3)
          );
          trailGeometry.attributes.position.needsUpdate = true;
          // Important for dotted line to work
          (trailLine.material as THREE.LineDashedMaterial).needsUpdate = true; 
          trailLine.computeLineDistances();
          
          previousPosition.copy(position);
        }
      }

      // Render loop (Always run, even if models are loading)
      controls.update();
      renderer.render(scene, camera);
    };

    animate(); // Start the loop

    // --- 7. CLEANUP & RESIZE ---
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      controls.dispose();
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []); // Empty dependency array means this runs only once on mount

  return <div ref={containerRef} className="w-full h-screen" />;
}

export default App;