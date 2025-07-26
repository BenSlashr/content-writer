/**
 * Module Notifications - Système de notifications utilisateur
 * @author Content Writer Team
 * @version 1.0.0
 */

/**
 * Types de notifications
 */
const NotificationTypes = {
    SUCCESS: 'success',
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error'
};

/**
 * Positions possibles pour les notifications
 */
const NotificationPositions = {
    TOP_RIGHT: 'top-right',
    TOP_LEFT: 'top-left',
    BOTTOM_RIGHT: 'bottom-right',
    BOTTOM_LEFT: 'bottom-left',
    TOP_CENTER: 'top-center',
    BOTTOM_CENTER: 'bottom-center'
};

/**
 * Gestionnaire de notifications
 */
class NotificationManager {
    constructor(options = {}) {
        this.container = null;
        this.notifications = new Map();
        this.position = options.position || NotificationPositions.TOP_RIGHT;
        this.maxNotifications = options.maxNotifications || 5;
        this.defaultDuration = options.defaultDuration || 5000;
        this.animationDuration = 300;
        
        this.init();
        console.log('🔔 Gestionnaire de notifications initialisé');
    }

    /**
     * Initialise le conteneur de notifications
     */
    init() {
        this.createContainer();
        this.injectStyles();
    }

    /**
     * Crée le conteneur principal des notifications
     */
    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'notification-container';
        this.container.className = `notification-container ${this.position}`;
        
