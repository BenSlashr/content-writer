# Système de Scoring SEO - Content Writer

## Vue d'ensemble

Le système de scoring SEO de Content Writer calcule un score de 0 à 100 basé sur l'optimisation des mots-clés dans le contenu. Ce système est conçu pour être robuste et fonctionner avec un grand nombre de mots-clés (jusqu'à 80+ mots-clés).

## Principe de fonctionnement

### Répartition des points
- **70% du score** : Mots-clés obligatoires
- **30% du score** : Mots-clés complémentaires
- **Malus maximum** : 20 points pour la suroptimisation

### Calcul du score

#### 1. Score des mots-clés obligatoires (70 points max)
```
Score obligatoires = (Nombre de mots-clés réussis / Total mots-clés obligatoires) × 70
```

#### 2. Score des mots-clés complémentaires (30 points max)
```
Score complémentaires = (Nombre de mots-clés réussis / Total mots-clés complémentaires) × 30
```

#### 3. Score de base
```
Score de base = Score obligatoires + Score complémentaires
```

#### 4. Calcul du malus
```
Malus = min(20, (Nombre de mots-clés suroptimisés / Total mots-clés) × 20)
```

#### 5. Score final
```
Score final = max(0, min(100, Score de base - Malus))
```

## Critères de réussite

### Mots-clés réussis
Un mot-clé est considéré comme "réussi" s'il apparaît au moins le nombre minimum de fois requis dans le texte.

### Suroptimisation
Un mot-clé est considéré comme "suroptimisé" s'il apparaît plus de fois que le maximum recommandé.

## Exemple de calcul

Avec 35 mots-clés obligatoires et 45 mots-clés complémentaires :

- **25/35 obligatoires réussis** : 25/35 × 70 = 50 points
- **15/45 complémentaires réussis** : 15/45 × 30 = 10 points
- **Score de base** : 50 + 10 = 60 points
- **5 mots-clés suroptimisés** : 5/80 × 20 = 1.25 points de malus
- **Score final** : 60 - 1.25 = 58.75 points

## Interprétation des scores

- **80-100** : Excellent - Contenu très bien optimisé
- **60-79** : Bon - Contenu bien optimisé
- **40-59** : Moyen - Optimisation à améliorer
- **0-39** : À améliorer - Optimisation insuffisante

## Mise à jour en temps réel

Le score se met à jour automatiquement à chaque modification du texte dans l'éditeur, avec un délai de 500ms pour éviter les calculs trop fréquents.

## Données retournées par l'API

```json
{
  "score_seo": 75.5,
  "base_score": 78.2,
  "malus": 2.7,
  "score_obligatoires": 52.3,
  "score_complementaires": 25.9,
  "score_details": {
    "obligatoires_success": 25,
    "total_obligatoires": 35,
    "complementaires_success": 15,
    "total_complementaires": 45,
    "malus_count": 3
  }
}
```

## Avantages du système

1. **Robustesse** : Fonctionne avec n'importe quel nombre de mots-clés
2. **Plafonnement** : Score garanti entre 0 et 100
3. **Pondération** : Priorité donnée aux mots-clés obligatoires
4. **Malus** : Pénalisation de la suroptimisation
5. **Transparence** : Détails complets du calcul
6. **Temps réel** : Mise à jour instantanée

## Implémentation technique

### Backend (Python)
La fonction `calculate_simple_robust_score()` dans `main.py` implémente la logique de calcul du score.

### Frontend (JavaScript)
La fonction `updateStatistics()` dans `app.js` met à jour l'affichage du score en temps réel.

### Interface utilisateur
L'interface affiche :
- Le score principal (0-100)
- Le score de base (avant malus)
- Le malus appliqué
- La répartition obligatoires/complémentaires
- Les détails techniques (nombre de mots-clés réussis/suroptimisés)

## Configuration

Le système utilise les données de l'API Thot/Slashr qui contiennent :
- `KW_obligatoires` : Liste des mots-clés obligatoires avec [mot, min, importance, max]
- `KW_complementaires` : Liste des mots-clés complémentaires avec [mot, min, importance, max]

Si le maximum n'est pas fourni par l'API, il est calculé automatiquement comme `min × 2`. 