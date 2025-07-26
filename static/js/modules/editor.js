/**
 * Module Editor - Éditeur de texte enrichi
 * @author Content Writer Team
 * @version 1.0.0
 */

class TextEditor {
    constructor() {
        this.editor = null;
        this.isInitialized = false;
    }

    /**
     * Initialise l'éditeur de texte enrichi
     */
    async init() {
        if (this.isInitialized) return;

        this.editor = document.getElementById('editor');
        if (!this.editor) {
            console.error('❌ Élément éditeur introuvable');
            return;
        }

        this.setupToolbarEvents();
        this.setupKeyboardShortcuts();
        
        this.isInitialized = true;
        console.log('📝 Éditeur de texte enrichi initialisé');
    }

    /**
     * Configure les événements de la barre d'outils
     */
    setupToolbarEvents() {
        // Boutons de formatage de base
        this.addEventIfExists('bold-button', () => this.execFormatCommand('bold'));
        this.addEventIfExists('italic-button', () => this.execFormatCommand('italic'));
        this.addEventIfExists('underline-button', () => this.execFormatCommand('underline'));
        this.addEventIfExists('strikethrough-button', () => this.execFormatCommand('strikeThrough'));

        // Listes
        this.addEventIfExists('bullet-list-button', () => this.insertList('ul'));
        this.addEventIfExists('numbered-list-button', () => this.insertList('ol'));

        // Autres éléments
        this.addEventIfExists('blockquote-button', () => this.formatBlockquote());
        this.addEventIfExists('link-button', () => this.createLink());
        this.addEventIfExists('image-button', () => this.insertImage());
        this.addEventIfExists('table-button', () => this.insertTable());
        this.addEventIfExists('code-button', () => this.insertCode());

        // Annuler/Rétablir
        this.addEventIfExists('undo-button', () => this.execFormatCommand('undo'));
        this.addEventIfExists('redo-button', () => this.execFormatCommand('redo'));

        // Couleur du texte
        this.addEventIfExists('text-color-button', () => this.changeTextColor());

        // Menus déroulants
        this.setupDropdownMenus();
    }