        // Ajouter au body
        document.body.appendChild(this.container);
    }

    /**
     * Injecte les styles CSS pour les notifications
     */
    injectStyles() {
        if (document.getElementById('notification-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification-container {
                position: fixed;
                z-index: 10000;
                pointer-events: none;
                max-width: 400px;
            }

            .notification-container.top-right {
                top: 20px;
                right: 20px;
            }

            .notification-container.top-left {
                top: 20px;
                left: 20px;
            }

            .notification-container.bottom-right {
                bottom: 20px;
                right: 20px;
            }

            .notification-container.bottom-left {
                bottom: 20px;
                left: 20px;
            }

            .notification-container.top-center {
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
            }

            .notification-container.bottom-center {
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
            }

            .notification {
                pointer-events: auto;
                margin-bottom: 12px;
                padding: 16px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                backdrop-filter: blur(8px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                max-width: 100%;
                word-wrap: break-word;
                transform: translateX(100%);
                opacity: 0;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                line-height: 1.4;
            }

            .notification.show {
                transform: translateX(0);
                opacity: 1;
            }

            .notification.success {
                background: linear-gradient(135deg, rgba(16, 185, 129, 0.9), rgba(5, 150, 105, 0.9));
                color: white;
                border-color: rgba(16, 185, 129, 0.3);
            }

            .notification.info {
                background: linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9));
                color: white;
                border-color: rgba(59, 130, 246, 0.3);
            }

            .notification.warning {
                background: linear-gradient(135deg, rgba(245, 158, 11, 0.9), rgba(217, 119, 6, 0.9));
                color: white;
                border-color: rgba(245, 158, 11, 0.3);
            }

            .notification.error {
                background: linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(220, 38, 38, 0.9));
                color: white;
                border-color: rgba(239, 68, 68, 0.3);
            }

            .notification-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 8px;
            }

            .notification-title {
                font-weight: 600;
                font-size: 15px;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .notification-icon {
                width: 18px;
                height: 18px;
                flex-shrink: 0;
            }

            .notification-close {
                background: none;
                border: none;
                color: inherit;
                cursor: pointer;
                font-size: 18px;
                line-height: 1;
                padding: 0;
                opacity: 0.7;
                transition: opacity 0.2s;
            }

            .notification-close:hover {
                opacity: 1;
            }

            .notification-message {
                margin-bottom: 12px;
                opacity: 0.95;
            }

            .notification-actions {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }

            .notification-action {
                background: rgba(255, 255, 255, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.3);
                color: inherit;
                padding: 6px 12px;
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s;
                font-weight: 500;
            }

            .notification-action:hover {
                background: rgba(255, 255, 255, 0.3);
                transform: translateY(-1px);
            }

            .notification-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                background: rgba(255, 255, 255, 0.3);
                border-radius: 0 0 8px 8px;
                transition: width linear;
            }

            @media (max-width: 480px) {
                .notification-container {
                    left: 10px !important;
                    right: 10px !important;
                    max-width: none;
                    transform: none !important;
                }

                .notification {
                    margin-bottom: 8px;
                    padding: 12px 16px;
                }
            }
        `;

        document.head.appendChild(styles);
    }

    /**
     * Affiche une notification
     * @param {string} type - Type de notification
     * @param {string} message - Message à afficher
     * @param {Object} options - Options de la notification
     * @returns {string} ID de la notification
     */
    show(type, message, options = {}) {
        const id = this.generateId();
        const notification = this.createNotification(id, type, message, options);
        
        // Limiter le nombre de notifications
        this.enforceMaxNotifications();
        
        // Ajouter au conteneur
        this.container.appendChild(notification);
        
        // Stocker la référence
        this.notifications.set(id, {
            element: notification,
            type,
            message,
            options,
            createdAt: Date.now()
        });

        // Animation d'entrée
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });

        // Auto-dismiss si spécifié
        if (!options.persistent && options.duration !== 0) {
            const duration = options.duration || this.defaultDuration;
            this.scheduleRemoval(id, duration);
        }

        return id;
    }

    /**
     * Crée l'élément DOM de la notification
     * @param {string} id - ID de la notification
     * @param {string} type - Type de notification
     * @param {string} message - Message
     * @param {Object} options - Options
     * @returns {HTMLElement} Élément de notification
     */
    createNotification(id, type, message, options) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.dataset.id = id;

        const icon = this.getIcon(type);
        const title = options.title || this.getDefaultTitle(type);

        let html = `
            <div class="notification-header">
                <div class="notification-title">
                    ${icon}
                    ${title}
                </div>
                <button class="notification-close" onclick="window.notificationManager?.dismiss('${id}')">&times;</button>
            </div>
            <div class="notification-message">${message}</div>
        `;

        // Ajouter les actions si présentes
        if (options.actions && options.actions.length > 0) {
            html += '<div class="notification-actions">';
            options.actions.forEach((action, index) => {
                html += `<button class="notification-action" onclick="window.notificationManager?.executeAction('${id}', ${index})">${action.label}</button>`;
            });
            html += '</div>';
        }

        // Ajouter la barre de progression si auto-dismiss
        if (!options.persistent && options.duration !== 0) {
            const duration = options.duration || this.defaultDuration;
            html += `<div class="notification-progress" style="width: 100%; transition-duration: ${duration}ms;"></div>`;
        }

        notification.innerHTML = html;

        // Démarrer l'animation de la barre de progression
        if (!options.persistent && options.duration !== 0) {
            requestAnimationFrame(() => {
                const progress = notification.querySelector('.notification-progress');
                if (progress) {
                    progress.style.width = '0%';
                }
            });
        }

        return notification;
    }

    /**
     * Obtient l'icône pour un type de notification
     * @param {string} type - Type de notification
     * @returns {string} HTML de l'icône
     */
    getIcon(type) {
        const icons = {
            success: '<svg class="notification-icon" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>',
            info: '<svg class="notification-icon" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>',
            warning: '<svg class="notification-icon" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>',
            error: '<svg class="notification-icon" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>'
        };
        return icons[type] || icons.info;
    }

    /**
     * Obtient le titre par défaut pour un type
     * @param {string} type - Type de notification
     * @returns {string} Titre par défaut
     */
    getDefaultTitle(type) {
        const titles = {
            success: 'Succès',
            info: 'Information',
            warning: 'Attention',
            error: 'Erreur'
        };
        return titles[type] || 'Notification';
    }

    /**
     * Méthodes de raccourci pour chaque type
     */
    showSuccess(message, options = {}) {
        return this.show(NotificationTypes.SUCCESS, message, options);
    }

    showInfo(message, options = {}) {
        return this.show(NotificationTypes.INFO, message, options);
    }

    showWarning(message, options = {}) {
        return this.show(NotificationTypes.WARNING, message, options);
    }

    showError(message, options = {}) {
        return this.show(NotificationTypes.ERROR, message, options);
    }

    /**
     * Ferme une notification
     * @param {string} id - ID de la notification
     */
    dismiss(id) {
        const notification = this.notifications.get(id);
        if (!notification) return;

        const element = notification.element;
        
        // Animation de sortie
        element.classList.remove('show');
        
        setTimeout(() => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
            this.notifications.delete(id);
        }, this.animationDuration);
    }

    /**
     * Exécute une action de notification
     * @param {string} id - ID de la notification
     * @param {number} actionIndex - Index de l'action
     */
    executeAction(id, actionIndex) {
        const notification = this.notifications.get(id);
        if (!notification || !notification.options.actions) return;

        const action = notification.options.actions[actionIndex];
        if (action && typeof action.action === 'function') {
            action.action();
            
            // Fermer la notification après l'action (sauf si spécifié autrement)
            if (action.dismissAfter !== false) {
                this.dismiss(id);
            }
        }
    }

    /**
     * Planifie la suppression automatique d'une notification
     * @param {string} id - ID de la notification
     * @param {number} duration - Durée en millisecondes
     */
    scheduleRemoval(id, duration) {
        setTimeout(() => {
            this.dismiss(id);
        }, duration);
    }

    /**
     * Applique la limite du nombre maximum de notifications
     */
    enforceMaxNotifications() {
        const notificationElements = this.container.children;
        while (notificationElements.length >= this.maxNotifications) {
            const oldest = notificationElements[0];
            const id = oldest.dataset.id;
            this.dismiss(id);
        }
    }

    /**
     * Génère un ID unique pour une notification
     * @returns {string} ID unique
     */
    generateId() {
        return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Ferme toutes les notifications
     */
    dismissAll() {
        const ids = Array.from(this.notifications.keys());
        ids.forEach(id => this.dismiss(id));
    }

    /**
     * Obtient le nombre de notifications actives
     * @returns {number} Nombre de notifications
     */
    getActiveCount() {
        return this.notifications.size;
    }

    /**
     * Détruit le gestionnaire de notifications
     */
    destroy() {
        this.dismissAll();
        
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }

        const styles = document.getElementById('notification-styles');
        if (styles && styles.parentNode) {
            styles.parentNode.removeChild(styles);
        }

        this.notifications.clear();
        console.log('🗑️ Gestionnaire de notifications détruit');
    }
}

// Export des classes et constantes
export { 
    NotificationManager, 
    NotificationTypes, 
    NotificationPositions 
}; 