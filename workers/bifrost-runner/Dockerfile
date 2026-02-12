FROM node:20-slim

WORKDIR /app

# Install git, curl, build-essential (BIF-83)
RUN apt-get update && apt-get install -y \
    git \
    curl \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Keep image small (BIF-82)
# No CMD yet, or simple keepalive for now
CMD [ "tail", "-f", "/dev/null" ]
