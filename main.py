from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import httpx
import json
import urllib.parse
import logging
import re
from typing import Dict, Any, Optional
from fastapi.responses import FileResponse  # Ajoutez cette importation
import os  # Ajoutez cette importation

# Configuration du chemin de base pour le déploiement
BASE_PATH = os.getenv("BASE_PATH", "/content-writer")
app = FastAPI(
    title="Content Writer API", 
    root_path=BASE_PATH,
    docs_url=f"{BASE_PATH}/docs" if BASE_PATH else "/docs",
    redoc_url=f"{BASE_PATH}/redoc" if BASE_PATH else "/redoc"
)

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.get("/", include_in_schema=False)
async def read_index():
    return FileResponse("static/index.html")

@app.get("/index.html", include_in_schema=False)
async def explicit_index():
    return FileResponse("static/index.html")

# Configuration CORS pour permettre les requêtes depuis le frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Montage des fichiers statiques
app.mount("/static", StaticFiles(directory="static"), name="static")

# Modèle de données pour la requête
class TextAnalysisRequest(BaseModel):
    text: str
    query: str

class GuideRequest(BaseModel):
    keywords: str

class SlashrGuideRequest(BaseModel):
    keywords: str
    location: str = "France"

# Modèle de données pour le cache
thot_cache: Dict[str, Any] = {}
slashr_cache: Dict[str, Any] = {}

# Configuration de l'API Thot
THOT_API_KEY = "tools@slashr.fr::2.0SL5CGX8tGHJKCGVHBnzvsi"
THOT_API_ENDPOINT = "https://api.thot-seo.fr/commande-api"

# Configuration de l'API Slashr Sémantique
SLASHR_API_BASE_URL = "https://outils.agence-slashr.fr/semantique/api/v1"
SLASHR_TIMEOUT = 30.0

def normalize_text_for_search(text):
    """
    Normalise le texte pour la recherche en supprimant la ponctuation excessive
    mais en préservant la structure des mots.
    """
    # Remplacer les apostrophes et guillemets par des espaces
    text = re.sub(r"['\"\u2018\u2019\u201C\u201D\u201E\u201F\u00AB\u00BB]", ' ', text)
    # Remplacer les tirets par des espaces (pour éviter site-web = site web)
    text = re.sub(r'[-_]', ' ', text)
    # Remplacer la ponctuation restante par des espaces
    text = re.sub(r'[^\w\s]', ' ', text)
    # Normaliser les espaces multiples
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def count_keyword_occurrences(text, keyword):
    """
    Compte les occurrences d'un mot-clé dans un texte de manière ULTRA-ROBUSTE.
    
    Cette fonction gère :
    - La ponctuation (créatine, créatine. créatine! "créatine" etc.)
    - Les mots composés avec espaces (prise de masse)
    - Les variations de casse
    - Les caractères spéciaux et accents
    - Les apostrophes et guillemets
    - Les espaces multiples
    - Les retours à la ligne
    
    Args:
        text (str): Le texte dans lequel chercher (déjà en minuscules)
        keyword (str): Le mot-clé à chercher (déjà en minuscules)
    
    Returns:
        int: Nombre d'occurrences trouvées
    """
    if not keyword or not text:
        return 0
    
    # Normaliser le texte et le mot-clé
    normalized_text = normalize_text_for_search(text)
    normalized_keyword = normalize_text_for_search(keyword)
    
    if not normalized_keyword or not normalized_text:
        return 0
    
    # Méthode 1: Recherche exacte avec regex robuste
    count_regex = 0
    if ' ' in normalized_keyword:
        # Pour les expressions multi-mots
        parts = normalized_keyword.split()
        escaped_parts = [re.escape(part) for part in parts]
        pattern = r'\b' + r'\s+'.join(escaped_parts) + r'\b'
    else:
        # Pour les mots simples
        pattern = r'\b' + re.escape(normalized_keyword) + r'\b'
    
    matches = re.findall(pattern, normalized_text, re.IGNORECASE | re.UNICODE)
    count_regex = len(matches)
    
    # Méthode 2: Recherche par découpage en mots (validation)
    count_split = 0
    if ' ' not in normalized_keyword:
        # Pour les mots simples, compter aussi par découpage avec validation stricte
        words = normalized_text.split()
        for word in words:
            # Comparaison exacte pour éviter les pluriels (protéines ≠ protéine)
            if word.lower() == normalized_keyword.lower():
                count_split += 1
    else:
        # Pour les expressions multi-mots, rechercher la séquence
        words = normalized_text.split()
        keyword_parts = normalized_keyword.split()
        keyword_length = len(keyword_parts)
        
        for i in range(len(words) - keyword_length + 1):
            if all(words[i + j].lower() == keyword_parts[j].lower() 
                   for j in range(keyword_length)):
                count_split += 1
    
    # Utiliser la méthode regex comme référence principale, split comme validation
    # Si les deux méthodes donnent des résultats différents, prendre le plus conservateur
    if count_regex == count_split:
        final_count = count_regex
    else:
        # En cas de différence, prendre le minimum pour éviter les faux positifs
        final_count = min(count_regex, count_split)
        if count_regex > 0 and count_split > 0:
            # Sauf si les deux méthodes trouvent quelque chose, alors prendre le max
            final_count = max(count_regex, count_split)
    
    # Debug: afficher les détails si les méthodes diffèrent
    if count_regex != count_split:
        logger.info(f"Détection différente pour '{keyword}': regex={count_regex}, split={count_split}, final={final_count}")
    
    return final_count

