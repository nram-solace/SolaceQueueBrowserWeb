# 🚀 Solace Queue Browser Web
Version: v2.2.6

**A web tool for browsing, inspecting and managing messages on Solace PubSub+ Event Brokers.**

---

## 📋 Overview

The **Solace Queue Browser** is a web-based utility designed to help developers and operators inspect, analyze, and debug messages stored on Solace PubSub+ message broker queues. Whether you're troubleshooting message flow issues, verifying message content, or analyzing queue behavior, this tool provides an intuitive interface for bidirectional queue browsing with powerful filtering and inspection capabilities.

The tool supports all Solace broker deployment types including Solace Cloud, Solace Appliances, Software Brokers, and AEM brokers, ensuring you can work with your infrastructure regardless of how it's deployed.

---

## ✨ Key Features

### 🌐 Cross-Platform Broker Support

Connect to any Solace PubSub+ broker deployment:

- **☁️ Solace Cloud Brokers** - Connect to managed Solace Cloud instances
- **🏢 Solace Appliances** - Support for hardware appliance deployments
- **💻 Software Brokers** - Connect to self-hosted software broker instances
- **🔧 AEM Brokers** - Support for Adobe Experience Manager (AEM) broker configurations

The tool works seamlessly across all Solace broker deployment types, providing a consistent experience regardless of your infrastructure.

### 📝 Message Browsing

Comprehensive message viewing with multiple panels:

- **📄 Payload View** - View message body in formatted JSON, text, or raw format
- **📋 Headers View** - Inspect all message headers and properties
- **🏷️ User Properties** - View custom user-defined properties
- **ℹ️ Metadata** - Access message metadata including timestamps, IDs, and delivery info

### 🔍 Filtering & Search

- **Client-side Payload Filtering** - Filter messages by content anywhere in the message - payload or headers including user properties.

### 📤 Message Operations

Manage messages across queues with powerful operations:

- **📋 Copy Messages** - Copy messages from one queue to another while keeping the original message in the source queue
- **➡️ Move Messages** - Move messages from one queue to another by copying to destination and deleting from source
- **🗑️ Delete Messages** - Delete messages directly from queues

### 🔄 Ordering

- **📌 FIFO** - Browse messages in the spooled order. This is the default sort order and fully supported.

> 💡 Note: Pagination is supported with default sort order, but backward navigation between pages is not supported.

### Bi-directions using Solace's replay log functionality:

- **📌 From Queue Head** - Start from the oldest message
- **📌 From Queue Tail** - Start from the newest message  
- **📌 From Date/Time** - Jump to a specific timestamp
- **📌 From Message ID** - Navigate to a specific message by RGMID or Message ID

> 💡 Note: Bi-directional navigation between pages is experimental and require replay to be enabled on your Solace broker


---

## 📖 How to Use

### Connect to a Broker

<!-- SCREENSHOT: Add screenshot of broker connection dialog -->
<!-- ![Broker Connection](docs/screenshots/broker-connection.png) -->

Click the **➕ Add Broker** button in the left panel and enter your broker connection details:
- **Broker URL** - Your Solace broker endpoint
- **VPN Name** - Message VPN name
- **SEMP Credentials** - Username and password for SEMP API
- **Messaging Credentials** - Username and password for messaging API

### Browse a Queue

<!-- SCREENSHOT: Add screenshot of queue tree view -->
<!-- ![Queue Tree View](docs/screenshots/queue-tree.png) -->

Expand your broker connection in the left panel, navigate to the **Queues** section, and select a queue. Choose your browse mode:
- **Default** - Forward-only browsing (no replay required)
- **From Head** - Start from oldest message
- **From Tail** - Start from newest message
- **From Time** - Jump to specific timestamp
- **From Message ID** - Navigate to specific message

### Navigate Messages

<!-- SCREENSHOT: Add screenshot of message list with navigation controls -->
<!-- ![Message Navigation](docs/screenshots/message-navigation.png) -->

