FROM python:3.11-slim
ENV CASS_DRIVER_NO_EXTENSIONS=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["sh", "-c", "python -m app.seed && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
