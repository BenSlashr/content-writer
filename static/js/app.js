// Variables globales
console.log('=== VERSION JAVASCRIPT: SLASHR FORCÉ v2.0 - SCORING AMÉLIORÉ ===');
let currentQuery = "whey ou creatine";
let editorTimeout = null;
let keywords = {
    obligatoires: {},
    complementaires: {}
};
let ngrams = [];
let marker = null;
let selectedApi = 'slashr'; // Forcer l'utilisation de l'API Slashr

// Initialisation de l'application
document.addEventListener('DOMContentLoaded', function() {
    // Initialiser mark.js pour le surlignage
    marker = new Mark(document.getElementById("editor"));
    
    // Charger les données initiales
    loadInitialData();
    
    // Ajouter les écouteurs d'événements
    setupEventListeners();
});

// Charger les données initiales (simuler une requête API)
function loadInitialData() {
    fetch('/analyze', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            text: '',
            query: currentQuery
        })
    })
    .then(response => response.json())
    .then(data => {
        // Stocker les mots-clés
        updateKeywordsData(data);
        
        // Mettre à jour l'interface
        updateKeywordLists();
        updateStatistics(data);
    })
    .catch(error => {
        console.error('Erreur lors du chargement des données:', error);
    });
}

// Configurer les écouteurs d'événements
function setupEventListeners() {
    console.log('setupEventListeners - selectedApi initial:', selectedApi);
    
    // Écouter les changements dans l'éditeur
    const editor = document.getElementById('editor');
    editor.addEventListener('input', function() {
        // Utiliser un délai pour éviter trop d'appels API
        clearTimeout(editorTimeout);
        editorTimeout = setTimeout(function() {
            analyzeText(editor.textContent);
        }, 500);
    });
    
    // Écouter les clics sur le bouton d'intention de recherche
    document.getElementById('toggle-intention').addEventListener('click', function() {
        const intentionContent = document.getElementById('intention-content');
        if (intentionContent.classList.contains('hidden')) {
            intentionContent.classList.remove('hidden');
            this.textContent = '-';
        } else {
            intentionContent.classList.add('hidden');
            this.textContent = '+';
        }
    });
    
    // Écouter les clics sur le bouton de commande de guide
    document.getElementById('order-guide-button').addEventListener('click', function() {
        const keywords = document.getElementById('guide-keywords').value.trim();
        if (keywords) {
            orderGuide(keywords);
        }
    });
    
    // Écouter les clics sur le bouton de données par défaut
    document.getElementById('load-default-data').addEventListener('click', function() {
        loadDefaultData();
    });
    
    // Écouter les clics sur le bouton de toggle du guide
    document.getElementById('toggle-guide').addEventListener('click', function() {
        const guideContent = document.getElementById('guide-content');
        if (guideContent.classList.contains('hidden')) {
            guideContent.classList.remove('hidden');
            this.textContent = '-';
        } else {
            guideContent.classList.add('hidden');
            this.textContent = '+';
        }
    });
}

// Analyser le texte et mettre à jour l'interface
function analyzeText(text) {
    fetch('/analyze', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            text: text,
            query: currentQuery
        })
    })
    .then(response => response.json())
    .then(data => {
        // Mettre à jour les données des mots-clés
        updateKeywordsData(data);
        
        // Mettre à jour l'interface
        updateKeywordLists();
        updateStatistics(data);
        highlightKeywords();
    })
    .catch(error => {
        console.error('Erreur lors de l\'analyse du texte:', error);
    });
}

// Mettre à jour les données des mots-clés
function updateKeywordsData(data) {
    // Mots-clés obligatoires - s'assurer que chaque mot-clé a une propriété count
    keywords.obligatoires = {};
    for (const [keyword, keywordData] of Object.entries(data.kw_obligatoires || {})) {
        keywords.obligatoires[keyword] = {
            ...keywordData,
            count: keywordData.count || 0,
            completed: keywordData.completed || false
        };
    }
    
    // Mots-clés complémentaires - s'assurer que chaque mot-clé a une propriété count
    keywords.complementaires = {};
    for (const [keyword, keywordData] of Object.entries(data.kw_complementaires || {})) {
        keywords.complementaires[keyword] = {
            ...keywordData,
            count: keywordData.count || 0,
            completed: keywordData.completed || false
        };
    }
    
    // N-grams
    ngrams = data.ngrams_found || [];
}

