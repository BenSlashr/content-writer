/**
 * Module ErrorHandler - Gestion centralisée des erreurs
 * @author Content Writer Team
 * @version 1.0.0
 */

/**
 * Types d'erreurs supportés
 */
const ErrorTypes = {
    NETWORK: 'network',
    API: 'api', 
    VALIDATION: 'validation',
    PARSING: 'parsing',
    UI: 'ui',
    CHART: 'chart',
    EDITOR: 'editor',
    SCORING: 'scoring',
    UNKNOWN: 'unknown'
};

/**
 * Niveaux de sévérité
 */
const ErrorSeverity = {
    LOW: 'low',
    MEDIUM: 'medium', 
    HIGH: 'high',
    CRITICAL: 'critical'
};

/**
 * Erreur personnalisée de l'application
 */
class AppError extends Error {
    constructor(message, type = ErrorTypes.UNKNOWN, severity = ErrorSeverity.MEDIUM, originalError = null, context = {}) {
        super(message);
        this.name = 'AppError';
        this.type = type;
        this.severity = severity;
        this.originalError = originalError;
        this.context = context;
        this.timestamp = new Date().toISOString();
        this.id = this.generateErrorId();
    }

    generateErrorId() {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            message: this.message,
            type: this.type,
            severity: this.severity,
            timestamp: this.timestamp,
            context: this.context,
            stack: this.stack,
            originalError: this.originalError ? {
                name: this.originalError.name,
                message: this.originalError.message,
                stack: this.originalError.stack
            } : null
        };
    }
}

/**
 * Gestionnaire d'erreurs centralisé
 */
class ErrorHandler {
    constructor() {
        this.errors = [];
        this.maxErrors = 100; // Limite du nombre d'erreurs stockées
        this.notificationManager = null;
        this.logLevel = 'info'; // debug, info, warn, error
        this.isProduction = window.location.hostname !== 'localhost';
        
        // Initialiser la capture des erreurs globales
        this.initGlobalErrorHandling();
        
        console.log('🛡️ Gestionnaire d\'erreurs initialisé');
    }

