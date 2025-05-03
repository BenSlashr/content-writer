import os
import json
import urllib.parse
import logging
from typing import Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import httpx
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()

# Création de l'app FastAPI
app = FastAPI(title="Content Writer API")

# Serveur de fichiers statiques (frontend)
app.mount("/", StaticFiles(directory="static", html=True), name="static")

# Fallback pour servir index.html
@app.get("/", include_in_schema=False)
async def root():
    return FileResponse("static/index.html")

@app.get("/index.html", include_in_schema=False)
async def read_index_explicit():
    return FileResponse("static/index.html")

# Middleware CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logger
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Modèles de requêtes
class TextAnalysisRequest(BaseModel):
    text: str
    query: str

class GuideRequest(BaseModel):
    keywords: str

# Cache local
thot_cache: Dict[str, Any] = {}

# Config Thot API
THOT_API_KEY = "tools@slashr.fr::2.0SL5CGX8tGHJKCGVHBnzvsi"
THOT_API_ENDPOINT = "https://api.thot-seo.fr/commande-api"

@app.get("/health")
async def health_check():
    return {"status": "ok", "port": os.getenv("PORT")}

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

        # Obligatoires
        kw_obligatoires_count = {}
        for kw_info in thot_data.get("KW_obligatoires", []):
            keyword, required_count, importance = map(str.lower, map(str, kw_info))
            count = words.count(keyword)
            kw_obligatoires_count[keyword] = {
                "count": count,
                "required": int(required_count),
                "importance": importance,
                "completed": count >= int(required_count)
            }

        # Complémentaires
        kw_complementaires_count = {}
        for kw_info in thot_data.get("KW_complementaires", []):
            keyword, required_count, importance = map(str.lower, map(str, kw_info))
            count = words.count(keyword)
            kw_complementaires_count[keyword] = {
                "count": count,
                "required": int(required_count),
                "importance": importance,
                "completed": count >= int(required_count)
            }

        completed = sum(1 for v in kw_obligatoires_count.values() if v["completed"])
        score_seo = int((completed / len(kw_obligatoires_count)) * 100) if kw_obligatoires_count else 0
        ngrams = thot_data.get("ngrams", "").split(";")
        ngrams_found = [n for n in ngrams if n.lower() in text_lower]

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
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/order-guide")
async def order_guide(request: GuideRequest):
    try:
        encoded_keywords = urllib.parse.quote(request.keywords)
        api_url = f"{THOT_API_ENDPOINT}?keywords={encoded_keywords}&apikey={THOT_API_KEY}"

        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                response = await client.get(api_url)
                if response.status_code == 200:
                    data = response.json()
                    data["query"] = request.keywords
                    thot_cache[request.keywords] = data
                    return data
                else:
                    return {"error": f"Erreur HTTP {response.status_code}", "body": await response.text()}
            except httpx.TimeoutException:
                with open("sample_response.json", "r", encoding="utf-8") as f:
                    sample_data = json.load(f)
                sample_data["query"] = request.keywords
                return sample_data

    except Exception as e:
        logger.exception("Erreur interne")
        raise HTTPException(status_code=500, detail=str(e))

# Démarrage local
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=os.getenv("HOST", "0.0.0.0"), port=int(os.getenv("PORT", 8000)))
