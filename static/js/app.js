// Variables globales
let currentQuery = "whey ou creatine";
let editorTimeout = null;
let keywords = {
    obligatoires: {},
    complementaires: {}
};
let ngrams = [];
let marker = null;

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
    
    // Écouter les clics sur le bouton de recherche
    document.getElementById('search-button').addEventListener('click', function() {
        const query = document.getElementById('search-query').value.trim();
        if (query) {
            currentQuery = query;
            loadInitialData();
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
    // Mots-clés obligatoires
    keywords.obligatoires = data.kw_obligatoires || {};
    
    // Mots-clés complémentaires
    keywords.complementaires = data.kw_complementaires || {};
    
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
        if (data.completed) {
            completedObligatoires++;
        }
        
        const keywordItem = document.createElement('div');
        keywordItem.className = 'keyword-item';
        keywordItem.innerHTML = `
            <span class="keyword-count ${data.completed ? 'completed' : ''}">${data.count}</span>
            <span class="keyword-text ${data.completed ? 'completed' : ''}">${keyword}</span>
            <span class="keyword-required">${data.required}x</span>
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
        if (data.completed) {
            completedComplementaires++;
        }
        
        const keywordItem = document.createElement('div');
        keywordItem.className = 'keyword-item';
        keywordItem.innerHTML = `
            <span class="keyword-count ${data.completed ? 'completed' : ''}">${data.count}</span>
            <span class="keyword-text ${data.completed ? 'completed' : ''}">${keyword}</span>
            <span class="keyword-required">${data.required}x</span>
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

// Mettre à jour les statistiques
function updateStatistics(data) {
    // Score SEO
    document.getElementById('score-seo').textContent = `${data.score_seo}%`;
    
    // 200 premiers mots
    const premiersMotsPercent = Math.round((data.premiers_mots.count / data.premiers_mots.target) * 100);
    document.getElementById('premiers-mots-percent').textContent = `${premiersMotsPercent}%`;
    document.getElementById('premiers-mots-target').textContent = data.premiers_mots.target;
    
    // Suroptimisation
    document.getElementById('suroptimisation').textContent = `${data.suroptimisation}%`;
    document.getElementById('max-suroptimisation').textContent = data.max_suroptimisation;
    
    // Nombre de mots
    document.getElementById('word-count').textContent = data.word_count;
    document.getElementById('mots-requis').textContent = data.mots_requis;
    document.getElementById('mots-restants').textContent = Math.max(0, data.mots_requis - data.word_count);
    
    // Stocker les n-grams dans un attribut data pour référence future
    document.getElementById('editor').setAttribute('data-ngrams', data.ngrams || '');
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
