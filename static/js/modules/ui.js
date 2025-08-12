/**
 * Module UI - Gestion de l'interface utilisateur
 * @author Content Writer Team
 * @version 1.0.0
 */

class KeywordMatcher {
    constructor() {
        this.pluralSuffixes = ['', 's', 'es', 'x'];
    }

    normalizeTextForSearch(text) {
        if (!text) return '';
        const withoutDiacritics = text.normalize('NFD').replace(/\p{M}+/gu, '');
        return withoutDiacritics
            .toLowerCase()
            .replace(/['"\u2018\u2019\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, ' ')
            .replace(/[-_]/g, ' ')
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    createPositionMap(text) {
        const map = {};
        let wordIndex = 0;
        const wordPattern = /[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu;
        let match;
        while ((match = wordPattern.exec(text)) !== null) {
            map[wordIndex] = {
                start: match.index,
                end: match.index + match[0].length,
                word: match[0]
            };
            wordIndex++;
        }
        return map;
    }

    matchesWithPlural(word, base) {
        for (const suffix of this.pluralSuffixes) {
            if (word === base + suffix) return true;
        }
        return false;
    }

    matchesExpression(textWords, startIndex, kwWords) {
        const k = kwWords.length;
        for (let j = 0; j < k; j++) {
            const textWord = textWords[startIndex + j];
            const kwWord = kwWords[j];
            if (j === k - 1) {
                if (!this.matchesWithPlural(textWord, kwWord)) return false;
            } else {
                if (textWord !== kwWord) return false;
            }
        }
        return true;
    }

    findAllMatches(text, keyword) {
        const normalizedText = this.normalizeTextForSearch(text);
        const normalizedKeyword = this.normalizeTextForSearch(keyword);
        const matches = [];
        const textWords = normalizedText.split(' ').filter(Boolean);
        const kwWords = normalizedKeyword.split(' ').filter(Boolean);
        if (kwWords.length === 0 || textWords.length === 0) return matches;

        const positionMap = this.createPositionMap(text);

        if (kwWords.length === 1) {
            const base = kwWords[0];
            let idx = 0;
            textWords.forEach((word) => {
                if (this.matchesWithPlural(word, base)) {
                    const originalPos = positionMap[idx];
                    if (originalPos) {
                        matches.push({ start: originalPos.start, end: originalPos.end, match: originalPos.word });
                    }
                }
                idx++;
            });
            return matches;
        }

        const k = kwWords.length;
        for (let i = 0; i <= textWords.length - k; i++) {
            if (this.matchesExpression(textWords, i, kwWords)) {
                const startPos = positionMap[i];
                const endPos = positionMap[i + k - 1];
                if (startPos && endPos) {
                    matches.push({ start: startPos.start, end: endPos.end, match: text.substring(startPos.start, endPos.end) });
                }
            }
        }
        return matches;
    }
}

class UIManager {
    constructor() {
        this.elements = {};
        this.marker = null;
        this.optimizationChart = null;
        this.initializeElements();
    }

    /**
     * Initialise les références aux éléments DOM
     */
    initializeElements() {
        this.elements = {
            // Éditeur
            editor: document.getElementById('editor'),
            titleInput: document.getElementById('title-input'),
            
            // Statistiques
            scoreSeo: document.getElementById('score-seo'),
            baseScore: document.getElementById('base-score'),
            obligatoiresScore: document.getElementById('obligatoires-score'),
            complementairesScore: document.getElementById('complementaires-score'),
            suroptimisation: document.getElementById('suroptimisation'),
            maxSuroptimisation: document.getElementById('max-suroptimisation'),
            wordCount: document.getElementById('word-count'),
            motsRequis: document.getElementById('mots-requis'),
            motsRestants: document.getElementById('mots-restants'),
            
            // Listes de mots-clés
            kwObligatoiresList: document.getElementById('kw-obligatoires-list'),
            kwObligatoiresSummary: document.getElementById('kw-obligatoires-summary'),
            kwComplementairesList: document.getElementById('kw-complementaires-list'),
            kwComplementairesSummary: document.getElementById('kw-complementaires-summary'),
            ngramsList: document.getElementById('ngrams-list'),
            
            // Guide
            guideKeywords: document.getElementById('guide-keywords'),
            slashrLocation: document.getElementById('slashr-location'),
            guideStatus: document.getElementById('guide-status'),
            orderGuideButton: document.getElementById('order-guide-button'),
            loadDefaultButton: document.getElementById('load-default-data'),
            
            // Graphique
            optimizationChart: document.getElementById('optimization-chart'),
            graphKeywordsList: document.getElementById('graph-keywords-list')
        };

        // Initialiser mark.js pour le surlignage
        if (this.elements.editor) {
            this.marker = new Mark(this.elements.editor);
        }

        console.log('🎨 Éléments UI initialisés');
    }

    /**
     * Met à jour les statistiques SEO dans l'interface
     * @param {Object} scores - Scores calculés
     * @param {Object} stats - Statistiques générales
     */
    updateStatistics(scores, stats) {
        // Score principal
        if (this.elements.scoreSeo) {
            this.elements.scoreSeo.textContent = `${scores.score_seo}%`;
            this.updateScoreColor(this.elements.scoreSeo, scores.score_seo);
        }

        // Scores détaillés
        if (this.elements.baseScore) {
            this.elements.baseScore.textContent = `${scores.base_score}%`;
        }
        if (this.elements.obligatoiresScore) {
            this.elements.obligatoiresScore.textContent = `${scores.score_obligatoires}%`;
        }
        if (this.elements.complementairesScore) {
            this.elements.complementairesScore.textContent = `${scores.score_complementaires}%`;
        }

        // Suroptimisation
        if (this.elements.suroptimisation) {
            this.elements.suroptimisation.textContent = `${scores.suroptimisation}%`;
            this.updateSuroptimisationColor(this.elements.suroptimisation, scores.suroptimisation);
        }

        // Nombre de mots
        if (this.elements.wordCount && stats.wordCount !== undefined) {
            this.elements.wordCount.textContent = stats.wordCount;
            
            if (this.elements.motsRequis && this.elements.motsRestants) {
                const motsRequis = parseInt(this.elements.motsRequis.textContent) || 0;
                const motsRestants = Math.max(0, motsRequis - stats.wordCount);
                this.elements.motsRestants.textContent = motsRestants;
                
                this.updateWordCountColor(this.elements.wordCount, stats.wordCount, motsRequis);
            }
        }

        console.log('📊 Statistiques mises à jour');
    }

    /**
     * Met à jour la couleur du score SEO selon sa valeur
     * @param {HTMLElement} element - Élément à modifier
     * @param {number} score - Score SEO
     */
    updateScoreColor(element, score) {
        element.className = element.className.replace(/text-(green|blue|yellow|red)-600/g, '');
        
        if (score >= 80) {
            element.classList.add('text-green-600');
        } else if (score >= 60) {
            element.classList.add('text-blue-600');
        } else if (score >= 40) {
            element.classList.add('text-yellow-600');
        } else {
            element.classList.add('text-red-600');
        }
    }

    /**
     * Met à jour la couleur de la suroptimisation
     * @param {HTMLElement} element - Élément à modifier
     * @param {number} suroptimisation - Pourcentage de suroptimisation
     */
    updateSuroptimisationColor(element, suroptimisation) {
        element.className = element.className.replace(/text-(green|blue|yellow|red)-600/g, '');
        
        if (suroptimisation <= 20) {
            element.classList.add('text-green-600');
        } else if (suroptimisation <= 50) {
            element.classList.add('text-blue-600');
        } else if (suroptimisation <= 80) {
            element.classList.add('text-yellow-600');
        } else {
            element.classList.add('text-red-600');
        }
    }

    /**
     * Met à jour la couleur du compteur de mots
     * @param {HTMLElement} element - Élément à modifier
     * @param {number} wordCount - Nombre de mots actuel
     * @param {number} motsRequis - Nombre de mots requis
     */
    updateWordCountColor(element, wordCount, motsRequis) {
        element.className = element.className.replace(/text-(green|blue|yellow|red)-600/g, '');
        
        const percentage = motsRequis > 0 ? Math.min(100, (wordCount / motsRequis) * 100) : 0;
        
        if (percentage >= 100) {
            element.classList.add('text-green-600');
        } else if (percentage >= 75) {
            element.classList.add('text-blue-600');
        } else if (percentage >= 50) {
            element.classList.add('text-yellow-600');
        } else {
            element.classList.add('text-red-600');
        }
    }

    /**
     * Met à jour les listes de mots-clés
     * @param {Object} keywords - Mots-clés analysés
     */
    updateKeywordLists(keywords) {
        this.updateObligatoiresList(keywords.obligatoires);
        this.updateComplementairesList(keywords.complementaires);
    }

    /**
     * Met à jour la liste des mots-clés obligatoires
     * @param {Object} obligatoires - Mots-clés obligatoires
     */
    updateObligatoiresList(obligatoires) {
        if (!this.elements.kwObligatoiresList) return;

        this.elements.kwObligatoiresList.innerHTML = '';
        
        let completedCount = 0;
        const totalCount = Object.keys(obligatoires).length;

        for (const [keyword, data] of Object.entries(obligatoires)) {
            if (data.completed) completedCount++;

            const keywordItem = document.createElement('div');
            keywordItem.className = 'keyword-item';
            keywordItem.innerHTML = `
                <span class="keyword-count ${data.completed ? 'completed' : ''}">${data.count}</span>
                <span class="keyword-text ${data.completed ? 'completed' : ''}">${keyword}</span>
                <span class="keyword-required" title="Min: ${data.minRequired}, Max: ${data.maxRequired}">${data.minRequired}-${data.maxRequired}</span>
            `;
            this.elements.kwObligatoiresList.appendChild(keywordItem);
        }

        if (this.elements.kwObligatoiresSummary) {
            this.elements.kwObligatoiresSummary.textContent = `${completedCount}/${totalCount}`;
        }
    }

    /**
     * Met à jour la liste des mots-clés complémentaires
     * @param {Object} complementaires - Mots-clés complémentaires
     */
    updateComplementairesList(complementaires) {
        if (!this.elements.kwComplementairesList) return;

        this.elements.kwComplementairesList.innerHTML = '';
        
        let completedCount = 0;
        const totalCount = Object.keys(complementaires).length;

        for (const [keyword, data] of Object.entries(complementaires)) {
            if (data.completed) completedCount++;

            const keywordItem = document.createElement('div');
            keywordItem.className = 'keyword-item';
            keywordItem.innerHTML = `
                <span class="keyword-count ${data.completed ? 'completed' : ''}">${data.count}</span>
                <span class="keyword-text ${data.completed ? 'completed' : ''}">${keyword}</span>
                <span class="keyword-required" title="Min: ${data.minRequired}, Max: ${data.maxRequired}">${data.minRequired}-${data.maxRequired}</span>
            `;
            this.elements.kwComplementairesList.appendChild(keywordItem);
        }

        if (this.elements.kwComplementairesSummary) {
            this.elements.kwComplementairesSummary.textContent = `${completedCount}/${totalCount}`;
        }
    }

    /**
     * Met à jour la liste des n-grams
     * @param {Array} ngrams - Liste des n-grams
     * @param {Array} ngramsFound - N-grams trouvés dans le texte
     */
    updateNgramsList(ngrams, ngramsFound = []) {
        if (!this.elements.ngramsList) return;

        this.elements.ngramsList.innerHTML = '';

        ngrams.forEach(ngram => {
            const ngramItem = document.createElement('span');
            ngramItem.className = `ngram-item ${ngramsFound.includes(ngram) ? 'found' : ''}`;
            ngramItem.textContent = ngram;
            this.elements.ngramsList.appendChild(ngramItem);
        });
    }

    /**
     * Surligne les mots-clés dans l'éditeur
     * @param {Object} keywords - Mots-clés à surligner
     * @param {Array} ngramsFound - N-grams trouvés
     */
    highlightKeywords(keywords, ngramsFound = []) {
        if (!this.marker) return;

        // Effacer les surlignages précédents
        this.marker.unmark();

        const editorText = this.elements.editor ? this.elements.editor.textContent : '';
        const matcher = new KeywordMatcher();

        // Construire les ranges obligatoires
        const obligatoryRanges = [];
        Object.keys(keywords.obligatoires).forEach(keyword => {
            const found = matcher.findAllMatches(editorText, keyword);
            found.forEach(m => obligatoryRanges.push({ start: m.start, length: Math.max(0, m.end - m.start) }));
        });

        // Construire les ranges complémentaires
        const complementaryRanges = [];
        Object.keys(keywords.complementaires).forEach(keyword => {
            const found = matcher.findAllMatches(editorText, keyword);
            found.forEach(m => complementaryRanges.push({ start: m.start, length: Math.max(0, m.end - m.start) }));
        });

        if (obligatoryRanges.length > 0) {
            this.marker.markRanges(obligatoryRanges, {
                className: 'obligatoire'
            });
        }

        if (complementaryRanges.length > 0) {
            this.marker.markRanges(complementaryRanges, {
                className: 'complementaire'
            });
        }

        // Surligner les n-grams trouvés (simple)
        ngramsFound.forEach(ngram => {
            this.marker.mark(ngram, {
                className: 'ngram',
                accuracy: 'exactly',
                separateWordSearch: false
            });
        });

        console.log('🎨 Mots-clés surlignés');
    }

    /**
     * Affiche un message de statut pour le guide
     * @param {string} message - Message à afficher
     * @param {string} type - Type de message (success, error, info)
     */
    showGuideStatus(message, type = 'info') {
        if (!this.elements.guideStatus) return;

        const colors = {
            success: 'text-green-500',
            error: 'text-red-500',
            info: 'text-blue-500'
        };

        this.elements.guideStatus.classList.remove('hidden');
        this.elements.guideStatus.innerHTML = `<div class="${colors[type]}">${message}</div>`;

        // Masquer automatiquement après 5 secondes pour les erreurs, 3 pour le reste
        const timeout = type === 'error' ? 5000 : 3000;
        setTimeout(() => {
            if (this.elements.guideStatus) {
                this.elements.guideStatus.classList.add('hidden');
            }
        }, timeout);
    }

    /**
     * Vérifie si un élément existe
     * @param {string} elementId - ID de l'élément
     * @returns {boolean} True si l'élément existe
     */
    elementExists(elementId) {
        return this.elements[elementId] && this.elements[elementId] !== null;
    }

    /**
     * Met à jour les données globales (mots requis, etc.)
     * @param {Object} data - Données de l'API
     */
    updateGlobalData(data) {
        if (data.mots_requis && this.elements.motsRequis) {
            this.elements.motsRequis.textContent = data.mots_requis;
        }

        if (data.max_suroptimisation && this.elements.maxSuroptimisation) {
            this.elements.maxSuroptimisation.textContent = data.max_suroptimisation;
        }

        // Stocker les n-grams dans un attribut data pour référence future
        if (data.ngrams && this.elements.editor) {
            const ngrams = typeof data.ngrams === 'string' ? data.ngrams : data.ngrams.join(';');
            this.elements.editor.setAttribute('data-ngrams', ngrams);
        }
    }
}

// Export du module
export { UIManager }; 