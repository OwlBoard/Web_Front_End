import axios from "axios";
import { Layer, ShapeDef } from "../types/whiteboard";

const CANVAS_API_URL = 
  process.env.NEXT_PUBLIC_API_URL || 
  process.env.REACT_APP_CANVAS_SERVICE_URL || 
  "http://localhost:8000/api";

const apiClient = axios.create({
  baseURL: CANVAS_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Formato de figura que viene del backend de Go
interface BackendShape {
  user_id: string;
  type: string;
  layer_number: number;
  color: string;
  stroke_width: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  points?: number[];
  radius?: number;
}

// Formato de capa que viene del backend de Go
interface BackendLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
}

interface SaveCanvasRequest {
  canvasId?: string;
  userId: string;
  layers: BackendLayer[];
  shapes: BackendShape[];
}

interface SaveCanvasResponse {
  message: string;
}

interface GetCanvasResponse {
  layers: BackendLayer[];
  shapes: BackendShape[];
}

interface GetChecksumResponse {
  checksum: string;
}


export class CanvasApiService {
  /**
   * Transforma las figuras del formato del frontend (ShapeDef) al formato que espera el backend.
   * @param frontendShapes - Array de figuras del estado de la aplicación.
   * @param userId - El ID del usuario que guarda las figuras.
   * @param layers - El array de capas para determinar el número de capa.
   * @returns Un array de figuras en el formato del backend.
   */
  private static transformShapesForBackend(frontendShapes: ShapeDef[], userId: string, layers: any[]): BackendShape[] {
    const layerIndexMap = new Map(layers.map((layer, index) => [layer.id, index]));

    return frontendShapes.map((shape) => {
      const layerNumber = layerIndexMap.get(shape.layerId) ?? 0;

      const baseBackendShape: Partial<BackendShape> = {
        type: shape.type,
        layer_number: layerNumber,
        color: shape.stroke || "#000000",
        stroke_width: shape.strokeWidth || 1,
      };

      if (shape.type === "rect" && shape.x !== undefined && shape.y !== undefined) {
        return { ...baseBackendShape, x1: shape.x, y1: shape.y, x2: shape.x + shape.width, y2: shape.y + shape.height } as BackendShape;
      }
      if ((shape.type === "pen" || shape.type === "line") && shape.points) {
        return { ...baseBackendShape, points: shape.points.map(p => parseFloat(p.toString())) } as BackendShape;
      }
      if ((shape.type === "circle" || shape.type === "ellipse") && shape.x !== undefined && shape.y !== undefined) {
        return { ...baseBackendShape, x1: shape.x, y1: shape.y, radius: shape.radiusX } as BackendShape;
      }
      if (shape.type === "polygon" && shape.points) {
        // Para los polígonos, solo nos interesan los puntos, no el radio.
        const points = (shape as any).points || [];
        return { ...baseBackendShape, points: points.map((p: number) => parseFloat(p.toString())) } as BackendShape;
      }

      return baseBackendShape as BackendShape;
    });
  }

  /**
   * Guarda el estado actual del canvas (todas las figuras).
   * @param payload - Contiene el ID del tablero, el ID del usuario y las figuras del frontend.
   * @returns La respuesta del servidor.
   */
  static async saveCanvas(payload: { dashboardId: string; userId: string; shapes: ShapeDef[]; layers: any[] }): Promise<SaveCanvasResponse> {
    const backendLayers = payload.layers.map(l => ({
      id: l.id,
      name: l.name,
      visible: l.visible,
      locked: l.locked
    }));
    const backendShapes = this.transformShapesForBackend(payload.shapes, payload.userId, payload.layers);

    const requestBody: SaveCanvasRequest = {
      canvasId: payload.dashboardId,
      userId: payload.userId,
      layers: backendLayers,
      shapes: backendShapes,
    };

    const response = await apiClient.post<SaveCanvasResponse>("/canvas/save", requestBody);
    return response.data;
  }

  /**
   * Transforma las figuras del formato del backend al formato que espera el frontend.
   * @param backendShapes - Array de figuras del backend.
   * @returns Un array de figuras en el formato del frontend (ShapeDef).
   */
  private static transformShapesFromBackend(backendShapes: BackendShape[], layers: Layer[]): ShapeDef[] {
    const layerIdMap = new Map(layers.map((layer, index) => [index, layer.id]));

    return backendShapes.map((shape, index) => {
      const layerId = layerIdMap.get(shape.layer_number) ?? (layers.length > 0 ? layers[0].id : 'default-layer');

      const baseFrontendShape: Partial<ShapeDef> = {
        id: `${shape.type}-${Date.now()}-${index}`, // Generar un ID único para el frontend
        type: shape.type as any,
        layerId: layerId,
        stroke: shape.color,
        strokeWidth: shape.stroke_width,
        opacity: 1, // Asumir opacidad 1 si no viene del backend
      };

      if (shape.type === "rect" && shape.x1 !== undefined && shape.y1 !== undefined && shape.x2 !== undefined && shape.y2 !== undefined) {
        return { ...baseFrontendShape, x: shape.x1, y: shape.y1, width: shape.x2 - shape.x1, height: shape.y2 - shape.y1 } as ShapeDef;
      }
      if ((shape.type === "pen" || shape.type === "line" || shape.type === "polygon") && shape.points) {
        return { ...baseFrontendShape, points: shape.points } as ShapeDef;
      }
      if ((shape.type === "circle" || shape.type === "ellipse") && shape.x1 !== undefined && shape.y1 !== undefined && shape.radius !== undefined) {
        return { ...baseFrontendShape, x: shape.x1, y: shape.y1, radiusX: shape.radius, radiusY: shape.radius } as ShapeDef;
      }
      if (shape.type === "polygon" && shape.x1 !== undefined && shape.y1 !== undefined && shape.radius !== undefined) {
        return { ...baseFrontendShape, x: shape.x1, y: shape.y1, radius: shape.radius, sides: 6, points: [] } as ShapeDef; // Asumimos 6 lados y points vacío
      }

      return baseFrontendShape as ShapeDef;
    });
  }

  /**
   * Obtiene el estado completo de un canvas (capas y figuras).
   * @param dashboardId - El ID del tablero a cargar.
   * @returns Un objeto con las capas y figuras en el formato del frontend.
   */
  static async getCanvas(dashboardId: string): Promise<{ layers: Layer[]; shapes: ShapeDef[] }> {
    const response = await apiClient.get<GetCanvasResponse>(`/canvas`, {
      params: { id: dashboardId },
    });

    const { layers: backendLayers, shapes: backendShapes } = response.data;

    if (!backendLayers || backendLayers.length === 0) {
      return { layers: [], shapes: [] };
    }

    const frontendShapes = this.transformShapesFromBackend(backendShapes, backendLayers);
    return { layers: backendLayers, shapes: frontendShapes };
  }

  /**
   * Obtiene el checksum actual del canvas desde el backend.
   * @param dashboardId - El ID del tablero a verificar.
   * @returns El checksum como una cadena de texto.
   */
  static async getChecksum(dashboardId: string): Promise<string> {
    const response = await apiClient.get<GetChecksumResponse>(`/canvas/checksum`, { params: { id: dashboardId } });
    return response.data.checksum;
  }
}