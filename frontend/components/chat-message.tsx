import { Copy, User, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface ChatMessageProps {
  message: {
    role: 'user' | 'assistant';
    content: string;
  };
}

// Function to detect and format code blocks
const formatMessageContent = (content: string) => {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const inlineCodeRegex = /`([^`]+)`/g;
  
  const parts = [];
  let lastIndex = 0;
  let match;

  // Process code blocks
  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      const textContent = content.slice(lastIndex, match.index);
      if (textContent.trim()) {
        parts.push({ type: 'text', content: textContent });
      }
    }
    
    // Add code block
    parts.push({
      type: 'codeBlock',
      language: match[1] || 'text',
      content: match[2]
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < content.length) {
    const textContent = content.slice(lastIndex);
    if (textContent.trim()) {
      parts.push({ type: 'text', content: textContent });
    }
  }
  
  // If no code blocks found, process inline code
  if (parts.length === 0) {
    const textParts = [];
    let textLastIndex = 0;
    let textMatch;
    
    while ((textMatch = inlineCodeRegex.exec(content)) !== null) {
      // Add text before inline code
      if (textMatch.index > textLastIndex) {
        const beforeText = content.slice(textLastIndex, textMatch.index);
        if (beforeText) {
          textParts.push({ type: 'text', content: beforeText });
        }
      }
      
      // Add inline code
      textParts.push({
        type: 'inlineCode',
        content: textMatch[1]
      });
      
      textLastIndex = textMatch.index + textMatch[0].length;
    }
    
    // Add remaining text
    if (textLastIndex < content.length) {
      const remainingText = content.slice(textLastIndex);
      if (remainingText) {
        textParts.push({ type: 'text', content: remainingText });
      }
    }
    
    return textParts.length > 0 ? textParts : [{ type: 'text', content }];
  }
  
  return parts;
};

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const isLoading = message.role === 'assistant' && message.content === '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Failed to copy text silently
    }
  };

  const messageParts = message.content ? formatMessageContent(message.content) : [];

  return (
    <div className={`mb-6 flex w-full group ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex gap-3 max-w-[80%] items-start ${isUser ? 'flex-row-reverse max-w-[70%]' : ''}`}>
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
          isUser 
            ? 'bg-secondary text-foreground' 
            : 'bg-muted text-foreground'
        }`}>
          {isUser ? (
            <User className="h-5 w-5" />
          ) : (
            <Bot className="h-5 w-5" />
          )}
        </div>

        {/* Message Content */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="flex gap-1 items-center justify-center p-4">
              <div className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse" style={{animationDelay: '-0.32s'}}></div>
              <div className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse" style={{animationDelay: '-0.16s'}}></div>
              <div className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse" style={{animationDelay: '0s'}}></div>
            </div>
          ) : (
            <>
              <div className={`rounded-xl p-4 mb-2 relative ${
                isUser 
                  ? 'bg-secondary text-foreground rounded-br-sm' 
                  : 'bg-card text-foreground rounded-bl-sm border border-border'
              }`}>
                {messageParts.map((part, index) => {
                  if (part.type === 'text') {
                    return (
                      <p key={index} className="m-0 leading-normal whitespace-pre-wrap break-words">
                        {part.content.split('\n').map((line, lineIndex) => (
                          <span key={lineIndex}>
                            {line}
                            {lineIndex < part.content.split('\n').length - 1 && <br />}
                          </span>
                        ))}
                      </p>
                    );
                  } else if (part.type === 'inlineCode') {
                    return (
                      <code key={index} className={`px-1 py-0.5 rounded-sm font-mono text-sm ${
                        isUser 
                          ? 'bg-foreground/10 text-foreground' 
                          : 'bg-muted text-foreground'
                      }`}>
                        {part.content}
                      </code>
                    );
                  } else if (part.type === 'codeBlock') {
                    return (
                      <pre key={index} className={`rounded-lg p-4 my-3 overflow-x-auto font-mono text-sm leading-relaxed border border-border ${
                        isUser 
                          ? 'bg-muted text-foreground' 
                          : 'bg-muted text-foreground'
                      }`}>
                        <code className=" p-0 text-inherit">
                          {part.content}
                        </code>
                      </pre>
                    );
                  }
                  return null;
                })}
              </div>

              {/* Copy button for assistant messages */}
              {!isUser && (
                <div className="flex gap-2 mt-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="p-1 h-auto  border-0 text-muted-foreground transition-all duration-200 hover:bg-secondary hover:text-foreground"
                    title={copied ? 'Copied!' : 'Copy to clipboard'}
                  >
                    <Copy className={`h-4 w-4 ${copied ? 'text-green-500' : ''}`} />
                  </Button>
                </div>
              )}

            </>
          )}
        </div>
      </div>
    </div>
  );
}
