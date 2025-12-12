# Docker Configuration

This directory contains all files required for Dockerizing the Solace Queue Browser Web application.

## Files

- **Dockerfile** - Multi-stage Docker build configuration
- **docker-compose.yml** - Docker Compose configuration for easy deployment
- **.dockerignore** - Files to exclude from Docker build context
- **proxy-server.js** - Node.js proxy server that serves the app and proxies SEMP API requests
- **create-docker-dist.sh** - Script to create pre-built Docker image distribution
- **run-docker.sh** - Convenience script to build and run the container

## Usage

### Using Docker Compose (Recommended)

From the project root directory:

```bash
docker-compose -f docker/docker-compose.yml up -d
```

Or use the convenience script:

```bash
./docker/run-docker.sh
```

### Using Docker directly

From the project root directory:

```bash
# Build the image
docker build -f docker/Dockerfile -t solace-queue-browser .

# Run the container
docker run -p 3000:3000 solace-queue-browser
```

## Build Context

The Docker build context is set to the project root directory (`..`), so all files in the project are available during the build. The Dockerfile is located in the `docker/` directory.

## Port

The application runs on port 3000 by default. Change it by setting the `PORT` environment variable:

```bash
docker run -p 8080:8080 -e PORT=8080 solace-queue-browser
```

## Health Check

The container includes a health check that verifies the server is responding on port 3000.

---

# Quick Start: Distributing to Clients

## Recommended Method: Pre-built Docker Image

### Step 1: Create the Distribution Package

```bash
cd /path/to/SolaceQueueBrowserWeb
./docker/create-docker-dist.sh
```

**Note:** If you don't specify a version, the script automatically uses `APP_VERSION` from `src/config/version.js` (currently `2.3.8`).

To use a specific version:
```bash
./docker/create-docker-dist.sh v1.0.0
```

This creates:
- `dist-docker/solace-queue-browser-2.3.8.tar.gz` (Docker image - version matches APP_VERSION)
- `dist-docker/README-2.3.8.txt` (Client instructions)

### Step 2: Share with Clients

Send both files to your clients:
1. `solace-queue-browser-2.3.8.tar.gz` (the Docker image)
2. `README-2.3.8.txt` (instructions)

### Step 3: Client Instructions (included in README)

Clients simply need to:

```bash
# Load the image
docker load < solace-queue-browser-2.3.8.tar.gz

# Run the container
docker run -d -p 3000:3000 --name solace-queue-browser solace-queue-browser:2.3.8

# Access at http://localhost:3000
```

That's it! No build process, no dependencies, no source code.

---

# Distribution Guide for Clients

This guide explains how to distribute the Solace Queue Browser Web application to clients.

## Distribution Options

You have **three options** for distributing the application to clients:

### Option 1: Pre-built Docker Image (Recommended - Easiest for Clients)

**Best for:** Clients who just want to run the application without building anything.

**What to share:**
- A Docker image tarball (`.tar` or `.tar.gz` file)
- Simple instructions

**Steps to create distribution:**

Use the provided script (automatically uses `APP_VERSION` from `src/config/version.js`):
```bash
./docker/create-docker-dist.sh
```

Or manually:
1. Build the Docker image:
   ```bash
   docker build -f docker/Dockerfile -t solace-queue-browser:2.3.8 .
   ```

2. Save the image to a tarball:
   ```bash
   docker save solace-queue-browser:2.3.8 | gzip > solace-queue-browser-2.3.8.tar.gz
   ```

3. Share the tarball file with clients

**Note:** The version tag should match `APP_VERSION` in `src/config/version.js` for consistency.

**Client instructions:**
```bash
# Load the image
docker load < solace-queue-browser-2.3.8.tar.gz

# Run the container
docker run -d -p 3000:3000 --name solace-queue-browser solace-queue-browser:2.3.8

# Access at http://localhost:3000
```

**Pros:**
- ✅ No build process required for clients
- ✅ Fastest deployment
- ✅ Consistent environment
- ✅ No source code exposure

**Cons:**
- ❌ Larger file size (~200-300MB)
- ❌ Platform-specific (may need separate images for different architectures)

---

### Option 2: Docker Build Files (For Clients Who Want to Build)

