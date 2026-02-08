# Base image with Node.js 20
FROM mcr.microsoft.com/devcontainers/typescript-node:20

# Install additional OS packages
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
    postgresql-client \
    && apt-get clean -y && rm -rf /var/lib/apt/lists/*

# Install global npm packages
RUN npm install -g \
    prisma \
    @prisma/client \
    typescript \
    ts-node \
    vercel

# Set working directory
WORKDIR /workspace

# Copy package files for better layer caching (if they exist)
COPY package*.json ./

# Install dependencies if package.json exists
RUN if [ -f package.json ]; then npm install; fi

# Default command
CMD ["sleep", "infinity"]
