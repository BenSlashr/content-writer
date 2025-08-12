/**
 * Module Scoring - Calculs SEO et analyse des mots-clés
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

class SEOScoring {
    constructor() {
        this.keywords = {
            obligatoires: {},
            complementaires: {}
        };
        this.ngrams = [];
    }

    /**
     * Normalise le texte pour la recherche
     * @param {string} text - Texte à normaliser
     * @returns {string} Texte normalisé
     */
    normalizeTextForSearch(text) {
        if (!text) return '';

        // Décomposer Unicode et retirer les diacritiques (accent-insensible)
        const withoutDiacritics = text.normalize('NFD').replace(/\p{M}+/gu, '');

        return withoutDiacritics
            .toLowerCase()
            // Remplacer les apostrophes et guillemets par des espaces
            .replace(/['"\u2018\u2019\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, ' ')
            // Remplacer les tirets/underscores par des espaces
            .replace(/[-_]/g, ' ')
            // Garder seulement lettres/chiffres/espaces (Unicode)
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            // Supprimer les espaces invisibles éventuels
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            // Normaliser les espaces multiples
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Compte les occurrences d'un mot-clé dans un texte de manière robuste
     * @param {string} text - Texte à analyser
     * @param {string} keyword - Mot-clé à chercher
     * @returns {number} Nombre d'occurrences
     */
    countKeywordOccurrences(text, keyword) {
        if (!text || !keyword) return 0;
        const matcher = new KeywordMatcher();
        return matcher.findAllMatches(text, keyword).length;
    }

    /**
     * Analyse le texte et calcule les scores
     * @param {string} text - Texte à analyser
     * @returns {Object} Résultats de l'analyse
     */
    analyzeText(text) {
        const textLower = text.toLowerCase();
        const results = {
            keywords: { obligatoires: {}, complementaires: {} },
            ngrams: [],
            scores: {},
            stats: {}
        };

        // Analyser les mots-clés obligatoires
        for (const [keyword, data] of Object.entries(this.keywords.obligatoires)) {
            const count = this.countKeywordOccurrences(text, keyword);
            results.keywords.obligatoires[keyword] = {
                ...data,
                count,
                completed: count >= (data.minRequired || data.required || 1)
            };
        }

        // Analyser les mots-clés complémentaires
        for (const [keyword, data] of Object.entries(this.keywords.complementaires)) {
            const count = this.countKeywordOccurrences(text, keyword);
            results.keywords.complementaires[keyword] = {
                ...data,
                count,
                completed: count >= (data.minRequired || data.required || 1)
            };
        }

        // Calculer les scores
        results.scores = this.calculateSEOScore(results.keywords);
        
        // Statistiques générales
        const normalizedText = this.normalizeTextForSearch(textLower);
        const words = normalizedText.split(/\s+/).filter(word => word.length > 0);
        results.stats = {
            wordCount: words.length,
            uniqueWords: new Set(words).size
        };

        return results;
    }

    /**
     * Calcule le score SEO basé sur les mots-clés
     * @param {Object} keywords - Mots-clés analysés
     * @returns {Object} Scores détaillés
     */
    calculateSEOScore(keywords) {
        const totalObligatoires = Object.keys(keywords.obligatoires).length;
        const totalComplementaires = Object.keys(keywords.complementaires).length;
        
        // Score obligatoires (70%)
        const obligatoiresSuccess = Object.values(keywords.obligatoires)
            .filter(kw => kw.completed).length;
        const scoreObligatoires = totalObligatoires > 0 
            ? (obligatoiresSuccess / totalObligatoires) * 70 
            : 0;

        // Score complémentaires (30%)
        const complementairesSuccess = Object.values(keywords.complementaires)
            .filter(kw => kw.completed).length;
        const scoreComplementaires = totalComplementaires > 0 
            ? (complementairesSuccess / totalComplementaires) * 30 
            : 0;

        // Score de base
        const baseScore = scoreObligatoires + scoreComplementaires;

        // Calcul du malus de suroptimisation
        let malusCount = 0;
        const totalKeywords = totalObligatoires + totalComplementaires;

        // Vérifier suroptimisation obligatoires
        Object.values(keywords.obligatoires).forEach(kw => {
            const maxRequired = kw.maxRequired || (kw.minRequired * 2) || (kw.required * 2) || 2;
            if (kw.count > maxRequired) malusCount++;
        });

        // Vérifier suroptimisation complémentaires
        Object.values(keywords.complementaires).forEach(kw => {
            const maxRequired = kw.maxRequired || (kw.minRequired * 2) || (kw.required * 2) || 2;
            if (kw.count > maxRequired) malusCount++;
        });

        const malus = totalKeywords > 0 ? (malusCount / totalKeywords) * 20 : 0;
        const finalScore = Math.max(0, Math.min(100, baseScore - malus));

        return {
            score_seo: Math.round(finalScore),
            base_score: Math.round(baseScore),
            malus: Math.round(malus),
            score_obligatoires: Math.round(scoreObligatoires),
            score_complementaires: Math.round(scoreComplementaires),
            suroptimisation: totalKeywords > 0 ? Math.round((malusCount / totalKeywords) * 100) : 0,
            details: {
                obligatoires_success: obligatoiresSuccess,
                total_obligatoires: totalObligatoires,
                complementaires_success: complementairesSuccess,
                total_complementaires: totalComplementaires,
                malus_count: malusCount
            }
        };
    }

    /**
     * Met à jour les données des mots-clés
     * @param {Object} data - Données de l'API
     */
    updateKeywordsData(data) {
        // Mots-clés obligatoires
        this.keywords.obligatoires = {};
        if (data.KW_obligatoires && Array.isArray(data.KW_obligatoires)) {
            data.KW_obligatoires.forEach(kw => {
                const kwData = this.extractMinMaxValues(kw);
                if (kwData) {
                    this.keywords.obligatoires[kwData.keyword] = {
                        count: 0,
                        required: `${kwData.min},${kwData.max}`,
                        minRequired: kwData.min,
                        maxRequired: kwData.max,
                        importance: kwData.max,
                        completed: false
                    };
                }
            });
        }

        // Mots-clés complémentaires
        this.keywords.complementaires = {};
        if (data.KW_complementaires && Array.isArray(data.KW_complementaires)) {
            data.KW_complementaires.forEach(kw => {
                const kwData = this.extractMinMaxValues(kw);
                if (kwData) {
                    this.keywords.complementaires[kwData.keyword] = {
                        count: 0,
                        required: `${kwData.min},${kwData.max}`,
                        minRequired: kwData.min,
                        maxRequired: kwData.max,
                        importance: kwData.max,
                        completed: false
                    };
                }
            });
        }

        // N-grams
        if (data.ngrams) {
            this.ngrams = typeof data.ngrams === 'string' 
                ? data.ngrams.split(';').filter(ng => ng.trim())
                : data.ngrams;
        }
    }

    /**
     * Extrait les valeurs min/max d'un mot-clé
     * @param {Array} keyword - Données du mot-clé
     * @returns {Object|null} Données extraites
     */
    extractMinMaxValues(keyword) {
        if (!Array.isArray(keyword)) return null;
        
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
            // Format API Thot
            return {
                keyword: keyword[0],
                frequency: parseInt(keyword[1], 10) || 0,
                importance: parseInt(keyword[2], 10) || 0,
                min: parseInt(keyword[1], 10) || 0,
                max: parseInt(keyword[2], 10) || 0
            };
        }
        
        return null;
    }
}

// Export du module
export { SEOScoring }; 