// Mettre à jour les listes de mots-clés dans l'interface
function updateKeywordLists() {
    // Mettre à jour la liste des mots-clés obligatoires
    const kwObligatoiresList = document.getElementById('kw-obligatoires-list');
    kwObligatoiresList.innerHTML = '';
    
    let completedObligatoires = 0;
    let totalObligatoires = Object.keys(keywords.obligatoires).length;
    
    for (const [keyword, data] of Object.entries(keywords.obligatoires)) {
        const count = data.count || 0;
        const required = data.required || 1;
        const completed = data.completed || false;
        
        if (completed) {
            completedObligatoires++;
        }
        
        const keywordItem = document.createElement('div');
        keywordItem.className = 'keyword-item';
        keywordItem.innerHTML = `
            <span class="keyword-count ${completed ? 'completed' : ''}">${count}</span>
            <span class="keyword-text ${completed ? 'completed' : ''}">${keyword}</span>
            <span class="keyword-required">${required}x</span>
        `;
        kwObligatoiresList.appendChild(keywordItem);
    }
    
    // Mettre à jour le résumé des mots-clés obligatoires
    document.getElementById('kw-obligatoires-summary').textContent = `${completedObligatoires}/${totalObligatoires}`;
    
    // Mettre à jour la liste des mots-clés complémentaires
    const kwComplementairesList = document.getElementById('kw-complementaires-list');
    kwComplementairesList.innerHTML = '';
    
    let completedComplementaires = 0;
    let totalComplementaires = Object.keys(keywords.complementaires).length;
    
    for (const [keyword, data] of Object.entries(keywords.complementaires)) {
        const count = data.count || 0;
        const required = data.required || 1;
        const completed = data.completed || false;
        
        if (completed) {
            completedComplementaires++;
        }
        
        const keywordItem = document.createElement('div');
        keywordItem.className = 'keyword-item';
        keywordItem.innerHTML = `
            <span class="keyword-count ${completed ? 'completed' : ''}">${count}</span>
            <span class="keyword-text ${completed ? 'completed' : ''}">${keyword}</span>
            <span class="keyword-required">${required}x</span>
        `;
        kwComplementairesList.appendChild(keywordItem);
    }
    
    // Mettre à jour le résumé des mots-clés complémentaires
    document.getElementById('kw-complementaires-summary').textContent = `${completedComplementaires}/${totalComplementaires}`;
    
    // Mettre à jour la liste des n-grams
    const ngramsList = document.getElementById('ngrams-list');
    ngramsList.innerHTML = '';
    
    // Récupérer tous les n-grams depuis l'API
    const allNgrams = document.querySelector('#editor').getAttribute('data-ngrams') || '';
    const ngramArray = allNgrams.split(';').filter(ng => ng.trim());
    
    for (const ngram of ngramArray) {
        const ngramItem = document.createElement('span');
        ngramItem.className = `ngram-item ${ngrams.includes(ngram) ? 'found' : ''}`;
        ngramItem.textContent = ngram;
        ngramsList.appendChild(ngramItem);
    }
}

