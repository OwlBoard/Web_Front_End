import { useEffect, useRef, useCallback } from 'react';
import { getDashboardMongoId } from '../utils/UserMongoId';

interface CommentWebSocketMessage {
  type: 'comment_created' | 'comment_updated' | 'comment_deleted';
  data: any;
}

interface UseCommentsWebSocketProps {
  dashboardId: string;
  onCommentCreated: (comment: any) => void;
  onCommentUpdated: (comment: any) => void;
  onCommentDeleted: (commentId: string) => void;
}

export const useCommentsWebSocket = ({
  dashboardId,
  onCommentCreated,
  onCommentUpdated,
  onCommentDeleted,
}: UseCommentsWebSocketProps) => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    // Get MongoDB ObjectId for the dashboard
    const dashboardMongoId = getDashboardMongoId(dashboardId);
    
    // Connect to Comments Service WebSocket through API Gateway
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = process.env.NEXT_PUBLIC_API_URL?.replace('http://', '').replace('https://', '').split('/')[0] || 'localhost:8000';
    const wsUrl = `${protocol}//${wsHost}/api/comments/ws/dashboards/${dashboardMongoId}/comments`;
    
    console.log('[Comments WS] Connecting to:', wsUrl);
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[Comments WS] Connected successfully');
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: CommentWebSocketMessage = JSON.parse(event.data);
          console.log('[Comments WS] Received message:', message);

          switch (message.type) {
            case 'comment_created':
              onCommentCreated(message.data);
              break;
            case 'comment_updated':
              onCommentUpdated(message.data);
              break;
            case 'comment_deleted':
              onCommentDeleted(message.data.comment_id);
              break;
            default:
              console.warn('[Comments WS] Unknown message type:', message.type);
          }
        } catch (error) {
          console.error('[Comments WS] Error processing message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[Comments WS] WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('[Comments WS] Connection closed');
        wsRef.current = null;

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
          console.log(`[Comments WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.error('[Comments WS] Max reconnection attempts reached');
        }
      };
    } catch (error) {
      console.error('[Comments WS] Error creating WebSocket:', error);
    }
  }, [dashboardId, onCommentCreated, onCommentUpdated, onCommentDeleted]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      console.log('[Comments WS] Disconnecting...');
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardId]); // Only reconnect when dashboardId changes

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    reconnect: connect,
  };
};
