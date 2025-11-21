import React, { useState, useRef, useEffect } from 'react';
import api from '../api';

export function IAAssistantModule() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Bonjour ! Je suis votre assistant intelligent ComptaOrion. Comment puis-je vous aider aujourd\'hui ?'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    api.get('/ia/suggestions')
      .then(data => {
        if (data.success) {
          setSuggestions(data.suggestions);
        }
      })
      .catch(err => console.error('Erreur suggestions:', err));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await api.post('/ia/chat', {
        message: input,
        conversationHistory
      });

      if (response.success) {
        const assistantMessage = {
          role: 'assistant',
          content: response.message
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error(response.error || 'Erreur inconnue');
      }
    } catch (error) {
      console.error('Erreur IA:', error);
      const errorMessage = {
        role: 'assistant',
        content: '⚠️ Désolé, une erreur est survenue. Veuillez réessayer.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setInput(suggestion);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: '20px',
        borderBottom: '2px solid #e0e0e0',
        backgroundColor: '#fff'
      }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          🤖 Assistant Intelligent
        </h2>
        <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '14px' }}>
          Posez vos questions sur la comptabilité, la gestion, et plus encore
        </p>
      </div>

      {/* Zone des suggestions */}
      {messages.length === 1 && suggestions.length > 0 && (
        <div style={{
          padding: '20px',
          backgroundColor: '#f8f9fa',
          borderBottom: '1px solid #e0e0e0'
        }}>
          <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#666', fontWeight: '600' }}>
            💡 Questions suggérées :
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => handleSuggestionClick(suggestion)}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#fff',
                  border: '1px solid #d0d0d0',
                  borderRadius: '16px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  color: '#333'
                }}
                onMouseOver={(e) => {
                  e.target.style.backgroundColor = '#e3f2fd';
                  e.target.style.borderColor = '#90caf9';
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = '#fff';
                  e.target.style.borderColor = '#d0d0d0';
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Zone des messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        backgroundColor: '#f5f5f5'
      }}>
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              marginBottom: '15px',
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
            }}
          >
            <div style={{
              maxWidth: '70%',
              padding: '12px 16px',
              borderRadius: '12px',
              backgroundColor: msg.role === 'user' ? '#2196f3' : '#fff',
              color: msg.role === 'user' ? '#fff' : '#333',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {msg.role === 'assistant' && (
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px', fontWeight: '600' }}>
                  🤖 Assistant
                </div>
              )}
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '15px' }}>
            <div style={{
              padding: '12px 16px',
              borderRadius: '12px',
              backgroundColor: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px', fontWeight: '600' }}>
                🤖 Assistant
              </div>
              <div style={{ color: '#999' }}>Réflexion en cours...</div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Zone de saisie */}
      <div style={{
        padding: '20px',
        borderTop: '2px solid #e0e0e0',
        backgroundColor: '#fff'
      }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Posez votre question ici... (Entrée pour envoyer, Shift+Entrée pour nouvelle ligne)"
            disabled={loading}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #d0d0d0',
              fontSize: '14px',
              fontFamily: 'inherit',
              resize: 'none',
              minHeight: '50px',
              maxHeight: '150px'
            }}
            rows={2}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            style={{
              padding: '12px 24px',
              backgroundColor: input.trim() && !loading ? '#2196f3' : '#ccc',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'background-color 0.2s'
            }}
          >
            {loading ? '⏳' : '📤 Envoyer'}
          </button>
        </div>
      </div>
    </div>
  );
}
