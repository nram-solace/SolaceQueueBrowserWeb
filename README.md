# 🔍 SolQBrowser/Web 

**A  tool for browsing, inspecting, and managing messages on Solace PubSub+ Event Brokers.**

SolQBrowser/Web is a cross-platform utility that runs as a **desktop application** (Windows, Mac, Linux), **fully in-browser**, or as a **Docker container**. It provides comprehensive queue browsing capabilities, message inspection, and bulk operations for managing messages on Solace brokers.

> **🌐 Try it now:** A public browser-based version is available at [solace-queue-browser-web.vercel.app](https://solace-queue-browser-web.vercel.app/)
>
> **🔒 Privacy:** The web version runs entirely in your browser. No data is shared or stored outside your local machine. All connections are made directly from your browser to your broker.

---

## ✨ Key Features

### 🌐 Universal Broker Support

Connect to any Solace PubSub+ broker deployment type:

- **☁️ Solace Cloud** - Managed cloud instances
- **🔧 AEM Brokers** - SAP Advanced Event Mesh deployments
- **💻 Software Brokers** - Self-hosted broker instances
- **🏢 Solace Appliances** - Hardware appliance deployments

### 📊 Advanced Queue Browsing

**Message Browsing**:
- ➡️ Forward-only queue browsing with pagination
- 📄 **Page Navigation** - "Page n of N" indicator shows current position in paginated lists
- 🔍 Client-side filtering (payload, headers, user properties)
- 📄 Message content inspection and formatting
- ✅ Works with any queue configuration

**Advanced Browsing** (Requires replay logs, can be enabled in Settings):
- ⬅️➡️ Bidirectional navigation (forward and backward)
- 📌 Start from **oldest message** (queue head)
- 📌 Start from **newest message** (queue tail)
- 🕐 Jump to specific **date/time**
- 🔢 Navigate to specific **message by ID** (RGMID or Message ID)
- ⚙️ **Optional Feature** - Advanced browsing modes are disabled by default and can be enabled via Settings (⚙️ icon in left panel)

### 🔍 Message Inspection & Analysis

Multi-panel message viewing with comprehensive details:

- **📄 Payload View** - JSON formatting, text view, raw binary with syntax highlighting
- **📋 Headers View** - All message headers and properties
- **🏷️ User Properties** - Custom key-value properties in searchable format
- **ℹ️ Metadata** - Message IDs, timestamps, sequence numbers, delivery info

### 🔄 Bulk Message Operations

Manage messages across queues with powerful batch operations:

- **📋 Copy Messages** - Copy selected messages to another queue (source preserved)
- **➡️ Move Messages** - Move messages between queues (copy + delete)
- **🗑️ Delete Messages** - Bulk delete with progress tracking
- **⏱️ Progress Monitoring** - Real-time progress bars and operation status
- **📊 Results Summary** - Detailed success/failure reports

### 🔎 Search & Filtering

- **🔍 Global Search** - Filter messages by content across payload, headers, and user properties
- **⚡ Client-side Filtering** - Instant results without server round-trips
- **📝 Multi-field Search** - Search across all message components simultaneously
- **❌ Clear Search** - Quick reset button to clear search filters

### 🗂️ Broker Organization

- **📁 Group by Environment** - Organize brokers by environment (LAB, DEV, PROD, etc.)
- **📁 Group by Type** - Group by broker type (Cloud, Software, Appliance, etc.)
- **📁 Group by Region** - Organize by geographic region
- **🔍 Flexible Views** - Switch between grouped and flat list views

### 🔐 Session Management

- **💾 Save & Restore** - Save broker connections and restore across sessions
- **🔒 Encrypted Export** - Export sessions to password-protected encrypted files
- **📥 Import Sessions** - Import encrypted session files with automatic decryption
- **🔄 Persistent Storage** - Sessions stored locally in browser or as encrypted files


### 🌐 Proxy Support

- **✅ Automatic CORS Handling** - Built-in proxy eliminates broker CORS configuration requirements
- **🐳 Docker Proxy** - Container deployment includes proxy server
- **☁️ Vercel Deployment** - Serverless proxy for production web deployments
- **🔧 Development Proxy** - Automatic proxy in dev mode
- **🎯 Zero Configuration** - Works with any broker without CORS setup  

### ⚙️ Customization

- **🎛️ Optional Features** - Enable/disable advanced replay features via Settings dialog
- **💾 Persistent Preferences** - Settings saved to browser storage across sessions
- **🎨 Theme Support** - Light and dark theme options

---

## 🎯 Use Cases

- 🔧 **Troubleshooting** - Inspect queue contents and message flow
- 🐛 **Debugging** - Analyze message payloads and headers
- 📊 **Analysis** - Review message patterns and content
- 🔄 **Migration** - Copy or move messages between queues
- 🧹 **Cleanup** - Bulk delete unwanted messages
- ✅ **Verification** - Confirm message content and structure

---

## ⚠️ Important Requirements

### Replay Log Support

> **📌 Basic Browsing** works with **any queue** - replay logs are NOT required.

**Advanced features require replay logs enabled** (can be enabled in Settings):
- Bidirectional browsing (head/tail navigation)
- Time-based browsing
- Message ID navigation

> **💡 Tip:** Advanced replay features are disabled by default. Enable them via the Settings icon (⚙️) in the left panel toolbar if you need bidirectional browsing or time-based navigation.

**⚠️ Constraints:** Advanced features assume all queue messages are present in the Replay Log. Unexpected behavior may occur if:
- Replay log has been trimmed while messages remain on queue
- Replay filtering creates mixed replayable/non-replayable message sets
- Messages were acknowledged out-of-order

### Browser Mode Configuration

When running in browser mode:
- **✅ Automatic CORS Handling** - Proxy support eliminates the need for broker CORS configuration
- **🔒 TLS Matching** - Browser and broker TLS must match (HTTP ↔ HTTP, HTTPS ↔ HTTPS)

### 🐳 Docker Mode Benefits

Docker mode provides several advantages:
- **✅ No CORS Configuration** - Built-in proxy server handles CORS automatically
- **✅ Easy Deployment** - Containerized deployment with consistent environment
- **✅ Health Checks** - Built-in health monitoring
- **✅ Distribution Ready** - Pre-built images for easy client distribution
- **✅ Port Flexibility** - Configurable port via environment variable

---

## 🚀 Quick Start

### 🐳 Docker Mode (Recommended for Server Deployment)

Docker mode includes a built-in proxy server that handles CORS, eliminating the need to configure broker CORS settings.

**Using Docker Compose:**
```bash
docker-compose -f docker/docker-compose.yml up -d
```

**Using Docker directly:**
```bash
# Build the image
docker build -f docker/Dockerfile -t solace-queue-browser .

# Run the container
docker run -p 3000:3000 solace-queue-browser
```

Access at `http://localhost:3000`

**Custom Port:**
```bash
docker run -p 3030:3030 -e PORT=3030 solace-queue-browser
```

**Pre-built Docker Image Distribution:**
```bash
# Create distributable package (uses version from src/config/version.js)
./docker/create-docker-dist.sh

# Clients can then load and run:
docker load < dist-docker/solace-queue-browser-*.tar.gz
docker run -d -p 3000:3000 --name solace-queue-browser solace-queue-browser:<version>
```

### 🌐 Browser Mode

```bash
npm install
npm run dev
```

Navigate to `http://localhost:1420/`

### 🖥️ Desktop Mode

Prerequisites: Rust compiler (see [Tauri prerequisites](https://v1.tauri.app/v1/guides/getting-started/prerequisites/))

```bash
npm install
npm run tauri dev
```

### Connection Setup

1. **➕ Add Broker** - Click to configure broker connection
2. **🔐 Enter Credentials**:
   - Broker URL (management host and port)
   - SEMP API credentials
   - Messaging API credentials
3. **🔍 Discover VPNs** - Click "Get VPNs" to automatically discover available message VPNs
4. **✅ Connect** - Select VPN(s), test connection, and save. Select a queue from the tree view to start browsing

---

## 🏗️ Architecture

Built with modern web technologies:

- **⚛️ React** - UI framework
- **🎨 PrimeReact** - Component library
- **📦 Solace JavaScript API** - Messaging client
- **🖥️ Tauri** - Desktop application framework (optional)
- **🔌 SEMP API** - Broker management

All UI components are written in HTML/JS using the Prime React component library.

---

## 📖 Publishing to GitHub Pages

The app is published to GitHub Pages on the `gh-pages` branch:

```bash
git checkout gh-pages
git pull origin main
npm run build
npm run publish latest
npm run preview  # Verify at http://localhost:4173/latest/
git add -A
git commit -a -m "Update latest with new feature ..."
git push origin gh-pages
```

---

## 🔮 Planned Features

## 📄 License

See [LICENSE](LICENSE) file for details.
