import classes from './styles.module.css';

const WELCOME_CONTENT = `# 🔍 SolQBrowser/Web

**A tool for browsing, inspecting, and managing messages on Solace PubSub+ Event Brokers.**

SolQBrowser/Web is a cross-platform utility that runs as a **desktop application** (Windows, Mac, Linux), **fully in-browser**, or as a **Docker container**. It provides comprehensive queue browsing capabilities, message inspection, and bulk operations for managing messages on Solace brokers.

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
- ⚙️ **Optional Feature** - Advanced browsing modes are disabled by default and can be enabled via Settings (gear icon in left panel)

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

### ⚙️ Settings & Customization

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

> **💡 Tip:** Advanced replay features are hidden by default. Enable them via the Settings icon (⚙️) in the left panel toolbar if you need bidirectional browsing or time-based navigation.

**⚠️ Constraints:** Advanced features assume all queue messages are present in the Replay Log. Unexpected behavior may occur if:
- Replay log has been trimmed while messages remain on queue
- Replay filtering creates mixed replayable/non-replayable message sets
- Messages were acknowledged out-of-order

### Connection Setup

1. **➕ Add Broker** - Click to configure broker connection
2. **🔐 Enter Credentials**:
   - Broker URL
   - VPN Name
   - SEMP API credentials
   - Messaging API credentials
3. **✅ Connect** - Select a queue from the tree view and start browsing

---
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