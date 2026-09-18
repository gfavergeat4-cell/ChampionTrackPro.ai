// frames.ts — Source unique des images du kit de production.
//
// Le dossier d'images (`exportFrames.tsx`) et le dossier de production
// (`buildProducerKit.tsx`) lisent tous les deux cette liste. Une seule
// définition, donc aucun risque qu'une image du dossier ne corresponde pas à
// sa description dans le document.
//
// Les instants `t` viennent du minutage réel des scènes (constantes T_* dans
// chaque fichier de scène). Ils ont été ajustés après contrôle des valeurs
// effectivement rendues — voir CHANGELOG bloc 19.

export interface Frame {
  /** Identifiant court, utilisé dans le document de production. */
  id: string;
  /** Nom du fichier PNG exporté, sans extension. */
  file: string;
  scene: 1 | 2 | 3;
  /** Instant du gel, en millisecondes depuis le début de la scène. */
  t: number;
  desktop?: boolean;
  title: string;
  note: string;
  /** Acte du storyboard auquel l'image se rattache. */
  act: number;
}

export const PHONE = { w: 390, h: 844 };
export const DESK = { w: 1280, h: 720 };

export const FRAMES: Frame[] = [
  {
    id: "1a", file: "01_checkin_repos", scene: 1, t: 1300, act: 2,
    title: "État de repos",
    note: "Aucune valeur n'est affirmée tant que l'athlète n'a pas touché le curseur. L'anneau blanc pulse pour appeler la réponse.",
  },
  {
    id: "1b", file: "02_checkin_curseur_pose", scene: 1, t: 2500, act: 2,
    title: "Première réponse posée",
    note: "Le curseur a glissé jusqu'à 78. La valeur s'affiche en cyan sous le rail.",
  },
  {
    id: "1c", file: "03_checkin_trois_reponses", scene: 1, t: 6400, act: 2,
    title: "Les trois réponses données",
    note: "Effort, jambes, lucidité. Trois items, pas quinze — le check-in doit tenir sous la minute.",
  },
  {
    id: "1d", file: "04_checkin_douleur", scene: 1, t: 7500, act: 2,
    title: "Porte d'entrée douleur",
    note: "Question fermée, posée après le ressenti pour ne pas contaminer les réponses précédentes.",
  },
  {
    id: "1e", file: "05_checkin_confirmation", scene: 1, t: 9700, act: 2,
    title: "Confirmation",
    note: "Fin du parcours athlète. C'est le dernier plan de l'acte 2.",
  },
  {
    id: "2a", file: "06_brief_jauge", scene: 2, t: 1400, act: 3,
    title: "La jauge se remplit",
    note: "Part de l'effectif dans sa bande habituelle ou au-dessus. Ce n'est PAS une moyenne de scores — voir la section méthode DAR.",
  },
  {
    id: "2b", file: "07_brief_roster_complet", scene: 2, t: 4400, act: 3,
    title: "Roster complet",
    note: "Douze athlètes, chacun avec son écart à SA baseline. Ne pas couper avant la fin de la cascade.",
  },
  {
    id: "2c", file: "08_brief_desktop_16x9", scene: 2, t: 4400, desktop: true, act: 3,
    title: "Version desktop 16:9",
    note: "Même écran en paysage. Sert la déclinaison YouTube et le partage d'écran en rendez-vous.",
  },
  {
    id: "3a", file: "09_baseline_courbe_trace", scene: 3, t: 1650, act: 4,
    title: "La courbe se trace",
    note: "21 jours. La bande grisée est sa zone de variations habituelles, ±10 points autour de sa propre moyenne mobile.",
  },
  {
    // 3020 et non 3300 : à 3300 les axes sont en pleine animation et affichent
    // des valeurs interpolées (25 au lieu de 47). Une image fixe ne doit
    // jamais montrer un chiffre qui n'existe pas. À 3020, le point du jour est
    // complet et les axes n'ont pas encore commencé.
    id: "3b", file: "10_baseline_point_du_jour", scene: 3, t: 3020, act: 4,
    title: "Le point du jour tombe sous la bande",
    note: "L'instant décisif de toute la vidéo. Tenir le plan.",
  },
  {
    id: "3c", file: "11_baseline_lecture_complete", scene: 3, t: 5800, act: 4,
    title: "Lecture complète",
    note: "Décomposition par axe : le physique décroche de 31 points, le mental de 12 seulement. C'est la divergence qui fait vendre.",
  },
];
