#!/bin/bash
# Create a pre-built Docker image distribution package for clients
# Usage: ./create-docker-dist.sh [version]
# If no version is provided, it will use APP_VERSION from src/config/version.js

set -e

# Get the project root directory (parent of docker/)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Try to read APP_VERSION from version.js if no version provided
if [ -z "$1" ]; then
  VERSION_FILE="${PROJECT_ROOT}/src/config/version.js"
  if [ -f "$VERSION_FILE" ]; then
    # Extract version from: export const APP_VERSION = '2.3.8';
    APP_VERSION=$(grep "export const APP_VERSION" "$VERSION_FILE" | sed -E "s/.*APP_VERSION = ['\"]([^'\"]+)['\"].*/\1/" || echo "")
    if [ -n "$APP_VERSION" ]; then
      VERSION="$APP_VERSION"
      echo "📋 Using APP_VERSION from src/config/version.js: ${VERSION}"
    else
      VERSION="latest"
      echo "⚠️  Could not read APP_VERSION from version.js, using 'latest'"
    fi
  else
    VERSION="latest"
    echo "⚠️  version.js not found, using 'latest'"
  fi
else
  VERSION="$1"
fi

IMAGE_NAME="solace-queue-browser"
IMAGE_TAG="${IMAGE_NAME}:${VERSION}"
DIST_NAME="${IMAGE_NAME}-${VERSION}"
DIST_DIR="dist-docker"

echo "📦 Creating Docker distribution package..."
echo "   Version: ${VERSION}"
echo "   Image: ${IMAGE_TAG}"
echo "   Distribution: ${DIST_NAME}"
echo ""

# Change to project root
cd "$PROJECT_ROOT"

# Build the Docker image
echo "🔨 Building Docker image..."
docker build -f docker/Dockerfile -t "${IMAGE_TAG}" .

# Create distribution directory
mkdir -p "${DIST_DIR}"

# Save the image to a tarball
echo "💾 Saving Docker image to tarball..."
docker save "${IMAGE_TAG}" | gzip > "${DIST_DIR}/${DIST_NAME}.tar.gz"

# Get image size
IMAGE_SIZE=$(du -h "${DIST_DIR}/${DIST_NAME}.tar.gz" | cut -f1)

# Create README for clients
cat > "${DIST_DIR}/README-${VERSION}.txt" << EOF
Solace Queue Browser Web - Docker Image Distribution
====================================================

Version: ${VERSION}
Image Size: ${IMAGE_SIZE}

QUICK START:
-----------

1. Load the Docker image:
   docker load < ${DIST_NAME}.tar.gz

2. Run the container:
   docker run -d -p 3000:3000 --name solace-queue-browser ${IMAGE_TAG}

3. Access the application:
   Open your browser and navigate to: http://localhost:3000

STOPPING THE CONTAINER:
-----------------------
   docker stop solace-queue-browser
   docker rm solace-queue-browser

RUNNING WITH CUSTOM PORT:
-------------------------
   docker run -d -p 8080:8080 -e PORT=8080 --name solace-queue-browser ${IMAGE_TAG}
   Then access at: http://localhost:8080

NETWORK REQUIREMENTS:
---------------------
- Container needs outbound HTTPS access to Solace brokers
- Default port: 3000 (configurable via PORT environment variable)

TROUBLESHOOTING:
----------------
- Check container logs: docker logs solace-queue-browser
- Check if container is running: docker ps
- Restart container: docker restart solace-queue-browser

For more information, contact your Solace administrator.
EOF

echo ""
echo "✅ Distribution package created successfully!"
echo ""
echo "📁 Files created:"
echo "   - ${DIST_DIR}/${DIST_NAME}.tar.gz (${IMAGE_SIZE})"
echo "   - ${DIST_DIR}/README-${VERSION}.txt"
echo ""
echo "📤 To distribute:"
echo "   1. Send both files to your clients"
echo "   2. Clients follow instructions in README-${VERSION}.txt"
echo ""
