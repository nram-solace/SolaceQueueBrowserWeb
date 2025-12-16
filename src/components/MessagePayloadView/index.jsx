import { useRef, useState, useMemo } from 'react';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import classes from './styles.module.css';
import JsonView from 'react18-json-view';
import 'react18-json-view/src/style.css'
import { BINARY_PAYLOAD_NOT_AVAILABLE } from '../../hooks/solace';
import { copyToClipboard } from '../../utils/clipboard';
import { showSuccessToast, showErrorToast } from '../../utils/toast';
import PropTypes from 'prop-types';

export default function MessagePayloadView({ message }) {
  const toast = useRef(null);
  const [copied, setCopied] = useState(false);
  
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

  // Check if payload is XML and compute highlighted content
  const payload = message?.payload;
  const isXmlPayload = typeof payload === 'string' && isXml(payload);
  
  const xmlHighlightedContent = useMemo(() => {
    if (isXmlPayload) {
      return renderXmlWithSyntaxHighlighting(payload);
    }
    return null;
  }, [payload, isXmlPayload, renderXmlWithSyntaxHighlighting]);

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
 
  function isJson(payload){
     try{
        JSON.parse(payload);
        return true;
     }catch(e){
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

  // Early returns
  if (messageUndefined) {
    return 'Please select a message.';
  }
  
  if (payloadUndefined) {
    return '';
  }
  
  if (isBinaryPayloadNotAvailable) {
    return <div className={classes.binaryPayloadMessage}>Binary payload - not displayed</div>;
  }

  if (isJson(message?.payload)) {
    return (
      <>
        <div className={classes.jsonViewContainer} style={{ position: 'relative' }}>
          {renderCopyButton()}
          <JsonView src={JSON.parse(message?.payload)} theme="atom" dark="false" />
        </div>
        <Toast ref={toast} position="top-right" />
      </>
    );
  }
  
  if (isXmlPayload) {
    return (
      <>
        <div className={classes.payloadContainer} style={{ position: 'relative' }}>
          {renderCopyButton()}
          {xmlHighlightedContent}
        </div>
        <Toast ref={toast} position="top-right" />
      </>
    );
  }
  
  return (
    <>
      <div className={classes.payloadContainer} style={{ position: 'relative' }}>
        {renderCopyButton()}
        <pre className={classes.wrapText}>{payload || ''}</pre>
      </div>
      <Toast ref={toast} position="top-right" />
    </>
  );
}

MessagePayloadView.propTypes = {
  message: PropTypes.object
};