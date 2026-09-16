// useTimeline.ts — Horloge d'animation commune aux scènes du showcase.
//
// Toutes les scènes sont des fonctions PURES du temps écoulé : à t = 3200 ms,
// l'image est toujours la même. C'est la condition pour que deux prises de
// capture se raccordent au montage. Aucune animation CSS non déterministe,
// aucun Math.random.
import React from "react";

// Gel du temps. Utilisé par le générateur du kit producteur, qui rend les
// scènes en HTML statique hors navigateur : aucun effet ne s'exécute, donc le
// temps doit être lisible dès le premier rendu. `null` = lecture normale.
let FROZEN: number | null = null;

/** Fige toutes les scènes à `t` ms. `null` rétablit la lecture animée. */
export function freezeTimeline(t: number | null) {
  FROZEN = t;
}

/** Millisecondes écoulées depuis le dernier (re)play. */
export function useTimeline(playKey: number, paused = false): number {
  const [t, setT] = React.useState(FROZEN ?? 0);
  React.useEffect(() => {
    if (FROZEN !== null) return;
    setT(0);
    if (paused) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      setT(now - t0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playKey, paused]);
  return t;
}

/**
 * Progression 0->1 d'un segment démarrant à `start` et durant `dur`.
 * Reste à 0 avant, saturé à 1 après : une scène ne « redescend » jamais.
 */
export function seg(t: number, start: number, dur: number): number {
  if (t <= start) return 0;
  if (t >= start + dur) return 1;
  return (t - start) / dur;
}

/** Interpolation linéaire. */
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
