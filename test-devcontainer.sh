#!/bin/bash

# Test script to verify devcontainer setup
echo "🧪 Testing devcontainer configuration..."
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    echo "   Install Docker Desktop from: https://www.docker.com/products/docker-desktop"
    exit 1
else
    echo "✅ Docker is installed"
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running"
    echo "   Start Docker Desktop and try again"
    exit 1
else
    echo "✅ Docker is running"
fi

# Check if VS Code is installed
if ! command -v code &> /dev/null; then
    echo "⚠️  VS Code CLI not found (optional)"
    echo "   You can still use VS Code GUI to open the devcontainer"
else
    echo "✅ VS Code CLI is installed"
fi

# Check devcontainer files
echo ""
echo "📁 Checking devcontainer files..."

required_files=(
    ".devcontainer/devcontainer.json"
    ".devcontainer/docker-compose.yml"
    ".devcontainer/Dockerfile"
    ".devcontainer/post-create.sh"
    ".devcontainer/post-start.sh"
)

all_present=true
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file not found"
        all_present=false
    fi
done

if [ "$all_present" = false ]; then
    echo ""
    echo "❌ Some required files are missing"
    exit 1
fi

# Check script permissions
echo ""
echo "🔐 Checking script permissions..."
if [ -x ".devcontainer/post-create.sh" ] && [ -x ".devcontainer/post-start.sh" ]; then
    echo "✅ Scripts are executable"
else
    echo "⚠️  Scripts are not executable (will be fixed automatically)"
    chmod +x .devcontainer/*.sh
    echo "✅ Fixed permissions"
fi

# Check JSON syntax
echo ""
echo "📝 Validating JSON configuration..."
if command -v jq &> /dev/null; then
    if jq empty .devcontainer/devcontainer.json 2>/dev/null; then
        echo "✅ devcontainer.json is valid"
    else
        echo "❌ devcontainer.json has syntax errors"
        exit 1
    fi
else
    echo "⚠️  jq not installed, skipping JSON validation"
fi

# Test Docker Compose configuration
echo ""
echo "🐳 Testing Docker Compose configuration..."
cd .devcontainer
if docker-compose config &> /dev/null; then
    echo "✅ docker-compose.yml is valid"
else
    echo "❌ docker-compose.yml has errors"
    docker-compose config
    exit 1
fi
cd ..

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✨ All checks passed! Your devcontainer is ready to use."
echo "═══════════════════════════════════════════════════════"
echo ""
echo "🚀 Next steps:"
echo ""
echo "   1. Open this folder in VS Code:"
echo "      code ."
echo ""
echo "   2. When prompted, click 'Reopen in Container'"
echo "      OR press F1 and select 'Dev Containers: Reopen in Container'"
echo ""
echo "   3. Wait for the container to build (5-10 mins first time)"
echo ""
echo "   4. Once ready, run:"
echo "      npm run dev"
echo ""
echo "📚 For more details, see .devcontainer/README.md"
echo ""
