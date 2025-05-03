from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import httpx
import json
import urllib.parse
import logging
from typing import Dict, Any, Optional
from fastapi.responses import FileResponse
import os

app = FastAPI()

# Serve le dossier static (css, js, index.html, etc.)
app.mount("/", StaticFiles(directory="static", html=True), name="static")

# Optionnel : route fallback pour servir index.html
@app.get("/")
async def root():
    return FileResponse("static/index.html")

# Ajoute aussi /index.html si besoin
@app.get("/index.html")
async def read_index_explicit():
    return FileResponse("static/index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=os.getenv("HOST", "0.0.0.0"), port=int(os.getenv("PORT", 8000)))

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Content Writer API")

# Configuration CORS pour permettre les requêtes depuis le frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modèle de données pour la requête
class TextAnalysisRequest(BaseModel):
    text: str
    query: str

class GuideRequest(BaseModel):
    keywords: str

# Modèle de données pour le cache
thot_cache: Dict[str, Any] = {}

# Configuration de l'API Thot
THOT_API_KEY = "tools@slashr.fr::2.0SL5CGX8tGHJKCGVHBnzvsi"
THOT_API_ENDPOINT = "https://api.thot-seo.fr/commande-api"

@app.get("/")
async def read_root():
    return {"message": "Content Writer API is running"}

@app.post("/analyze")
async def analyze_text(request: TextAnalysisRequest):
    """
    Analyse le texte fourni et retourne les statistiques basées sur les mots-clés
    """
    try:
        # Si la requête est déjà dans le cache, utiliser les données en cache
        if request.query in thot_cache:
            thot_data = thot_cache[request.query]
        else:
            # Simuler une requête à l'API Thot (à remplacer par l'appel réel à l'API)
            # Dans un environnement de production, vous devriez utiliser l'API réelle
            with open("sample_response.json", "r", encoding="utf-8") as f:
                thot_data = json.load(f)
            thot_cache[request.query] = thot_data
        
        # Analyser le texte
        text_lower = request.text.lower()
        words = text_lower.split()
        
        # Compter les occurrences des mots-clés obligatoires
        kw_obligatoires_count = {}
        for kw_info in thot_data.get("KW_obligatoires", []):
            keyword = kw_info[0].lower()
            required_count = kw_info[1]
            importance = kw_info[2]
            
            # Compter les occurrences du mot-clé dans le texte
            count = 0
            for word in words:
                if keyword == word:
                    count += 1
            
            kw_obligatoires_count[keyword] = {
                "count": count,
                "required": required_count,
                "importance": importance,
                "completed": count >= required_count
            }
        
        # Compter les occurrences des mots-clés complémentaires
        kw_complementaires_count = {}
        for kw_info in thot_data.get("KW_complementaires", []):
            keyword = kw_info[0].lower()
            required_count = kw_info[1]
            importance = kw_info[2]
            
            # Compter les occurrences du mot-clé dans le texte
            count = 0
            for word in words:
                if keyword == word:
                    count += 1
            
            kw_complementaires_count[keyword] = {
                "count": count,
                "required": required_count,
                "importance": importance,
                "completed": count >= required_count
            }
        
        # Calculer le score SEO (simplification)
        total_kw_obligatoires = len(thot_data.get("KW_obligatoires", []))
        completed_kw_obligatoires = sum(1 for k, v in kw_obligatoires_count.items() if v["completed"])
        
        score_seo = 0
        if total_kw_obligatoires > 0:
            score_seo = int((completed_kw_obligatoires / total_kw_obligatoires) * 100)
        
        # Vérifier les n-grams
        ngrams = thot_data.get("ngrams", "").split(";")
        ngrams_found = []
        
        for ngram in ngrams:
            if ngram.lower() in text_lower:
                ngrams_found.append(ngram)
        
        # Calculer la suroptimisation (simplification)
        suroptimisation = 0
        max_suroptimisation = thot_data.get("max_suroptimisation", 5)
        
        # Compter les mots
        word_count = len(words)
        mots_requis = thot_data.get("mots_requis", 0)
        
        return {
            "score_seo": score_seo,
            "kw_obligatoires": kw_obligatoires_count,
            "kw_complementaires": kw_complementaires_count,
            "ngrams_found": ngrams_found,
            "suroptimisation": suroptimisation,
            "max_suroptimisation": max_suroptimisation,
            "word_count": word_count,
            "mots_requis": mots_requis,
            "premiers_mots": {
                "count": min(word_count, 200),
                "target": 200
            }
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Fonction pour traiter les données de l'API Thot
def process_thot_data(data, query):
    """
    Traite les données reçues de l'API Thot pour s'assurer qu'elles sont complètes
    et correctement formatées pour l'interface utilisateur.
    """
    # S'assurer que la requête est présente
    if "query" not in data or not data["query"]:
        data["query"] = query
    
    # S'assurer que les champs requis sont présents
    required_fields = [
        "score_target", "mots_requis", "KW_obligatoires", "KW_complementaires",
        "ngrams", "max_suroptimisation", "questions", "type_editorial",
        "type_catalogue", "type_fiche_produit", "mots_uniques_min_max_moyenne",
        "concurrence"
    ]
    
    for field in required_fields:
        if field not in data:
            if field == "KW_obligatoires" or field == "KW_complementaires":
                data[field] = []
            elif field == "ngrams":
                data[field] = ""
            elif field == "questions":
                data[field] = ""
            elif field == "concurrence":
                data[field] = []
            elif field in ["score_target", "mots_requis", "max_suroptimisation"]:
                data[field] = 0
            else:
                data[field] = ""
    
    # S'assurer que les n-grams sont au format string
    if isinstance(data["ngrams"], list):
        data["ngrams"] = ";".join(data["ngrams"])
    
    # S'assurer que les questions sont au format string
    if isinstance(data["questions"], list):
        data["questions"] = ";".join(data["questions"])
    
    return data

# Rediriger la racine vers la documentation de l'API
@app.get("/", include_in_schema=False)
async def root_redirect():
    return {"message": "Content Writer API is running. Access the documentation at /docs"}

@app.post("/order-guide")
async def order_guide(request: GuideRequest):
    """
    Commande un guide de rédaction à partir d'un mot-clé via l'API Thot
    """
    try:
        # Log des paramètres de la requête
        logger.info(f"Commande de guide pour le mot-clé: {request.keywords}")
        
        # Encoder les paramètres pour l'URL
        encoded_keywords = urllib.parse.quote(request.keywords)
        
        # Construire l'URL de l'API
        api_url = f"{THOT_API_ENDPOINT}?keywords={encoded_keywords}&apikey={THOT_API_KEY}"
        logger.info(f"URL de l'API: {api_url}")
        
        # Faire la requête à l'API Thot avec un timeout plus long
        async with httpx.AsyncClient(timeout=120.0) as client:
            logger.info("Envoi de la requête à l'API Thot...")
            try:
                response = await client.get(api_url)
                logger.info(f"Réponse reçue avec le code: {response.status_code}")
            except httpx.TimeoutException as e:
                logger.error(f"Timeout lors de la connexion à l'API Thot: {str(e)}")
                # Utiliser les données de l'exemple si disponibles
                logger.info("Tentative d'utilisation des données d'exemple...")
                try:
                    with open("sample_response.json", "r", encoding="utf-8") as f:
                        sample_data = json.load(f)
                    
                    # Modifier les données d'exemple pour correspondre à la requête
                    sample_data["query"] = request.keywords
                    
                    # Traiter les données pour s'assurer qu'elles sont complètes
                    processed_data = process_thot_data(sample_data, request.keywords)
                    
                    # Stocker dans le cache
                    thot_cache[request.keywords] = processed_data
                    
                    logger.info("Données d'exemple utilisées avec succès")
                    return sample_data
                except Exception as sample_error:
                    logger.error(f"Impossible d'utiliser les données d'exemple: {str(sample_error)}")
                    raise HTTPException(status_code=504, 
                                      detail=f"L'API Thot ne répond pas (timeout). Veuillez réessayer plus tard.")
            
            if response.status_code == 200:
                # Log du succès
                logger.info("Requête réussie, traitement des données...")
                
                # Stocker la réponse dans le cache
                response_data = response.json()
                logger.info(f"Données reçues: {str(response_data)[:200]}...")
                
                # Traiter les données pour s'assurer qu'elles sont complètes
                processed_data = process_thot_data(response_data, request.keywords)
                
                # Stocker les données traitées dans le cache
                thot_cache[request.keywords] = processed_data
                return processed_data
            else:
                # Log de l'erreur HTTP
                error_content = await response.text()
                logger.error(f"Erreur HTTP {response.status_code}: {error_content}")
                raise HTTPException(status_code=response.status_code, 
                                   detail=f"Erreur lors de la commande du guide: {error_content}")
    
    except Exception as e:
        # Log de l'exception
        logger.exception(f"Exception lors de la commande du guide: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur interne: {str(e)}")