**Best for:** Clients who want to build the image themselves or customize the build.

**What to share:**
- The entire `docker/` folder
- `package.json` and `package-lock.json` (for build context)
- Build instructions

**Steps to create distribution:**

1. Create a distribution package:
   ```bash
   # Create distribution directory
   mkdir -p dist-docker/solace-queue-browser-docker
   
   # Copy Docker files
   cp -r docker/* dist-docker/solace-queue-browser-docker/
   
   # Copy package files (needed for build)
   cp package.json package-lock.json dist-docker/solace-queue-browser-docker/
   
   # Create README
   cat > dist-docker/solace-queue-browser-docker/README.md << 'EOF'
   # Solace Queue Browser Web - Docker Build Package
   
   ## Prerequisites
   - Docker installed
   - Internet connection (for npm packages during build)
   
   ## Building
   
   From this directory:
   ```bash
   docker build -f Dockerfile -t solace-queue-browser .
   ```
   
   Note: The build context should be the project root, so you may need to adjust paths.
   
   ## Running
   ```bash
   docker run -d -p 3000:3000 --name solace-queue-browser solace-queue-browser
   ```
   
   Access at http://localhost:3000
   EOF
   
   # Create tarball
   cd dist-docker
   tar -czf solace-queue-browser-docker.tar.gz solace-queue-browser-docker
   ```

**Client instructions:**
- Extract the tarball
- Follow the README.md instructions
- Build and run the Docker image

**Pros:**
- ✅ Clients can customize the build
- ✅ Smaller distribution size
- ✅ Can inspect Dockerfile

**Cons:**
- ❌ Requires Docker and build time
- ❌ Requires internet during build
- ❌ More complex for clients

---

### Option 3: Standalone Distribution Package (Node.js)

**Best for:** Clients who don't have Docker or prefer Node.js deployment.

**What to share:**
- Use the existing `package-dist.sh` script (if available)

**Steps:**
```bash
./package-dist.sh v1.0.0
```

This creates `dist-package/solace-queue-browser-v1.0.0.tar.gz` containing:
- Built static files
- `proxy-server.js`
- README with instructions

**Client instructions:**
- Extract the tarball
- Option 1: Run with Node.js (requires Node.js 18+)
  ```bash
  node proxy-server.js
  ```
- Option 2: Use Docker (if they have Docker)
  ```bash
  # Create a simple Dockerfile in the extracted directory
  echo "FROM node:20-alpine
  WORKDIR /app
  COPY . .
  RUN npm install -g http-server
  EXPOSE 3000
  CMD [\"node\", \"proxy-server.js\"]" > Dockerfile
  docker build -t solace-queue-browser .
  docker run -p 3000:3000 solace-queue-browser
  ```

**Pros:**
- ✅ Works without Docker
- ✅ Smaller file size
- ✅ Flexible deployment options

**Cons:**
- ❌ Requires Node.js runtime (for Option 1)
- ❌ Clients need to manage dependencies

---

## Recommended Approach

**For most clients, use Option 1 (Pre-built Docker Image)** because:
- It's the simplest for clients
- No build process required
- Consistent, tested environment
- Fast deployment

## Creating the Distribution Package

Use the provided script to create a pre-built Docker image distribution:

```bash
./docker/create-docker-dist.sh
```

**Automatic Version Detection:**
- If no version is specified, the script automatically reads `APP_VERSION` from `src/config/version.js`
- This ensures the Docker image version matches the application version
- Currently uses version: `2.3.8` (from `src/config/version.js`)

**Manual Version:**
```bash
./docker/create-docker-dist.sh v1.0.0
```

This will create `dist-docker/solace-queue-browser-2.3.8.tar.gz` ready for distribution.

## Security Considerations

- **Pre-built images:** Source code is bundled but minified/obfuscated
- **Docker files:** Source code is not included (only built `dist/` folder)
- **Standalone package:** Source code is not included (only built files)

All distribution methods exclude source code from the repository.

## File Sizes (Approximate)

- Pre-built Docker image: ~200-300MB (compressed: ~100-150MB)
- Docker build files: ~5-10MB
- Standalone package: ~5-10MB
