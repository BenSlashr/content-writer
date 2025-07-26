// ============================================================================
// CONTENT WRITER - MODULE PRINCIPAL
// Extrait du fichier HTML monolithique pour améliorer la maintenabilité
// ============================================================================

// URL de l'API (à modifier selon l'environnement)
const API_URL = window.location.origin + window.location.pathname.replace(/\/$/, '');

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Fonction pour extraire correctement les valeurs min et max d'un mot-clé
 */
function extractMinMaxValues(keyword) {
    // Format API Slashr : [keyword, frequency, importance, min_freq, max_freq]
    // Format API Thot : [keyword, min, max]
    if (Array.isArray(keyword)) {
        if (keyword.length >= 5) {
            // Format API Slashr
            return {
                keyword: keyword[0],
                frequency: parseInt(keyword[1], 10) || 0,
                importance: parseInt(keyword[2], 10) || 0,
                min: parseInt(keyword[3], 10) || 0,
                max: parseInt(keyword[4], 10) || 0
            };
        } else if (keyword.length >= 3) {
            // Format API Thot (ancien format)
            return {
                keyword: keyword[0],
                frequency: parseInt(keyword[1], 10) || 0,
                importance: parseInt(keyword[2], 10) || 0,
                min: parseInt(keyword[1], 10) || 0,
                max: parseInt(keyword[2], 10) || 0
            };
        }
    }
    return null;
}

/**
 * Normalise le texte pour la recherche en supprimant la ponctuation excessive
 */
