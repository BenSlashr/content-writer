/**
 * Module Chart - Gestion du graphique d'optimisation
 * @author Content Writer Team
 * @version 1.0.0
 */

class ChartManager {
    constructor() {
        this.chart = null;
        this.displayData = [];
        this.highlightedPoint = null;
        this.isInitialized = false;
    }

    /**
     * Initialise le graphique d'optimisation
     */
    async init() {
        if (this.isInitialized) return;

        const chartElement = document.getElementById('optimization-chart');
        if (!chartElement) {
            console.error('❌ Élément graphique introuvable');
            return;
        }

        // Vérifier que ApexCharts est disponible
        if (typeof ApexCharts === 'undefined') {
            console.error('❌ ApexCharts n\'est pas chargé');
            return;
        }

        const options = {
            series: [{
                name: 'Votre contenu',
                data: []
            }],
            chart: {
                height: 300,
                type: 'line',
                toolbar: {
                    show: false
                },
                animations: {
                    enabled: true,
                    easing: 'easeinout',
                    speed: 800
                },
                fontFamily: 'system-ui, -apple-system, sans-serif',
                background: 'transparent',
                parentHeightOffset: 0
            },
            stroke: {
                width: 2,
                curve: 'straight'
            },
            colors: ['#000000'],
            markers: {
                size: 4,
                colors: ['#000000'],
                strokeWidth: 0,
                hover: {
                    size: 6
                }
            },
            grid: {
                show: true,
                borderColor: '#f1f1f1',
                strokeDashArray: 3,
                position: 'back',
                padding: {
                    left: 10,
                    right: 10,
                    top: 10,
                    bottom: 50
                }
            },
            annotations: {
                position: 'front',
                yaxis: [
                    {
                        y: 0,
                        y2: 1.0,
                        borderColor: '#90cdf4',
                        fillColor: 'rgba(147, 197, 253, 0.3)',
                        label: { text: '' }
                    },
                    {
                        y: 1.0,
                        y2: 1.5,
                        borderColor: '#9ae6b4',
                        fillColor: 'rgba(74, 222, 128, 0.3)',
                        label: { text: '' }
                    },
                    {
                        y: 1.5,
                        y2: 2.0,
                        borderColor: '#fbd38d',
                        fillColor: 'rgba(251, 191, 36, 0.3)',
                        label: { text: '' }
                    },
                    {
                        y: 2.0,
                        y2: 2.5,
                        borderColor: '#feb2b2',
                        fillColor: 'rgba(239, 68, 68, 0.3)',
                        label: { text: '' }
                    }
                ]
            },
            xaxis: {
                categories: [],
                labels: {
                    rotate: -45,
                    rotateAlways: true,
                    hideOverlappingLabels: false,
                    style: {
                        fontSize: '9px',
                        fontWeight: 400,
                        colors: ['#374151']
                    },
                    formatter: function(value) {
                        if (value && value.length > 12) {
                            return value.substring(0, 12) + '...';
                        }
                        return value || '';
                    },
                    offsetX: 0,
                    offsetY: 5,
                    maxHeight: 80
                },
                tickPlacement: 'on',
                axisBorder: { show: false },
                axisTicks: { show: false },
                padding: { left: 15, right: 15 }
            },
            yaxis: {
                min: 0,
                max: 2.5,
                labels: { show: false }
            },
            tooltip: {
                enabled: true,
                shared: false,
                intersect: true,
                custom: ({ series, seriesIndex, dataPointIndex, w }) => {
                    const keyword = w.globals.labels[dataPointIndex];
                    const value = series[seriesIndex][dataPointIndex];
                    
                    // Trouver les données complètes du mot-clé
                    const fullData = this.displayData.find(item => 
                        item.keyword === keyword || 
                        (item.keyword.length > 10 && keyword === item.keyword.substring(0, 10) + '...')
                    );
                    
                    if (fullData) {
                        const minCount = fullData.minRequired || 0;
                        const maxCount = fullData.maxRequired || 0;
                        const rangeText = minCount > 0 && maxCount > 0 ? `${minCount}-${maxCount}` : `${minCount}`;
                        
                        let zoneText = '';
                        if (value >= 2.0) {
                            zoneText = 'Suroptimisation';
                        } else if (value >= 1.5) {
                            zoneText = 'Optimisation forte';
                        } else if (value >= 1.0) {
                            zoneText = 'Optimisation normale';
                        } else {
                            zoneText = 'Sous-optimisation';
                        }
                        
                        return `<div class="p-2 bg-gray-800 text-white rounded shadow-lg">
                            <div class="font-bold">${fullData.keyword}</div>
                            <div>Occurrences: ${fullData.count}</div>
                            <div>Plage optimale: ${rangeText}</div>
                            <div>Zone: ${zoneText}</div>
                        </div>`;
                    }
                    
                    const ratio = Math.round(value * 100);
                    return `<div class="p-2 bg-gray-800 text-white rounded shadow-lg">
                        <div class="font-bold">${keyword}</div>
                        <div>Ratio: ${ratio}%</div>
                    </div>`;
                }
            },
            legend: { show: false },
            dataLabels: { enabled: false }
        };

        try {
            this.chart = new ApexCharts(chartElement, options);
            await this.chart.render();
            this.isInitialized = true;
            console.log('📊 Graphique d\'optimisation initialisé');
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation du graphique:', error);
            
            // Créer une erreur personnalisée pour le graphique
            if (window.ContentWriterApp?.errorHandler) {
                window.ContentWriterApp.errorHandler.handleError(
                    new AppError(
                        'Impossible d\'initialiser le graphique d\'optimisation',
                        'chart',
                        'medium',
                        error,
                        { component: 'chart', method: 'init' }
                    )
                );
            }
        }
    }

