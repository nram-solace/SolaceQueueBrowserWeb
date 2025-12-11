import { useState, useEffect } from 'react';
import welcomeMd from '../../../welcome.md?raw';
import classes from './styles.module.css';

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
  const [content, setContent] = useState('');

  useEffect(() => {
    // Load the markdown file
    setContent(welcomeMd);
  }, []);

  return (
    <div className={classes.welcomeContainer}>
      <div className={classes.welcomeContent}>
        <MarkdownRenderer content={content} />
      </div>
    </div>
  );
}
