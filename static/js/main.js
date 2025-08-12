/**
 * Content Writer - Point d'entrée principal
 * @author Content Writer Team
 * @version 1.0.0
 */

import { APIManager, APIError } from './modules/api.js';
import { SEOScoring } from './modules/scoring.js';
import { UIManager } from './modules/ui.js';
import { TextEditor } from './modules/editor.js';
import { ChartManager } from './modules/chart.js';
import { ErrorHandler, AppError, ErrorTypes, ErrorSeverity } from './modules/errorHandler.js';
import { NotificationManager } from './modules/notifications.js';

/**
 * Application principale Content Writer
 */
class ContentWriterApp {
    constructor() {
        // Initialiser les modules
        this.errorHandler = new ErrorHandler();
        this.notifications = new NotificationManager();
        this.api = new APIManager();
        this.scoring = new SEOScoring();
        this.ui = new UIManager();
        this.editor = new TextEditor();
        this.chart = new ChartManager();
        
        // Connecter le gestionnaire d'erreurs aux notifications
        this.errorHandler.setNotificationManager(this.notifications);
        
        // Rendre le gestionnaire de notifications accessible globalement pour les actions
        window.notificationManager = this.notifications;
        
        // État de l'application
        this.currentQuery = "whey ou creatine";
        this.editorTimeout = null;
        this.isInitialized = false;
        
        console.log('🚀 Content Writer App initialisée');
    }

