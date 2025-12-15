#!/bin/bash
# Create a pre-built Docker image distribution package for clients
# Usage: ./create-docker-dist.sh [version]
# If no version is provided, it will use APP_VERSION from src/config/version.js

set -e

# ---- Configuration ----
PLATFORMS=("linux/amd64" "linux/arm64")
BUILDER_NAME="solace-queue-browser-multiarch"

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
echo "   Platforms: ${PLATFORMS[*]}"
echo ""

# Change to project root
cd "$PROJECT_ROOT"

# Create distribution directory
mkdir -p "${DIST_DIR}"

# Ensure buildx builder exists and is usable
if ! docker buildx inspect "${BUILDER_NAME}" >/dev/null 2>&1; then
  echo "🧰 Creating docker buildx builder: ${BUILDER_NAME}"
  docker buildx create --name "${BUILDER_NAME}" --use >/dev/null
else
  echo "🧰 Using docker buildx builder: ${BUILDER_NAME}"
  docker buildx use "${BUILDER_NAME}" >/dev/null
fi

# Bootstrapping helps ensure QEMU/binfmt is ready for cross-builds (esp. on CI)
docker buildx inspect --bootstrap >/dev/null

declare -a CREATED_FILES=()
declare -a IMAGE_SIZES=()

# Build and export one image tarball per platform (portable for clients)
for PLATFORM in "${PLATFORMS[@]}"; do
  ARCH="${PLATFORM#linux/}"
  ARCH_TAG="${IMAGE_TAG}-${ARCH}"
  ARCH_DIST_NAME="${DIST_NAME}-${ARCH}"
  ARCH_TARBALL="${DIST_DIR}/${ARCH_DIST_NAME}.tar.gz"

  echo ""
  echo "🔨 Building Docker image for ${PLATFORM}..."
  # --load only supports single-platform builds (we loop per platform)
  docker buildx build \
    --platform "${PLATFORM}" \
    -f docker/Dockerfile \
    -t "${ARCH_TAG}" \
    --load \
    .

  echo "💾 Saving Docker image to tarball (${PLATFORM})..."
  docker save "${ARCH_TAG}" | gzip > "${ARCH_TARBALL}"

  ARCH_IMAGE_SIZE=$(du -h "${ARCH_TARBALL}" | cut -f1)
  CREATED_FILES+=("${ARCH_TARBALL}")
  IMAGE_SIZES+=("${ARCH}:${ARCH_IMAGE_SIZE}")

  # Optional: remove the arch-tagged image from local daemon to save space
  # docker rmi "${ARCH_TAG}" >/dev/null 2>&1 || true
done

# Create README for clients
cat > "${DIST_DIR}/README-${VERSION}.txt" << EOF
Solace Queue Browser Web - Docker Image Distribution
====================================================

Version: ${VERSION}
Images:
$(printf '%s\n' "${IMAGE_SIZES[@]}" | sed 's/^/ - /')

QUICK START:
-----------

1. Choose the correct image for your Docker host architecture:
   - amd64 (x86_64 Intel/AMD): ${DIST_NAME}-amd64.tar.gz
   - arm64 (Apple Silicon / ARM servers): ${DIST_NAME}-arm64.tar.gz

2. Load the Docker image:
   docker load < ${DIST_NAME}-<amd64|arm64>.tar.gz

3. Run the container:
   docker run -d -p 3000:3000 --name solace-queue-browser ${IMAGE_TAG}-<amd64|arm64>

4. Access the application:
   Open your browser and navigate to: http://localhost:3000

STOPPING THE CONTAINER:
-----------------------
   docker stop solace-queue-browser
   docker rm solace-queue-browser

RUNNING WITH CUSTOM PORT:
-------------------------
   docker run -d -p 8080:8080 -e PORT=8080 --name solace-queue-browser ${IMAGE_TAG}-<amd64|arm64>
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
for F in "${CREATED_FILES[@]}"; do
  echo "   - ${F}"
done
echo "   - ${DIST_DIR}/README-${VERSION}.txt"
echo ""
echo "📤 To distribute:"
echo "   1. Send the README and BOTH tar.gz files to your clients"
echo "   2. Clients load the correct tar.gz for their host architecture"
echo ""
