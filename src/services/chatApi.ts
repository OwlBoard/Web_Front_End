export interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  content: string;
  message_type: string;
  timestamp: string;
  dashboard_id: string;
  reply_to?: string;
}

export interface ChatRoom {
  id: string;
  dashboard_id: string;
  name: string;
  created_at: string;
}

export interface ConnectedUser {
  user_id: string;
  username: string;
  dashboard_id: string;
  connected_at: string;
}

// Use API Gateway for client-side requests
const CHAT_API_BASE = process.env.NEXT_PUBLIC_API_URL || 
                      process.env.REACT_APP_CHAT_SERVICE_URL || 
                      'http://localhost:8000/api';

class ChatApiService {
  private ws: WebSocket | null = null;
  private messageHandlers: ((message: ChatMessage) => void)[] = [];
  private connectionHandlers: ((connected: boolean) => void)[] = [];
  private messagesClearedHandlers: (() => void)[] = [];

  // REST API endpoints
  async getMessages(dashboardId: string): Promise<ChatMessage[]> {
    try {
      const response = await fetch(`${CHAT_API_BASE}/chat/messages/${dashboardId}`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      return await response.json();
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  }

  async getRooms(): Promise<ChatRoom[]> {
    try {
      const response = await fetch(`${CHAT_API_BASE}/chat/rooms`);
      if (!response.ok) throw new Error('Failed to fetch rooms');
      return await response.json();
    } catch (error) {
      console.error('Error fetching rooms:', error);
      return [];
    }
  }

  async getConnectedUsers(dashboardId: string): Promise<ConnectedUser[]> {
    try {
      const response = await fetch(`${CHAT_API_BASE}/chat/users/${dashboardId}`);
      if (!response.ok) throw new Error('Failed to fetch connected users');
      return await response.json();
    } catch (error) {
      console.error('Error fetching connected users:', error);
      return [];
    }
  }

  async clearAllMessages(dashboardId: string): Promise<boolean> {
    try {
      const response = await fetch(`${CHAT_API_BASE}/chat/messages/${dashboardId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to clear messages');
      return true;
    } catch (error) {
      console.error('Error clearing messages:', error);
      return false;
    }
  }

  // WebSocket connection
  connectToRoom(dashboardId: string, userId: string, username: string): void {
    if (this.ws) {
      this.ws.close();
    }

    // Force wss:// since load balancer uses HTTPS (port 8000)
    const protocol = 'wss:';
    const wsHost = process.env.NEXT_PUBLIC_API_URL?.replace('http://', '').replace('https://', '').split('/')[0] || 'localhost:8000';
    const wsUrl = `${protocol}//${wsHost}/api/chat/ws/${dashboardId}?user_id=${userId}&username=${encodeURIComponent(username)}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('💬 Connected to chat room:', dashboardId);
      this.notifyConnectionHandlers(true);
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'chat_message') {
          const message: ChatMessage = {
            id: data.data.id,
            user_id: data.data.user_id,
            username: data.data.username,
            content: data.data.content,
            message_type: data.data.message_type,
            timestamp: data.data.timestamp,
            dashboard_id: data.data.dashboard_id,
            reply_to: data.data.reply_to
          };
          
          // Mark this as a confirmed server message
          (message as any).isServerMessage = true;
          this.notifyMessageHandlers(message);
        } else if (data.type === 'messages_cleared') {
          // Notify handlers that all messages were cleared
          this.notifyMessagesClearedHandlers();
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('💬 Disconnected from chat room');
      this.notifyConnectionHandlers(false);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.notifyConnectionHandlers(false);
    };
  }

  sendMessage(message: string, userId: string, username: string, dashboardId: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Create optimistic message for immediate UI update
      const optimisticMessage: ChatMessage = {
        id: `temp_${Date.now()}_${Math.random()}`, // Temporary ID
        user_id: userId,
        username: username,
        content: message,
        message_type: 'text',
        timestamp: new Date().toISOString(),
        dashboard_id: dashboardId
      };

      // Immediately notify handlers for optimistic update
      this.notifyMessageHandlers(optimisticMessage);

      // Send message via WebSocket
      this.ws.send(JSON.stringify({
        type: 'chat_message',
        data: {
          content: message,
          message_type: 'text'
        }
      }));
    } else {
      console.error('WebSocket is not connected');
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // Event handlers
  onMessage(handler: (message: ChatMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  onConnection(handler: (connected: boolean) => void): void {
    this.connectionHandlers.push(handler);
  }

  onMessagesCleared(handler: () => void): void {
    this.messagesClearedHandlers.push(handler);
  }

  removeMessageHandler(handler: (message: ChatMessage) => void): void {
    this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
  }

  removeConnectionHandler(handler: (connected: boolean) => void): void {
    this.connectionHandlers = this.connectionHandlers.filter(h => h !== handler);
  }

  removeMessagesClearedHandler(handler: () => void): void {
    this.messagesClearedHandlers = this.messagesClearedHandlers.filter(h => h !== handler);
  }

  private notifyMessageHandlers(message: ChatMessage): void {
    this.messageHandlers.forEach(handler => handler(message));
  }

  private notifyConnectionHandlers(connected: boolean): void {
    this.connectionHandlers.forEach(handler => handler(connected));
  }

  private notifyMessagesClearedHandlers(): void {
    this.messagesClearedHandlers.forEach(handler => handler());
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
export const chatApi = new ChatApiService();