def calculate_simple_robust_score(kw_obligatoires_count, kw_complementaires_count, thot_data):
    """
    Calcule un score SEO robuste de 0 à 100 basé sur l'atteinte des objectifs de mots-clés.
    
    Cette fonction implémente un système de scoring qui :
    - Attribue 70% du score aux mots-clés obligatoires
    - Attribue 30% du score aux mots-clés complémentaires
    - Applique un malus pour la suroptimisation (dépassement des maximums)
    - Garantit que le score final ne dépasse jamais 100
    
    Args:
        kw_obligatoires_count (dict): Dictionnaire des comptages des mots-clés obligatoires
        kw_complementaires_count (dict): Dictionnaire des comptages des mots-clés complémentaires
        thot_data (dict): Données de l'API Thot contenant les mots-clés et leurs paramètres
    
    Returns:
        dict: Dictionnaire contenant le score final et les détails du calcul
        
    Exemple de retour :
    {
        "score_seo": 75.5,
        "base_score": 78.2,
        "malus": 2.7,
        "score_obligatoires": 52.3,
        "score_complementaires": 25.9,
        "details": {
            "obligatoires_success": 25,
            "total_obligatoires": 35,
            "complementaires_success": 15,
            "total_complementaires": 45,
            "malus_count": 3
        }
    }
    """
    # Compter les mots-clés qui atteignent leur objectif
    obligatoires_success = 0
    complementaires_success = 0
    total_obligatoires = len(thot_data.get("KW_obligatoires", []))
    total_complementaires = len(thot_data.get("KW_complementaires", []))
    
    malus_count = 0
    
    # Vérifier les mots-clés obligatoires
    for kw_info in thot_data.get("KW_obligatoires", []):
        keyword = kw_info[0].lower()
        min_freq = kw_info[1]  # Fréquence minimale requise
        max_freq = kw_info[3] if len(kw_info) > 3 else min_freq * 2  # Fréquence maximale recommandée
        
        count = kw_obligatoires_count.get(keyword, {}).get("count", 0)
        
        # Un mot-clé est réussi s'il atteint au moins le minimum requis
        if count >= min_freq:
            obligatoires_success += 1
            # Vérifier la suroptimisation (dépassement du maximum)
            if count > max_freq:
                malus_count += 1
    
    # Vérifier les mots-clés complémentaires
    for kw_info in thot_data.get("KW_complementaires", []):
        keyword = kw_info[0].lower()
        min_freq = kw_info[1]
        max_freq = kw_info[3] if len(kw_info) > 3 else min_freq * 2
        
        count = kw_complementaires_count.get(keyword, {}).get("count", 0)
        
        if count >= min_freq:
            complementaires_success += 1
            if count > max_freq:
                malus_count += 1
    
    # Calcul du score obligatoire (70% du score total)
    score_obligatoires = 0
    if total_obligatoires > 0:
        score_obligatoires = (obligatoires_success / total_obligatoires) * 70
    
    # Calcul du score complémentaire (30% du score total)
    score_complementaires = 0
    if total_complementaires > 0:
        score_complementaires = (complementaires_success / total_complementaires) * 30
    
    # Score de base (sans malus)
    base_score = score_obligatoires + score_complementaires
    
    # Calcul du malus pour suroptimisation (sans maximum)
    total_keywords = total_obligatoires + total_complementaires
    malus = 0
    if total_keywords > 0:
        malus = (malus_count / total_keywords) * 20
    
    # Score final (plafonné entre 0 et 100)
    final_score = max(0, min(100, base_score - malus))
    
    return {
        "score_seo": round(final_score, 1),
        "base_score": round(base_score, 1),
        "malus": round(malus, 1),
        "score_obligatoires": round(score_obligatoires, 1),
        "score_complementaires": round(score_complementaires, 1),
        "details": {
            "obligatoires_success": obligatoires_success,
            "total_obligatoires": total_obligatoires,
            "complementaires_success": complementaires_success,
            "total_complementaires": total_complementaires,
            "malus_count": malus_count
        }
    }

