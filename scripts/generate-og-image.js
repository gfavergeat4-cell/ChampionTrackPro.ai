#!/usr/bin/env node

/**
 * Script pour générer og-image.jpg à partir d'une image source
 * Usage: node scripts/generate-og-image.js [chemin-vers-image-source]
 * 
 * Si aucun chemin n'est fourni, cherche automatiquement:
 * - assets/logo-source.jpg
 * - assets/logo-source.png
 * - public/logo-source.jpg
 * - public/logo-source.png
 */

const fs = require('fs');
const path = require('path');

// Dimensions Open Graph standard
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const OUTPUT_FILE = path.join(__dirname, '../web/og-image.jpg');

// Chemins possibles pour l'image source
const POSSIBLE_SOURCES = [
  path.join(__dirname, '../assets/logo-source.jpg'),
  path.join(__dirname, '../assets/logo-source.png'),
  path.join(__dirname, '../public/logo-source.jpg'),
  path.join(__dirname, '../public/logo-source.png'),
];

function findSourceImage(userPath) {
  if (userPath) {
    const fullPath = path.isAbsolute(userPath) 
      ? userPath 
      : path.join(process.cwd(), userPath);
    
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
    console.error(`❌ Image source non trouvée: ${fullPath}`);
    process.exit(1);
  }

  // Chercher automatiquement
  for (const sourcePath of POSSIBLE_SOURCES) {
    if (fs.existsSync(sourcePath)) {
      return sourcePath;
    }
  }

  return null;
}

async function generateOGImage(sourcePath) {
  try {
    // Essayer d'utiliser sharp (bibliothèque recommandée)
    let sharp;
    try {
      sharp = require('sharp');
    } catch (e) {
      console.error('❌ La bibliothèque "sharp" n\'est pas installée.');
      console.error('   Installez-la avec: npm install sharp --save-dev');
      console.error('   Ou utilisez: npm install sharp');
      process.exit(1);
    }

    console.log(`📸 Lecture de l'image source: ${sourcePath}`);
    
    // Lire l'image source
    const image = sharp(sourcePath);
    const metadata = await image.metadata();
    
    console.log(`   Dimensions originales: ${metadata.width}x${metadata.height}`);
    console.log(`   Format: ${metadata.format}`);

    // Créer le dossier de sortie si nécessaire
    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Redimensionner et recadrer pour 1200x630
    // Stratégie: redimensionner pour couvrir, puis recadrer au centre
    const resized = image
      .resize(OG_WIDTH, OG_HEIGHT, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({
        quality: 85,
        mozjpeg: true
      });

    // Écrire le fichier
    await resized.toFile(OUTPUT_FILE);

    // Vérifier la taille du fichier
    const stats = fs.statSync(OUTPUT_FILE);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log(`✅ Image générée avec succès!`);
    console.log(`   Fichier: ${OUTPUT_FILE}`);
    console.log(`   Dimensions: ${OG_WIDTH}x${OG_HEIGHT}px`);
    console.log(`   Taille: ${fileSizeMB} MB`);

    if (stats.size > 1024 * 1024) {
      console.warn(`⚠️  Attention: L'image fait plus de 1 MB (${fileSizeMB} MB)`);
      console.warn(`   Vous pouvez réduire la qualité en modifiant le script (ligne quality: 85)`);
    }

  } catch (error) {
    console.error('❌ Erreur lors de la génération de l\'image:', error.message);
    process.exit(1);
  }
}

// Point d'entrée
const userSourcePath = process.argv[2];
const sourcePath = findSourceImage(userSourcePath);

if (!sourcePath) {
  console.error('❌ Aucune image source trouvée.');
  console.error('');
  console.error('Usage:');
  console.error('  node scripts/generate-og-image.js [chemin-vers-image]');
  console.error('');
  console.error('Ou placez votre image source dans un de ces emplacements:');
  POSSIBLE_SOURCES.forEach(p => console.error(`  - ${p}`));
  process.exit(1);
}

generateOGImage(sourcePath);

