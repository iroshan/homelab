/**
 * Memos API Client
 * Handles all interactions with the Memos REST API
 */

const axios = require('axios');
const config = require('../config');

class MemosAPI {
    constructor() {
        this.baseURL = `${config.memos.url}${config.memos.apiBase}`;
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Store user tokens (in-memory for now)
        this.userTokens = new Map();
    }

    /**
     * Set authentication token for a user
     */
    setUserToken(userId, token) {
        this.userTokens.set(userId.toString(), token);
    }

    /**
     * Get authentication token for a user
     */
    getUserToken(userId) {
        return this.userTokens.get(userId.toString());
    }

    /**
     * Get authenticated axios instance for user
     */
    getAuthClient(userId) {
        const token = this.getUserToken(userId);
        if (!token) {
            return this.client;
        }

        return axios.create({
            baseURL: this.baseURL,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        });
    }

    /**
     * Create a new memo
     */
    async createMemo(userId, content, visibility = 'PRIVATE') {
        try {
            const client = this.getAuthClient(userId);
            const response = await client.post('/memos', {
                content,
                visibility,
            });
            return { success: true, data: response.data };
        } catch (error) {
            console.error('Error creating memo:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Search memos by content
     */
    async searchMemos(userId, query, limit = 10) {
        try {
            const client = this.getAuthClient(userId);
            const response = await client.get('/memos', {
                params: {
                    filter: `content:contains("${query}")`,
                    pageSize: limit,
                },
            });
            return { success: true, data: response.data.memos || [] };
        } catch (error) {
            console.error('Error searching memos:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * List recent memos
     */
    async listMemos(userId, limit = 10) {
        try {
            const client = this.getAuthClient(userId);
            const response = await client.get('/memos', {
                params: {
                    pageSize: limit,
                },
            });
            return { success: true, data: response.data.memos || [] };
        } catch (error) {
            console.error('Error listing memos:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get memos by tag
     */
    async getMemosByTag(userId, tag, limit = 10) {
        try {
            const client = this.getAuthClient(userId);
            const response = await client.get('/memos', {
                params: {
                    filter: `tag:"${tag}"`,
                    pageSize: limit,
                },
            });
            return { success: true, data: response.data.memos || [] };
        } catch (error) {
            console.error('Error getting memos by tag:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get memo statistics
     */
    async getStats(userId) {
        try {
            const client = this.getAuthClient(userId);
            const response = await client.get('/memos/stats');
            return { success: true, data: response.data };
        } catch (error) {
            console.error('Error getting stats:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Delete a memo
     */
    async deleteMemo(userId, memoName) {
        try {
            const client = this.getAuthClient(userId);
            await client.delete(`/${memoName}`);
            return { success: true };
        } catch (error) {
            console.error('Error deleting memo:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update a memo
     */
    async updateMemo(userId, memoName, content) {
        try {
            const client = this.getAuthClient(userId);
            const response = await client.patch(`/${memoName}`, {
                content,
            });
            return { success: true, data: response.data };
        } catch (error) {
            console.error('Error updating memo:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Extract tags from memo content
     */
    extractTags(content) {
        const tagRegex = /#(\w+)/g;
        const tags = [];
        let match;

        while ((match = tagRegex.exec(content)) !== null) {
            tags.push(match[1]);
        }

        return tags;
    }

    /**
     * Check if Memos is reachable
     */
    async healthCheck() {
        try {
            await this.client.get('/ping');
            return true;
        } catch (error) {
            console.error('Memos health check failed:', error.message);
            return false;
        }
    }
}

module.exports = new MemosAPI();