    /**
     * Met à jour le graphique avec de nouvelles données
     * @param {Array} keywordData - Données des mots-clés
     */
    updateChart(keywordData) {
        if (!this.chart || !this.isInitialized) {
            console.warn('⚠️ Graphique non initialisé, tentative d\'initialisation...');
            this.init().then(() => {
                if (this.isInitialized) {
                    this.updateChart(keywordData);
                }
            });
            return;
        }

        if (!keywordData || keywordData.length === 0) {
            console.warn('⚠️ Aucune donnée de mot-clé pour le graphique');
            this.chart.updateSeries([{ name: 'Votre contenu', data: [] }]);
            this.chart.updateOptions({ xaxis: { categories: [] } });
            this.updateKeywordsList([]);
            return;
        }

        console.log('📊 Mise à jour du graphique avec', keywordData.length, 'mots-clés');

        // Trier par importance décroissante et limiter
        const sortedData = [...keywordData]
            .sort((a, b) => (b.importance || 0) - (a.importance || 0))
            .slice(0, 40);

        this.displayData = sortedData;

        // Préparer les données pour le graphique
        const labels = sortedData.map(item => item.keyword);
        const values = sortedData.map(item => this.calculateRatio(item));

        // Mettre à jour le graphique
        this.chart.updateOptions({
            xaxis: { categories: labels }
        });

        this.chart.updateSeries([{
            name: 'Votre contenu',
            data: values
        }]);

        // Mettre à jour la liste des mots-clés
        this.updateKeywordsList(sortedData);
    }

    /**
     * Calcule le ratio d'optimisation pour un mot-clé
     * @param {Object} item - Données du mot-clé
     * @returns {number} Ratio entre 0 et 2.5
     */
    calculateRatio(item) {
        const minCount = item.minRequired || 0;
        const maxCount = item.maxRequired || minCount * 2;
        const count = item.count || 0;
        
        if (minCount === 0) return 0;

        let ratio = 0;
        
        if (count < minCount) {
            // Sous-optimisation (0 - 1.0)
            ratio = count / minCount;
        } else if (count > maxCount) {
            // Suroptimisation (2.0+)
            ratio = 2.0 + ((count - maxCount) / maxCount) * 0.5;
        } else {
            // Optimisation normale à forte (1.0 - 2.0)
            if (maxCount > minCount) {
                ratio = 1.0 + ((count - minCount) / (maxCount - minCount));
            } else {
                ratio = 1.0;
            }
        }
        
        return Math.min(Math.max(ratio, 0), 2.5);
    }

    /**
     * Met à jour la liste des mots-clés sous le graphique
     * @param {Array} keywordsData - Données des mots-clés
     */
    updateKeywordsList(keywordsData) {
        const keywordsList = document.getElementById('graph-keywords-list');
        if (!keywordsList) return;

        keywordsList.innerHTML = '';

        keywordsData.forEach((item, index) => {
            const ratio = this.calculateRatio(item);
            const rangeText = `${item.count}/${item.minRequired || 0}-${item.maxRequired || 0}`;
            
            let bgColor = '';
            if (ratio >= 2.0) {
                bgColor = 'bg-red-500 text-white';
            } else if (ratio >= 1.5) {
                bgColor = 'bg-yellow-500 text-black';
            } else if (ratio >= 1.0) {
                bgColor = 'bg-green-400 text-black';
            } else {
                bgColor = 'bg-blue-300 text-black';
            }

            const chip = document.createElement('div');
            chip.className = `${bgColor} rounded-full px-2 py-0.5 cursor-pointer transition-all hover:shadow-md inline-flex items-center`;
            chip.innerHTML = `<span class="font-semibold">${index + 1}. ${item.keyword}</span> <span class="ml-1">${rangeText}</span>`;

            chip.addEventListener('mouseenter', () => this.highlightPoint(index));
            chip.addEventListener('mouseleave', () => this.resetHighlights());

            keywordsList.appendChild(chip);
        });
    }

    /**
     * Met en évidence un point sur le graphique
     * @param {number} index - Index du point à mettre en évidence
     */
    highlightPoint(index) {
        if (!this.chart) return;

        this.highlightedPoint = index;
        
        const newMarkers = {
            size: Array(this.displayData.length).fill(4),
            colors: Array(this.displayData.length).fill('#000000'),
            strokeWidth: Array(this.displayData.length).fill(0)
        };

        newMarkers.size[index] = 8;
        newMarkers.colors[index] = '#3182ce';
        newMarkers.strokeWidth[index] = 2;

        this.chart.updateOptions({ markers: newMarkers });
    }

    /**
     * Remet à zéro les mises en évidence
     */
    resetHighlights() {
        if (!this.chart) return;

        this.highlightedPoint = null;
        this.chart.updateOptions({
            markers: {
                size: 4,
                colors: ['#000000'],
                strokeWidth: 0,
                hover: { size: 6 }
            }
        });
    }

    /**
     * Nettoie le graphique
     */
    clear() {
        if (this.chart) {
            this.chart.updateSeries([{ name: 'Votre contenu', data: [] }]);
            this.chart.updateOptions({ xaxis: { categories: [] } });
        }
        this.updateKeywordsList([]);
        this.displayData = [];
    }
}

// Export du module
export { ChartManager }; 