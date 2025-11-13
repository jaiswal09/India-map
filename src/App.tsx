import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

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

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    let mapMesh: THREE.Object3D | THREE.Mesh;
    let airplane: THREE.Object3D | THREE.Mesh;

    const loader = new GLTFLoader();

    loader.load('/models/india_map.glb', (gltf) => {
      mapMesh = gltf.scene;
      mapMesh.receiveShadow = true;
      mapMesh.traverse((child) => {
        if ('receiveShadow' in child) child.receiveShadow = true;
      });
      scene.add(mapMesh);
    }, undefined, (error) => {
      console.warn('Failed to load india_map.glb:', error);
      const mapGeometry = new THREE.PlaneGeometry(200, 200, 100, 100);
      const vertices = mapGeometry.attributes.position.array;
      for (let i = 0; i < vertices.length; i += 3) {
        vertices[i + 2] = Math.random() * 3 - 1.5;
      }
      mapGeometry.attributes.position.needsUpdate = true;
      mapGeometry.computeVertexNormals();

      const mapMaterial = new THREE.MeshStandardMaterial({
        color: 0x2d5016,
        roughness: 0.8,
        metalness: 0.2,
      });
      mapMesh = new THREE.Mesh(mapGeometry, mapMaterial);
      mapMesh.rotation.x = -Math.PI / 2;
      mapMesh.receiveShadow = true;
      scene.add(mapMesh);
    });

    loader.load('/models/airplane.glb', (gltf) => {
      airplane = gltf.scene;
      airplane.castShadow = true;
      airplane.traverse((child) => {
        if ('castShadow' in child) child.castShadow = true;
      });
      scene.add(airplane);
    }, undefined, (error) => {
      console.warn('Failed to load airplane.glb:', error);
      const airplaneGeometry = new THREE.ConeGeometry(1, 4, 8);
      const airplaneMaterial = new THREE.MeshStandardMaterial({
        color: 0xff3333,
        metalness: 0.6,
        roughness: 0.3,
      });
      airplane = new THREE.Mesh(airplaneGeometry, airplaneMaterial);
      airplane.castShadow = true;
      scene.add(airplane);
    });

    const pathPoints = [
      new THREE.Vector3(-60, 8, -40),
      new THREE.Vector3(-40, 12, -10),
      new THREE.Vector3(-20, 15, 20),
      new THREE.Vector3(0, 18, 35),
      new THREE.Vector3(25, 16, 40),
      new THREE.Vector3(45, 12, 30),
      new THREE.Vector3(55, 10, 10),
      new THREE.Vector3(50, 8, -15),
      new THREE.Vector3(35, 10, -35),
      new THREE.Vector3(10, 12, -45),
      new THREE.Vector3(-20, 14, -50),
      new THREE.Vector3(-45, 10, -45),
      new THREE.Vector3(-60, 8, -40),
    ];

    const curve = new THREE.CatmullRomCurve3(pathPoints);
    curve.closed = false;

    const trailPoints: THREE.Vector3[] = [];
    const trailGeometry = new THREE.BufferGeometry();
    const trailMaterial = new THREE.LineDashedMaterial({
      color: 0x00ffff,
      linewidth: 2,
      dashSize: 0.8,
      gapSize: 0.4,
    });
    const trailLine = new THREE.Line(trailGeometry, trailMaterial);
    scene.add(trailLine);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2;

    let t = 0;
    let previousPosition = new THREE.Vector3();

    function animate() {
      requestAnimationFrame(animate);

      t += 0.0008;
      if (t > 1) t = 0;

      const position = curve.getPoint(t);
      if (airplane instanceof THREE.Mesh || airplane.isObject3D) {
        airplane.position.copy(position);

        const tangent = curve.getTangent(t);
        const direction = new THREE.Vector3();
        direction.copy(tangent).normalize();

        const up = new THREE.Vector3(0, 1, 0);
        const axis = new THREE.Vector3().crossVectors(up, direction).normalize();
        const angle = Math.acos(up.dot(direction));
        airplane.quaternion.setFromAxisAngle(axis, angle - Math.PI / 2);
      }

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
        trailLine.computeLineDistances();
        previousPosition.copy(position);
      }

      controls.update();
      renderer.render(scene, camera);
    }

    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} className="w-full h-screen" />;
}

export default App;