    /**
     * Initialise l'application
     */
    async init() {
        if (this.isInitialized) {
            console.warn('⚠️ Application déjà initialisée');
            return;
        }

        try {
            // Attendre que le DOM soit prêt
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }

            console.log('📱 Initialisation de l\'application...');

            // Initialiser les modules
            await this.initializeModules();
            
            // Configurer les événements
            this.setupEventListeners();
            
            // Charger les données initiales
            await this.loadInitialData();
            
            this.isInitialized = true;
            console.log('✅ Application initialisée avec succès');
            
        } catch (error) {
            const errorId = this.errorHandler.handleError(
                this.errorHandler.createCriticalError(
                    'Échec de l\'initialisation de l\'application',
                    error,
                    { component: 'main', method: 'init' }
                )
            );
            console.error('❌ Erreur critique lors de l\'initialisation:', errorId);
        }
    }

    /**
     * Initialise tous les modules
     */
    async initializeModules() {
        // Initialiser l'éditeur de texte enrichi
        if (this.ui.elementExists('editor')) {
            await this.editor.init();
            console.log('📝 Éditeur de texte initialisé');
        }

        // Initialiser le graphique d'optimisation
        await this.chart.init();
        console.log('📊 Graphique d\'optimisation initialisé');
    }

    /**
     * Configure tous les écouteurs d'événements
     */
    setupEventListeners() {
        console.log('🎧 Configuration des écouteurs d\'événements');

        // Écouter les changements dans l'éditeur
        if (this.ui.elements.editor) {
            this.ui.elements.editor.addEventListener('input', (e) => {
                this.handleEditorInput(e.target.textContent);
            });

            this.ui.elements.editor.addEventListener('paste', (e) => {
                e.preventDefault();
                const text = (e.clipboardData || window.clipboardData).getData('text/plain');
                document.execCommand('insertText', false, text);
                
                setTimeout(() => {
                    this.handleEditorInput(e.target.textContent);
                }, 100);
            });
        }

        // Bouton commander un guide
        if (this.ui.elements.orderGuideButton) {
            this.ui.elements.orderGuideButton.addEventListener('click', () => {
                this.handleOrderGuide();
            });
        }

        // Bouton charger données par défaut
        if (this.ui.elements.loadDefaultButton) {
            this.ui.elements.loadDefaultButton.addEventListener('click', () => {
                this.handleLoadDefaultData();
            });
        }

        console.log('✅ Écouteurs d\'événements configurés');
    }

    /**
     * Gère les changements dans l'éditeur avec debouncing
     * @param {string} text - Texte de l'éditeur
     */
    handleEditorInput(text) {
        // Utiliser un délai pour éviter trop d'appels
        clearTimeout(this.editorTimeout);
        this.editorTimeout = setTimeout(() => {
            this.analyzeText(text);
        }, 500);
    }

    /**
     * Analyse le texte en temps réel
     * @param {string} text - Texte à analyser
     */
    async analyzeText(text) {
        // Toujours récupérer le contenu le plus à jour depuis l'éditeur
        const latestText = this.ui?.elements?.editor?.textContent ?? text ?? '';

        if (!latestText.trim()) {
            // Réinitialiser complètement l'interface si le texte est vide
            this.ui.updateStatistics({
                score_seo: 0, base_score: 0, malus: 0,
                score_obligatoires: 0, score_complementaires: 0,
                suroptimisation: 0
            }, { wordCount: 0 });
            // Vider les listes de mots-clés et les surlignages
            this.ui.updateKeywordLists({ obligatoires: {}, complementaires: {} });
            this.ui.highlightKeywords({ obligatoires: {}, complementaires: {} }, []);
            // Nettoyer le graphique
            if (this.chart?.clear) this.chart.clear();
            return;
        }

        try {
            console.log('🔄 Analyse du texte en cours...');

            // Analyser à partir du contenu courant de l'éditeur
            const localResults = this.scoring.analyzeText(latestText);

            // Mettre à jour l'interface immédiatement
            this.ui.updateStatistics(localResults.scores, localResults.stats);
            this.ui.updateKeywordLists(localResults.keywords);
            this.ui.highlightKeywords(localResults.keywords, localResults.ngrams);
            
            // Mettre à jour le graphique avec les données des mots-clés
            const keywordData = this.prepareKeywordDataForChart(localResults.keywords);
            this.chart.updateChart(keywordData);

            // Optionnel: Synchroniser avec le backend pour validation
            // const serverResults = await this.api.analyzeText(text, this.currentQuery);
            // if (serverResults) {
            //     this.updateFromServerResults(serverResults);
            // }

        } catch (error) {
            this.errorHandler.handleError(
                new AppError(
                    'Erreur lors de l\'analyse du texte',
                    ErrorTypes.SCORING,
                    ErrorSeverity.MEDIUM,
                    error,
                    { 
                        component: 'main', 
                        method: 'analyzeText',
                        textLength: text.length,
                        retryFunction: () => this.analyzeText(text)
                    }
                )
            );
        }
    }

    /**
     * Charge les données initiales - Ne charge plus automatiquement les données par défaut
     */
    async loadInitialData() {
        try {
            console.log('📊 Initialisation sans données par défaut - en attente de commande...');
            
            // Initialiser l'interface avec des valeurs vides
            this.ui.updateStatistics({
                score_seo: 0, base_score: 0, malus: 0,
                score_obligatoires: 0, score_complementaires: 0,
                suroptimisation: 0
            }, { wordCount: 0 });

            // Ne plus charger automatiquement les données par défaut
            // L'utilisateur doit maintenant cliquer sur "Charger données par défaut" ou "Commander un guide"

        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation:', error);
            this.ui.showGuideStatus('Erreur lors de l\'initialisation', 'error');
        }
    }

    /**
     * Gère la commande d'un guide
     */
    async handleOrderGuide() {
        const keywords = this.ui.elements.guideKeywords?.value?.trim();
        if (!keywords) {
            alert('Veuillez entrer un mot-clé');
            return;
        }

        const location = this.ui.elements.slashrLocation?.value || 'France';

        try {
            this.ui.showGuideStatus(`Commande du guide Slashr en cours (${location})...`, 'info');

            const data = await this.api.orderSlashrGuide(keywords, location);
            
            this.ui.showGuideStatus('Guide Slashr commandé avec succès !', 'success');
            this.currentQuery = keywords;
            
            // Mettre à jour l'interface avec les nouvelles données
            this.updateFromAPIData(data);

        } catch (error) {
            this.errorHandler.handleError(
                this.errorHandler.createAPIError(
                    'Impossible de commander le guide Slashr',
                    error,
                    { 
                        component: 'main', 
                        method: 'handleOrderGuide',
                        keywords: keywords,
                        location: location,
                        retryFunction: () => this.handleOrderGuide()
                    }
                )
            );
        }
    }

    /**
     * Gère le chargement des données par défaut
     */
    async handleLoadDefaultData() {
        try {
            this.ui.showGuideStatus('Chargement des données par défaut...', 'info');

            const defaultData = this.getDefaultData();
            this.currentQuery = defaultData.query;
            
            this.updateFromAPIData(defaultData);
            
            this.ui.showGuideStatus('Données par défaut chargées !', 'success');

            // Analyser le texte actuel avec les nouveaux mots-clés
            const editorText = this.ui.elements.editor?.textContent || '';
            if (editorText) {
                this.analyzeText(editorText);
            }

        } catch (error) {
            this.errorHandler.handleError(
                new AppError(
                    'Impossible de charger les données par défaut',
                    ErrorTypes.API,
                    ErrorSeverity.LOW,
                    error,
                    { 
                        component: 'main', 
                        method: 'handleLoadDefaultData',
                        retryFunction: () => this.handleLoadDefaultData()
                    }
                )
            );
        }
    }

    /**
     * Met à jour l'interface à partir des données API
     * @param {Object} data - Données de l'API
     */
    updateFromAPIData(data) {
        // Mettre à jour le module scoring
        this.scoring.updateKeywordsData(data);
        
        // Mettre à jour l'interface
        this.ui.updateGlobalData(data);
        this.ui.updateKeywordLists(this.scoring.keywords);
        this.ui.updateNgramsList(this.scoring.ngrams);
        
        // Mettre à jour le graphique avec les nouvelles données
        const keywordData = this.prepareKeywordDataForChart(this.scoring.keywords);
        this.chart.updateChart(keywordData);

        console.log('🔄 Interface mise à jour avec les données API');
    }

    /**
     * Prépare les données des mots-clés pour le graphique
     * @param {Object} keywords - Mots-clés analysés
     * @returns {Array} Données formatées pour le graphique
     */
    prepareKeywordDataForChart(keywords) {
        const keywordData = [];
        
        // Ajouter les mots-clés obligatoires
        Object.entries(keywords.obligatoires || {}).forEach(([keyword, data]) => {
            keywordData.push({
                keyword: keyword,
                count: data.count || 0,
                minRequired: data.minRequired || 0,
                maxRequired: data.maxRequired || 0,
                importance: data.importance || 0,
                type: 'obligatoire'
            });
        });
        
        // Ajouter les mots-clés complémentaires
        Object.entries(keywords.complementaires || {}).forEach(([keyword, data]) => {
            keywordData.push({
                keyword: keyword,
                count: data.count || 0,
                minRequired: data.minRequired || 0,
                maxRequired: data.maxRequired || 0,
                importance: data.importance || 0,
                type: 'complementaire'
            });
        });
        
        return keywordData;
    }

    /**
     * Retourne les données par défaut
     * @returns {Object} Données par défaut
     */
    getDefaultData() {
        return {
            "query": "whey ou creatine",
            "score_target": 54,
            "mots_requis": 1404,
            "KW_obligatoires": [
                ["créatine", 2, 44], ["whey", 1, 35], ["prise", 1, 33], ["muscle", 2, 29],
                ["complément", 2, 27], ["masse", 2, 25], ["bcaa", 1, 25], ["protéine", 5, 20],
                ["alimentaire", 2, 21], ["musculaire", 2, 17], ["effet", 3, 12], ["récupération", 1, 14],
                ["musculation", 1, 12], ["produit", 1, 12], ["acide", 2, 10], ["aminé", 2, 10],
                ["force", 2, 9], ["énergie", 1, 11], ["monohydrate", 2, 8], ["poudre", 2, 9]
            ],
            "KW_complementaires": [
                ["pack", 2, 33], ["collation", 2, 17], ["taux", 5, 9], ["substance", 2, 10],
                ["point", 1, 11], ["marque", 4, 6], ["augmenter", 2, 8], ["personne", 1, 8],
                ["amélioration", 1, 8], ["utilisé", 1, 8], ["matin", 2, 8], ["midi", 2, 8],
                ["performance", 2, 7], ["booster", 1, 7], ["meilleur", 1, 7], ["sportive", 1, 7]
            ],
            "ngrams": "grammes de créatine;lait de vache;synthèse des protéines;phase de charge;récupération musculaire;développement musculaire;protéine de lactosérum;créatine par jour;protéines de lactosérum;créatine augmente;force musculaire;nutrition sportive;whey et de créatine;grande quantité;régime alimentaire;sport nutrition;whey ou créatine;prise de muscle;supplémentation en créatine;protéine complète;courte durée;prise de masse musculaire;créatine et la whey;prenant de la créatine;adénosine triphosphate;apport protéique;prise de créatine;complément alimentaire;explosivité musculaire;augmentation de la masse;whey protein;masse maigre;prise de poids;protéine whey;construction musculaire;fonction rénale;augmentation de la force;créatine et la protéine;joue un rôle;jouent un rôle;whey isolat native;haute qualité;créatine monohydrate;faible teneur;whey isolate native;mode de vie sain;croissance musculaire;volume musculaire;protéine en poudre;petit lait;hypertrophie musculaire;haute intensité",
            "max_suroptimisation": 5
        };
    }
}

// Initialiser l'application
const app = new ContentWriterApp();

// Démarrer l'application quand le DOM est prêt
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}

// Export pour utilisation externe si nécessaire
window.ContentWriterApp = app;

// Rendre les gestionnaires d'erreurs et notifications disponibles globalement
window.errorHandler = app.errorHandler;
window.notificationManager = app.notifications; 