Use the navigation controls to move through messages:
- **⬅️ Previous Page** - Navigate to older messages
- **➡️ Next Page** - Navigate to newer messages
- **🔍 Filter** - Apply filters to narrow down messages
- **📊 View Details** - Click a message to view full details in right panels

### Inspect Message Details

<!-- SCREENSHOT: Add screenshot of message detail panels -->
<!-- ![Message Details](docs/screenshots/message-details.png) -->

When you select a message, four detail panels appear:

1. **Payload Panel** - Message body content with JSON formatting, text view, raw binary view, and syntax highlighting

2. **Headers Panel** - Standard message headers including destination, delivery mode, priority, expiration, and more

3. **User Properties Panel** - Custom properties displayed as key-value pairs in a searchable format

4. **Metadata Panel** - Message metadata including Message ID / RGMID, timestamps, sequence numbers, and delivery information

### Copy, Move, or Delete Messages

<!-- SCREENSHOT: Add screenshot of message operations (copy/move/delete buttons) -->
<!-- ![Message Operations](docs/screenshots/message-operations.png) -->

Select a message in the message list and use the action buttons to:

- **📋 Copy Message** - Click the copy button to copy the message to another queue. A dialog will appear to select the destination queue. The original message remains in the source queue.

- **➡️ Move Message** - Click the move button to move the message to another queue. You'll be asked to confirm the operation, then select the destination queue. The message will be copied to the destination and deleted from the source queue.

- **🗑️ Delete Message** - Click the delete button to permanently remove the message from the current queue. You'll be asked to confirm before deletion.

> ⚠️ **Note:** Copy and move operations require the message to have a Replication Group Message ID (RGMID). Messages without RGMID cannot be copied or moved.

---

## 📸 Screenshots

### Main Interface

<!-- SCREENSHOT: Add full application screenshot showing all panels -->
<!-- ![Main Interface](docs/screenshots/main-interface.png) -->

*The main interface showing broker tree, message list, and detail panels*

### Queue Browsing

<!-- SCREENSHOT: Add screenshot of queue browsing with different modes -->
<!-- ![Queue Browsing](docs/screenshots/queue-browsing.png) -->

*Browsing a queue with multiple browse modes available*

### Message Filtering

<!-- SCREENSHOT: Add screenshot of filtering interface -->
<!-- ![Message Filtering](docs/screenshots/message-filtering.png) -->

*Filtering messages by payload content or headers*

### JSON Payload View

<!-- SCREENSHOT: Add screenshot of formatted JSON payload -->
<!-- ![JSON Payload](docs/screenshots/json-payload.png) -->

*Formatted JSON payload with syntax highlighting*

### Message Headers

<!-- SCREENSHOT: Add screenshot of headers panel -->
<!-- ![Message Headers](docs/screenshots/message-headers.png) -->

*Detailed view of message headers and properties*

### Message Operations

<!-- SCREENSHOT: Add screenshot showing copy/move/delete operations -->
<!-- ![Message Operations](docs/screenshots/message-operations.png) -->

*Copy, move, or delete messages with queue selection dialog*

---

## ⚠️ Important Notes

### Replay Log Requirements

> ⚠️ **IMPORTANT:** Most advanced features require replay to be enabled on your Solace broker.

The tool assumes:
- All messages on a queue are present in the Replay Log
- Replay log has not been trimmed while messages remain on the queue
- Replay filtering doesn't create mixed replayable/non-replayable message sets

### Browser Mode Requirements

When running in browser mode:
- **CORS Configuration** - Broker SEMP service must allow cross-origin requests
- **TLS Matching** - Browser and broker TLS configuration must match
  - HTTP site → HTTP broker
  - HTTPS site → HTTPS broker

### Known Behaviors

- Messages acknowledged out-of-order may still appear in the queue view
- Binary payloads may not be fully retrievable in some scenarios

---

## 🔮 Planned Features


---

## 📚 Additional Resources

