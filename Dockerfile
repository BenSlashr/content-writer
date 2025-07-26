# Multi-stage build pour optimiser la taille
FROM python:3.10-slim as builder

# Variables d'environnement pour optimiser Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Installer les dépendances système nécessaires
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Créer un utilisateur non-root pour la sécurité
RUN useradd --create-home --shell /bin/bash app

# Définir le répertoire de travail
WORKDIR /app

# Copier et installer les dépendances Python
COPY requirements.txt .
RUN pip install --user --no-warn-script-location -r requirements.txt

# Stage final
FROM python:3.10-slim

# Variables d'environnement
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    BASE_PATH="/content-writer" \
    HOST="0.0.0.0" \
    PORT="8000"

# Créer l'utilisateur app
RUN useradd --create-home --shell /bin/bash app

# Copier les dépendances Python depuis le builder
COPY --from=builder /root/.local /home/app/.local

# Définir le répertoire de travail
WORKDIR /app

# Copier le code de l'application
COPY --chown=app:app . .

# Changer vers l'utilisateur non-root
USER app

# Ajouter le répertoire local des packages Python au PATH
ENV PATH="/home/app/.local/bin:$PATH"

# Exposer le port
EXPOSE 8000

# Healthcheck pour Docker
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/content-writer/', timeout=5)"

# Commande de démarrage
CMD ["sh", "-c", "uvicorn main:app --host $HOST --port $PORT --root-path $BASE_PATH"]
