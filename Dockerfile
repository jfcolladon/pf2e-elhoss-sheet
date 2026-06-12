# ---------- Etapa 1: build del frontend ----------
FROM node:22-alpine AS frontend
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---------- Etapa 2: seed de la base de datos ----------
FROM python:3.12-slim AS seed
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./backend/
# copia local del doc de house rules como fallback si Google no responde
COPY data/houserules.txt ./data/houserules.txt
ENV DB_PATH=/seed/app.db
ENV HOUSERULES_TXT=/app/data/houserules.txt
RUN mkdir -p /seed \
    && python backend/etl/seed_aon.py \
    && python backend/etl/seed_houserules.py

# ---------- Etapa 3: imagen final ----------
FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
COPY backend/etl ./etl
COPY --from=frontend /fe/dist ./static
COPY --from=seed /seed/app.db /seed/app.db

ENV DB_PATH=/data/app.db
ENV STATIC_DIR=/app/static
EXPOSE 8000
# Si el volumen /data aun no tiene la base sembrada, se copia la del build.
CMD ["sh", "-c", "mkdir -p /data; if [ ! -f /data/app.db ]; then echo 'Inicializando base de datos desde el seed del build...'; cp /seed/app.db /data/app.db; fi; exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
