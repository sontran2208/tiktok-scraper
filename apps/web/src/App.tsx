import { FormEvent, useEffect, useMemo, useState } from 'react';
import WebApp from '@twa-dev/sdk';
import { createScrape, getScrapes, Scrape } from './api';

const format = (value?: string | number) => value === undefined || value === null ? '—' : new Intl.NumberFormat('vi-VN').format(Number(value));
const formatDate = (date: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(date));

const LIMIT = 10;

export function App() {
  const [url, setUrl] = useState('');
  const [items, setItems] = useState<Scrape[]>([]);
  const [type, setType] = useState('ALL');
  const [order, setOrder] = useState('desc');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const userId = WebApp.initDataUnsafe.user?.id?.toString();

  const refresh = async (p: number = page) => {
    setHistoryLoading(true);
    try {
      const res = await getScrapes(type, order, p, LIMIT);
      // Handle both old format (array) and new paginated format ({data, meta})
      if (Array.isArray(res)) {
        setItems(res as unknown as Scrape[]);
        setTotalPages(1);
        setTotal((res as unknown as Scrape[]).length);
      } else {
        setItems(res.data ?? []);
        setTotalPages(res.meta?.totalPages ?? 1);
        setTotal(res.meta?.total ?? 0);
      }
    }
    catch { setError('Không tải được lịch sử. Kiểm tra API rồi thử lại.'); }
    finally { setHistoryLoading(false); }
  };

  useEffect(() => {
    setPage(1);
    refresh(1);
  }, [type, order]);

  useEffect(() => {
    refresh(page);
  }, [page]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await createScrape(url.trim(), userId);
      setUrl('');
      WebApp.HapticFeedback.notificationOccurred('success');
      // Reload trang 1 để hiện item mới nhất
      setPage(1);
      await refresh(1);
    }
    catch (e) {
      const message = e instanceof Error ? e.message : 'Không thể cào dữ liệu.';
      setError(message);
      WebApp.HapticFeedback.notificationOccurred('error');
    } finally { setLoading(false); }
  }

  const empty = useMemo(() => !historyLoading && items.length === 0, [items.length, historyLoading]);

  return <main>
    <header>
      <p className="eyebrow">TELEGRAM MINI APP</p>
      <h1>TikTok Data Scraper</h1>
      <p>Nhập link video hoặc trang cá nhân công khai.</p>
    </header>
    <form onSubmit={submit} className="card form">
      <label htmlFor="url">Link TikTok</label>
      <input
        id="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://www.tiktok.com/@..."
        required
        disabled={loading}
      />
      <button disabled={loading}>
        {loading ? <><span className="spinner" /> Đang cào dữ liệu...</> : 'Cào dữ liệu'}
      </button>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
    <section className="history">
      <div className="history-title">
        <div>
          <h2>Lịch sử cào</h2>
          {!historyLoading && total > 0 && (
            <p className="history-count">{total} kết quả</p>
          )}
        </div>
        <div className="filters">
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Lọc loại link">
            <option value="ALL">Tất cả</option>
            <option value="VIDEO">Video</option>
            <option value="PROFILE">Profile</option>
          </select>
          <select value={order} onChange={(e) => setOrder(e.target.value)} aria-label="Sắp xếp thời gian">
            <option value="desc">Mới nhất</option>
            <option value="asc">Cũ nhất</option>
          </select>
        </div>
      </div>

      {historyLoading
        ? <div className="list">{[1, 2, 3].map((n) => <SkeletonCard key={n} />)}</div>
        : empty
          ? <div className="empty">Chưa có dữ liệu. Hãy cào link TikTok đầu tiên.</div>
          : <div className="list">{items.map((item) => <HistoryCard item={item} key={item.id} />)}</div>}

      {!historyLoading && totalPages > 1 && (
        <div className="pagination">
          <button
            className="page-btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            aria-label="Trang trước"
          >
            ←
          </button>
          <span className="page-info">
            Trang <strong>{page}</strong> / {totalPages}
          </span>
          <button
            className="page-btn"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            aria-label="Trang sau"
          >
            →
          </button>
        </div>
      )}
    </section>
  </main>;
}

function SkeletonCard() {
  return (
    <article className="card result skeleton">
      <div className="skeleton-line short" />
      <div className="skeleton-line" />
      <div className="skeleton-metrics">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="skeleton-metric">
            <div className="skeleton-line mini" />
            <div className="skeleton-line mid" />
          </div>
        ))}
      </div>
    </article>
  );
}

function HistoryCard({ item }: { item: Scrape }) {
  const video = item.type === 'VIDEO';
  return <article className="card result">
    <div className="result-head">
      <span className={'badge ' + item.type.toLowerCase()}>{video ? 'Video' : 'Profile'}</span>
      <time>{formatDate(item.scrapedAt)}</time>
    </div>
    <a href={item.url} target="_blank" rel="noreferrer">{item.url}</a>
    <div className="metrics">
      {video ? <>
        <Metric label="Views" value={item.views} />
        <Metric label="Likes" value={item.likes} />
        <Metric label="Comments" value={item.comments} />
        <Metric label="Shares" value={item.shares} />
      </> : <>
        <Metric label="Followers" value={item.followers} />
        <Metric label="Total likes" value={item.totalLikes} />
        <Metric label="Videos" value={item.totalVideos} />
      </>}
    </div>
  </article>;
}

function Metric({ label, value }: { label: string; value?: string | number }) {
  return <div>
    <span>{label}</span>
    <strong>{format(value)}</strong>
  </div>;
}
