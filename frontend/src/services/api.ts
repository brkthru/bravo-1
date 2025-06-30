import axios from 'axios';
import {
  Campaign,
  ApiResponse,
  CreateCampaignRequest,
  UpdateCampaignRequest,
} from '@bravo-1/shared';

const api = axios.create({
  baseURL: '/api/v0',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const campaignApi = {
  // Get all campaigns with pagination
  getAll: async (
    search?: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{
    campaigns: Campaign[];
    pagination: {
      page: number;
      totalPages: number;
      total: number;
      limit: number;
    };
  }> => {
    const response = await api.get<
      ApiResponse<Campaign[]> & {
        pagination?: {
          page: number;
          totalPages: number;
          total: number;
          limit: number;
        };
      }
    >('/campaigns', {
      params: {
        ...(search ? { search } : {}),
        page,
        limit,
      },
    });

    if (!response.data.success) {
      throw new Error(response.data.error);
    }

    return {
      campaigns: response.data.data,
      pagination: response.data.pagination || {
        page: 1,
        totalPages: 1,
        total: response.data.data.length,
        limit: limit,
      },
    };
  },

  // Get campaign by ID
  getById: async (id: string): Promise<Campaign> => {
    const response = await api.get<ApiResponse<Campaign>>(`/campaigns/${id}`);

    if (!response.data.success) {
      throw new Error(response.data.error);
    }

    return response.data.data;
  },

  // Create new campaign
  create: async (campaign: CreateCampaignRequest): Promise<Campaign> => {
    const response = await api.post<ApiResponse<Campaign>>('/campaigns', campaign);

    if (!response.data.success) {
      throw new Error(response.data.error);
    }

    return response.data.data;
  },

  // Update campaign
  update: async (id: string, updates: UpdateCampaignRequest): Promise<Campaign> => {
    const response = await api.put<ApiResponse<Campaign>>(`/campaigns/${id}`, updates);

    if (!response.data.success) {
      throw new Error(response.data.error);
    }

    return response.data.data;
  },

  // Delete campaign
  delete: async (id: string): Promise<void> => {
    const response = await api.delete<ApiResponse<{ deleted: boolean }>>(`/campaigns/${id}`);

    if (!response.data.success) {
      throw new Error(response.data.error);
    }
  },
};

export default api;
