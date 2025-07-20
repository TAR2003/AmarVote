import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkHtml from 'remark-html';
import { 
  FiMessageCircle, 
  FiSend, 
  FiX, 
  FiMaximize2, 
  FiMinimize2,
  FiMessageSquare,
  FiUser,
  FiLoader,
  FiRefreshCw,
  FiMoreVertical
} from 'react-icons/fi';

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'bot',
      content: "Hello! I'm AmarVote AI Assistant. I can help you with questions about our voting platform, ElectionGuard technology, and election results. How can I assist you today?",
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const menuRef = useRef(null);

  // Generate a unique session ID when component mounts
  useEffect(() => {
    const generateSessionId = () => {
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substr(2, 9);
      return `session_${timestamp}_${randomString}`;
    };
    setSessionId(generateSessionId());
  }, []);

  const suggestedQuestions = [
    "How does ElectionGuard ensure vote privacy?",
    "What are the different types of elections available?",
    "How can I check election results?",
    "What is cryptographic verification?",
    "How do I create an election?",
    "What security measures are in place?"
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
    if (!isOpen && messages.length > 1 && messages[messages.length - 1].type === 'bot') {
      setHasNewMessage(true);
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setHasNewMessage(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const clearChat = () => {
    setMessages([{
      id: 1,
      type: 'bot',
      content: "Hello! I'm AmarVote AI Assistant. I can help you with questions about our voting platform, ElectionGuard technology, and election results. How can I assist you today?",
      timestamp: new Date()
    }]);
    setShowSuggestions(true);
    setShowMenu(false);
    setSessionId(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  };

  const handleSendMessage = async (messageText = null) => {
    const messageToSend = messageText || inputMessage;
    if (!messageToSend?.trim() || isLoading || !sessionId) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: messageToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setShowSuggestions(false);

    try {
      const getCsrfToken = () => {
        const cookies = document.cookie.split('; ');
        const csrfCookie = cookies.find(cookie => cookie.startsWith('XSRF-TOKEN='));
        return csrfCookie ? csrfCookie.split('=')[1] : '';
      };

      const headers = {
        'Content-Type': 'application/json',
        'X-XSRF-TOKEN': getCsrfToken() || ''
      };

      const response = await fetch('/api/chatbot/chat', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ 
          userMessage: messageToSend,
          sessionId 
        })
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const responseText = await response.text();
      console.log(responseText);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        type: 'bot',
        content: responseText,
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        type: 'bot',
        content: "I'm sorry, I'm having trouble responding right now. Please try again later.",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTimestamp = (timestamp) => {
    return timestamp.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const ChatMessage = ({ message }) => (
    <div className={`flex gap-3 mb-4 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
      {message.type === 'bot' && (
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
            <FiMessageSquare className="w-4 h-4 text-white" />
          </div>
        </div>
      )}
      
      <div className={`max-w-[75%] ${message.type === 'user' ? 'order-1' : ''}`}>
        <div className={`p-3 rounded-lg ${
          message.type === 'user' 
            ? 'bg-blue-500 text-white rounded-br-sm' 
            : 'bg-white text-gray-800 rounded-bl-sm shadow-sm border border-gray-100'
        }`}>
          {message.type === 'bot' ? (
            <div className="prose prose-sm prose-blue max-w-none">
              <ReactMarkdown
                rehypePlugins={[rehypeRaw]}
                remarkPlugins={[remarkHtml]}
                components={{
                  h1: ({node, ...props}) => <h1 className="text-xl font-bold mt-4 mb-3 text-blue-800 border-b border-blue-200 pb-2" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-lg font-bold mt-4 mb-3 text-blue-700" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-base font-semibold mt-3 mb-2 text-blue-600" {...props} />,
                  h4: ({node, ...props}) => <h4 className="text-sm font-semibold mt-2 mb-1 text-blue-600" {...props} />,
                  p: ({node, ...props}) => <p className="mb-3 leading-relaxed text-gray-800" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc pl-6 mb-3 space-y-1" {...props} />,
                  ol: ({node, ...props}) => <ol className="list-decimal pl-6 mb-3 space-y-1" {...props} />,
                  li: ({node, ...props}) => <li className="mb-1 text-gray-800" {...props} />,
                  strong: ({node, ...props}) => <strong className="font-semibold text-blue-700" {...props} />,
                  em: ({node, ...props}) => <em className="italic text-gray-700" {...props} />,
                  a: ({node, ...props}) => <a className="text-blue-600 hover:underline font-medium" target="_blank" rel="noopener" {...props} />,
                  hr: ({node, ...props}) => <hr className="my-4 border-gray-300" {...props} />,
                  blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-blue-200 pl-4 py-2 my-3 bg-blue-50 text-gray-700 italic" {...props} />,
                  code: ({node, inline, ...props}) => 
                    inline ? 
                      <code className="bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-sm font-mono" {...props} /> : 
                      <pre className="bg-gray-100 p-3 rounded-md text-sm font-mono my-2 overflow-x-auto border border-gray-200" {...props} />,
                  // Add support for subscript and superscript
                  sub: ({node, ...props}) => <sub className="text-xs" {...props} />,
                  sup: ({node, ...props}) => <sup className="text-xs" {...props} />,
                }}
              >
                {/* Convert LaTeX-style Greek letters and underscore notation to proper HTML */}
                {message.content
                  .replace(/\\kappa/g, 'κ')
                  .replace(/\\zeta/g, 'ζ')
                  .replace(/\\gamma/g, 'γ')
                  .replace(/\\alpha/g, 'α')
                  .replace(/\\beta/g, 'β')
                  .replace(/\\delta/g, 'δ')
                  .replace(/\\epsilon/g, 'ε')
                  .replace(/\\theta/g, 'θ')
                  .replace(/\\lambda/g, 'λ')
                  .replace(/\\mu/g, 'μ')
                  .replace(/\\pi/g, 'π')
                  .replace(/\\sigma/g, 'σ')
                  .replace(/\\tau/g, 'τ')
                  .replace(/\\phi/g, 'φ')
                  .replace(/\\omega/g, 'ω')
                  // Convert underscore notation to HTML subscripts
                  .replace(/([a-zA-Zκζγαβδεθλμπστφω])_\{([^}]+)\}/g, '$1<sub>$2</sub>')
                  .replace(/([a-zA-Zκζγαβδεθλμπστφω])_([a-zA-Z0-9κζγαβδεθλμπστφω])/g, '$1<sub>$2</sub>')
                  // Convert caret notation to HTML superscripts  
                  .replace(/([a-zA-Zκζγαβδεθλμπστφω])\^\{([^}]+)\}/g, '$1<sup>$2</sup>')
                  .replace(/([a-zA-Zκζγαβδεθλμπστφω])\^([a-zA-Z0-9])/g, '$1<sup>$2</sup>')
                }
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
          )}
        </div>
        <p className={`text-xs text-gray-500 mt-1 ${
          message.type === 'user' ? 'text-right' : 'text-left'
        }`}>
          {formatTimestamp(message.timestamp)}
        </p>
      </div>

      {message.type === 'user' && (
        <div className="flex-shrink-0 order-2">
          <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center">
            <FiUser className="w-4 h-4 text-white" />
          </div>
        </div>
      )}
    </div>
  );

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsOpen(true)}
          className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-full shadow-xl transition-all duration-300 hover:scale-110 relative group"
          aria-label="Open chatbot"
          style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999 }}
        >
          <FiMessageCircle className="w-7 h-7 mx-auto" />
          {hasNewMessage && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
              <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
            </div>
          )}
          <div className="absolute -top-12 right-0 bg-gray-800 text-white text-xs px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap shadow-lg">
            AI Assistant
          </div>
        </button>
      </div>
    );
  }

  return (
    <div 
      className={`fixed transition-all duration-300 ${
        isMaximized 
          ? 'inset-6' 
          : 'bottom-6 right-6 w-96 h-[32rem]'
      }`}
      style={{ zIndex: 9999 }}
    >
      <div className="bg-white rounded-lg shadow-2xl border border-gray-200 h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <FiMessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold">AmarVote AI Assistant</h3>
              <p className="text-blue-100 text-xs">
                {messages.length > 1 ? 'Conversation Active' : 'Online'}
                {sessionId && messages.length > 1 && (
                  <span className="ml-1 opacity-70">• Session Active</span>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              aria-label={isMaximized ? "Minimize" : "Maximize"}
            >
              {isMaximized ? <FiMinimize2 className="w-4 h-4" /> : <FiMaximize2 className="w-4 h-4" />}
            </button>
            
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 hover:bg-white/20 rounded transition-colors"
                aria-label="More options"
              >
                <FiMoreVertical className="w-4 h-4" />
              </button>
              
              {showMenu && (
                <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-[120px]">
                  <button
                    onClick={clearChat}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    title="Start a new conversation session"
                  >
                    <FiRefreshCw className="w-3 h-3" />
                    New Session
                  </button>
                </div>
              )}
            </div>
            
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              aria-label="Close chatbot"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          
          {/* Suggested Questions */}
          {showSuggestions && messages.length === 1 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600 font-medium">Suggested questions:</p>
              <div className="grid gap-2">
                {suggestedQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => handleSendMessage(question)}
                    className="text-left p-2 text-sm bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                    disabled={isLoading}
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {isLoading && (
            <div className="flex gap-3 mb-4 justify-start">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <FiMessageSquare className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="max-w-xs lg:max-w-md">
                <div className="p-3 rounded-lg bg-gray-100 text-gray-800 rounded-bl-sm">
                  <div className="flex items-center gap-2">
                    <FiLoader className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-200 bg-white">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={sessionId ? "Continue the conversation..." : "Type your message..."}
              className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm max-h-20 min-h-[40px]"
              rows="1"
              disabled={isLoading || !sessionId}
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputMessage.trim() || isLoading || !sessionId}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              aria-label="Send message"
            >
              <FiSend className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
            <span>Press Enter to send</span>
            <span className="flex items-center gap-1">
              {sessionId && (
                <span className="text-green-600">
                  • Session Active
                </span>
              )}
              <span>Powered by AI</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;