/**
 * Module API - Gestion des interactions avec le backend
 * @author Content Writer Team
 * @version 1.0.0
 */

class APIManager {
    constructor() {
        // Détection automatique du chemin de base
        const pathname = window.location.pathname;
        const basePath = pathname.includes('/content-writer') 
            ? pathname.substring(0, pathname.indexOf('/content-writer') + '/content-writer'.length)
            : pathname.replace(/\/$/, '');
        
        this.baseURL = window.location.origin + basePath;
        this.cache = new Map();
        this.requestTimeout = 30000; // 30 secondes
        
        console.log(`🔗 API Base URL configurée: ${this.baseURL}`);
    }

    /**
     * Analyser le texte via l'API backend
     * @param {string} text - Texte à analyser
     * @param {string} query - Requête de recherche
     * @returns {Promise<Object>} Résultats de l'analyse
     */
    async analyzeText(text, query) {
        const cacheKey = `analyze_${query}_${text.substring(0, 100)}`;
        
        if (this.cache.has(cacheKey)) {
            console.log('📦 Utilisation du cache pour l\'analyse');
            return this.cache.get(cacheKey);
        }

        try {
            const response = await fetch(`${this.baseURL}/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text, query }),
                signal: AbortSignal.timeout(this.requestTimeout)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.cache.set(cacheKey, data);
            
            console.log('✅ Analyse terminée avec succès');
            return data;
            
        } catch (error) {
            console.error('❌ Erreur lors de l\'analyse:', error);
            
            // Améliorer le message d'erreur selon le type
            let message = 'Erreur lors de l\'analyse du texte';
            if (error.name === 'AbortError') {
                message = 'Délai d\'attente dépassé pour l\'analyse';
            } else if (error.message?.includes('Failed to fetch')) {
                message = 'Impossible de contacter le serveur d\'analyse';
            } else if (error.message?.includes('HTTP 500')) {
                message = 'Erreur interne du serveur d\'analyse';
            } else if (error.message?.includes('HTTP 429')) {
                message = 'Trop de requêtes d\'analyse, veuillez patienter';
            }
            
            throw new APIError(message, error);
        }
    }

    /**
     * Commander un guide Slashr
     * @param {string} keywords - Mots-clés
     * @param {string} location - Localisation
     * @returns {Promise<Object>} Données du guide
     */
    async orderSlashrGuide(keywords, location = 'France') {
        const cacheKey = `slashr_${keywords}_${location}`;
        
        if (this.cache.has(cacheKey)) {
            console.log('📦 Utilisation du cache pour le guide Slashr');
            return this.cache.get(cacheKey);
        }

        try {
            const response = await fetch(`${this.baseURL}/order-guide-slashr`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ keywords, location }),
                signal: AbortSignal.timeout(this.requestTimeout)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.cache.set(cacheKey, data);
            
            console.log('✅ Guide Slashr commandé avec succès');
            return data;
            
        } catch (error) {
            console.error('❌ Erreur lors de la commande du guide Slashr:', error);
            
            // Améliorer le message d'erreur selon le type
            let message = 'Erreur lors de la commande du guide';
            if (error.name === 'AbortError') {
                message = 'Délai d\'attente dépassé pour la commande du guide';
            } else if (error.message?.includes('Failed to fetch')) {
                message = 'Impossible de contacter le service Slashr';
            } else if (error.message?.includes('HTTP 401')) {
                message = 'Accès non autorisé au service Slashr';
            } else if (error.message?.includes('HTTP 403')) {
                message = 'Quota dépassé pour le service Slashr';
            } else if (error.message?.includes('HTTP 500')) {
                message = 'Erreur interne du service Slashr';
            }
            
            throw new APIError(message, error);
        }
    }

    /**
     * Vider le cache
     */
    clearCache() {
        this.cache.clear();
        console.log('🗑️ Cache vidé');
    }
}

/**
 * Erreur API personnalisée
 */
class APIError extends Error {
    constructor(message, originalError) {
        super(message);
        this.name = 'APIError';
        this.originalError = originalError;
    }
}

// Export du module
export { APIManager, APIError }; 