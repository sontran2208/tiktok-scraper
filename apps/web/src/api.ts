const API_URL = import.meta.env.VITE_API_URL ?? '/api';

export type Scrape = {
    id: string;
    url: string;
    type: 'VIDEO' | 'PROFILE';
    views?: string;
    likes?: string;
    comments?: string;
    shares?: string;
    followers?: string;
    totalLikes?: string;
    totalVideos?: number;
    scrapedAt: string;
};

export type PaginatedResponse<T> = {
    data: T[];
    meta: { total: number; page: number; limit: number; totalPages: number };
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
        headers: { 'content-type': 'application/json', ...init?.headers },
        ...init
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Có lỗi xảy ra.');
    return data;
}

export const getScrapes = (type = 'ALL', order = 'desc', page = 1, limit = 10) =>
    request<PaginatedResponse<Scrape>>(`/scrapes?${new URLSearchParams({
        ...(type !== 'ALL' ? { type } : {}),
        order,
        page: String(page),
        limit: String(limit),
    })}`);

export const createScrape = (url: string, telegramUserId?: string) =>
    request<Scrape>('/scrapes', { method: 'POST', body: JSON.stringify({ url, telegramUserId }) });

