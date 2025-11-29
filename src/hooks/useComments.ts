import { useState, useCallback, useEffect } from "react";
import { CommentDef } from "../types/types";
import { CommentsApiService } from "../services/commentsApi";
import { useCommentsWebSocket } from "./useCommentsWebSocket";

interface UseCommentsProps {
  dashboardId: string;
  userId: string;
}

export const useComments = ({ dashboardId, userId }: UseCommentsProps) => {
  const [comments, setComments] = useState<CommentDef[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🔹 WebSocket handlers for real-time updates
  const handleCommentCreated = useCallback((backendComment: any) => {
    console.log('[useComments] Comment created via WebSocket:', backendComment);
    const frontend = CommentsApiService.convertToFrontendComment(backendComment);
    
    setComments((prev) => {
      // Avoid duplicates: check if this comment already exists
      const exists = prev.some((c) => 
        c.backendId === frontend.backendId || 
        (c.backendId && c.backendId === backendComment._id)
      );
      
      if (exists) {
        console.log('[useComments] Comment already exists, updating it');
        return prev.map((c) => 
          (c.backendId === frontend.backendId || c.backendId === backendComment._id) ? frontend : c
        );
      }
      
      console.log('[useComments] Adding new comment from WebSocket');
      return [...prev, frontend];
    });
  }, []);

  const handleCommentUpdated = useCallback((backendComment: any) => {
    console.log('[useComments] Comment updated via WebSocket:', backendComment);
    const frontend = CommentsApiService.convertToFrontendComment(backendComment);
    
    setComments((prev) => 
      prev.map((c) => 
        (c.backendId === frontend.backendId || c.backendId === backendComment._id) ? frontend : c
      )
    );
  }, []);

  const handleCommentDeleted = useCallback((commentId: string) => {
    console.log('[useComments] Comment deleted via WebSocket:', commentId);
    
    setComments((prev) => prev.filter((c) => c.backendId !== commentId));
  }, []);

  // 🔹 Connect to Comments WebSocket
  const { isConnected } = useCommentsWebSocket({
    dashboardId,
    onCommentCreated: handleCommentCreated,
    onCommentUpdated: handleCommentUpdated,
    onCommentDeleted: handleCommentDeleted,
  });

  // 🔹 Cargar todos los comentarios
  const loadComments = useCallback(async () => {
    setLoading(true);
    try {
      const backendComments = await CommentsApiService.getCommentsByDashboard(dashboardId);
      const frontendComments = backendComments.map(CommentsApiService.convertToFrontendComment);
      // Preserve any temporary (unsaved) comments created locally so they don't vanish
      setComments((prev) => {
        const tempComments = prev.filter((c) => typeof c.id === 'string' && c.id.startsWith('temp-'));
        // Avoid duplicates: if a temp was saved and backend returned it, filter it out
        const tempWithoutSaved = tempComments.filter((t) => !frontendComments.some((fc) => fc.backendId === t.backendId || fc.id === t.id));
        return [...frontendComments, ...tempWithoutSaved];
      });
    } catch (err) {
      console.error("Error loading comments:", err);
      setError(err instanceof Error ? err.message : "Error loading comments");
    } finally {
      setLoading(false);
    }
  }, [dashboardId]);

  // 🔹 Crear comentario temporal
  const createTemporaryComment = useCallback((x: number, y: number) => {
    const tempId = `temp-${Date.now()}`;
    // Read the display name from localStorage if available
    const storedName = typeof window !== 'undefined' ? localStorage.getItem('user_name') : null;
    const tempComment: CommentDef = {
      id: tempId,
      backendId: undefined,
      text: "",
      x,
      y,
      user: { name: storedName || "Usuario" },
      dashboardId,
      userId,
    };
    setComments((prev) => [...prev, tempComment]);
    return tempComment;
  }, [dashboardId, userId]);

  // 🔹 Guardar comentario en backend
  const saveTemporaryComment = useCallback(
    async (tempId: string, text: string) => {
      const comment = comments.find((c) => c.id === tempId);
      if (!comment) return;
      
      try {
        const newComment = await CommentsApiService.createComment(
          dashboardId,
          userId,
          CommentsApiService.convertToBackendComment({ ...comment, text })
        );
        const converted = CommentsApiService.convertToFrontendComment(newComment);
        
        // Ensure the frontend shows the actual user_name from localStorage if available
        const storedName = typeof window !== 'undefined' ? localStorage.getItem('user_name') : null;
        if (storedName) converted.user = { name: storedName };

        // Replace temp comment with the saved one
        setComments((prev) => prev.map((c) => (c.id === tempId ? converted : c)));

        // No need to manually broadcast - the backend will broadcast via WebSocket to all connected clients
        console.log('[useComments] Comment saved, backend will broadcast to other clients');
        
        return converted;
      } catch (error) {
        console.error('[useComments] Failed to save comment:', error);
        throw error;
      }
    },
    [comments, dashboardId, userId]
  );

  // 🔹 Cancelar comentario temporal
  const cancelTemporaryComment = useCallback((id: string) => {
    setComments((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // 🔹 Actualizar comentario
  const updateComment = useCallback(async (id: string, text: string) => {
    const comment = comments.find((c) => c.id === id);
    if (!comment?.backendId) return;
    
    try {
      await CommentsApiService.updateComment(comment.backendId, { content: text });
      // Backend will broadcast the update via WebSocket, no need to update state here
      console.log('[useComments] Comment updated, backend will broadcast to all clients');
    } catch (error) {
      console.error('[useComments] Failed to update comment:', error);
      throw error;
    }
  }, [comments]);

  // 🔹 Eliminar comentario
  const deleteComment = useCallback(async (id: string) => {
    const comment = comments.find((c) => c.id === id);
    if (!comment?.backendId) return;
    
    try {
      await CommentsApiService.deleteComment(comment.backendId);
      // Backend will broadcast the deletion via WebSocket, no need to update state here
      console.log('[useComments] Comment deleted, backend will broadcast to all clients');
    } catch (error) {
      console.error('[useComments] Failed to delete comment:', error);
      throw error;
    }
  }, [comments]);

  // 🔹 Mover comentario (drag)
  const updateCommentPosition = useCallback(async (id: string, x: number, y: number) => {
    // Update local state immediately for smooth UX
    setComments((prev) => prev.map((c) => (c.id === id ? { ...c, x, y } : c)));
    
    // Find comment to get backendId
    const comment = comments.find(c => c.id === id);
    if (!comment || !comment.backendId) {
      console.warn('[useComments] Cannot update position: comment not found or no backendId');
      return;
    }
    
    try {
      // Persist to backend
      await CommentsApiService.updateCommentCoordinates(comment.backendId, x, y);
      console.log('[useComments] Comment position updated on backend');
      // Backend will broadcast the update via WebSocket to other clients
    } catch (error) {
      console.error('[useComments] Failed to update comment position:', error);
      // Optionally revert local state on error
    }
  }, [comments]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  return {
    comments,
    loading,
    error,
    isConnected,
    createTemporaryComment,
    saveTemporaryComment,
    cancelTemporaryComment,
    updateComment,
    deleteComment,
    updateCommentPosition,
  };
};
