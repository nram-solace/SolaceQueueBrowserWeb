import { useRef, useState, useMemo, useEffect } from 'react';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import classes from './styles.module.css';
import JsonView from 'react18-json-view';
import 'react18-json-view/src/style.css'
import { BINARY_PAYLOAD_NOT_AVAILABLE } from '../../hooks/solace';
import { copyToClipboard } from '../../utils/clipboard';
import { showSuccessToast, showErrorToast } from '../../utils/toast';
import PropTypes from 'prop-types';

const VIEW_MODES = {
  RAW: 'raw',
  FORMATTED: 'formatted',
  COLOR: 'color'
};

// Helper functions - defined outside component to avoid hoisting issues
function isJson(payload) {
  try {
    JSON.parse(payload);
    return true;
  } catch (e) {
    return false;
  }
}

function isXml(payload) {
  if (typeof payload !== 'string') {
    return false;
  }
  // Check if it looks like XML (starts with < and contains XML-like structure)
  const trimmed = payload.trim();
  if (!trimmed.startsWith('<')) {
    return false;
  }
  // Try to parse it as XML
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(payload, 'text/xml');
    // Check for parser errors
    const parserError = doc.querySelector('parsererror');
    return !parserError;
  } catch (e) {
    return false;
  }
}

function formatXml(xmlString) {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    
    // Check for XML declaration
    const hasDeclaration = xmlString.trim().startsWith('<?xml');
    let declaration = '';
    if (hasDeclaration) {
      const declarationMatch = xmlString.match(/^<\?xml[^>]*\?>/);
      if (declarationMatch) {
        declaration = declarationMatch[0] + '\n';
      }
    }
    
    // Format with indentation
    let formatted = '';
    const formatNode = (node, indent = '') => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName;
        const attrs = Array.from(node.attributes)
          .map(attr => ` ${attr.name}="${attr.value}"`)
          .join('');
        
        // Get all child nodes
        const childNodes = Array.from(node.childNodes);
        
        // Separate element children from text children
        const elementChildren = childNodes.filter(child => child.nodeType === Node.ELEMENT_NODE);
        const textChildren = childNodes.filter(
          child => child.nodeType === Node.TEXT_NODE && child.textContent?.trim()
        );
        
        // Check if element has only text content (no nested elements)
        const hasOnlyText = elementChildren.length === 0 && textChildren.length > 0;
        
        if (elementChildren.length === 0 && textChildren.length === 0) {
          // Self-closing or empty element
          formatted += indent + `<${tagName}${attrs} />\n`;
        } else if (hasOnlyText) {
          // Element with only text content - put on one line
          const textContent = textChildren.map(t => t.textContent.trim()).join(' ');
          formatted += indent + `<${tagName}${attrs}>${textContent}</${tagName}>\n`;
        } else {
          // Element with nested elements - each on its own line
          formatted += indent + `<${tagName}${attrs}>\n`;
          // Process each child node separately
          childNodes.forEach(child => {
            if (child.nodeType === Node.ELEMENT_NODE) {
              formatNode(child, indent + '  ');
            } else if (child.nodeType === Node.TEXT_NODE) {
              const text = child.textContent?.trim();
              if (text) {
                formatted += indent + '  ' + text + '\n';
              }
            }
          });
          formatted += indent + `</${tagName}>\n`;
        }
      }
    };
    
    formatNode(xmlDoc.documentElement);
    return (declaration + formatted.trim()).trim();
  } catch (e) {
    // If formatting fails, return original
    return xmlString;
  }
}

