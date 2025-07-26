/**
 * Module Scoring - Calculs SEO et analyse des mots-clés
 * @author Content Writer Team
 * @version 1.0.0
 */

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
        
        // Remplacer les apostrophes et guillemets par des espaces
        text = text.replace(/['\"\u2018\u2019\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, ' ');
        // Remplacer les tirets par des espaces (pour éviter site-web = site web)
        text = text.replace(/[-_]/g, ' ');
        // Remplacer la ponctuation restante par des espaces
        text = text.replace(/[^\w\s]/g, ' ');
        // Normaliser les espaces multiples
        text = text.replace(/\s+/g, ' ');
        return text.trim();
    }

    /**
     * Compte les occurrences d'un mot-clé dans un texte de manière robuste
     * @param {string} text - Texte à analyser
     * @param {string} keyword - Mot-clé à chercher
     * @returns {number} Nombre d'occurrences
     */
    countKeywordOccurrences(text, keyword) {
        if (!text || !keyword) return 0;
        
        const normalizedText = this.normalizeTextForSearch(text.toLowerCase());
        const normalizedKeyword = this.normalizeTextForSearch(keyword.toLowerCase());
        
        if (!normalizedKeyword || !normalizedText) return 0;

        // Méthode 1: Regex avec word boundaries
        const pattern = new RegExp(`\\b${normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        const matches = normalizedText.match(pattern) || [];
        const countRegex = matches.length;
        
        // Méthode 2: Split et comparaison exacte pour validation
        const words = normalizedText.split(/\s+/).filter(word => word.length > 0);
        const countSplit = words.filter(word => word === normalizedKeyword).length;
        
        // Retourner le résultat le plus cohérent
        return countRegex === countSplit ? countRegex : Math.min(countRegex, countSplit);
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
            const count = this.countKeywordOccurrences(textLower, keyword);
            results.keywords.obligatoires[keyword] = {
                ...data,
                count,
                completed: count >= (data.minRequired || data.required || 1)
            };
        }

        // Analyser les mots-clés complémentaires
        for (const [keyword, data] of Object.entries(this.keywords.complementaires)) {
            const count = this.countKeywordOccurrences(textLower, keyword);
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