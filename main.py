import os
import json
import httpx
import urllib.parse
import logging
from typing import Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()
PORT = int(os.getenv("PORT", 8000))
HOST = os.getenv("HOST", "0.0.0.0")
BASE_PATH = os.getenv("BASE_PATH", "")

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialisation de FastAPI avec le prefixe BASE_PATH
app = FastAPI(title="Content Writer API", root_path=BASE_PATH)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Servir les fichiers statiques (index.html, js, css, etc.)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Route fallback pour SPA (Single Page App) - utile avec Caddy + BASE_PATH
@app.get("/", include_in_schema=False)
async def read_index():
    return FileResponse("static/index.html")

@app.get("/index.html", include_in_schema=False)
async def explicit_index():
    return FileResponse("static/index.html")

# Données et modèles
class TextAnalysisRequest(BaseModel):
    text: str
    query: str

class GuideRequest(BaseModel):
    keywords: str

thot_cache: Dict[str, Any] = {}
THOT_API_KEY = "tools@slashr.fr::2.0SL5CGX8tGHJKCGVHBnzvsi"
THOT_API_ENDPOINT = "https://api.thot-seo.fr/commande-api"

@app.get("/health")
async def health():
    return {"status": "ok", "base_path": BASE_PATH, "port": PORT}

@app.post("/analyze")
async def analyze_text(request: TextAnalysisRequest):
    try:
        if request.query in thot_cache:
            thot_data = thot_cache[request.query]
        else:
            with open("sample_response.json", "r", encoding="utf-8") as f:
                thot_data = json.load(f)
            thot_cache[request.query] = thot_data

        text_lower = request.text.lower()
        words = text_lower.split()

        kw_obligatoires_count = {}
        for kw_info in thot_data.get("KW_obligatoires", []):
            keyword, required_count, importance = kw_info
            count = words.count(keyword.lower())
            kw_obligatoires_count[keyword.lower()] = {
                "count": count,
                "required": required_count,
                "importance": importance,
                "completed": count >= required_count
            }

        kw_complementaires_count = {}
        for kw_info in thot_data.get("KW_complementaires", []):
            keyword, required_count, importance = kw_info
            count = words.count(keyword.lower())
            kw_complementaires_count[keyword.lower()] = {
                "count": count,
                "required": required_count,
                "importance": importance,
                "completed": count >= required_count
            }

        total = len(thot_data.get("KW_obligatoires", []))
        completed = sum(1 for v in kw_obligatoires_count.values() if v["completed"])
        score_seo = int((completed / total) * 100) if total else 0

        ngrams_found = [ng for ng in thot_data.get("ngrams", "").split(";") if ng.lower() in text_lower]

        return {
            "score_seo": score_seo,
            "kw_obligatoires": kw_obligatoires_count,
            "kw_complementaires": kw_complementaires_count,
            "ngrams_found": ngrams_found,
            "suroptimisation": 0,
            "max_suroptimisation": thot_data.get("max_suroptimisation", 5),
            "word_count": len(words),
            "mots_requis": thot_data.get("mots_requis", 0),
            "premiers_mots": {"count": min(len(words), 200), "target": 200}
        }
    except Exception as e:
        logger.error(f"Erreur analyse: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

def process_thot_data(data, query):
    if "query" not in data or not data["query"]:
        data["query"] = query
    champs = ["score_target", "mots_requis", "KW_obligatoires", "KW_complementaires",
              "ngrams", "max_suroptimisation", "questions", "type_editorial",
              "type_catalogue", "type_fiche_produit", "mots_uniques_min_max_moyenne",
              "concurrence"]
    for champ in champs:
        if champ not in data:
            if champ in ["KW_obligatoires", "KW_complementaires", "concurrence"]:
                data[champ] = []
            elif champ in ["ngrams", "questions"]:
                data[champ] = ""
            elif champ in ["score_target", "mots_requis", "max_suroptimisation"]:
                data[champ] = 0
            else:
                data[champ] = ""
    if isinstance(data["ngrams"], list):
        data["ngrams"] = ";".join(data["ngrams"])
    if isinstance(data["questions"], list):
        data["questions"] = ";".join(data["questions"])
    return data

@app.post("/order-guide")
async def order_guide(request: GuideRequest):
    try:
        logger.info(f"Commande pour : {request.keywords}")
        encoded = urllib.parse.quote(request.keywords)
        url = f"{THOT_API_ENDPOINT}?keywords={encoded}&apikey={THOT_API_KEY}"
        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                resp = await client.get(url)
            except httpx.TimeoutException:
                logger.warning("Timeout Thot, fallback...")
                with open("sample_response.json", "r") as f:
                    sample = json.load(f)
                    processed = process_thot_data(sample, request.keywords)
                    thot_cache[request.keywords] = processed
                    return processed
            if resp.status_code == 200:
                response_data = resp.json()
                processed = process_thot_data(response_data, request.keywords)
                thot_cache[request.keywords] = processed
                return processed
            else:
                logger.error(f"Erreur HTTP {resp.status_code}")
                raise HTTPException(status_code=resp.status_code, detail=await resp.text())
    except Exception as e:
        logger.exception("Erreur guide")
        raise HTTPException(status_code=500, detail=str(e))

# Pour exécution directe
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