    /**
     * Ajoute un événement si l'élément existe
     * @param {string} elementId - ID de l'élément
     * @param {Function} handler - Gestionnaire d'événement
     */
    addEventIfExists(elementId, handler) {
        const element = document.getElementById(elementId);
        if (element) {
            element.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handler();
            });
        }
    }

    /**
     * Configure les menus déroulants
     */
    setupDropdownMenus() {
        // Menu des titres
        const headingButton = document.getElementById('heading-button');
        const headingDropdown = document.getElementById('heading-dropdown');
        
        if (headingButton && headingDropdown) {
            headingButton.addEventListener('click', (e) => {
                e.stopPropagation();
                headingDropdown.classList.toggle('show');
            });

            // Boutons de titres
            headingDropdown.querySelectorAll('button').forEach(button => {
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const format = button.getAttribute('data-format');
                    this.formatHeading(format);
                    headingDropdown.classList.remove('show');
                });
            });
        }

        // Menu d'alignement
        const alignButton = document.getElementById('align-button');
        const alignDropdown = document.getElementById('align-dropdown');
        
        if (alignButton && alignDropdown) {
            alignButton.addEventListener('click', (e) => {
                e.stopPropagation();
                alignDropdown.classList.toggle('show');
            });

            // Boutons d'alignement
            alignDropdown.querySelectorAll('button').forEach(button => {
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const align = button.getAttribute('data-align');
                    this.execFormatCommand('justify' + align.charAt(0).toUpperCase() + align.slice(1));
                    alignDropdown.classList.remove('show');
                });
            });
        }

        // Fermer les menus en cliquant ailleurs
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown')) {
                document.querySelectorAll('.dropdown-content.show').forEach(dropdown => {
                    dropdown.classList.remove('show');
                });
            }
        });
    }

    /**
     * Configure les raccourcis clavier
     */
    setupKeyboardShortcuts() {
        if (!this.editor) return;

        this.editor.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'b':
                        e.preventDefault();
                        this.execFormatCommand('bold');
                        break;
                    case 'i':
                        e.preventDefault();
                        this.execFormatCommand('italic');
                        break;
                    case 'u':
                        e.preventDefault();
                        this.execFormatCommand('underline');
                        break;
                    case 'k':
                        e.preventDefault();
                        this.createLink();
                        break;
                    case 'z':
                        if (e.shiftKey) {
                            e.preventDefault();
                            this.execFormatCommand('redo');
                        } else {
                            e.preventDefault();
                            this.execFormatCommand('undo');
                        }
                        break;
                    case 'y':
                        e.preventDefault();
                        this.execFormatCommand('redo');
                        break;
                }
            }
        });
    }

    /**
     * Exécute une commande de formatage
     * @param {string} command - Commande à exécuter
     * @param {string} value - Valeur optionnelle
     */
    execFormatCommand(command, value = null) {
        if (!this.editor) return;

        this.editor.focus();

        try {
            const success = document.execCommand(command, false, value);
            if (success) {
                console.log(`✅ Commande ${command} exécutée avec succès`);
                return;
            }
        } catch (e) {
            console.warn(`⚠️ execCommand échoué pour ${command}:`, e);
        }

        // Fallback pour les commandes de base
        this.fallbackFormatCommand(command, value);
    }

    /**
     * Fallback pour les commandes de formatage
     * @param {string} command - Commande
     * @param {string} value - Valeur
     */
    fallbackFormatCommand(command, value) {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const selectedText = range.toString();

        if (!selectedText) return;

        let element;
        switch (command) {
            case 'bold':
                element = document.createElement('strong');
                break;
            case 'italic':
                element = document.createElement('em');
                break;
            case 'underline':
                element = document.createElement('u');
                break;
            case 'strikeThrough':
                element = document.createElement('s');
                break;
            default:
                return;
        }

        if (element) {
            element.textContent = selectedText;
            range.deleteContents();
            range.insertNode(element);
            
            // Repositionner le curseur
            range.setStartAfter(element);
            range.setEndAfter(element);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    /**
     * Formate un titre
     * @param {string} format - Format du titre (h1, h2, h3, h4, p)
     */
    formatHeading(format) {
        if (format === 'p') {
            this.execFormatCommand('formatBlock', '<p>');
        } else {
            this.execFormatCommand('formatBlock', '<' + format + '>');
        }
    }

    /**
     * Insère une liste
     * @param {string} listType - Type de liste (ul, ol)
     */
    insertList(listType) {
        if (!this.editor) return;

        this.editor.focus();

        const command = listType === 'ul' ? 'insertUnorderedList' : 'insertOrderedList';
        
        try {
            const success = document.execCommand(command, false, null);
            if (success) {
                console.log(`✅ Liste ${listType} créée avec succès`);
                return;
            }
        } catch (e) {
            console.warn(`⚠️ execCommand échoué pour ${command}:`, e);
        }

        // Fallback moderne
        this.insertListFallback(listType);
    }

    /**
     * Fallback pour l'insertion de liste
     * @param {string} listType - Type de liste
     */
    insertListFallback(listType) {
        const selection = window.getSelection();
        const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

        const listElement = document.createElement(listType);
        const listItem = document.createElement('li');
        listItem.textContent = range && range.toString() ? range.toString() : 'Nouvel élément';
        listElement.appendChild(listItem);

        if (range) {
            range.deleteContents();
            range.insertNode(listElement);
            
            // Positionner le curseur dans le li
            const newRange = document.createRange();
            newRange.setStart(listItem, 0);
            newRange.setEnd(listItem, listItem.childNodes.length);
            selection.removeAllRanges();
            selection.addRange(newRange);
        } else {
            this.editor.appendChild(listElement);
        }
    }

    /**
     * Formate une citation
     */
    formatBlockquote() {
        if (!this.editor) return;

        this.editor.focus();

        try {
            const success = document.execCommand('formatBlock', false, '<blockquote>');
            if (success) {
                console.log('✅ Citation créée avec succès');
                return;
            }
        } catch (e) {
            console.warn('⚠️ execCommand échoué pour blockquote:', e);
        }

        // Fallback moderne
        this.insertBlockquoteFallback();
    }

    /**
     * Fallback pour la citation
     */
    insertBlockquoteFallback() {
        const selection = window.getSelection();
        const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

        const blockquote = document.createElement('blockquote');
        blockquote.style.borderLeft = '4px solid #ccc';
        blockquote.style.paddingLeft = '16px';
        blockquote.style.margin = '16px 0';
        blockquote.style.fontStyle = 'italic';

        if (range && range.toString()) {
            blockquote.textContent = range.toString();
            range.deleteContents();
            range.insertNode(blockquote);
        } else {
            blockquote.textContent = 'Citation';
            if (range) {
                range.insertNode(blockquote);
            } else {
                this.editor.appendChild(blockquote);
            }
        }
    }

    /**
     * Crée un lien
     */
    createLink() {
        if (!this.editor) return;

        const selection = window.getSelection();
        if (selection.rangeCount === 0) {
            alert('⚠️ Veuillez sélectionner du texte pour créer un lien');
            return;
        }

        const range = selection.getRangeAt(0);
        const selectedText = range.toString();

        if (!selectedText) {
            alert('⚠️ Veuillez sélectionner du texte pour créer un lien');
            return;
        }

        const url = prompt('Entrez l\'URL du lien:', 'https://');
        if (!url) return;

        try {
            const success = document.execCommand('createLink', false, url);
            if (success) {
                console.log('✅ Lien créé avec succès');
                return;
            }
        } catch (e) {
            console.warn('⚠️ execCommand échoué pour createLink:', e);
        }

        // Fallback moderne
        this.createLinkFallback(range, selectedText, url);
    }

    /**
     * Fallback pour la création de lien
     * @param {Range} range - Range de sélection
     * @param {string} selectedText - Texte sélectionné
     * @param {string} url - URL du lien
     */
    createLinkFallback(range, selectedText, url) {
        const link = document.createElement('a');
        link.href = url;
        link.textContent = selectedText;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';

        try {
            range.deleteContents();
            range.insertNode(link);
            
            // Positionner le curseur après le lien
            range.setStartAfter(link);
            range.setEndAfter(link);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            
            console.log('✅ Lien créé avec l\'API moderne');
        } catch (e) {
            console.error('❌ Erreur lors de la création du lien:', e);
        }
    }

    /**
     * Insère une image
     */
    insertImage() {
        if (!this.editor) return;

        const url = prompt('Entrez l\'URL de l\'image:', 'https://');
        if (!url) return;

        try {
            const success = document.execCommand('insertImage', false, url);
            if (success) {
                console.log('✅ Image insérée avec succès');
                return;
            }
        } catch (e) {
            console.warn('⚠️ execCommand échoué pour insertImage:', e);
        }

        // Fallback moderne
        this.insertImageFallback(url);
    }

    /**
     * Fallback pour l'insertion d'image
     * @param {string} url - URL de l'image
     */
    insertImageFallback(url) {
        const img = document.createElement('img');
        img.src = url;
        img.alt = 'Image insérée';
        img.style.maxWidth = '100%';
        img.style.height = 'auto';

        const selection = window.getSelection();
        const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

        if (range) {
            range.insertNode(img);
            range.setStartAfter(img);
            range.setEndAfter(img);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            this.editor.appendChild(img);
        }

        console.log('✅ Image insérée avec l\'API moderne');
    }

    /**
     * Insère un tableau
     */
    insertTable() {
        if (!this.editor) return;

        const rows = prompt('Nombre de lignes:', '3');
        const cols = prompt('Nombre de colonnes:', '3');

        if (!rows || !cols) return;

        const numRows = parseInt(rows);
        const numCols = parseInt(cols);

        if (isNaN(numRows) || isNaN(numCols) || numRows < 1 || numCols < 1) {
            alert('⚠️ Veuillez entrer des nombres valides');
            return;
        }

        this.insertTableElement(numRows, numCols);
    }

    /**
     * Insère un élément tableau
     * @param {number} numRows - Nombre de lignes
     * @param {number} numCols - Nombre de colonnes
     */
    insertTableElement(numRows, numCols) {
        const table = document.createElement('table');
        table.style.border = '1px solid #ccc';
        table.style.borderCollapse = 'collapse';
        table.style.width = '100%';
        table.style.marginTop = '10px';
        table.style.marginBottom = '10px';

        const tbody = document.createElement('tbody');

        for (let i = 0; i < numRows; i++) {
            const tr = document.createElement('tr');

            for (let j = 0; j < numCols; j++) {
                const cell = i === 0 ? document.createElement('th') : document.createElement('td');
                cell.style.border = '1px solid #ccc';
                cell.style.padding = '8px';
                cell.textContent = i === 0 ? `Titre ${j + 1}` : `Cellule ${i + 1}-${j + 1}`;

                if (i === 0) {
                    cell.style.backgroundColor = '#f5f5f5';
                    cell.style.fontWeight = 'bold';
                }

                tr.appendChild(cell);
            }

            tbody.appendChild(tr);
        }

        table.appendChild(tbody);

        // Insérer le tableau
        const selection = window.getSelection();
        const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

        if (range) {
            range.insertNode(table);
            range.setStartAfter(table);
            range.setEndAfter(table);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            this.editor.appendChild(table);
        }

        console.log('✅ Tableau inséré avec l\'API moderne');
    }

    /**
     * Insère du code inline
     */
    insertCode() {
        const selection = window.getSelection().toString();
        const code = '<code>' + (selection || 'code') + '</code>';
        this.execFormatCommand('insertHTML', code);
    }

    /**
     * Change la couleur du texte
     */
    changeTextColor() {
        const color = prompt('Entrez une couleur (nom ou code hexadécimal):', '#3b82f6');
        if (color) {
            this.execFormatCommand('foreColor', color);
        }
    }

    /**
     * Obtient le contenu de l'éditeur
     * @returns {string} Contenu HTML de l'éditeur
     */
    getContent() {
        return this.editor ? this.editor.innerHTML : '';
    }

    /**
     * Obtient le texte brut de l'éditeur
     * @returns {string} Texte brut de l'éditeur
     */
    getTextContent() {
        return this.editor ? this.editor.textContent : '';
    }

    /**
     * Définit le contenu de l'éditeur
     * @param {string} content - Contenu HTML à définir
     */
    setContent(content) {
        if (this.editor) {
            this.editor.innerHTML = content;
        }
    }

    /**
     * Vide l'éditeur
     */
    clear() {
        if (this.editor) {
            this.editor.innerHTML = '';
        }
    }

    /**
     * Met le focus sur l'éditeur
     */
    focus() {
        if (this.editor) {
            this.editor.focus();
        }
    }
}

// Export du module
export { TextEditor }; 