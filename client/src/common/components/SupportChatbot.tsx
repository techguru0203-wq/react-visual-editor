import { useEffect, useRef, useState } from 'react';
import {
  CloseOutlined,
  LoadingOutlined,
  MessageOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { Button, Input, message as antdMessage } from 'antd';

import { api_url } from '../../lib/constants';
import { useCurrentUser } from '../contexts/currentUserContext';
import { ReactComponent as LogoIcon } from '../icons/logo.svg';
import { getHeaders } from '../util/apiHeaders';

// Helper to get user email - works for both logged in and logged out users
function getUserEmail(user: any): string {
  if (user?.email) {
    return user.email;
  }
  // Try to get from localStorage or sessionStorage
  return (
    localStorage.getItem('userEmail') ||
    sessionStorage.getItem('userEmail') ||
    ''
  );
}

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'support';
  timestamp: Date;
  isAiReply?: boolean;
}

export default function SupportChatbot() {
  const { user } = useCurrentUser();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      text: "Hello! I'm OmniBot, the AI support agent for Omniflow. I'm here to answer your questions of Omniflow. How can I help you today?",
      sender: 'support',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<any>(null);
  const emailInputRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      // Check if we have user email
      const email = getUserEmail(user);
      if (!email) {
        setShowEmailInput(true);
        setTimeout(() => emailInputRef.current?.focus(), 100);
      } else {
        setUserEmail(email);
        setShowEmailInput(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }
  }, [isOpen, messages, user]);

  const handleEmailSubmit = () => {
    if (!userEmail.trim() || !userEmail.includes('@')) {
      antdMessage.warning('Please enter a valid email address');
      return;
    }
    setShowEmailInput(false);
    // Save email for future use
    localStorage.setItem('userEmail', userEmail);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isSending) return;

    // If email is not set, show email input
    const email = getUserEmail(user) || userEmail;
    if (!email) {
      setShowEmailInput(true);
      setTimeout(() => emailInputRef.current?.focus(), 100);
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: inputValue.trim(),
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsSending(true);

    try {
      const headers = await getHeaders();
      const appLink = window.location.href;
      const projectName = document.title || 'Omniflow Platform';

      const response = await fetch(`${api_url}/api/support/chat`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          message: userMessage.text,
          email: email,
          projectName,
          appLink,
          chatSessionId: chatSessionId || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Update chat session ID if provided
        if (data.chatSessionId && !chatSessionId) {
          setChatSessionId(data.chatSessionId);
        }

        // Show AI reply message
        if (data.message) {
          const aiMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            text: data.message,
            sender: 'support',
            timestamp: new Date(),
            isAiReply: true,
          };
          setMessages((prev) => [...prev, aiMessage]);
        }
      } else {
        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          text: 'Sorry, there was an error sending your message. Please try again later.',
          sender: 'support',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        antdMessage.error(data.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, there was an error sending your message. Please try again later.',
        sender: 'support',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      antdMessage.error('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Chat Button */}
      {!isOpen && (
        <Button
          type="primary"
          shape="circle"
          size="large"
          icon={<MessageOutlined />}
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 56,
            height: 56,
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(83, 69, 243, 0.4)',
          }}
          aria-label="Open support chat"
        />
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 384,
            height: 600,
            backgroundColor: '#fff',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid #e8e8e8',
          }}
        >
          {/* Header */}
          <div
            style={{
              backgroundColor: '#5345F3',
              color: '#fff',
              padding: '8px 0',
              borderTopLeftRadius: 8,
              borderTopRightRadius: 8,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <LogoIcon style={{ width: 24, height: 24 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>
                  OmniBot
                </div>
              </div>
            </div>
            <Button
              type="text"
              icon={<CloseOutlined />}
              onClick={() => setIsOpen(false)}
              style={{ color: '#fff' }}
              aria-label="Close chat"
            />
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '8px 0',
              backgroundColor: '#f5f5f5',
            }}
          >
            {messages.map((msg) => (
              <div key={msg.id}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent:
                      msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    marginBottom: 16,
                    alignItems: 'flex-start',
                    gap: 8,
                  }}
                >
                  {msg.sender === 'support' && (
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        backgroundColor: '#f0f0f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <LogoIcon style={{ width: 20, height: 20 }} />
                    </div>
                  )}
                  <div
                    style={{
                      maxWidth: '80%',
                      padding: '12px 16px',
                      borderRadius: 8,
                      backgroundColor:
                        msg.sender === 'user' ? '#5345F3' : '#fff',
                      color: msg.sender === 'user' ? '#fff' : '#333',
                      border:
                        msg.sender === 'user' ? 'none' : '1px solid #e8e8e8',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 14,
                        whiteSpace: 'pre-wrap',
                        marginBottom: 4,
                      }}
                    >
                      {msg.text}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        opacity: 0.7,
                        textAlign: 'right',
                      }}
                    >
                      {msg.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
                {msg.isAiReply && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-start',
                      marginBottom: 16,
                      paddingLeft: 16,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: '#666',
                        cursor: 'pointer',
                      }}
                      onClick={async () => {
                        const email = getUserEmail(user) || userEmail;
                        if (!email) {
                          antdMessage.warning(
                            'Please provide your email first'
                          );
                          return;
                        }

                        try {
                          const headers = await getHeaders();
                          const appLink = window.location.href;
                          const projectName =
                            document.title || 'Omniflow Platform';

                          // Find the user message that corresponds to this AI reply
                          const msgIndex = messages.findIndex(
                            (m) => m.id === msg.id
                          );
                          const originalUserMessage = messages
                            .slice(0, msgIndex)
                            .reverse()
                            .find((m) => m.sender === 'user')?.text;

                          const response = await fetch(
                            `${api_url}/api/support/contact-agent`,
                            {
                              method: 'POST',
                              headers,
                              credentials: 'include',
                              body: JSON.stringify({
                                email,
                                originalMessage: originalUserMessage || 'N/A',
                                projectName,
                                appLink,
                              }),
                            }
                          );

                          const data = await response.json();

                          if (data.success) {
                            const agentMessage: ChatMessage = {
                              id: Date.now().toString(),
                              text: data.message,
                              sender: 'support',
                              timestamp: new Date(),
                            };
                            setMessages((prev) => [...prev, agentMessage]);
                          } else {
                            antdMessage.error(
                              data.error || 'Failed to contact support agent'
                            );
                          }
                        } catch (error) {
                          console.error(
                            'Error contacting support agent:',
                            error
                          );
                          antdMessage.error(
                            'Failed to contact support agent. Please try again.'
                          );
                        }
                      }}
                    >
                      Not getting your answers?{' '}
                      <span
                        style={{
                          color: '#5345F3',
                          textDecoration: 'underline',
                        }}
                      >
                        you may contact our support agent
                      </span>
                    </span>
                  </div>
                )}
              </div>
            ))}
            {isSending && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-start',
                  marginBottom: 16,
                  alignItems: 'flex-start',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    backgroundColor: '#f0f0f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <LogoIcon style={{ width: 20, height: 20 }} />
                </div>
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 8,
                    backgroundColor: '#fff',
                    border: '1px solid #e8e8e8',
                  }}
                >
                  <LoadingOutlined style={{ fontSize: 16 }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: '16px',
              borderTop: '1px solid #e8e8e8',
              backgroundColor: '#fff',
              borderBottomLeftRadius: 8,
              borderBottomRightRadius: 8,
            }}
          >
            {showEmailInput ? (
              <div>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                  Please provide your email address so we can respond to you:
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input
                    ref={emailInputRef}
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    onPressEnter={handleEmailSubmit}
                    placeholder="your.email@example.com"
                    style={{ flex: 1 }}
                  />
                  <Button
                    type="primary"
                    onClick={handleEmailSubmit}
                    disabled={!userEmail.trim() || !userEmail.includes('@')}
                    style={{
                      backgroundColor: '#5345F3',
                      borderColor: '#5345F3',
                    }}
                  >
                    Continue
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onPressEnter={handleKeyPress}
                  placeholder="Type your message..."
                  disabled={isSending}
                  style={{ flex: 1 }}
                />
                <Button
                  type="primary"
                  icon={isSending ? <LoadingOutlined /> : <SendOutlined />}
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isSending}
                  style={{
                    backgroundColor: '#5345F3',
                    borderColor: '#5345F3',
                    color: 'white',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
