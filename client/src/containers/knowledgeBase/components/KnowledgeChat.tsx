import React, { useEffect, useRef, useState } from 'react';
import {
  InfoCircleOutlined,
  RobotOutlined,
  SendOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Button, Empty, Input, message as antdMessage, Spin } from 'antd';

import { useLanguage } from '../../../common/contexts/languageContext';
import {
  chatWithKnowledgeBaseApi,
  SearchResult,
} from '../api/knowledgeBaseApi';

import './KnowledgeChat.scss';

interface Message {
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  sources?: SearchResult[];
}

interface KnowledgeChatProps {
  knowledgeBaseId: string;
  knowledgeBaseName: string;
}

export function KnowledgeChat({
  knowledgeBaseId,
  knowledgeBaseName,
}: KnowledgeChatProps) {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) {
      return;
    }

    const userMessage: Message = {
      type: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setLoading(true);

    try {
      const response = await chatWithKnowledgeBaseApi(
        knowledgeBaseId,
        currentInput,
        chatSessionId || undefined
      );

      if (!chatSessionId && response.chatSessionId) {
        setChatSessionId(response.chatSessionId);
      }

      const aiMessage: Message = {
        type: 'ai',
        content: response.message,
        timestamp: new Date(),
        sources: response.sources,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error: any) {
      console.error('Chat error:', error);
      antdMessage.error(error.message || t('knowledgeBase.chatError'));

      const errorMessage: Message = {
        type: 'ai',
        content: t('knowledgeBase.chatError'),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="knowledge-chat">
      <div className="knowledge-chat-messages" ref={chatContainerRef}>
        {messages.length === 0 ? (
          <div className="knowledge-chat-empty">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div className="empty-description">
                  <InfoCircleOutlined
                    style={{ fontSize: '16px', marginRight: '8px' }}
                  />
                  {t('knowledgeBase.startConversation')}
                </div>
              }
            />
          </div>
        ) : (
          <div className="messages-list">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`message-item ${
                  message.type === 'user' ? 'message-user' : 'message-ai'
                }`}
              >
                <div className="message-avatar">
                  {message.type === 'user' ? (
                    <UserOutlined />
                  ) : (
                    <RobotOutlined />
                  )}
                </div>
                <div className="message-content">
                  <div className="message-text">{message.content}</div>
                  {message.sources && message.sources.length > 0 && (
                    <div className="message-sources">
                      <div className="sources-label">
                        {t('knowledgeBase.source')}:
                      </div>
                      {message.sources.map((source, idx) => {
                        const isImage = /\.(jpg|jpeg|png|gif|bmp)$/i.test(
                          source.fileName
                        );

                        return (
                          <div key={idx} className="source-item">
                            <div className="source-header">
                              {isImage ? '🖼️' : '📄'} {source.fileName} (
                              {(source.score * 100).toFixed(0)}%)
                              {isImage && (
                                <span className="ocr-badge">
                                  {' '}
                                  • {t('knowledgeBase.ocrExtracted')}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="message-time">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="message-item message-ai">
                <div className="message-avatar">
                  <RobotOutlined />
                </div>
                <div className="message-content">
                  <Spin size="small" />
                  <span style={{ marginLeft: '12px' }}>
                    {t('knowledgeBase.thinking')}
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="knowledge-chat-input">
        <Input.TextArea
          placeholder={t('knowledgeBase.typeMessage')}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          disabled={loading}
          autoSize={{ minRows: 1, maxRows: 4 }}
          className="chat-textarea"
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          loading={loading}
          disabled={!input.trim() || loading}
          className="send-button"
        ></Button>
      </div>
    </div>
  );
}