// Mettre à jour les statistiques avec le nouveau système de scoring
function updateStatistics(data) {
    // Score SEO - nouveau système robuste
    const scoreSeo = data.score_seo !== undefined ? data.score_seo : 0;
    const baseScore = data.base_score !== undefined ? data.base_score : 0;
    const malus = data.malus !== undefined ? data.malus : 0;
    const scoreObligatoires = data.score_obligatoires !== undefined ? data.score_obligatoires : 0;
    const scoreComplementaires = data.score_complementaires !== undefined ? data.score_complementaires : 0;
    
    // Mettre à jour l'affichage du score principal
    const scoreSeoElement = document.getElementById('score-seo');
    scoreSeoElement.textContent = `${scoreSeo}%`;
    
    // Mise à jour de la couleur du score SEO en fonction de sa valeur
    if (scoreSeo >= 80) {
        scoreSeoElement.className = 'text-2xl font-bold text-green-600'; // Excellent
    } else if (scoreSeo >= 60) {
        scoreSeoElement.className = 'text-2xl font-bold text-blue-600'; // Bon
    } else if (scoreSeo >= 40) {
        scoreSeoElement.className = 'text-2xl font-bold text-yellow-600'; // Moyen
    } else {
        scoreSeoElement.className = 'text-2xl font-bold text-red-600'; // À améliorer
    }
    
    // Afficher les détails du score si les éléments existent
    const baseScoreElement = document.getElementById('base-score');
    const malusElement = document.getElementById('malus-score');
    const obligatoiresScoreElement = document.getElementById('obligatoires-score');
    const complementairesScoreElement = document.getElementById('complementaires-score');
    
    if (baseScoreElement) baseScoreElement.textContent = `${baseScore}%`;
    if (malusElement) malusElement.textContent = `${malus} pts`;
    if (obligatoiresScoreElement) obligatoiresScoreElement.textContent = `${scoreObligatoires}%`;
    if (complementairesScoreElement) complementairesScoreElement.textContent = `${scoreComplementaires}%`;
    
    // Afficher les détails du scoring si disponibles
    if (data.score_details) {
        const detailsElement = document.getElementById('score-details');
        if (detailsElement) {
            detailsElement.innerHTML = `
                <div class="text-xs text-gray-600">
                    <div>Obligatoires: ${data.score_details.obligatoires_success}/${data.score_details.total_obligatoires}</div>
                    <div>Complémentaires: ${data.score_details.complementaires_success}/${data.score_details.total_complementaires}</div>
                    <div>Mots-clés suroptimisés: ${data.score_details.malus_count}</div>
                </div>
            `;
        }
    }
    
    // Debug: Afficher les détails du score dans la console
    console.log('=== Score SEO Détaillé ===');
    console.log('Score final:', scoreSeo + '%');
    console.log('Score de base:', baseScore + '%');
    console.log('Malus:', malus + '%');
    console.log('Score obligatoires:', scoreObligatoires + '%');
    console.log('Score complémentaires:', scoreComplementaires + '%');
    if (data.score_details) {
        console.log('Détails:', data.score_details);
    }
    

    
    // Suroptimisation
    const suroptimisation = data.suroptimisation !== undefined ? data.suroptimisation : 0;
    const maxSuroptimisation = data.max_suroptimisation !== undefined ? data.max_suroptimisation : 5;
    document.getElementById('suroptimisation').textContent = `${suroptimisation}%`;
    document.getElementById('max-suroptimisation').textContent = maxSuroptimisation;
    
    // Nombre de mots
    const wordCount = data.word_count !== undefined ? data.word_count : 0;
    const motsRequis = data.mots_requis !== undefined ? data.mots_requis : 0;
    document.getElementById('word-count').textContent = wordCount;
    document.getElementById('mots-requis').textContent = motsRequis;
    document.getElementById('mots-restants').textContent = Math.max(0, motsRequis - wordCount);
    
    // Stocker les n-grams dans un attribut data pour référence future
    const ngrams = data.ngrams || '';
    document.getElementById('editor').setAttribute('data-ngrams', ngrams);
}

// Surligner les mots-clés dans l'éditeur
function highlightKeywords() {
    // Effacer les surlignages précédents
    marker.unmark();
    
    // Surligner les mots-clés obligatoires
    for (const keyword of Object.keys(keywords.obligatoires)) {
        marker.mark(keyword, {
            className: 'obligatoire',
            accuracy: 'exactly',
            separateWordSearch: false
        });
    }
    
    // Surligner les mots-clés complémentaires
    for (const keyword of Object.keys(keywords.complementaires)) {
        marker.mark(keyword, {
            className: 'complementaire',
            accuracy: 'exactly',
            separateWordSearch: false
        });
    }
    
    // Surligner les n-grams trouvés
    for (const ngram of ngrams) {
        marker.mark(ngram, {
            className: 'ngram',
            accuracy: 'exactly',
            separateWordSearch: false
        });
    }
}

// Fonction utilitaire pour échapper les caractères spéciaux dans les expressions régulières
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Commander un guide selon l'API sélectionnée
function orderGuide(keywords) {
    console.log('orderGuide appelé - utilisation forcée de l\'API Slashr');
    console.log('keywords:', keywords);
    
    // Forcer l'utilisation de l'API Slashr
    orderSlashrGuide(keywords);
}

