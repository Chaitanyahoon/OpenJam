# Build stage
FROM python:3.11-slim as builder

WORKDIR /app
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Runtime stage
FROM python:3.11-slim

# Create non-root user 1000 (Required for Hugging Face Spaces & security)
RUN useradd -m -u 1000 user

WORKDIR /app
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=7860 \
    HOME=/home/user

# Copy venv from builder
COPY --from=builder /opt/venv /opt/venv

# Install runtime dependencies (ffmpeg for audio extraction)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy application code with user ownership
COPY --chown=user:user . /app

# Ensure logs, data, and cache directories exist and are writable
RUN mkdir -p /app/logs /app/data /app/cache && chown -R user:user /app

USER user

# Expose port (7860 for Hugging Face Spaces; overridable via $PORT on Render/Koyeb)
EXPOSE 7860

# Run application
CMD ["python", "run.py"]
