import React, { useState, useRef, useEffect } from 'react';
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
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const menuRef = useRef(null);

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
    // Set new message indicator when chat is closed and a bot message is added
    if (!isOpen && messages.length > 1 && messages[messages.length - 1].type === 'bot') {
      setHasNewMessage(true);
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setHasNewMessage(false); // Clear new message indicator when chat is opened
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
    setMessages([
      {
        id: 1,
        type: 'bot',
        content: "Hello! I'm AmarVote AI Assistant. I can help you with questions about our voting platform, ElectionGuard technology, and election results. How can I assist you today?",
        timestamp: new Date()
      }
    ]);
    setShowSuggestions(true);
    setShowMenu(false);
  };

  const handleSendMessage = async (messageText = null) => {
    const messageToSend = messageText || inputMessage;
    
    // Ensure messageToSend is a string and not empty
    if (!messageToSend || typeof messageToSend !== 'string' || !messageToSend.trim() || isLoading) return;

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
      // Use the same authentication pattern as other API calls
      const getCsrfToken = () => {
        const cookies = document.cookie.split('; ');
        const csrfCookie = cookies.find(cookie => cookie.startsWith('XSRF-TOKEN='));
        return csrfCookie ? csrfCookie.split('=')[1] : '';
      };

      const headers = {
        'Content-Type': 'application/json'
      };

      // Add CSRF token (required for authenticated endpoints)
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        headers['X-XSRF-TOKEN'] = csrfToken;
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: headers,
        credentials: 'include', // This ensures cookies (including session) are sent
        body: JSON.stringify({ userMessage: messageToSend })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseText = await response.text();

      const botMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: responseText,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: "I'm sorry, I'm having trouble responding right now. Please try again later.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
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

  const formatMessage = (content) => {
    // Replace **text** with bold formatting
    let formatted = content.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-blue-700">$1</strong>');
    
    // Handle numbered lists with bold headings
    formatted = formatted.replace(/(\d+)\.\s\*\*(.*?)\*\*:\s*/g, '<div class="mb-3"><strong class="font-semibold text-blue-700">$1. $2:</strong> ');
    
    // Handle bullet points and sub-bullet points
    formatted = formatted.replace(/^-\s+/gm, '<div class="ml-4 mb-1">• ');
    formatted = formatted.replace(/^\s+\-\s+/gm, '<div class="ml-8 mb-1">◦ ');
    
    // Close div tags for bullet points
    formatted = formatted.replace(/(<div class="ml-[48]+ mb-1">[^<]+)/g, '$1</div>');
    
    // Handle line breaks and paragraphs
    formatted = formatted.replace(/\n\n+/g, '</p><p class="mt-4">');
    formatted = formatted.replace(/\n/g, '<br>');
    
    // Wrap in paragraph if not already wrapped
    if (!formatted.includes('<p>') && !formatted.includes('<div class="mb-')) {
      formatted = `<p class="leading-relaxed">${formatted}</p>`;
    }
    
    // Clean up any unclosed divs
    formatted = formatted.replace(/<\/div>\s*<br>/g, '</div>');
    
    return formatted;
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
            <div 
              className="text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}
              style={{
                wordBreak: 'break-word',
                lineHeight: '1.6'
              }}
            />
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
              <p className="text-blue-100 text-xs">Online</p>
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
                  >
                    <FiRefreshCw className="w-3 h-3" />
                    Clear Chat
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
              placeholder="Type your message..."
              className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm max-h-20 min-h-[40px]"
              rows="1"
              disabled={isLoading}
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputMessage.trim() || isLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              aria-label="Send message"
            >
              <FiSend className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
            <span>Press Enter to send</span>
            <span>Powered by AI</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
