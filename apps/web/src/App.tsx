import { FormEvent, useEffect, useMemo, useState } from 'react';
import WebApp from '@twa-dev/sdk';
import { createScrape, getScrapes, Scrape } from './api';

const format = (value?: string | number) => value === undefined || value === null ? '—' : new Intl.NumberFormat('vi-VN').format(Number(value));
const formatDate = (date: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(date));

export function App() {
  const [url, setUrl] = useState(''); const [items, setItems] = useState<Scrape[]>([]); const [type, setType] = useState('ALL'); const [order, setOrder] = useState('desc'); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const userId = WebApp.initDataUnsafe.user?.id?.toString();
  const refresh = async () => { try { setItems(await getScrapes(type, order)); } catch { setError('Không tải được lịch sử. Kiểm tra API rồi thử lại.'); } };
  useEffect(() => { refresh(); }, [type, order]);
  async function submit(event: FormEvent) { event.preventDefault(); setError(''); setLoading(true); try { const result = await createScrape(url.trim(), userId); setItems((old) => [result, ...old]); setUrl(''); WebApp.HapticFeedback.notificationOccurred('success'); } catch (e) { const message = e instanceof Error ? e.message : 'Không thể cào dữ liệu.'; setError(message); WebApp.HapticFeedback.notificationOccurred('error'); } finally { setLoading(false); } }
  const empty = useMemo(() => !loading && items.length === 0, [items.length, loading]);
  return <main>
    <header><p className="eyebrow">TELEGRAM MINI APP</p><h1>TikTok Data Scraper</h1><p>Nhập link video hoặc trang cá nhân công khai.</p></header>
    <form onSubmit={submit} className="card form"><label htmlFor="url">Link TikTok</label><input id="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.tiktok.com/@..." required disabled={loading}/><button disabled={loading}>{loading ? <><span className="spinner"/> Đang cào dữ liệu...</> : 'Cào dữ liệu'}</button>{error && <p className="error" role="alert">{error}</p>}</form>
    <section className="history"><div className="history-title"><h2>Lịch sử cào</h2><div className="filters"><select value={type} onChange={(e) => setType(e.target.value)} aria-label="Lọc loại link"><option value="ALL">Tất cả</option><option value="VIDEO">Video</option><option value="PROFILE">Profile</option></select><select value={order} onChange={(e) => setOrder(e.target.value)} aria-label="Sắp xếp thời gian"><option value="desc">Mới nhất</option><option value="asc">Cũ nhất</option></select></div></div>
      {empty ? <div className="empty">Chưa có dữ liệu. Hãy cào link TikTok đầu tiên.</div> : <div className="list">{items.map((item) => <HistoryCard item={item} key={item.id}/>)}</div>}
    </section>
  </main>;
}
function HistoryCard({ item }: { item: Scrape }) { const video = item.type === 'VIDEO'; return <article className="card result"><div className="result-head"><span className={'badge ' + item.type.toLowerCase()}>{video ? 'Video' : 'Profile'}</span><time>{formatDate(item.scrapedAt)}</time></div><a href={item.url} target="_blank" rel="noreferrer">{item.url}</a><div className="metrics">{video ? <><Metric label="Views" value={item.views}/><Metric label="Likes" value={item.likes}/><Metric label="Comments" value={item.comments}/><Metric label="Shares" value={item.shares}/></> : <><Metric label="Followers" value={item.followers}/><Metric label="Total likes" value={item.totalLikes}/><Metric label="Videos" value={item.totalVideos}/></>}</div></article>; }
function Metric({ label, value }: { label: string; value?: string | number }) { return <div><span>{label}</span><strong>{format(value)}</strong></div>; }
