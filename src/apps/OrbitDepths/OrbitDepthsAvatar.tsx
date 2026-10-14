import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

interface OrbitDepthsAvatarProps {
  player: { readonly current: { angle: number; jump: number } };
  visible: boolean;
}

const MODEL_URL = "/models/testun-creatura236/scene.gltf";

export function OrbitDepthsAvatar({ player, visible }: OrbitDepthsAvatarProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.set(0, 1.18, 4.25);
    camera.lookAt(0, 1.05, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xc8e5ff, 0x17191d, 2.1));
    const keyLight = new THREE.DirectionalLight(0xffe1bd, 3.2);
    keyLight.position.set(-3, 6, 4);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x61d8d1, 2.2);
    rimLight.position.set(4, 3, -4);
    scene.add(rimLight);

    let mixer: THREE.AnimationMixer | null = null;
    let model: THREE.Group | null = null;
    let modelBaseY = 0;
    let animationFrame = 0;
    let previousTime = 0;
    let disposed = false;
    const loader = new GLTFLoader();
    loader.load(MODEL_URL, (gltf) => {
      if (disposed) return;
      model = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const scale = 2.65 / Math.max(size.y, 0.01);
      model.scale.setScalar(scale);
      model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
      modelBaseY = model.position.y;
      model.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = true;
          object.receiveShadow = true;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            if (material instanceof THREE.MeshStandardMaterial) {
              material.roughness = Math.max(0.42, material.roughness);
              material.metalness = Math.min(0.35, material.metalness);
            }
          }
        }
      });
      scene.add(model);
      if (gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(model);
        mixer.clipAction(gltf.animations[0]).play();
      }
    }, undefined, (error) => {
      console.error("Orbit Depths character model failed to load", error);
    });

    const resizeObserver = new ResizeObserver(() => {
      const { width, height } = host.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(host);

    function render(time: number) {
      const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0;
      previousTime = time;
      mixer?.update(delta);
      if (model) {
        model.rotation.y = Math.PI + player.current.angle;
        model.position.y = modelBaseY + player.current.jump * 0.2;
      }
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(render);
    }
    animationFrame = requestAnimationFrame(render);

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      mixer?.stopAllAction();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [player]);

  return <div ref={hostRef} className={`orbit-depths__avatar ${visible ? "orbit-depths__avatar--visible" : ""}`} aria-hidden="true" />;
}