import classes from './styles.module.css';

const WELCOME_CONTENT = `# 🚀 Solace Queue Browser Web

**A web tool for browsing, inspecting and managing messages on Solace PubSub+ Event Brokers.**

---

## 📋 Overview

The **SolaceQueueBrowserWeb** is a web-based utility designed to help developers and operators inspect, analyze, and debug messages stored on Solace PubSub+ message broker queues. Whether you're troubleshooting message flow issues, verifying message content, or analyzing queue behavior, this tool provides an intuitive interface for bidirectional queue browsing with powerful filtering and inspection capabilities.

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

`;

function MarkdownRenderer({ content }) {
  // Simple markdown parser for basic formatting
  const parseMarkdown = (text) => {
    // Split into lines
    const lines = text.split('\n');
    const elements = [];
    let currentList = null;
    let currentParagraph = [];
    let inCodeBlock = false;
    let codeBlockLines = [];
    let codeBlockLang = '';

    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        const paraText = currentParagraph.join(' ').trim();
        if (paraText) {
          elements.push({ type: 'p', content: paraText });
        }
        currentParagraph = [];
      }
    };

    const flushList = () => {
      if (currentList) {
        elements.push(currentList);
        currentList = null;
      }
    };

    const processInline = (text) => {
      // Process bold **text**
      text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      // Process links [text](url)
      text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
      return text;
    };

    lines.forEach((line, index) => {
      // Code blocks
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          elements.push({ type: 'code', lang: codeBlockLang, content: codeBlockLines.join('\n') });
          codeBlockLines = [];
          codeBlockLang = '';
          inCodeBlock = false;
        } else {
          flushParagraph();
          flushList();
          codeBlockLang = line.trim().substring(3).trim();
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeBlockLines.push(line);
        return;
      }

      // Headers
      if (line.startsWith('# ')) {
        flushParagraph();
        flushList();
        elements.push({ type: 'h1', content: line.substring(2).trim() });
        return;
      }
      if (line.startsWith('## ')) {
        flushParagraph();
        flushList();
        elements.push({ type: 'h2', content: line.substring(3).trim() });
        return;
      }
      if (line.startsWith('### ')) {
        flushParagraph();
        flushList();
        elements.push({ type: 'h3', content: line.substring(4).trim() });
        return;
      }

      // Horizontal rule
      if (line.trim() === '---') {
        flushParagraph();
        flushList();
        elements.push({ type: 'hr' });
        return;
      }

      // Blockquotes/Notes
      if (line.trim().startsWith('> ')) {
        flushParagraph();
        flushList();
        const noteContent = line.substring(2).trim();
        if (noteContent.includes('[!IMPORTANT]') || noteContent.includes('[!NOTE]') || noteContent.includes('⚠️')) {
          elements.push({ type: 'note', content: noteContent.replace(/\[!IMPORTANT\]|\[!NOTE\]/g, '').trim() });
        } else {
          elements.push({ type: 'p', content: noteContent, className: classes.note });
        }
        return;
      }

      // Lists
      if (line.trim().startsWith('- ') || line.trim().match(/^\d+\.\s/)) {
        flushParagraph();
        if (!currentList) {
          currentList = { type: 'ul', items: [] };
        }
        const itemText = line.replace(/^[-*]\s+|^\d+\.\s+/, '').trim();
        currentList.items.push(processInline(itemText));
        return;
      }

      // Empty line
      if (line.trim() === '') {
        flushParagraph();
        flushList();
        return;
      }

      // Regular paragraph
      if (line.trim().startsWith('<div') || line.trim().startsWith('</div>')) {
        // Skip HTML div tags
        return;
      }

      currentParagraph.push(processInline(line.trim()));
    });

    flushParagraph();
    flushList();

    return elements;
  };

  const elements = parseMarkdown(content);

  return (
    <>
      {elements.map((el, index) => {
        switch (el.type) {
          case 'h1':
            return <h1 key={index} className={classes.title}>{el.content}</h1>;
          case 'h2':
            return <h2 key={index} className={classes.section}>{el.content}</h2>;
          case 'h3':
            return <h3 key={index} className={classes.section}>{el.content}</h3>;
          case 'p':
            return (
              <p 
                key={index} 
                className={el.className} 
                dangerouslySetInnerHTML={{ __html: el.content }} 
              />
            );
          case 'ul':
            return (
              <ul key={index}>
                {el.items.map((item, i) => (
                  <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
                ))}
              </ul>
            );
          case 'code':
            return (
              <pre key={index} className={classes.codeBlock}>
                <code>{el.content}</code>
              </pre>
            );
          case 'note':
            return (
              <div key={index} className={classes.note} dangerouslySetInnerHTML={{ __html: el.content }} />
            );
          case 'hr':
            return <hr key={index} className={classes.hr} />;
          default:
            return null;
        }
      })}
    </>
  );
}

export default function WelcomeScreen() {
  return (
    <div className={classes.welcomeContainer}>
      <div className={classes.welcomeContent}>
        <MarkdownRenderer content={WELCOME_CONTENT} />
      </div>
    </div>
  );
}
