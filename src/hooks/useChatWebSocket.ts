// WebSocket hook for real-time chat
import { useState, useEffect, useRef, useCallback } from 'react';

// Get API base URL from environment - Use API Gateway
const CHAT_API_BASE = process.env.NEXT_PUBLIC_API_URL ||
                      process.env.REACT_APP_CHAT_SERVICE_URL || 
                      'http://localhost:8000/api';

interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  message: string;
  timestamp: string;
  message_type: 'user' | 'system';
}

interface ConnectedUser {
  user_id: string;
  username: string;
  status: 'online' | 'offline';
}

interface UseChatWebSocketProps {
  dashboardId: string | null;
  userId: string | null;
  username: string | null;
  enabled?: boolean;
}

export function useChatWebSocket({ 
  dashboardId, 
  userId, 
  username,
  enabled = true 
}: UseChatWebSocketProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  // Load message history on mount
  useEffect(() => {
    if (!dashboardId || !enabled) return;

    const loadHistory = async () => {
      try {
        const response = await fetch(`${CHAT_API_BASE}/chat/messages/${dashboardId}?limit=50`);
        if (response.ok) {
          const data = await response.json();
          // Map backend messages (with 'content') to frontend format (with 'message')
          const mappedMessages: ChatMessage[] = (data || []).map((msg: any) => ({
            id: msg.id,
            user_id: msg.user_id,
            username: msg.username,
            message: msg.content, // Backend uses 'content', we use 'message'
            timestamp: msg.timestamp,
            message_type: msg.message_type === 'system' ? 'system' : 'user'
          }));
          setMessages(mappedMessages);
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
      }
    };

    loadHistory();
  }, [dashboardId, enabled]);

  // WebSocket connection
  useEffect(() => {
    if (!dashboardId || !userId || !username || !enabled) {
      return;
    }

    const connectWebSocket = () => {
      try {
        // Force wss:// since load balancer uses HTTPS (port 8000)
        const protocol = 'wss:';
        const wsHost = process.env.NEXT_PUBLIC_API_URL?.replace('http://', '').replace('https://', '').split('/')[0] || 'localhost:8000';
        const wsUrl = `${protocol}//${wsHost}/api/chat/ws/${dashboardId}?user_id=${userId}&username=${encodeURIComponent(username)}`;
        
        console.log('Connecting to WebSocket:', wsUrl);
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('WebSocket connected');
          setIsConnected(true);
          setError(null);
          reconnectAttemptsRef.current = 0;
          // Expose a global helper so other parts of the app can send arbitrary events
          try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            window.sendChatWsEvent = (type: string, data: any) => {
              if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return false;
              try {
                wsRef.current.send(JSON.stringify({ type, data }));
                return true;
              } catch (e) {
                console.error('Failed to send chat WS event:', e);
                return false;
              }
            };
          } catch (e) {
            // ignore in environments without window
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('WebSocket message received:', data);

            if (data.type === 'chat_message') {
              // New chat message - map backend fields to frontend format
              const message: ChatMessage = {
                id: data.data.id,
                user_id: data.data.user_id,
                username: data.data.username,
                message: data.data.content, // Backend sends 'content', we use 'message'
                timestamp: data.data.timestamp,
                message_type: 'user'
              };
              setMessages(prev => [...prev, message]);
            } else if (data.type === 'user_joined') {
              // System message for user joining
              const systemMessage: ChatMessage = {
                id: `system-${Date.now()}`,
                user_id: 'system',
                username: 'System',
                message: `${data.data.username} joined the chat`,
                timestamp: data.data.timestamp,
                message_type: 'system'
              };
              setMessages(prev => [...prev, systemMessage]);
              // Refresh connected users
              fetchConnectedUsers();
              } else if (data.type === 'comment_created') {
                // Broadcast comment events to other hooks/components via window event
                try {
                  // Send the comment payload as-is in data.data
                  if (typeof window !== 'undefined' && window?.CustomEvent) {
                    window.dispatchEvent(new CustomEvent('comment_created', { detail: data.data }));
                  }
                } catch (e) {
                  console.error('Failed to dispatch comment_created event:', e);
                }
            } else if (data.type === 'user_left') {
              // System message for user leaving
              const systemMessage: ChatMessage = {
                id: `system-${Date.now()}`,
                user_id: 'system',
                username: 'System',
                message: `${data.data.username} left the chat`,
                timestamp: data.data.timestamp,
                message_type: 'system'
              };
              setMessages(prev => [...prev, systemMessage]);
              // Refresh connected users
              fetchConnectedUsers();
            } else if (data.type === 'users_list') {
              // Update connected users list
              setConnectedUsers(data.data);
            } else if (data.type === 'error') {
              console.error('WebSocket error message:', data.message);
              setError(data.message);
            }
          } catch (err) {
            console.error('Error parsing WebSocket message:', err);
          }
        };

        ws.onerror = (event) => {
          console.error('WebSocket error:', event);
          setError('Connection error');
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected');
          setIsConnected(false);
          
          // Attempt reconnection with exponential backoff
          if (reconnectAttemptsRef.current < 5) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
            console.log(`Reconnecting in ${delay}ms...`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectAttemptsRef.current += 1;
              connectWebSocket();
            }, delay);
          } else {
            setError('Failed to connect after multiple attempts');
          }
        };

        wsRef.current = ws;
      } catch (err) {
        console.error('Error creating WebSocket:', err);
        setError('Failed to create connection');
      }
    };

    const fetchConnectedUsers = async () => {
      try {
        const response = await fetch(`${CHAT_API_BASE}/chat/users/${dashboardId}`);
        if (response.ok) {
          const data = await response.json();
          setConnectedUsers(data.users || []);
        }
      } catch (err) {
        console.error('Failed to fetch connected users:', err);
      }
    };

    connectWebSocket();
    fetchConnectedUsers();

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
        try {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          if (typeof window !== 'undefined' && window.sendChatWsEvent) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            delete window.sendChatWsEvent;
          }
        } catch (e) {
          // ignore
        }
      }
    };
  }, [dashboardId, userId, username, enabled]);

  const sendMessage = useCallback((message: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('Not connected to chat');
      return false;
    }

    if (!message.trim()) {
      return false;
    }

    try {
      wsRef.current.send(JSON.stringify({
        type: 'chat_message',
        data: {
          message: message.trim()
        }
      }));
      return true;
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
      return false;
    }
  }, []);

  return {
    messages,
    connectedUsers,
    isConnected,
    error,
    sendMessage
  };
}
