# Content Writer - Assistant de rédaction SEO

Une interface de rédaction pour guider les rédacteurs en utilisant l'API Thot. Cette application analyse le texte en temps réel et met à jour les compteurs de mots-clés pour aider à optimiser le contenu pour le référencement.

## Fonctionnalités

- Analyse en temps réel du texte saisi
- Suivi des mots-clés obligatoires et complémentaires
- Détection des expressions (n-grams)
- Calcul du score SEO
- Surlignage des mots-clés dans l'éditeur
- Interface moderne et intuitive

## Technologies utilisées

- **Backend** : FastAPI
- **Frontend** : HTML, CSS, JavaScript
- **Éditeur de texte** : contenteditable
- **Surlignage de mots** : mark.js
- **Stylisation** : Tailwind CSS

## Installation

1. Cloner le dépôt
2. Installer les dépendances :
   ```
   pip install -r requirements.txt
   ```

## Utilisation

1. Démarrer le serveur :
   ```
   uvicorn main:app --reload
   ```
2. Ouvrir un navigateur et accéder à `http://localhost:8000`
3. Commencer à rédiger dans l'éditeur

## Structure du projet

```
content-writer/
├── main.py                # Backend FastAPI
├── requirements.txt       # Dépendances Python
├── sample_response.json   # Exemple de réponse API Thot
├── static/                # Fichiers statiques
│   ├── css/
│   │   └── styles.css     # Styles personnalisés
│   ├── js/
│   │   └── app.js         # Logique JavaScript
│   └── index.html         # Interface utilisateur
└── README.md              # Documentation
```

## Intégration avec Thot API

Pour intégrer l'API Thot réelle, modifiez la fonction `analyze_text` dans `main.py` pour effectuer une requête à l'API Thot au lieu d'utiliser les données d'exemple.

## Personnalisation

Vous pouvez personnaliser l'interface et les fonctionnalités selon vos besoins en modifiant les fichiers HTML, CSS et JavaScript dans le dossier `static/`.
