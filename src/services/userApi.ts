// src/services/userApi.ts
import axios from 'axios';
import { AuthResponse } from '../types/AuthResponse';

// ✅ Base URL for User Service - Use API Gateway for proper CORS handling
const USER_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 
  process.env.REACT_APP_USER_SERVICE_URL || 
  'http://localhost:8000/api';

// Configure axios instance
const userApiClient = axios.create({
  baseURL: USER_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json', // Changed from x-www-form-urlencoded to JSON
  },
  timeout: 10000,
});

// Request/Response interfaces
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name?: string;
}

export interface UserOut {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
}

export interface DashboardOut {
  id: number;
  title: string;
  description: string | null;
  owner_id: number;
}

export interface UserUpdateRequest {
  full_name?: string;
  password?: string;
}

// API Service Class
export class UserApiService {
  // ✅ User Registration (JSON)
  static async register(userData: RegisterRequest): Promise<AuthResponse> {
    const response = await userApiClient.post<AuthResponse>('users/register', {
      email: userData.email,
      password: userData.password,
      full_name: userData.full_name || 'Usuario',
    });
    return response.data;
  }

  // ✅ User Login (JSON)
  static async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await userApiClient.post<AuthResponse>('users/login', {
      email: credentials.email,
      password: credentials.password,
    });
    return response.data;
  }

  // Get all users
  static async getAllUsers(): Promise<UserOut[]> {
    const response = await userApiClient.get<UserOut[]>('users');
    return response.data;
  }

  // Get user by ID
  static async getUserById(userId: number): Promise<UserOut> {
    const response = await userApiClient.get<UserOut>(`users/${userId}`);
    return response.data;
  }

  // Update user
  static async updateUser(userId: number, updateData: UserUpdateRequest): Promise<UserOut> {
    const response = await userApiClient.put<UserOut>(`users/${userId}`, updateData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  }

  // Delete user (soft delete by default)
  static async deleteUser(userId: number, hard: boolean = false): Promise<void> {
    await userApiClient.delete(`users/${userId}?hard=${hard}`);
  }

  // Get user dashboards
  static async getUserDashboards(userId: number): Promise<DashboardOut[]> {
    const response = await userApiClient.get<DashboardOut[]>(`users/${userId}/dashboards`);
    return response.data;
  }
}

// Convenience functions for easier imports
export const registerUser = UserApiService.register;
export const loginUser = UserApiService.login;
export const getUser = UserApiService.getUserById;
export const getAllUsers = UserApiService.getAllUsers;
export const updateUser = UserApiService.updateUser;
export const deleteUser = UserApiService.deleteUser;
export const getUserDashboards = UserApiService.getUserDashboards;