    /**
     * Initialise la capture des erreurs globales
     */
    initGlobalErrorHandling() {
        // Erreurs JavaScript non capturées
        window.addEventListener('error', (event) => {
            this.handleError(new AppError(
                event.message || 'Erreur JavaScript non capturée',
                ErrorTypes.UNKNOWN,
                ErrorSeverity.HIGH,
                event.error,
                {
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno
                }
            ));
        });

        // Promesses rejetées non capturées
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError(new AppError(
                'Promesse rejetée non capturée',
                ErrorTypes.UNKNOWN,
                ErrorSeverity.HIGH,
                event.reason,
                { reason: event.reason }
            ));
        });
    }

    /**
     * Définit le gestionnaire de notifications
     * @param {Object} notificationManager - Gestionnaire de notifications
     */
    setNotificationManager(notificationManager) {
        this.notificationManager = notificationManager;
    }

    /**
     * Gère une erreur
     * @param {Error|AppError} error - Erreur à gérer
     * @param {Object} context - Contexte supplémentaire
     * @returns {string} ID de l'erreur
     */
    handleError(error, context = {}) {
        let appError;
        
        if (error instanceof AppError) {
            appError = error;
            // Ajouter le contexte supplémentaire
            appError.context = { ...appError.context, ...context };
        } else {
            // Convertir l'erreur en AppError
            appError = this.createAppError(error, context);
        }

        // Stocker l'erreur
        this.storeError(appError);

        // Logger l'erreur
        this.logError(appError);

        // Notifier l'utilisateur si nécessaire
        this.notifyUser(appError);

        // Envoyer à un service de monitoring (si configuré)
        this.sendToMonitoring(appError);

        return appError.id;
    }

    /**
     * Crée une AppError à partir d'une erreur standard
     * @param {Error} error - Erreur originale
     * @param {Object} context - Contexte
     * @returns {AppError} Erreur formatée
     */
    createAppError(error, context = {}) {
        let type = ErrorTypes.UNKNOWN;
        let severity = ErrorSeverity.MEDIUM;

        // Détecter le type d'erreur automatiquement
        if (error.name === 'TypeError' || error.name === 'ReferenceError') {
            type = ErrorTypes.UI;
            severity = ErrorSeverity.HIGH;
        } else if (error.name === 'SyntaxError') {
            type = ErrorTypes.PARSING;
            severity = ErrorSeverity.HIGH;
        } else if (error.message?.includes('fetch') || error.message?.includes('network')) {
            type = ErrorTypes.NETWORK;
            severity = ErrorSeverity.MEDIUM;
        } else if (error.message?.includes('API') || error.message?.includes('HTTP')) {
            type = ErrorTypes.API;
            severity = ErrorSeverity.MEDIUM;
        }

        return new AppError(
            error.message || 'Erreur inconnue',
            type,
            severity,
            error,
            context
        );
    }

    /**
     * Stocke l'erreur dans l'historique
     * @param {AppError} error - Erreur à stocker
     */
    storeError(error) {
        this.errors.unshift(error);
        
        // Limiter le nombre d'erreurs stockées
        if (this.errors.length > this.maxErrors) {
            this.errors = this.errors.slice(0, this.maxErrors);
        }
    }

    /**
     * Log l'erreur dans la console
     * @param {AppError} error - Erreur à logger
     */
    logError(error) {
        const logData = {
            id: error.id,
            type: error.type,
            severity: error.severity,
            message: error.message,
            timestamp: error.timestamp,
            context: error.context
        };

        switch (error.severity) {
            case ErrorSeverity.CRITICAL:
                console.error('🔥 ERREUR CRITIQUE:', logData);
                if (error.originalError) {
                    console.error('Stack trace:', error.originalError);
                }
                break;
            case ErrorSeverity.HIGH:
                console.error('❌ ERREUR HAUTE:', logData);
                break;
            case ErrorSeverity.MEDIUM:
                console.warn('⚠️ ERREUR MOYENNE:', logData);
                break;
            case ErrorSeverity.LOW:
                console.info('ℹ️ ERREUR FAIBLE:', logData);
                break;
        }
    }

    /**
     * Notifie l'utilisateur selon la sévérité
     * @param {AppError} error - Erreur à notifier
     */
    notifyUser(error) {
        if (!this.notificationManager) return;

        const userMessage = this.getUserFriendlyMessage(error);
        
        switch (error.severity) {
            case ErrorSeverity.CRITICAL:
                this.notificationManager.showError(userMessage, {
                    persistent: true,
                    actions: [
                        { label: 'Recharger la page', action: () => window.location.reload() },
                        { label: 'Signaler le problème', action: () => this.reportError(error) }
                    ]
                });
                break;
            case ErrorSeverity.HIGH:
                this.notificationManager.showError(userMessage, {
                    duration: 8000,
                    actions: [
                        { label: 'Réessayer', action: () => this.retryLastAction(error) }
                    ]
                });
                break;
            case ErrorSeverity.MEDIUM:
                this.notificationManager.showWarning(userMessage, { duration: 5000 });
                break;
            case ErrorSeverity.LOW:
                // Les erreurs faibles ne sont généralement pas montrées à l'utilisateur
                break;
        }
    }

    /**
     * Génère un message convivial pour l'utilisateur
     * @param {AppError} error - Erreur
     * @returns {string} Message utilisateur
     */
    getUserFriendlyMessage(error) {
        const messages = {
            [ErrorTypes.NETWORK]: 'Problème de connexion réseau. Vérifiez votre connexion internet.',
            [ErrorTypes.API]: 'Erreur de communication avec le serveur. Veuillez réessayer.',
            [ErrorTypes.VALIDATION]: 'Les données saisies ne sont pas valides.',
            [ErrorTypes.PARSING]: 'Erreur lors du traitement des données.',
            [ErrorTypes.UI]: 'Erreur d\'interface. Veuillez rafraîchir la page.',
            [ErrorTypes.CHART]: 'Erreur lors de l\'affichage du graphique.',
            [ErrorTypes.EDITOR]: 'Erreur dans l\'éditeur de texte.',
            [ErrorTypes.SCORING]: 'Erreur lors du calcul du score SEO.',
            [ErrorTypes.UNKNOWN]: 'Une erreur inattendue s\'est produite.'
        };

        return messages[error.type] || messages[ErrorTypes.UNKNOWN];
    }

    /**
     * Envoie l'erreur à un service de monitoring
     * @param {AppError} error - Erreur à envoyer
     */
    sendToMonitoring(error) {
        // En production, on pourrait envoyer à Sentry, LogRocket, etc.
        if (this.isProduction && error.severity === ErrorSeverity.CRITICAL) {
            // Exemple d'envoi à un service externe
            try {
                fetch('/api/errors', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(error.toJSON())
                }).catch(() => {
                    // Ignorer les erreurs d'envoi de monitoring
                });
            } catch (e) {
                // Ignorer silencieusement
            }
        }
    }

    /**
     * Méthodes utilitaires pour créer des erreurs spécifiques
     */
    createNetworkError(message, originalError = null, context = {}) {
        return new AppError(message, ErrorTypes.NETWORK, ErrorSeverity.MEDIUM, originalError, context);
    }

    createAPIError(message, originalError = null, context = {}) {
        return new AppError(message, ErrorTypes.API, ErrorSeverity.MEDIUM, originalError, context);
    }

    createValidationError(message, context = {}) {
        return new AppError(message, ErrorTypes.VALIDATION, ErrorSeverity.LOW, null, context);
    }

    createUIError(message, originalError = null, context = {}) {
        return new AppError(message, ErrorTypes.UI, ErrorSeverity.HIGH, originalError, context);
    }

    createCriticalError(message, originalError = null, context = {}) {
        return new AppError(message, ErrorTypes.UNKNOWN, ErrorSeverity.CRITICAL, originalError, context);
    }

    /**
     * Récupère les erreurs selon des critères
     * @param {Object} filters - Filtres de recherche
     * @returns {Array} Liste des erreurs filtrées
     */
    getErrors(filters = {}) {
        let filteredErrors = [...this.errors];

        if (filters.type) {
            filteredErrors = filteredErrors.filter(error => error.type === filters.type);
        }

        if (filters.severity) {
            filteredErrors = filteredErrors.filter(error => error.severity === filters.severity);
        }

        if (filters.since) {
            const sinceDate = new Date(filters.since);
            filteredErrors = filteredErrors.filter(error => new Date(error.timestamp) >= sinceDate);
        }

        return filteredErrors;
    }

    /**
     * Vide l'historique des erreurs
     */
    clearErrors() {
        this.errors = [];
        console.log('🗑️ Historique des erreurs vidé');
    }

    /**
     * Retourne les statistiques des erreurs
     * @returns {Object} Statistiques
     */
    getErrorStats() {
        const stats = {
            total: this.errors.length,
            byType: {},
            bySeverity: {},
            last24h: 0
        };

        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

        this.errors.forEach(error => {
            // Par type
            stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
            
            // Par sévérité
            stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
            
            // Dernières 24h
            if (new Date(error.timestamp) >= last24h) {
                stats.last24h++;
            }
        });

        return stats;
    }

    /**
     * Méthodes de récupération et retry
     */
    retryLastAction(error) {
        // Implémentation basique - à étendre selon les besoins
        console.log('🔄 Tentative de récupération pour:', error.id);
        
        if (error.context.retryFunction && typeof error.context.retryFunction === 'function') {
            try {
                error.context.retryFunction();
            } catch (e) {
                this.handleError(new AppError(
                    'Échec de la récupération automatique',
                    ErrorTypes.UNKNOWN,
                    ErrorSeverity.HIGH,
                    e,
                    { originalErrorId: error.id }
                ));
            }
        }
    }

    reportError(error) {
        // Ouvrir un modal ou rediriger vers un formulaire de rapport
        console.log('📧 Signalement d\'erreur:', error.id);
        
        const reportData = {
            error: error.toJSON(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            timestamp: new Date().toISOString()
        };

        // Copier dans le presse-papiers pour faciliter le signalement
        if (navigator.clipboard) {
            navigator.clipboard.writeText(JSON.stringify(reportData, null, 2))
                .then(() => {
                    console.log('📋 Données d\'erreur copiées dans le presse-papiers');
                });
        }
    }
}

// Export des classes et constantes
export { 
    ErrorHandler, 
    AppError, 
    ErrorTypes, 
    ErrorSeverity 
}; 