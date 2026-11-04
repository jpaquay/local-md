FROM python:3.12-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY dist ./dist
COPY server.py ./server.py
COPY docs /docs

RUN useradd --create-home --uid 1001 appuser && chown -R appuser:appuser /app /docs
USER appuser

ENV HOST=0.0.0.0
ENV PORT=8000
ENV ROOT_DIR=/docs
ENV PINNED_ROOTS=/docs
ENV LOCK_ROOT=true

EXPOSE 8000

CMD ["python", "server.py", "--host", "0.0.0.0", "--port", "8000", "--root", "/docs", "--lock-root"]