function normalizeTextForSearch(text) {
    text = text.replace(/['\"\u2018\u2019\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, ' ');
    text = text.replace(/[-_]/g, ' ');
    text = text.replace(/[^\w\s]/g, ' ');
    text = text.replace(/\s+/g, ' ');
    return text.trim();
}

/**
 * Compte les occurrences d'un mot-clé dans un texte de manière robuste
 */
function countKeywordOccurrences(text, keyword) {
    if (!text || !keyword) return 0;
    
    const normalizedText = normalizeTextForSearch(text.toLowerCase());
    const normalizedKeyword = normalizeTextForSearch(keyword.toLowerCase());
    
    // Méthode 1: Regex avec word boundaries
    const pattern = new RegExp(`\\b${normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = normalizedText.match(pattern) || [];
    const countRegex = matches.length;
    
    // Méthode 2: Split et comparaison exacte
    const words = normalizedText.split(/\s+/).filter(word => word.length > 0);
    const countSplit = words.filter(word => word === normalizedKeyword).length;
    
    // Debug détaillé pour identifier les problèmes
    console.log(`   🔍 Debug regex pour "${keyword}":`);
    console.log(`      Pattern: ${pattern}`);
    console.log(`      Matches: ${matches}`);
    console.log(`      Count regex: ${countRegex}`);
    console.log(`   📝 Mots dans le texte: [${words.join(', ')}]`);
    
    words.forEach(word => {
        if (word === normalizedKeyword) {
            console.log(`   ✅ Match split trouvé: "${word}"`);
        }
    });
    
    console.log(`   📊 Comparaison pour "${keyword}": regex=${countRegex}, split=${countSplit}`);
    
    // Final decision logic:
    if (countRegex === countSplit) {
        console.log(`   ✅ Méthodes concordantes, retour: ${countRegex}`);
        return countRegex;
    } else {
        console.log(`   ⚠️ Méthodes différentes, privilégier split: ${countSplit}`);
        // In case of difference, prioritize split method
        return countSplit;
    }
}

// ============================================================================
// VARIABLES GLOBALES
// ============================================================================

let currentQuery = "whey ou creatine";
let editorTimeout = null;
let keywords = {
    obligatoires: {},
    complementaires: {}
};
let ngrams = [];
let marker = null;
let keywordData = [];
let optimizationChart = null;
let editor = null;

// Données par défaut pour le chargement rapide
const defaultData = {
    "query": "whey ou creatine",
    "score_target": 54,
    "mots_requis": 1404,
    "KW_obligatoires": [["créatine",2,44],["whey",1,35],["prise",1,33],["muscle",2,29],["complément",2,27],["masse",2,25],["bcaa",1,25],["protéine",5,20],["alimentaire",2,21],["musculaire",2,17],["effet",3,12],["récupération",1,14],["musculation",1,12],["produit",1,12],["acide",2,10],["aminé",2,10],["force",2,9],["énergie",1,11],["monohydrate",2,8],["poudre",2,9],["dose",1,8],["consommer",1,8],["effort",2,9],["jour",1,8],["shaker",1,7],["objectif",1,7],["source",1,7],["séance",2,7],["sport",1,6],["lait",1,5],["sportif",1,6],["endurance",1,5],["exemple",1,5],["étude",1,5],["corps",1,6],["consommation",1,5],["recommandée",2,4],["bienfait",1,5],["puissance",1,6],["apport",1,5],["graisse",1,6],["meilleure",1,3],["haute",1,4],["santé",2,3],["rôle",1,4]],
    "KW_complementaires": [["pack",2,33],["collation",2,17],["taux",5,9],["substance",2,10],["point",1,11],["marque",4,6],["augmenter",2,8],["personne",1,8],["amélioration",1,8],["utilisé",1,8],["matin",2,8],["midi",2,8],["performance",2,7],["booster",1,7],["meilleur",1,7],["sportive",1,7],["développement",2,5],["prix",4,5],["gamme",1,7],["forme",2,6],["intense",2,7],["organisme",1,7],["court",2,7],["qualité",1,7],["profiter",1,7],["risque",1,7],["composition",2,7],["fabriqué",2,5],["choisir",2,4],["associer",2,4],["nutrition",2,4],["croissance",1,5],["isolate",1,4],["training",2,3],["eau",2,4],["bénéfique",1,5],["supplémentation",1,4],["dosage",1,6],["varié",2,4],["équilibré",2,4],["cadre",2,4],["essentiel",1,4],["temps",1,5],["existe",1,5],["aide",1,4],["premier",1,5],["charge",1,5],["association",2,5],["raison",1,5],["nutriment",1,5],["éviter",1,4],["haut",1,5],["dépasser",1,4],["développer",1,4],["volume",2,3],["lieu",1,5],["favoriser",1,6],["capacité",2,4],["apporte",1,5],["spécifique",1,4],["construction",2,4],["dérivée",1,4],["concentrée",1,4],["positif",1,5],["favorisant",1,5],["choix",2,3],["naturelle",2,4],["consommateur",2,4],["teneur",1,5],["goût",1,5],["formule",2,5],["format",2,4],["vie",2,4],["sain",2,4],["portée",2,4],["enfant",2,4],["sec",2,4],["marché",2,4],["forte",2,4],["conservation",2,4],["idéale",2,3],["apprécié",2,5],["partie",2,5],["supplément",1,4],["avantage",2,3],["creapure",2,3],["gramme",1,4],["utile",2,3],["première",1,2],["augmente",1,2],["contient",1,2],["repas",1,2],["lactosérum",1,2],["monde",1,2],["pratiquant",1,3],["intensité",1,4],["gain",2,3],["rapide",2,3],["article",1,2]],
    "ngrams": "grammes de créatine;lait de vache;synthèse des protéines;phase de charge;récupération musculaire;développement musculaire;protéine de lactosérum;créatine par jour;protéines de lactosérum;créatine augmente;force musculaire;nutrition sportive;whey et de créatine;grande quantité;régime alimentaire;sport nutrition;whey ou créatine;prise de muscle;supplémentation en créatine;protéine complète;courte durée;prise de masse musculaire;créatine et la whey;prenant de la créatine;adénosine triphosphate;apport protéique;prise de créatine;complément alimentaire;explosivité musculaire;augmentation de la masse;whey protein;masse maigre;prise de poids;protéine whey;construction musculaire;fonction rénale;augmentation de la force;créatine et la protéine;joue un rôle;jouent un rôle;whey isolat native;haute qualité;créatine monohydrate;faible teneur;whey isolate native;mode de vie sain;croissance musculaire;volume musculaire;protéine en poudre;petit lait;hypertrophie musculaire;haute intensité",
    "max_suroptimisation": 5
};

// ============================================================================
// INITIALISATION
// ============================================================================

/**
 * Initialisation de l'application
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM chargé, initialisation de l\'application');
    
    // Initialiser mark.js pour le surlignage
    marker = new Mark(document.getElementById("editor"));
    
    // Charger les données initiales
    loadInitialData();
    
    // Ajouter les écouteurs d'événements
    setupEventListeners();
    
    // Initialiser l'éditeur de texte enrichi (avec délai pour s'assurer que le DOM est prêt)
    setTimeout(() => {
        console.log('⏰ Tentative d\'initialisation de l\'éditeur après délai...');
        initTextEditor();
    }, 100);
    
    // Initialiser le graphique d'optimisation
    initOptimizationChart();
});

// ============================================================================
// NOTE: Le reste du code sera ajouté dans les prochaines étapes
// pour éviter de créer un fichier trop volumineux d'un coup
// ============================================================================ 