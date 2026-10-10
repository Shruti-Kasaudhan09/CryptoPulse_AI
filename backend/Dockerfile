# Backend image (Phase 22). Build from the REPO ROOT so ml/ is included:
#   docker build -f backend/Dockerfile -t cryptopulse-api .
#   docker run -p 8000:8000 -e DATABASE_URL=... cryptopulse-api
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    MPLBACKEND=Agg

# libgomp is needed by xgboost
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install -r backend/requirements.txt

COPY ml ml
COPY backend backend
RUN chmod +x backend/start.sh

WORKDIR /app/backend
EXPOSE 8000
CMD ["./start.sh"]
