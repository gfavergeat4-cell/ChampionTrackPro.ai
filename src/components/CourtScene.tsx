// CourtScene.tsx — Scène ambiante Courtlight (doc 06 §4, couche 1)
// Terrain NBA en perspective, poussière de lumière, parallaxe caméra.
// Web uniquement, dégradation automatique : reduced-motion / no WebGL / FPS<30.
import React from "react";
import { Platform, StyleSheet, View } from "react-native";

const PARTICLE_COUNT = 180;
const FPS_CHECK_FRAMES = 60; // mesurer sur 60 frames
const FPS_MIN = 28;          // en-dessous → figer la scène

/** Dessine le terrain NBA (proportions 94×50 ft) sur un canvas 2D pour servir de texture. */
function createCourtTexture(THREE: any) {
  const W = 2048;
  const ox = 64;
  const sPx = (W - 2 * ox) / 94;
  const H = Math.round(50 * sPx + 2 * ox);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;

  // Parquet : lattes sombres avec variation subtile
  g.fillStyle = "#0A1322";
  g.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 54) {
    g.fillStyle = `rgba(140,180,230,${0.015 + Math.random() * 0.02})`;
    g.fillRect(x, 0, 27, H);
  }

  // Reflet zénithal au centre
  const rg = g.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, W * 0.55);
  rg.addColorStop(0, "rgba(80,150,220,0.10)");
  rg.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = rg;
  g.fillRect(0, 0, W, H);

  const X = (ft: number) => ox + ft * sPx;
  const Y = (ft: number) => ox + ft * sPx;
  const line = (w: number, a: number) => {
    g.strokeStyle = `rgba(0,212,255,${a})`;
    g.lineWidth = w;
    g.shadowColor = "rgba(0,212,255,0.9)";
    g.shadowBlur = 16;
  };

  // Périmètre + médiane + cercle central
  line(7, 0.85);
  g.strokeRect(X(0), Y(0), 94 * sPx, 50 * sPx);
  g.beginPath();
  g.moveTo(X(47), Y(0));
  g.lineTo(X(47), Y(50));
  g.stroke();
  g.beginPath();
  g.arc(X(47), Y(25), 6 * sPx, 0, 7);
  g.stroke();

  // Chaque moitié : raquette, cercle LF, arc 3 pts, panier
  for (const side of [0, 1]) {
    const bx = side ? X(94 - 5.25) : X(5.25);
    const dir = side ? -1 : 1;
    line(6, 0.7);

    // Raquette (16 ft large, 19 ft fond) + cercle lancer franc
    g.strokeRect(side ? X(94 - 19) : X(0), Y(17), 19 * sPx, 16 * sPx);
    g.beginPath();
    g.arc(side ? X(94 - 19) : X(19), Y(25), 6 * sPx, 0, 7);
    g.stroke();

    // Arc 3 points
    g.beginPath();
    g.arc(
      bx,
      Y(25),
      23.75 * sPx,
      dir === 1 ? -1.19 : Math.PI - 1.19,
      dir === 1 ? 1.19 : Math.PI + 1.19
    );
    g.stroke();

    // Panier
    g.strokeStyle = "rgba(255,140,60,0.75)";
    g.shadowColor = "rgba(255,140,60,0.8)";
    g.lineWidth = 5;
    g.beginPath();
    g.arc(bx, Y(25), 0.75 * sPx, 0, 7);
    g.stroke();
    g.beginPath();
    g.moveTo(side ? X(94 - 4) : X(4), Y(22));
    g.lineTo(side ? X(94 - 4) : X(4), Y(28));
    g.stroke();
  }

  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  return t;
}

export default function CourtScene() {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const rafRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (Platform.OS !== "web") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Dégradation : prefers-reduced-motion → rendu statique unique
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let THREE: any;
    try {
      THREE = require("three");
    } catch {
      return; // three.js absent → pas de scène
    }

    // WebGL disponible ?
    let renderer: any;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch {
      return; // pas de WebGL
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x070b14, 10, 34);

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 60);
    camera.position.set(0, 3.0, 10.5);

    // Sol : terrain NBA en canvas-texture
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(28.2, 15),
      new THREE.MeshBasicMaterial({ map: createCourtTexture(THREE) })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.4;
    scene.add(floor);

    // Reflet du terrain (illusion sol ciré)
    const refl = floor.clone();
    refl.material = floor.material.clone();
    refl.material.transparent = true;
    refl.material.opacity = 0.18;
    refl.rotation.x = Math.PI / 2;
    refl.position.y = -2.46;
    scene.add(refl);

    // Poussière de lumière
    const N = PARTICLE_COUNT;
    const pos = new Float32Array(N * 3);
    const speeds: number[] = [];
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 24;
      pos[i * 3 + 1] = Math.random() * 8 - 2;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 22;
      speeds.push(0.0008 + Math.random() * 0.0022);
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const particles = new THREE.Points(
      particleGeo,
      new THREE.PointsMaterial({
        color: 0x7fd8ff,
        size: 0.035,
        transparent: true,
        opacity: 0.55,
      })
    );
    scene.add(particles);

    // Parallaxe
    let mx = 0;
    let my = 0;
    const onPointer = (e: PointerEvent) => {
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener("pointermove", onPointer);

    // Resize
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);
    onResize();

    // Boucle d'animation avec mesure FPS
    let frozen = false;
    let frameCount = 0;
    let lastTime = performance.now();

    const loop = () => {
      if (frozen) return;

      // Mesure FPS sur les N premières frames
      frameCount++;
      if (frameCount === FPS_CHECK_FRAMES) {
        const elapsed = performance.now() - lastTime;
        const fps = (FPS_CHECK_FRAMES / elapsed) * 1000;
        if (fps < FPS_MIN) {
          // GPU trop faible → figer la scène en un rendu statique
          frozen = true;
          renderer.render(scene, camera);
          return;
        }
      }

      // Particules
      const p = particles.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < N; i++) {
        p[i * 3 + 1] += speeds[i];
        if (p[i * 3 + 1] > 6) p[i * 3 + 1] = -2;
      }
      particles.geometry.attributes.position.needsUpdate = true;

      // Parallaxe caméra
      camera.position.x += (mx * 1.4 - camera.position.x) * 0.04;
      camera.position.y += (2.2 - my * 1.0 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(loop);
    };

    if (reduced) {
      // Rendu unique statique
      renderer.render(scene, camera);
    } else {
      rafRef.current = requestAnimationFrame(loop);
    }

    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(rafRef.current);
      renderer.dispose();
      particleGeo.dispose();
      floor.geometry.dispose();
      floor.material.map?.dispose();
      floor.material.dispose();
      refl.geometry.dispose();
      refl.material.dispose();
      particles.material.dispose();
    };
  }, []);

  if (Platform.OS !== "web") return null;

  return (
    <View style={styles.container} pointerEvents="none">
      <canvas ref={canvasRef as any} style={{ width: "100%", height: "100%" }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute" as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
});
