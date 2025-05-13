import axios from 'axios';
import { VehicleInfo } from '../types/vehicle';
import WebSocket from 'ws';

interface ForumSource {
    url: string;
    title?: string;
    snippet?: string;
}

interface RepairPost {
    url: string;
    title: string | null;
    content: string;
    dtcCodes: string[];
    vehicleInfo: {
        make: string | null;
        year: string | null;
    };
    timestamp: string | null;
}
interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}
interface ForumDTCAnalyzerProps {
    forumUrl: string;
}
interface QueryResponse {
    answer: string;
    sources: ForumSource[];
}

interface ProcessForumResponse {
    success: boolean;
    message: string;
    pagesProcessed: number;
    totalChunks: number;
    
}

export class ForumCrawlerService {
    // Make sure this matches your server port
    private static readonly API_URL = process.env.API_BASE_URL || 'http://localhost:5000/api/forum-crawler';
    private static ws: any = null; // Will be replaced with proper WebSocket implementation

    public static async processForum(
        url: string, 
        question?: string,
        onProgress?: (data: any) => void
    ): Promise<ProcessForumResponse> {
        try {
            // Remove browser-specific WebSocket code
            const response = await axios.post<ProcessForumResponse>(
                `${this.API_URL}/process`, 
                { url, question }
            );

            return response.data;
        } catch (error) {
            console.error('Error processing forum:', error);
            throw error;
        }
    }

    public static async queryForum(question: string): Promise<QueryResponse> {
        try {
            const response = await axios.post<QueryResponse>(`${this.API_URL}/query`, { question });
            return response.data;
        } catch (error) {
            console.error('Error querying forum:', error);
            throw error;
        }
    }

    public static async searchForumPosts(
        vehicleInfo: Partial<VehicleInfo> = {},
        dtcCode?: string,
        forumUrls: string[] = []
    ): Promise<RepairPost[]> {
        try {
            console.log('Sending request to:', `${this.API_URL}/search`);
            console.log('Request payload:', {
                vehicleInfo,
                dtcCode,
                forumUrls
            });

            const response = await axios.post<RepairPost[]>(`${this.API_URL}/search`, {
                vehicleInfo: {
                    make: vehicleInfo.make || null,
                    year: vehicleInfo.year || null
                },
                dtcCode,
                forumUrls
            });
            
            console.log('Response:', response.data);
            return response.data;
        } catch (error: any) {
            if (axios.isAxiosError(error)) {
                console.error('Axios error:', {
                    message: error.message,
                    response: error.response?.data,
                    status: error.response?.status,
                    config: error.config
                });
            } else {
                console.error('Error searching forum posts:', error);
            }
            throw error;
        }
    }

    // Helper method to validate forum URL
    private static isValidForumUrl(url: string): boolean {
        try {
            const urlObj = new URL(url);
            // Add specific forum domain validations
            const allowedDomains = ['bmwforums.com', 'forums.example.com'];
            return allowedDomains.some(domain => urlObj.hostname.includes(domain));
        } catch {
            return false;
        }
    }

    // Helper method to sanitize input
    private static sanitizeInput(text: string): string {
        return text.trim();
    }

    // Add BMW Forums specific method
    public static async processBMWForum(url: string, options?: {
        maxDepth?: number;
        maxPages?: number;
        question?: string;
    }): Promise<ProcessForumResponse> {
        try {
            const response = await axios.post<ProcessForumResponse>(
                `${this.API_URL}/process-bmw`,
                { url, options }
            );
            return response.data;
        } catch (error) {
            console.error('Error processing BMW forum:', error);
            throw error;
        }
    }
}

// Export interfaces for use in other components
export type { RepairPost, QueryResponse, ProcessForumResponse, ForumSource };