# Route supprimée - conflit avec read_index()

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
        
        # Analyser le texte avec une détection améliorée des mots-clés
        text_lower = request.text.lower()
        
        # Compter les occurrences des mots-clés obligatoires
        kw_obligatoires_count = {}
        for kw_info in thot_data.get("KW_obligatoires", []):
            keyword = kw_info[0].lower()
            required_count = kw_info[1]
            importance = kw_info[2]
            
            # Compter les occurrences du mot-clé dans le texte avec une méthode robuste
            count = count_keyword_occurrences(text_lower, keyword)
            
            # Debug: Afficher le résultat pour chaque mot-clé
            if count > 0:
                logger.info(f"✅ Mot-clé '{keyword}' trouvé {count} fois (requis: {required_count})")
            
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
            
            # Compter les occurrences du mot-clé dans le texte avec une méthode robuste
            count = count_keyword_occurrences(text_lower, keyword)
            
            kw_complementaires_count[keyword] = {
                "count": count,
                "required": required_count,
                "importance": importance,
                "completed": count >= required_count
            }
        
        # Debug: Afficher les mots-clés chargés et le texte analysé
        logger.info(f"=== DEBUG ANALYSE ===")
        logger.info(f"Query: {request.query}")
        logger.info(f"Texte analysé (premiers 200 caractères): {request.text[:200]}...")
        logger.info(f"Nombre de mots-clés obligatoires: {len(thot_data.get('KW_obligatoires', []))}")
        logger.info(f"Premiers 5 mots-clés obligatoires: {[kw[0] for kw in thot_data.get('KW_obligatoires', [])[:5]]}")
        
        # Calculer le nouveau score SEO robuste
        score_data = calculate_simple_robust_score(kw_obligatoires_count, kw_complementaires_count, thot_data)
        
        # Vérifier les n-grams
        ngrams = thot_data.get("ngrams", "").split(";")
        ngrams_found = []
        
        for ngram in ngrams:
            if ngram.lower() in text_lower:
                ngrams_found.append(ngram)
        
        # Calculer la suroptimisation basée sur le malus_count
        total_keywords = len(kw_obligatoires_count) + len(kw_complementaires_count)
        malus_count = score_data["details"]["malus_count"]
        
        # Suroptimisation = pourcentage de mots-clés suroptimisés
        suroptimisation = round((malus_count / total_keywords) * 100) if total_keywords > 0 else 0
        max_suroptimisation = 100  # Maximum logique : 100% des mots-clés suroptimisés
        
        # Compter les mots (méthode améliorée)
        words = re.findall(r'\b\w+\b', text_lower)
        word_count = len(words)
        mots_requis = thot_data.get("mots_requis", 0)
        
        return {
            "score_seo": score_data["score_seo"],
            "base_score": score_data["base_score"],
            "malus": score_data["malus"],
            "score_obligatoires": score_data["score_obligatoires"],
            "score_complementaires": score_data["score_complementaires"],
            "score_details": score_data["details"],
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

def process_slashr_data(data: Dict[str, Any], query: str) -> Dict[str, Any]:
    """
    Convertit les données de l'API Slashr au format compatible avec l'interface utilisateur
    """
    # Convertir les mots-clés obligatoires
    kw_obligatoires = []
    for keyword_data in data.get("required_keywords", []):
        if isinstance(keyword_data, dict):
            keyword = keyword_data.get("keyword", "")
            frequency = keyword_data.get("frequency", 1)
            importance = keyword_data.get("importance", 10)
            # Utiliser min_freq et max_freq si disponibles
            min_freq = keyword_data.get("min_freq", 1)
            max_freq = keyword_data.get("max_freq", frequency)
        else:
            # Si c'est un format différent, s'adapter
            keyword = str(keyword_data)
            frequency = 1
            importance = 10
            min_freq = 1
            max_freq = 1
        
        kw_obligatoires.append([keyword, frequency, importance, min_freq, max_freq])
    
    # Convertir les mots-clés complémentaires (limités à 20)
    kw_complementaires = []
    for keyword_data in data.get("complementary_keywords", [])[:20]:
        if isinstance(keyword_data, dict):
            keyword = keyword_data.get("keyword", "")
            frequency = keyword_data.get("frequency", 1)
            importance = keyword_data.get("importance", 5)
            # Utiliser min_freq et max_freq si disponibles
            min_freq = keyword_data.get("min_freq", 1)
            max_freq = keyword_data.get("max_freq", frequency)
        else:
            keyword = str(keyword_data)
            frequency = 1
            importance = 5
            min_freq = 1
            max_freq = 1
        
        kw_complementaires.append([keyword, frequency, importance, min_freq, max_freq])
    
    # Calculer les statistiques globales min/max/moyenne
    all_keywords = data.get("required_keywords", []) + data.get("complementary_keywords", [])
    if all_keywords:
        min_values = []
        max_values = []
        for kw in all_keywords:
            if isinstance(kw, dict):
                min_values.append(kw.get("min_freq", 1))
                max_values.append(kw.get("max_freq", 1))
        
        if min_values and max_values:
            global_min = min(min_values)
            global_max = max(max_values)
            global_avg = int((global_min + global_max) / 2)
            mots_uniques_stats = f"[{global_min}, {global_max}, {global_avg}]"
        else:
            mots_uniques_stats = "[1, 5, 3]"
    else:
        mots_uniques_stats = "[1, 5, 3]"
    
    # Créer la structure de données compatible
    processed_data = {
        "query": query,
        "score_target": data.get("target_seo_score", 50),
        "mots_requis": data.get("recommended_words", 800),
        "KW_obligatoires": kw_obligatoires,
        "KW_complementaires": kw_complementaires,
        "ngrams": "",  # L'API Slashr ne semble pas retourner de n-grams
        "max_suroptimisation": 5,
        "questions": "",
        "type_editorial": 100,
        "type_catalogue": 0,
        "type_fiche_produit": 0,
        "mots_uniques_min_max_moyenne": mots_uniques_stats,
        "concurrence": []
    }
    
    return processed_data

# Route supprimée - conflit avec read_index()

@app.post("/order-guide")
async def order_guide(request: GuideRequest):
    """
    Commande un guide de rédaction à partir d'un mot-clé via l'API Thot
    """
    try:
        # Log des paramètres de la requête
        logger.info(f"=== DÉBUT order_guide (THOT) ===")
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
                    logger.info(f"=== FIN order_guide (THOT) - fallback sample ===")
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
                logger.info(f"=== FIN order_guide (THOT) - succès ===")
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
        logger.error(f"=== FIN order_guide (THOT) - échec ===")
        raise HTTPException(status_code=500, detail=f"Erreur interne: {str(e)}")

@app.post("/order-guide-slashr")
async def order_guide_slashr(request: SlashrGuideRequest):
    """
    Commande un guide de rédaction à partir d'un mot-clé via l'API Slashr Sémantique
    """
    try:
        # Log des paramètres de la requête
        logger.info(f"=== DÉBUT order_guide_slashr ===")
        logger.info(f"Commande de guide Slashr pour le mot-clé: {request.keywords}, location: {request.location}")
        
        # Vérifier le cache d'abord
        cache_key = f"{request.keywords}_{request.location}"
        if cache_key in slashr_cache:
            logger.info("Utilisation des données en cache pour Slashr")
            return slashr_cache[cache_key]
        
        # Encoder les paramètres pour l'URL
        encoded_query = request.keywords.replace(" ", "%20")
        
        # Construire l'URL de l'API Slashr
        api_url = f"{SLASHR_API_BASE_URL}/analyze/{encoded_query}?location={request.location}&language=fr"
        logger.info(f"URL de l'API Slashr: {api_url}")
        logger.info(f"Timeout configuré: {SLASHR_TIMEOUT}s")
        
        # Faire la requête à l'API Slashr
        async with httpx.AsyncClient(timeout=SLASHR_TIMEOUT) as client:
            logger.info("Envoi de la requête à l'API Slashr...")
            try:
                response = await client.get(api_url)
                logger.info(f"Réponse reçue avec le code: {response.status_code}")
            except httpx.TimeoutException as e:
                logger.error(f"=== TIMEOUT API SLASHR ===")
                logger.error(f"URL appelée: {api_url}")
                logger.error(f"Timeout configuré: {SLASHR_TIMEOUT}s")
                logger.error(f"Détail de l'erreur: {str(e)}")
                logger.error(f"=== FIN TIMEOUT API SLASHR ===")
                logger.error("L'API Slashr ne répond pas - pas de fallback vers Thot")
                raise HTTPException(status_code=504, 
                                  detail=f"L'API Slashr ne répond pas (timeout). Veuillez réessayer plus tard.")
            except httpx.RequestError as e:
                logger.error(f"=== ERREUR CONNEXION API SLASHR ===")
                logger.error(f"URL appelée: {api_url}")
                logger.error(f"Type d'erreur: {type(e).__name__}")
                logger.error(f"Détail de l'erreur: {str(e)}")
                logger.error(f"=== FIN ERREUR CONNEXION API SLASHR ===")
                logger.error("Impossible de se connecter à l'API Slashr - pas de fallback vers Thot")
                raise HTTPException(status_code=503, 
                                  detail=f"Impossible de se connecter à l'API Slashr: {str(e)}")
            
            if response.status_code == 200:
                # Log du succès
                logger.info("Requête Slashr réussie, traitement des données...")
                
                # Récupérer les données JSON
                response_data = response.json()
                logger.info(f"=== RÉPONSE COMPLÈTE DE L'API SLASHR ===")
                logger.info(f"Status Code: {response.status_code}")
                logger.info(f"Headers: {dict(response.headers)}")
                logger.info(f"Données JSON complètes: {json.dumps(response_data, indent=2, ensure_ascii=False)}")
                logger.info(f"=== FIN RÉPONSE API SLASHR ===")
                
                # Convertir les données au format compatible
                processed_data = process_slashr_data(response_data, request.keywords)
                logger.info(f"Données traitées: {json.dumps(processed_data, indent=2, ensure_ascii=False)}")
                
                # Stocker les données traitées dans le cache
                slashr_cache[cache_key] = processed_data
                
                logger.info("Données Slashr traitées avec succès")
                logger.info(f"=== FIN order_guide_slashr (succès) ===")
                return processed_data
            else:
                # Log de l'erreur HTTP
                error_content = response.text
                logger.error(f"=== ERREUR API SLASHR ===")
                logger.error(f"Status Code: {response.status_code}")
                logger.error(f"Headers: {dict(response.headers)}")
                logger.error(f"Contenu de l'erreur: {error_content}")
                logger.error(f"=== FIN ERREUR API SLASHR ===")
                logger.error("Erreur HTTP de l'API Slashr - pas de fallback vers Thot")
                raise HTTPException(status_code=response.status_code, 
                                   detail=f"Erreur lors de la commande du guide Slashr: {error_content}")
    
    except HTTPException:
        # Re-raise HTTP exceptions
        logger.error(f"=== FIN order_guide_slashr (échec HTTPException) ===")
        raise
    except Exception as e:
        # Log de l'exception
        logger.exception(f"Exception lors de la commande du guide Slashr: {str(e)}")
        logger.error(f"=== FIN order_guide_slashr (échec Exception) ===")
        raise HTTPException(status_code=500, detail=f"Erreur interne: {str(e)}")

# Montage des fichiers statiques déjà fait plus haut

