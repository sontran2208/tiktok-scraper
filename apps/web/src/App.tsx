import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import WebApp from '@twa-dev/sdk';
import toast from 'react-hot-toast';
import { createScrape, getScrapes, getProfileVideos, Scrape, ProfileVideo, ProfileVideosResponse } from './api';

const format = (value?: string | number) =>
  value === undefined || value === null ? '—' : new Intl.NumberFormat('vi-VN').format(Number(value));
const formatDate = (date: string) =>
  new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(date));

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
      if (Array.isArray(res)) {
        setItems(res as unknown as Scrape[]);
        setTotalPages(1);
        setTotal((res as unknown as Scrape[]).length);
      } else {
        setItems(res.data ?? []);
        setTotalPages(res.meta?.totalPages ?? 1);
        setTotal(res.meta?.total ?? 0);
      }
    } catch {
      setError('Không tải được lịch sử. Kiểm tra API rồi thử lại.');
    } finally {
      setHistoryLoading(false);
    }
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
    const toastId = toast.loading('Đang cào dữ liệu...');
    try {
      await createScrape(url.trim(), userId);
      setUrl('');
      WebApp.HapticFeedback.notificationOccurred('success');
      toast.success('Cào dữ liệu thành công!', { id: toastId });
      setPage(1);
      await refresh(1);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Không thể cào dữ liệu.';
      setError(message);
      WebApp.HapticFeedback.notificationOccurred('error');
      toast.error(message, { id: toastId });
    } finally {
      setLoading(false);
    }
  }

  const empty = useMemo(() => !historyLoading && items.length === 0, [items.length, historyLoading]);

  return (
    <main>
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
              onClick={() => {
                setPage((p) => Math.max(1, p - 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
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
              onClick={() => {
                setPage((p) => Math.min(totalPages, p + 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              disabled={page >= totalPages}
              aria-label="Trang sau"
            >
              →
            </button>
          </div>
        )}
      </section>
    </main>
  );
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
  const isProfile = item.type === 'PROFILE';
  const [expanded, setExpanded] = useState(false);
  const [videosData, setVideosData] = useState<ProfileVideosResponse | null>(null);
  const [videoPage, setVideoPage] = useState(1);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchVideos = useCallback(async (p = 1) => {
    setLoadingVideos(true);
    try {
      const res = await getProfileVideos(item.id, p, 20);
      setVideosData(res);
      setVideoPage(p);
      // Nếu job vẫn đang chạy → poll
      if (res.jobStatus === 'PENDING' || res.jobStatus === 'RUNNING') {
        if (!pollRef.current) {
          pollRef.current = setInterval(async () => {
            const updated = await getProfileVideos(item.id, p, 20).catch(() => null);
            if (updated) setVideosData(updated);
            if (updated?.jobStatus === 'DONE' || updated?.jobStatus === 'FAILED') {
              clearInterval(pollRef.current!);
              pollRef.current = null;
            }
          }, 3000);
        }
      }
    } catch { /* ignore */ } finally {
      setLoadingVideos(false);
    }
  }, [item.id]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleExpand = () => {
    if (!expanded) fetchVideos(1);
    setExpanded((v) => !v);
  };

  const jobStatus = videosData?.jobStatus ?? item.videoJobStatus;

  return (
    <article className="card result">
      <div className="result-head">
        <span className={'badge ' + item.type.toLowerCase()}>{video ? 'Video' : 'Profile'}</span>
        <time>{formatDate(item.scrapedAt)}</time>
      </div>
      <a href={item.url} target="_blank" rel="noreferrer">{item.url}</a>
      <div className={`metrics ${video ? 'video' : 'profile'}`}>
        {video ? <>
          <Metric label="Views" value={item.views} />
          <Metric label="Likes" value={item.likes} />
          <Metric label="Comments" value={item.comments} />
          <Metric label="Shares" value={item.shares} />
        </> : <>
          <Metric label="Followers" value={item.followers} />
          <Metric label="Total likes" value={item.totalLikes} />
          <Metric label="Videos" value={videosData?.meta.total ?? item.totalVideos} />
        </>}
      </div>

      {isProfile && (
        <div className="profile-videos-section">
          <button className="videos-toggle" onClick={handleExpand}>
            {expanded ? '▲ Ẩn danh sách video' : '▼ Xem danh sách video'}
            <JobStatusBadge status={jobStatus} />
          </button>

          {expanded && (
            <div className="videos-list">
              {loadingVideos && !videosData && (
                <div className="videos-loading">
                  <span className="spinner" /> Đang tải...
                </div>
              )}

              {jobStatus === 'PENDING' && (
                <div className="job-notice pending">⏳ Đang xếp hàng cào video...</div>
              )}
              {jobStatus === 'RUNNING' && (
                <div className="job-notice running">
                  <span className="spinner" /> Đang cào video trong nền...
                </div>
              )}
              {jobStatus === 'FAILED' && (
                <div className="job-notice failed">❌ Cào video thất bại: {videosData?.jobError}</div>
              )}

              {videosData && videosData.data.length > 0 && (
                <>
                  <p className="videos-count">{videosData.meta.total} video</p>
                  <div className="video-cards">
                    {videosData.data.map((v) => <VideoCard key={v.id} video={v} />)}
                  </div>
                  {videosData.meta.totalPages > 1 && (
                    <div className="pagination pagination--compact">
                      <button
                        className="page-btn"
                        disabled={videoPage <= 1}
                        onClick={() => fetchVideos(videoPage - 1)}
                      >←</button>
                      <span className="page-info">
                        <strong>{videoPage}</strong> / {videosData.meta.totalPages}
                      </span>
                      <button
                        className="page-btn"
                        disabled={videoPage >= videosData.meta.totalPages}
                        onClick={() => fetchVideos(videoPage + 1)}
                      >→</button>
                    </div>
                  )}
                </>
              )}

              {videosData && videosData.data.length === 0 && jobStatus === 'DONE' && (
                <div className="empty">Không tìm thấy video nào.</div>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function JobStatusBadge({ status }: { status?: string | null }) {
  if (!status) return null;
  const map: Record<string, { label: string; cls: string }> = {
    PENDING: { label: '⏳ Đang chờ', cls: 'job-pending' },
    RUNNING: { label: '⚙️ Đang cào', cls: 'job-running' },
    DONE: { label: '✅ Hoàn tất', cls: 'job-done' },
    FAILED: { label: '❌ Thất bại', cls: 'job-failed' },
  };
  const info = map[status];
  if (!info) return null;
  return <span className={`job-badge ${info.cls}`}>{info.label}</span>;
}

function VideoCard({ video }: { video: ProfileVideo }) {
  return (
    <a className="video-card" href={video.videoUrl} target="_blank" rel="noreferrer">
      {video.coverUrl && (
        <img className="video-cover" src={video.coverUrl} alt="cover" loading="lazy" />
      )}
      <div className="video-info">
        {video.description && (
          <p className="video-desc">{video.description}</p>
        )}
        <div className="video-metrics">
          <span>👁 {format(video.views)}</span>
          <span>❤️ {format(video.likes)}</span>
          <span>💬 {format(video.comments)}</span>
          <span>↗ {format(video.shares)}</span>
        </div>
        {video.publishedAt && (
          <time className="video-date">{formatDate(video.publishedAt)}</time>
        )}
      </div>
    </a>
  );
}

function Metric({ label, value }: { label: string; value?: string | number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{format(value)}</strong>
    </div>
  );
}