export default function MessagePayloadView({ message, onHeaderTemplate }) {
  const toast = useRef(null);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState(VIEW_MODES.COLOR);
  
  // All hooks must be called before any conditional returns
  // Color palette for matching XML tags
  const tagColors = useMemo(() => [
    '#e06c75', // Red
    '#61afef', // Blue
    '#98c379', // Green
    '#d19a66', // Orange
    '#c678dd', // Purple
    '#56b6c2', // Cyan
    '#e5c07b', // Yellow
    '#be5046', // Dark Red
    '#528bff', // Light Blue
    '#7f848e', // Gray
  ], []);

  const renderXmlWithSyntaxHighlighting = useMemo(() => {
    return function(xmlString) {
      try {
        const formatted = formatXml(xmlString);
        const tagColorMap = new Map();
        const parts = [];
        let currentIndex = 0;

        // Regular expression to match XML tags, attributes, and text
        const xmlRegex = /(<\?xml[^>]*\?>)|(<\/?[^\s>]+(?:\s+[^>]*)?>)|([^<]+)/g;
        let match;

        const getTagColorIndex = (tagName, tagMap) => {
          if (!tagMap.has(tagName)) {
            tagMap.set(tagName, tagMap.size % tagColors.length);
          }
          return tagMap.get(tagName);
        };

        while ((match = xmlRegex.exec(formatted)) !== null) {
          const [fullMatch, declaration, tag, text] = match;
          const matchIndex = match.index;

          // Add any text before this match (preserve newlines and whitespace)
          if (matchIndex > currentIndex) {
            const textBefore = formatted.substring(currentIndex, matchIndex);
            // Preserve whitespace and newlines - they're important for formatting
            if (textBefore) {
              parts.push({ type: 'whitespace', content: textBefore });
            }
          }

          if (declaration) {
            // XML declaration
            parts.push({ type: 'declaration', content: declaration });
          } else if (tag) {
            // XML tag
            const isClosing = tag.startsWith('</');
            const isSelfClosing = tag.endsWith('/>');
            const tagMatch = tag.match(/<\/?([^\s/>]+)/);
            
            if (tagMatch) {
              const tagName = tagMatch[1];
              const colorIndex = getTagColorIndex(tagName, tagColorMap);
              const color = tagColors[colorIndex];

              // Extract attributes
              const attrMatch = tag.match(/\s+([^=]+)="([^"]*)"/g);
              const attributes = attrMatch || [];

              parts.push({
                type: 'tag',
                isClosing,
                isSelfClosing,
                tagName,
                color,
                fullTag: tag,
                attributes
              });
            } else {
              parts.push({ type: 'tag', fullTag: tag });
            }
          } else if (text) {
            // Text content - preserve as-is (don't trim, as it may contain important whitespace)
            if (text) {
              parts.push({ type: 'text', content: text });
            }
          }

          currentIndex = matchIndex + fullMatch.length;
        }

        // Render the parts with syntax highlighting
        return (
          <pre className={classes.wrapText}>
            {parts.map((part, index) => {
              if (part.type === 'declaration') {
                return (
                  <span key={index} className={classes.xmlDeclaration}>
                    {part.content}
                  </span>
                );
              } else if (part.type === 'whitespace') {
                // Preserve whitespace and newlines for formatting
                return <span key={index}>{part.content}</span>;
              } else if (part.type === 'tag') {
                const { isClosing, isSelfClosing, tagName, color, fullTag, attributes } = part;
                
                if (tagName) {
                  // Split the tag to highlight the tag name separately
                  const tagStart = isClosing ? '</' : '<';
                  const tagEnd = isSelfClosing ? ' />' : '>';
                  const beforeAttrs = fullTag.substring(
                    fullTag.indexOf(tagName) + tagName.length,
                    fullTag.length - (isSelfClosing ? 2 : 1)
                  );
                  
                  return (
                    <span key={index}>
                      <span className={classes.xmlBracket}>{tagStart}</span>
                      <span 
                        className={classes.xmlTagName} 
                        style={{ color }}
                      >
                        {tagName}
                      </span>
                      {attributes && attributes.length > 0 && (
                        <span className={classes.xmlAttributes}>
                          {attributes.map((attr, attrIndex) => {
                            const attrParts = attr.match(/(\S+)="([^"]*)"/);
                            if (attrParts) {
                              const [, attrName, attrValue] = attrParts;
                              return (
                                <span key={attrIndex}>
                                  <span className={classes.xmlAttrName}> {attrName}</span>
                                  <span className={classes.xmlBracket}>=</span>
                                  <span className={classes.xmlAttrValue}>"{attrValue}"</span>
                                </span>
                              );
                            }
                            return <span key={attrIndex}>{attr}</span>;
                          })}
                        </span>
                      )}
                      {beforeAttrs && !attributes && (
                        <span className={classes.xmlAttributes}>{beforeAttrs}</span>
                      )}
                      <span className={classes.xmlBracket}>{tagEnd}</span>
                    </span>
                  );
                } else {
                  return (
                    <span key={index} className={classes.xmlTag}>
                      {fullTag}
                    </span>
                  );
                }
              } else if (part.type === 'text') {
                return (
                  <span key={index} className={classes.xmlText}>
                    {part.content}
                  </span>
                );
              }
              return null;
            })}
          </pre>
        );
      } catch (e) {
        // If highlighting fails, return plain formatted XML
        return <pre className={classes.wrapText}>{formatXml(xmlString)}</pre>;
      }
    };
  }, [tagColors, classes]);

  // Get the raw payload - store original for Raw mode
  const rawPayload = message?.payload;
  
  // Only process payload for type detection if not in Raw mode
  // In Raw mode, we skip ALL processing including type detection
  const shouldDetectTypes = viewMode !== VIEW_MODES.RAW;
  const payload = shouldDetectTypes 
    ? (typeof rawPayload === 'string' ? rawPayload : (rawPayload !== undefined ? String(rawPayload) : ''))
    : '';
  const isXmlPayload = shouldDetectTypes && typeof payload === 'string' && payload && isXml(payload);
  const isJsonPayload = shouldDetectTypes && typeof payload === 'string' && payload && isJson(payload);
  
  const xmlHighlightedContent = useMemo(() => {
    if (shouldDetectTypes && isXmlPayload) {
      return renderXmlWithSyntaxHighlighting(payload);
    }
    return null;
  }, [payload, isXmlPayload, shouldDetectTypes, renderXmlWithSyntaxHighlighting]);

  // View mode selector component - clickable text (memoized)
  const ViewModeSelector = useMemo(() => {
    return () => (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.875rem' }}>
      <span
        onClick={() => setViewMode(VIEW_MODES.RAW)}
        style={{
          cursor: 'pointer',
          color: viewMode === VIEW_MODES.RAW ? 'var(--primary-color)' : 'var(--text-color-secondary)',
          fontWeight: viewMode === VIEW_MODES.RAW ? '600' : '400',
          padding: '0.25rem 0.5rem',
          borderRadius: '4px',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          if (viewMode !== VIEW_MODES.RAW) {
            e.target.style.backgroundColor = 'var(--surface-100)';
          }
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = 'transparent';
        }}
      >
        Raw
      </span>
      <span style={{ color: 'var(--text-color-secondary)' }}>|</span>
      <span
        onClick={() => setViewMode(VIEW_MODES.FORMATTED)}
        style={{
          cursor: 'pointer',
          color: viewMode === VIEW_MODES.FORMATTED ? 'var(--primary-color)' : 'var(--text-color-secondary)',
          fontWeight: viewMode === VIEW_MODES.FORMATTED ? '600' : '400',
          padding: '0.25rem 0.5rem',
          borderRadius: '4px',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          if (viewMode !== VIEW_MODES.FORMATTED) {
            e.target.style.backgroundColor = 'var(--surface-100)';
          }
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = 'transparent';
        }}
      >
        Formatted
      </span>
      <span style={{ color: 'var(--text-color-secondary)' }}>|</span>
      <span
        onClick={() => setViewMode(VIEW_MODES.COLOR)}
        style={{
          cursor: 'pointer',
          color: viewMode === VIEW_MODES.COLOR ? 'var(--primary-color)' : 'var(--text-color-secondary)',
          fontWeight: viewMode === VIEW_MODES.COLOR ? '600' : '400',
          padding: '0.25rem 0.5rem',
          borderRadius: '4px',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          if (viewMode !== VIEW_MODES.COLOR) {
            e.target.style.backgroundColor = 'var(--surface-100)';
          }
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = 'transparent';
        }}
      >
        Color
      </span>
    </div>
    );
  }, [viewMode]);

  // Custom header template for Panel - provide to parent via callback
  // MUST be called before any early returns (Rules of Hooks)
  const headerTemplate = useMemo(() => {
    return (options) => (
      <div className={options?.className || ''} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingRight: '1.5rem' }}>
        <span style={{ fontWeight: '600' }}>Payload</span>
        <ViewModeSelector />
      </div>
    );
  }, [viewMode, ViewModeSelector]);

  // Provide header template to parent if callback provided
  useEffect(() => {
    if (onHeaderTemplate) {
      onHeaderTemplate(headerTemplate);
    }
  }, [headerTemplate, onHeaderTemplate]);

  // Now we can check conditions and return early
  const messageUndefined = message === undefined;
  const payloadUndefined = message?.payload === undefined;
  const isBinaryPayloadNotAvailable = message?.payload === BINARY_PAYLOAD_NOT_AVAILABLE;
  
  const renderCopyButton = () => {
    if (payloadUndefined || isBinaryPayloadNotAvailable) {
      return null;
    }

    return (
      <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', zIndex: 10 }}>
        <Button
          icon={copied ? 'pi pi-check' : 'pi pi-copy'}
          className="p-button-text p-button-sm"
          onClick={handleCopyPayload}
          tooltip="Copy payload to clipboard"
          tooltipOptions={{ position: 'left' }}
          style={{ padding: '0.5rem' }}
        />
      </div>
    );
  };
  
  const handleCopyPayload = async () => {
    const payload = message?.payload;
    if (!payload || payload === BINARY_PAYLOAD_NOT_AVAILABLE) {
      showErrorToast(toast, 'Payload not available to copy', 'Copy Failed');
      return;
    }

    // For JSON and XML payloads, copy the formatted version
    let textToCopy = payload;
    if (typeof payload === 'string') {
      try {
        // If it's valid JSON, format it nicely
        const parsed = JSON.parse(payload);
        textToCopy = JSON.stringify(parsed, null, 2);
      } catch (e) {
        // Check if it's XML
        if (isXml(payload)) {
          textToCopy = formatXml(payload);
        } else {
          // Not JSON or XML, use as-is
          textToCopy = payload;
        }
      }
    } else {
      textToCopy = JSON.stringify(payload, null, 2);
    }

    if (await copyToClipboard(textToCopy)) {
      setCopied(true);
      showSuccessToast(toast, 'Copied payload to clipboard', 'Copied', 2000);
      setTimeout(() => setCopied(false), 2000);
    } else {
      showErrorToast(toast, 'Failed to copy payload to clipboard', 'Copy Failed');
    }
  };

  // Render content based on view mode
  const renderContent = () => {
    // RAW mode: display payload exactly as received, no processing whatsoever
    // This must be checked FIRST before any other processing
    if (viewMode === VIEW_MODES.RAW) {
      // Get the raw payload value directly from message - absolutely no processing
      const rawValue = message?.payload;
      if (rawValue === undefined || rawValue === null) {
        return <pre style={{ margin: 0, fontSize: 'small' }}></pre>;
      }
      // If it's already a string, use it EXACTLY as-is (this is the true raw value)
      // No formatting, no parsing, no type detection, no nothing
      if (typeof rawValue === 'string') {
        return (
          <pre 
            style={{ 
              whiteSpace: 'pre',  // Preserve exact whitespace, no wrapping
              wordBreak: 'normal', 
              overflowWrap: 'normal',
              margin: 0,
              fontSize: 'small',
              overflowX: 'auto',
              overflowY: 'auto',
              fontFamily: 'monospace'
            }}
          >
            {rawValue}
          </pre>
        );
      }
      // If it's an object, stringify it without any formatting (compact, no indentation)
      return (
        <pre 
          style={{ 
            whiteSpace: 'pre',
            wordBreak: 'normal',
            overflowWrap: 'normal',
            margin: 0,
            fontSize: 'small',
            overflowX: 'auto',
            overflowY: 'auto',
            fontFamily: 'monospace'
          }}
        >
          {JSON.stringify(rawValue)}
        </pre>
      );
    }
    
    // FORMATTED and COLOR modes: detect type and format accordingly
    if (isJsonPayload) {
      if (viewMode === VIEW_MODES.FORMATTED) {
        try {
          const parsed = JSON.parse(payload);
          return <pre className={classes.wrapText}>{JSON.stringify(parsed, null, 2)}</pre>;
        } catch (e) {
          return <pre className={classes.wrapText}>{payload}</pre>;
        }
      } else {
        // COLOR mode
        return <JsonView src={JSON.parse(payload)} theme="atom" dark="false" />;
      }
    } else if (isXmlPayload) {
      if (viewMode === VIEW_MODES.FORMATTED) {
        return <pre className={classes.wrapText}>{formatXml(payload)}</pre>;
      } else {
        // COLOR mode
        return xmlHighlightedContent;
      }
    } else {
      // Plain text payload - Formatted and Color modes are the same
      return <pre className={classes.wrapText}>{payload || ''}</pre>;
    }
  };

  // Early returns (after all hooks)
  if (messageUndefined) {
    return 'Please select a message.';
  }
  
  if (payloadUndefined) {
    return '';
  }
  
  if (isBinaryPayloadNotAvailable) {
    return <div className={classes.binaryPayloadMessage}>Binary payload - not displayed</div>;
  }

  // For Raw mode, render immediately without any processing
  if (viewMode === VIEW_MODES.RAW) {
    const rawValue = message?.payload;
    const rawContent = typeof rawValue === 'string' 
      ? rawValue 
      : (rawValue !== undefined && rawValue !== null ? JSON.stringify(rawValue) : '');
    
    return (
      <>
        <div className={classes.payloadContainer} style={{ position: 'relative' }}>
          {renderCopyButton()}
          <pre 
            style={{ 
              whiteSpace: 'pre',
              wordBreak: 'normal', 
              overflowWrap: 'normal',
              margin: 0,
              fontSize: 'small',
              overflowX: 'auto',
              overflowY: 'auto',
              fontFamily: 'monospace'
            }}
          >
            {rawContent}
          </pre>
        </div>
        <Toast ref={toast} position="top-right" />
      </>
    );
  }

  const containerClass = isJsonPayload && viewMode === VIEW_MODES.COLOR 
    ? classes.jsonViewContainer 
    : classes.payloadContainer;

  return (
    <>
      <div className={containerClass} style={{ position: 'relative' }}>
        {renderCopyButton()}
        {renderContent()}
      </div>
      <Toast ref={toast} position="top-right" />
    </>
  );
}

MessagePayloadView.propTypes = {
  message: PropTypes.object
};