// Commander un guide via l'API Slashr
function orderSlashrGuide(keywords) {
    console.log('orderSlashrGuide appelé avec keywords:', keywords);
    
    const location = document.getElementById('slashr-location').value;
    console.log('location:', location);
    
    const statusDiv = document.getElementById('guide-status');
    statusDiv.classList.remove('hidden');
    statusDiv.innerHTML = `<div class="text-blue-600">🔄 Commande du guide Slashr en cours (${location})...</div>`;
    
    console.log('Envoi de la requête POST vers /order-guide-slashr');
    
    fetch('/order-guide-slashr', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            keywords: keywords,
            location: location
        })
    })
    .then(response => {
        console.log('Réponse reçue de /order-guide-slashr:', response.status);
        return response.json();
    })
    .then(data => {
        console.log('Données reçues de /order-guide-slashr:', data);
        statusDiv.innerHTML = `<div class="text-green-600">✅ Guide Slashr commandé avec succès (${location})!</div>`;
        
        // Mettre à jour la requête actuelle
        currentQuery = keywords;
        
        // Mettre à jour les données des mots-clés
        updateKeywordsData(data);
        
        // Mettre à jour l'interface
        updateKeywordLists();
        updateStatistics(data);
        
        // Masquer le statut après 3 secondes
        setTimeout(() => {
            statusDiv.classList.add('hidden');
        }, 3000);
    })
    .catch(error => {
        console.error('Erreur lors de la commande du guide Slashr:', error);
        statusDiv.innerHTML = `<div class="text-red-600">❌ Erreur lors de la commande du guide Slashr</div>`;
        
        // Masquer le statut après 5 secondes
        setTimeout(() => {
            statusDiv.classList.add('hidden');
        }, 5000);
    });
}

// Commander un guide via l'API Thot (gardé pour utilisation future)
/*
function orderThotGuide(keywords) {
    const statusDiv = document.getElementById('guide-status');
    statusDiv.classList.remove('hidden');
    statusDiv.innerHTML = '<div class="text-blue-600">🔄 Commande du guide Thot en cours...</div>';
    
    fetch('/order-guide', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            keywords: keywords
        })
    })
    .then(response => response.json())
    .then(data => {
        statusDiv.innerHTML = '<div class="text-green-600">✅ Guide Thot commandé avec succès!</div>';
        
        // Mettre à jour la requête actuelle
        currentQuery = keywords;
        
        // Mettre à jour les données des mots-clés
        updateKeywordsData(data);
        
        // Mettre à jour l'interface
        updateKeywordLists();
        updateStatistics(data);
        
        // Masquer le statut après 3 secondes
        setTimeout(() => {
            statusDiv.classList.add('hidden');
        }, 3000);
    })
    .catch(error => {
        console.error('Erreur lors de la commande du guide Thot:', error);
        statusDiv.innerHTML = '<div class="text-red-600">❌ Erreur lors de la commande du guide Thot</div>';
        
        // Masquer le statut après 5 secondes
        setTimeout(() => {
            statusDiv.classList.add('hidden');
        }, 5000);
    });
}
*/

// Charger les données par défaut
function loadDefaultData() {
    const statusDiv = document.getElementById('guide-status');
    statusDiv.classList.remove('hidden');
    statusDiv.innerHTML = '<div class="text-blue-600">🔄 Chargement des données par défaut...</div>';
    
    // Utiliser les données par défaut (whey ou creatine)
    currentQuery = "whey ou creatine";
    
    fetch('/analyze', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            text: '',
            query: currentQuery
        })
    })
    .then(response => response.json())
    .then(data => {
        statusDiv.innerHTML = '<div class="text-green-600">✅ Données par défaut chargées!</div>';
        
        // Mettre à jour les données des mots-clés
        updateKeywordsData(data);
        
        // Mettre à jour l'interface
        updateKeywordLists();
        updateStatistics(data);
        
        // Masquer le statut après 3 secondes
        setTimeout(() => {
            statusDiv.classList.add('hidden');
        }, 3000);
    })
    .catch(error => {
        console.error('Erreur lors du chargement des données par défaut:', error);
        statusDiv.innerHTML = '<div class="text-red-600">❌ Erreur lors du chargement des données par défaut</div>';
        
        // Masquer le statut après 5 secondes
        setTimeout(() => {
            statusDiv.classList.add('hidden');
        }, 5000);
    });
}

