// src/services/commentsApi.ts
import { CommentDef } from '../types/types';
import { getUserMongoId, generateMongoIdFromUserId, getDashboardMongoId } from '../utils/UserMongoId';

const API_BASE_URL = 
  process.env.NEXT_PUBLIC_COMMENTS_SERVICE_URL || 
  process.env.REACT_APP_COMMENTS_SERVICE_URL || 
  'http://localhost:8000/api/comments';

export interface CreateCommentRequest {
  content: string;
  coordinates: string; // formato "x,y"
  user_name?: string; // Optional username to display
}

// Basado en el schema CommentOut del Swagger
export interface CommentResponse {
  _id?: string;  // Optional porque puede venir como 'id'
  id?: string;   // Optional porque puede venir como '_id'
  dashboard_id: string;
  user_id: string;
  user_name?: string;  // Username from backend
  content: string;
  coordinates: number[];
  created_at: string;
  updated_at: string;
}

export interface UpdateCommentRequest {
  content: string;
}

export class CommentsApiService {
  
  // Crear un nuevo comentario
  static async createComment(
    dashboardId: string, 
    userId: string, 
    commentData: CreateCommentRequest
  ): Promise<CommentResponse> {
    // Convert SQL IDs to MongoDB ObjectIds
    const dashboardMongoId = getDashboardMongoId(dashboardId);
    const userMongoId = generateMongoIdFromUserId(userId);
    
    console.log('Creando comentario:', { 
      dashboardId, 
      dashboardMongoId,
      userId, 
      userMongoId,
      commentData 
    });
    
    const url = `${API_BASE_URL}/dashboards/${dashboardMongoId}/users/${userMongoId}/comments`;
    console.log('URL:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        content: commentData.content,
        coordinates: commentData.coordinates,
        user_name: commentData.user_name  // Send username to backend
      }),
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Error response:', errorData);
      
      if (response.status === 422) {
        const validationErrors = errorData.detail || [];
        throw new Error(`Validation Error: ${validationErrors.map((e: any) => e.msg).join(', ')}`);
      }
      
      throw new Error(`Error creating comment: ${response.status} - ${errorData.detail || response.statusText}`);
    }

    const result = await response.json();
    console.log('Comment created successfully:', result);
    return result;
  }

  // Obtener todos los comentarios de un tablero
  static async getCommentsByDashboard(dashboardId: string): Promise<CommentResponse[]> {
    // Convert SQL ID to MongoDB ObjectId
    const dashboardMongoId = getDashboardMongoId(dashboardId);
    
    console.log('Fetching comments for dashboard:', dashboardId, '(Mongo ID:', dashboardMongoId, ')');
    const url = `${API_BASE_URL}/dashboards/${dashboardMongoId}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      // If 404, the dashboard might not have comments yet - return empty array
      if (response.status === 404) {
        console.log('No comments found for dashboard (404)');
        return [];
      }
      throw new Error(`Error fetching comments: ${response.status} - ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Comments fetched:', result);
    return result;
  }

  // Actualizar un comentario
  static async updateComment(commentId: string, updateData: UpdateCommentRequest): Promise<CommentResponse> {
    console.log('Updating comment:', commentId, updateData);
    
    const response = await fetch(`${API_BASE_URL}/${commentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Error updating comment: ${response.status} - ${errorData.detail || response.statusText}`);
    }

    const result = await response.json();
    console.log('Comment updated:', result);
    return result;
  }

  // Actualizar solo las coordenadas de un comentario
  static async updateCommentCoordinates(commentId: string, x: number, y: number): Promise<CommentResponse> {
    console.log('Updating comment coordinates:', commentId, { x, y });
    
    const response = await fetch(`${API_BASE_URL}/${commentId}/coordinates`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify([x, y]),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Error updating comment coordinates: ${response.status} - ${errorData.detail || response.statusText}`);
    }

    const result = await response.json();
    console.log('Comment coordinates updated:', result);
    return result;
  }

  // Eliminar un comentario
  static async deleteComment(commentId: string): Promise<void> {
    console.log('Deleting comment:', commentId);
    
    const response = await fetch(`${API_BASE_URL}/${commentId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Error deleting comment: ${response.status} - ${response.statusText}`);
    }
    
    console.log('Comment deleted successfully');
  }

  // Convertir respuesta del backend a formato del frontend
  static convertToFrontendComment(backendComment: CommentResponse): CommentDef {
    // Handle both _id and id from backend
    const commentId = backendComment._id || backendComment.id || '';
    
    return {
      id: commentId,
      x: backendComment.coordinates[0],
      y: backendComment.coordinates[1],
      text: backendComment.content,
      user: {
        name: backendComment.user_name || "Usuario"  // Use username from backend, fallback to "Usuario"
      },
      // Añadimos campos adicionales para tracking
      backendId: commentId,
      dashboardId: backendComment.dashboard_id,
      userId: backendComment.user_id,
      createdAt: backendComment.created_at,
      updatedAt: backendComment.updated_at
    };
  }

  // Convertir comentario del frontend para enviar al backend
  static convertToBackendComment(frontendComment: CommentDef): CreateCommentRequest {
    return {
      content: frontendComment.text,
      coordinates: `${frontendComment.x},${frontendComment.y}`,
      user_name: frontendComment.user?.name  // Include username
    };
  }

}