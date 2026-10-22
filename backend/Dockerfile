FROM python:3.11-slim

WORKDIR /app

RUN apt-get update -o Acquire::Retries=5 -o Acquire::http::Timeout=20 \
    && apt-get install -y --no-install-recommends -o Acquire::Retries=5 \
    curl \
    docker.io \
    procps \
    systemd \
    iproute2 \
    kmod \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]