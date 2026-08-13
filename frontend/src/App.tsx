import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  Activity, AlertTriangle, ArrowUpRight, BarChart3, Bell, BookOpen, Bot,
  Check, ChevronDown, ChevronRight, CircleHelp, Clock3, CloudUpload, Code2,
  Database, Download, FileText, Filter, Gauge, Grid2X2, LayoutDashboard,
  List, LoaderCircle, Menu, MoreHorizontal, PanelRightClose, Play, Plus,
  RefreshCw, Search, Settings2, SlidersHorizontal, Sparkles, Tags, Upload,
  Users, Wifi, X, Zap,
} from 'lucide-react'

type Page = 'dashboard' | 'sync' | 'environment' | 'settings'
type Creator = {
  id: string; name: string; initials: string; category: string; sub: string
  avatarUrl?: string | null; followerCount?: number | null; latestVideoTitle?: string | null; latestVideoUrl?: string | null
  heat: number; activity: number; quality: number; weekly: number
  views: string; likes: string; updated: string; status: '重点关注' | '观察中' | '低优先级'
  evidence: string[]; keywords: string[]; heatDataStatus?: 'complete' | 'partial' | 'insufficient'; categoryOverride?: string | null; statusOverride?: string | null; notes?: string | null
  analyzedAt?: string; contents?: Array<{ title: string; url?: string | null; summary?: string | null; published_at?: string | null; view_count?: number | null; like_count?: number | null; comment_count?: number | null; share_count?: number | null; heat_score?: number | null }>; detailStats?: { total_articles?: number; avg_views?: number | null; avg_likes?: number | null; avg_comments?: number | null; weekly_posts?: Record<string, number>; original_ratio?: number | null }
}

const demoCreators: Creator[] = [
  { id: '1', name: '少数派', initials: '少', category: '产品 / 设计', sub: '效率工具', heat: 91.2, activity: 96, quality: 89, weekly: 4.2, views: '8.6w', likes: '2,130', updated: '12 分钟前', status: '重点关注', evidence: ['效率工具评测占比 42%', '近 30 天持续发布 18 篇'], keywords: ['AI 工具', '效率', '工作流', 'iOS', '知识管理'] },
  { id: '2', name: '机器之心', initials: '机', category: 'AI / 科技', sub: 'AI 行业动态', heat: 88.5, activity: 92, quality: 86, weekly: 3.8, views: '5.2w', likes: '1,584', updated: '38 分钟前', status: '重点关注', evidence: ['AI 行业动态占比 58%', '高频关键词：模型、Agent'], keywords: ['大模型', 'Agent', '开源', '论文', '行业'] },
  { id: '3', name: '晚点 LatePost', initials: '晚', category: '商业 / 投资', sub: '商业观察', heat: 84.8, activity: 71, quality: 93, weekly: 1.6, views: '12.4w', likes: '3,870', updated: '2 小时前', status: '重点关注', evidence: ['商业观察类文章互动率较高', '平均篇幅 3,420 字'], keywords: ['消费', '创业', '投资', '公司', '增长'] },
  { id: '4', name: '人人都是产品经理', initials: '人', category: '产品 / 设计', sub: '产品运营', heat: 77.3, activity: 88, quality: 75, weekly: 5.3, views: '2.8w', likes: '690', updated: '3 小时前', status: '观察中', evidence: ['产品运营内容占比 65%', '周均更新 5.3 篇'], keywords: ['产品经理', '用户研究', '运营', '增长', '方法论'] },
  { id: '5', name: '极客公园', initials: '极', category: 'AI / 科技', sub: '科技资讯', heat: 72.6, activity: 83, quality: 72, weekly: 2.8, views: '3.4w', likes: '820', updated: '5 小时前', status: '观察中', evidence: ['科技资讯与产品发布占比 71%', '近 90 天发文稳定'], keywords: ['科技', '硬件', '创新', '产品', '发布会'] },
  { id: '6', name: '设计杂谈', initials: '设', category: '产品 / 设计', sub: 'UI/UX 设计', heat: 68.9, activity: 63, quality: 82, weekly: 1.3, views: '1.6w', likes: '438', updated: '昨天', status: '观察中', evidence: ['UI/UX 设计为主导主题', '原创比例 94%'], keywords: ['设计系统', '交互', '视觉', '灵感', 'Figma'] },
  { id: '7', name: '职人社', initials: '职', category: '职业 / 成长', sub: '职场成长', heat: 56.4, activity: 49, quality: 69, weekly: 0.8, views: '9,800', likes: '208', updated: '3 天前', status: '低优先级', evidence: ['近 30 天更新频率偏低', '内容主题较为分散'], keywords: ['职场', '沟通', '管理', '成长', '选择'] },
  { id: '8', name: '新潮沉思录', initials: '新', category: '文化 / 生活', sub: '文化观察', heat: 49.8, activity: 36, quality: 79, weekly: 0.4, views: '7,200', likes: '156', updated: '12 天前', status: '低优先级', evidence: ['阅读数据缺失 36%', '最近一次更新距今 12 天'], keywords: ['文化', '生活方式', '城市', '观察', '阅读'] },
]

const navItems: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: '洞察总览', icon: LayoutDashboard },
  { id: 'sync', label: '数据接入', icon: CloudUpload },
  { id: 'environment', label: '运行环境', icon: Gauge },
  { id: 'settings', label: '分析设置', icon: SlidersHorizontal },
]

const chartData = [18, 24, 21, 34, 29, 41, 37, 49, 45, 58, 53, 66]
const API_BASE = 'http://127.0.0.1:8765/api'

type ImportResponse = {
  items: Array<{
    id: string; platform_uid?: string | null; name: string; avatar_url?: string | null; follower_count?: number | null; category_main: string; category_sub?: string | null
    heat_score: number; activity_score: number; quality_score: number; weekly_count?: number; latest_video_title?: string | null; latest_video_url?: string | null
    article_count: number; avg_views?: number | null; avg_likes?: number | null
    status: string; heat_data_status?: 'complete' | 'partial' | 'insufficient'; analysis_evidence?: string[]; top_keywords?: string[]; update_frequency?: number; analyzed_at?: string; category_override?: string | null; status_override?: string | null; manual_notes?: string | null; contents?: Array<{ title: string; url?: string | null; summary?: string | null; published_at?: string | null; view_count?: number | null; like_count?: number | null; comment_count?: number | null; share_count?: number | null; heat_score?: number | null }>; stats?: Creator['detailStats']
  }>
  creator_count: number; content_count: number; filename: string
}

type BilibiliStatus = {
  ready: boolean
  logged_in: boolean | null
  message: string
  user?: { uid: string; name: string }
  status?: string
  creator_count?: number
  content_count?: number
  pipeline?: string[]
}

type BilibiliLogin = {
  status: 'idle' | 'waiting' | 'scanned' | 'expired' | 'logged_in'
  message: string
  qr_image?: string
  user?: { uid: string; name: string }
  expires_in?: number
}

type BilibiliSyncState = {
  job_id?: string | null
  status: 'idle' | 'running' | 'completed' | 'failed' | 'stopped'
  phase: string
  message: string
  following_total: number
  followings_processed: number
  videos_scanned: number
  new_content: number
  new_creators?: number
  total_creator_count: number
  total_content_count: number
}
type MetricsState = { status: 'idle' | 'starting' | 'running' | 'completed' | 'failed'; processed: number; total: number; updated: number; message: string }

type SyncHistoryItem = BilibiliSyncState & {
  id: string
  started_at?: string | null
  finished_at?: string | null
}
type CategoryStat = { name: string; count: number; children?: Array<{ name: string; count: number }> }

function formatMetric(value: number | null | undefined): string {
  if (value == null) return '数据不足'
  if (value >= 10000) return `${(value / 10000).toFixed(1)}w`
  return value.toLocaleString('zh-CN')
}

function topicGradient(stats: CategoryStat[], total: number): string {
  const tones = ['#baf7ff', '#8fe8f4', '#6cd2e5', '#54b8d2', '#77d8ed', '#9eeef7', '#4fa6c0', '#a8f3fb']
  const sum = stats.reduce((value, item) => value + item.count, 0) || total || 1
  let cursor = 0
  return stats.slice(0, 12).map((item, index) => { const start = cursor; cursor += item.count / sum * 100; return `${tones[index % tones.length]} ${start}% ${Math.max(start + .7, cursor - .8)}%, rgba(37, 113, 139, .55) ${Math.max(start + .7, cursor - .8)}% ${cursor}%` }).join(', ')
}

function exportCreators(items: Creator[]) {
  const header = '账号,分类,状态,热度,活跃度,视频数,关键词\n'
  const rows = items.map((item) => [item.name, item.category, item.status, item.heat, item.activity, item.contents?.length ?? '', item.keywords.join('、')].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([`\uFEFF${header}${rows}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a'); link.href = url; link.download = `创作者洞察台-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url)
}

function mapImportedCreator(item: ImportResponse['items'][number]): Creator {
  const status: Creator['status'] = item.status === '重点关注' || item.status === '低优先级' ? item.status : '观察中'
  return {
    id: item.id, name: item.name, initials: item.name.slice(0, 1), avatarUrl: item.platform_uid ? `${API_BASE}/bilibili/avatar/${encodeURIComponent(item.platform_uid)}` : item.avatar_url, followerCount: item.follower_count, latestVideoTitle: item.latest_video_title, latestVideoUrl: item.latest_video_url,
    category: item.category_main || '待同步 / 无样本', sub: item.category_sub || '等待最新视频样本',
    heat: item.heat_score || 0, activity: item.activity_score || 0, quality: item.quality_score || 0,
    weekly: item.weekly_count ?? item.update_frequency ?? 0, views: formatMetric(item.avg_views), likes: formatMetric(item.avg_likes),
    updated: '刚刚导入', status,
    evidence: item.analysis_evidence?.length ? item.analysis_evidence : [`已入库 ${item.article_count} 条视频`, '点击运行分析生成系统判断依据'],
    keywords: item.top_keywords?.length ? item.top_keywords : ['待分析'],
    heatDataStatus: item.heat_data_status || 'insufficient', analyzedAt: item.analyzed_at, categoryOverride: item.category_override, statusOverride: item.status_override, notes: item.manual_notes, contents: item.contents, detailStats: item.stats,
  }
}

function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [selected, setSelected] = useState<Creator | null>(null)
  const [creatorData, setCreatorData] = useState<Creator[]>([])
  const [summary, setSummary] = useState({ total: 0, contents: 0, priority: 0, review: 0, newCreators: 0 })
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('全部分类')
  const [status, setStatus] = useState('全部状态')
  const [view, setView] = useState<'grid' | 'table'>('grid')
  const [syncing, setSyncing] = useState(false)
  const [toast, setToast] = useState('')
  const [mobileNav, setMobileNav] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [analysisRunning, setAnalysisRunning] = useState(false)
  const [bilibiliStatus, setBilibiliStatus] = useState<BilibiliStatus | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [loginState, setLoginState] = useState<BilibiliLogin>({ status: 'idle', message: '准备生成二维码' })
  const [bilibiliSync, setBilibiliSync] = useState<BilibiliSyncState>({ status: 'idle', phase: 'idle', message: '尚未开始自动读取', following_total: 0, followings_processed: 0, videos_scanned: 0, new_content: 0, total_creator_count: 0, total_content_count: 0 })
  const [syncHistory, setSyncHistory] = useState<SyncHistoryItem[]>([])
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([])
  const [sortBy, setSortBy] = useState('heat')
  const [creatorPage, setCreatorPage] = useState(1)
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [trendModalOpen, setTrendModalOpen] = useState(false)
  const [metricsState, setMetricsState] = useState<MetricsState>({ status: 'idle', processed: 0, total: 0, updated: 0, message: '尚未补齐视频互动数据' })
  const reduceMotion = useReducedMotion()

  const filtered = useMemo(() => creatorData.filter((creator) => {
    const matchesQuery = !query || `${creator.name}${creator.category}${creator.sub}`.toLowerCase().includes(query.toLowerCase())
    const matchesCategory = category === '全部分类' || creator.category === category
    const matchesStatus = status === '全部状态' || creator.status === status
    return matchesQuery && matchesCategory && matchesStatus
  }).sort((a, b) => sortBy === 'name' ? a.name.localeCompare(b.name, 'zh-CN') : sortBy === 'activity' ? b.activity - a.activity : b.heat - a.heat), [creatorData, query, category, status, sortBy])
  const visibleCreators = useMemo(() => filtered.slice(0, creatorPage * 24), [filtered, creatorPage])

  useEffect(() => { setCreatorPage(1) }, [query, category, status, sortBy, view])

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2800) }
  const startSync = async () => {
    setSyncing(true)
    try {
      const response = await fetch(`${API_BASE}/analysis/run?platform=bilibili`, { method: 'POST' })
      if (!response.ok) throw new Error('分析接口暂时不可用')
      const result = await response.json() as { contents: number }
      const [creatorResponse, statsResponse] = await Promise.all([fetch(`${API_BASE}/creators/?platform=bilibili`), fetch(`${API_BASE}/stats/overview?platform=bilibili`)]);
      const creatorResult = await creatorResponse.json() as { items: ImportResponse['items'] }
      const statsResult = await statsResponse.json() as { total_creators: number; analyzed_contents: number; priority_creators: number; review_creators: number; new_creators?: number }
      setCreatorData(creatorResult.items.map(mapImportedCreator))
      setSummary({ total: statsResult.total_creators, contents: statsResult.analyzed_contents, priority: statsResult.priority_creators, review: statsResult.review_creators, newCreators: statsResult.new_creators ?? 0 })
      notify(`分析完成：已处理 ${result.contents} 条视频`)
    } catch (error) { notify(error instanceof Error ? error.message : '分析失败，请确认后端已启动') }
    finally { setSyncing(false) }
  }
  const refreshBilibiliStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/bilibili/status`)
      const result = await response.json() as BilibiliStatus
      setBilibiliStatus(result)
      return result
    } catch {
      const result = { ready: false, logged_in: null, message: 'B站状态接口不可用，请确认后端服务已启动。' }
      setBilibiliStatus(result)
      return result
    }
  }
  const captureBilibili = async () => {
    try {
      const statusResponse = await fetch(`${API_BASE}/bilibili/login/status`)
      const login = await statusResponse.json() as BilibiliLogin
      if (login.status !== 'logged_in') { setLoginOpen(true); await createBilibiliLogin(); return }
      const response = await fetch(`${API_BASE}/bilibili/sync/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      const result = await response.json() as BilibiliSyncState
      if (!response.ok) throw new Error(result.message || 'B站关注内容读取失败')
      setBilibiliSync(result)
      notify('已启动 B站全部关注 UP 主读取，页面会显示实时进度')
    } catch (error) { notify(error instanceof Error ? error.message : 'B站采集接口不可用，请确认后端服务已启动。') }
  }
  const stopBilibiliSync = async () => {
    try {
      const response = await fetch(`${API_BASE}/bilibili/sync/stop`, { method: 'POST' })
      const result = await response.json() as BilibiliSyncState
      if (!response.ok) throw new Error(result.message || '停止同步失败')
      setBilibiliSync(result)
      notify('已发送停止请求，当前请求完成后会安全停止')
    } catch (error) { notify(error instanceof Error ? error.message : '停止同步失败') }
  }
  const refreshBilibiliHistory = async () => {
    try {
      const response = await fetch(`${API_BASE}/bilibili/sync/history?limit=8`)
      if (response.ok) setSyncHistory((await response.json() as { items: SyncHistoryItem[] }).items)
    } catch { /* history is supplementary to the live sync state */ }
  }
  const refreshBilibiliSync = async () => {
    try {
      const response = await fetch(`${API_BASE}/bilibili/sync/status`)
      if (!response.ok) return null
      const result = await response.json() as BilibiliSyncState
      setBilibiliSync(result)
      if (result.status === 'completed' || result.status === 'failed' || result.status === 'stopped') { await refreshDashboardData(); await refreshBilibiliHistory() }
      return result
    } catch { return null }
  }
  const refreshDashboardData = async () => {
    const [creatorResponse, statsResponse, categoryResponse] = await Promise.all([fetch(`${API_BASE}/creators/?platform=bilibili`), fetch(`${API_BASE}/stats/overview?platform=bilibili`), fetch(`${API_BASE}/categories/?platform=bilibili`)]);
    if (!creatorResponse.ok || !statsResponse.ok) return
    const creatorResult = await creatorResponse.json() as { items: ImportResponse['items'] }
    const statsResult = await statsResponse.json() as { total_creators: number; analyzed_contents: number; priority_creators: number; review_creators: number; new_creators?: number }
    setCreatorData(creatorResult.items.map(mapImportedCreator))
    setSummary({ total: statsResult.total_creators, contents: statsResult.analyzed_contents, priority: statsResult.priority_creators, review: statsResult.review_creators, newCreators: statsResult.new_creators ?? 0 })
    if (categoryResponse.ok) setCategoryStats((await categoryResponse.json() as { items: CategoryStat[] }).items)
  }
  const createBilibiliLogin = async () => {
    try {
      const response = await fetch(`${API_BASE}/bilibili/login/qr`, { method: 'POST' })
      const result = await response.json() as BilibiliLogin
      if (!response.ok) throw new Error(result.message || '二维码生成失败')
      setLoginState(result); setLoginOpen(true)
    } catch (error) { setLoginState({ status: 'expired', message: error instanceof Error ? error.message : '二维码生成失败' }); setLoginOpen(true) }
  }
  const maybeStartAutoSync = async (user?: { uid: string; name: string }) => {
    if (!user) return
    const key = `creator-manager:bilibili-full-sync:${user.uid}`
    const current = await refreshBilibiliSync()
    // 后端任务状态在服务重启后会恢复为 idle；本地标记用于避免页面重新打开时重复全量扫描。
    if (current?.status === 'running' || current?.status === 'completed' || localStorage.getItem(key) === 'completed') return
    const response = await fetch(`${API_BASE}/bilibili/sync/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    if (response.ok) { setBilibiliSync(await response.json() as BilibiliSyncState); notify('已自动启动全部关注 UP 主读取') }
  }
  const pollBilibiliLogin = async () => {
    try {
      const response = await fetch(`${API_BASE}/bilibili/login/status`)
      const result = await response.json() as BilibiliLogin
      // 状态轮询接口只返回状态字段时，保留首次生成的二维码，避免二维码被加载图标覆盖。
      setLoginState((current) => ({
        ...current,
        ...result,
        qr_image: result.qr_image ?? (result.status === 'expired' ? undefined : current.qr_image),
      }))
      if (result.status === 'logged_in') { setBilibiliStatus((current) => ({ ...(current || { ready: true, logged_in: false, message: '' }), logged_in: true, user: result.user, message: result.message })); notify(result.message); await maybeStartAutoSync(result.user) }
      return result
    } catch { return null }
  }
  const handleImportComplete = (result: ImportResponse) => {
    setCreatorData(result.items.map(mapImportedCreator))
    setSummary({ total: result.creator_count, contents: result.content_count, priority: 0, review: result.items.filter((item) => item.status === '待复核').length, newCreators: 0 })
  }

  const runAnalysis = async () => {
    setAnalysisRunning(true)
    try {
      const response = await fetch(`${API_BASE}/analysis/run?platform=bilibili`, { method: 'POST' })
      if (!response.ok) throw new Error('分析接口暂时不可用')
      const result = await response.json() as { contents: number }
      const [creatorResponse, statsResponse] = await Promise.all([fetch(`${API_BASE}/creators/?platform=bilibili`), fetch(`${API_BASE}/stats/overview?platform=bilibili`)]);
      const creatorResult = await creatorResponse.json() as { items: ImportResponse['items'] }
      const statsResult = await statsResponse.json() as { total_creators: number; analyzed_contents: number; priority_creators: number; review_creators: number }
      setCreatorData(creatorResult.items.map(mapImportedCreator))
      setSummary({ total: statsResult.total_creators, contents: statsResult.analyzed_contents, priority: statsResult.priority_creators, review: statsResult.review_creators, newCreators: 0 })
      notify(`分析完成：已处理 ${result.contents} 条视频，证据与热度已更新`)
    } catch (error) {
      notify(error instanceof Error ? error.message : '分析失败，请确认后端已启动')
    } finally { setAnalysisRunning(false) }
  }

  const selectCreator = async (creator: Creator) => {
    setSelected(creator)
    try {
      const response = await fetch(`${API_BASE}/creators/${creator.id}`)
      if (!response.ok) return
      const detail = await response.json() as ImportResponse['items'][number]
      const mappedDetail = mapImportedCreator(detail)
      setSelected({ ...mappedDetail, avatarUrl: creator.avatarUrl || mappedDetail.avatarUrl })
    } catch { /* keep the card data if the detail endpoint is unavailable */ }
  }

  const backfillMetrics = async () => {
    try {
      const response = await fetch(`${API_BASE}/bilibili/metrics/backfill`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ limit: 5000 }) })
      if (!response.ok) throw new Error('互动数据补齐任务启动失败')
      setMetricsState(await response.json() as MetricsState)
      notify('已开始补齐视频点赞、评论、分享和播放数据')
    } catch (error) { notify(error instanceof Error ? error.message : '互动数据补齐失败') }
  }

  useEffect(() => {
    if (!['starting', 'running'].includes(metricsState.status)) return
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/bilibili/metrics/status`)
        if (response.ok) { const next = await response.json() as MetricsState; setMetricsState(next); if (next.status === 'completed') { await refreshDashboardData(); notify(next.message) } }
      } catch { /* retain the last progress snapshot */ }
    }, 1600)
    return () => window.clearInterval(timer)
  }, [metricsState.status])

  useEffect(() => {
    const loadLocalData = async () => {
      try {
        const [creatorResponse, statsResponse, categoryResponse] = await Promise.all([fetch(`${API_BASE}/creators/?platform=bilibili`), fetch(`${API_BASE}/stats/overview?platform=bilibili`), fetch(`${API_BASE}/categories/?platform=bilibili`)]);
        if (!creatorResponse.ok || !statsResponse.ok) return
        const creatorResult = await creatorResponse.json() as { items: ImportResponse['items'] }
        const statsResult = await statsResponse.json() as { total_creators: number; analyzed_contents: number; priority_creators: number; review_creators: number }
        if (creatorResult.items.length) setCreatorData(creatorResult.items.map(mapImportedCreator))
        setSummary({ total: statsResult.total_creators, contents: statsResult.analyzed_contents, priority: statsResult.priority_creators, review: statsResult.review_creators, newCreators: 0 })
        if (categoryResponse.ok) setCategoryStats((await categoryResponse.json() as { items: CategoryStat[] }).items)
      } catch {
        // The prototype remains usable with demo data when the backend is offline.
      }
    }
    void loadLocalData()
  }, [])

  useEffect(() => { const openImport = () => setImportOpen(true); window.addEventListener('open-import', openImport); return () => window.removeEventListener('open-import', openImport) }, [])

  useEffect(() => { if (page === 'sync') { void refreshBilibiliStatus().then((result) => { if (result?.logged_in) void maybeStartAutoSync(result.user) }); void refreshBilibiliSync(); void refreshBilibiliHistory() } }, [page])
  useEffect(() => {
    void refreshBilibiliStatus().then((result) => { if (result?.logged_in) void maybeStartAutoSync(result.user) })
    void refreshBilibiliSync()
  }, [])
  useEffect(() => {
    if (bilibiliSync.status !== 'running') return
    const timer = window.setInterval(() => void refreshBilibiliSync(), 1800)
    return () => window.clearInterval(timer)
  }, [bilibiliSync.status])
  useEffect(() => {
    if (bilibiliSync.status !== 'completed' || !bilibiliStatus?.user?.uid) return
    localStorage.setItem(`creator-manager:bilibili-full-sync:${bilibiliStatus.user.uid}`, 'completed')
  }, [bilibiliSync.status, bilibiliStatus?.user?.uid])
  useEffect(() => {
    if (!loginOpen || !['waiting', 'scanned'].includes(loginState.status)) return
    const timer = window.setInterval(() => void pollBilibiliLogin(), 1800)
    return () => window.clearInterval(timer)
  }, [loginOpen, loginState.status])

  return <div className="app-shell">
    <div className="ambient ambient-one" /><div className="ambient ambient-two" />
    <header className="topbar">
      <button className="mobile-menu icon-button" aria-label="打开导航" onClick={() => setMobileNav(!mobileNav)}><Menu size={20} /></button>
      <div className="brand" onClick={() => setPage('dashboard')} role="button" tabIndex={0}>
        <div className="brand-mark"><Sparkles size={18} /></div><div><div className="brand-name">个人内容整理平台</div><div className="brand-caption">个人用户的整理与归纳</div></div>
      </div>
      <div className="platform-switch"><button className="platform active"><span className="bili-dot" /> B站 已关注UP主</button></div>
      <div className="top-actions"><div className="sync-indicator"><span className={syncing ? 'live-dot pulsing' : 'live-dot'} />{syncing ? '分析进行中' : '数据已同步'}</div><button className="button primary compact" onClick={startSync} disabled={syncing}>{syncing ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}{syncing ? '同步中' : '一键同步'}</button><button className="icon-button" aria-label="通知" onClick={() => notify('当前没有新的提醒')}><Bell size={18} /></button></div>
    </header>
    <div className="workspace">
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="sidebar-label">WORKSPACE</div>
        <nav>{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${page === id ? 'selected' : ''}`} onClick={() => { setPage(id); setMobileNav(false) }}><Icon size={18} /><span>{label}</span>{id === 'sync' && syncing && <span className="nav-pulse" />}</button>)}</nav>
        <div className="side-divider" /><div className="sidebar-label">快捷入口</div>
        <button className="nav-item" onClick={() => setImportOpen(true)}><Upload size={18} /><span>导入数据</span><Plus size={15} className="nav-end" /></button>
        <div className="side-bottom"><div className="local-card"><div className="local-icon"><Database size={16} /></div><div><strong>本地数据安全</strong><span>数据仅保存在你的设备</span></div><Check size={15} className="success-icon" /></div><div className="sidebar-footer"><span>v0.1 原型版</span><button className="help-button" aria-label="帮助" onClick={() => notify('这是创作者洞察台的网页端原型')}><CircleHelp size={16} /></button></div></div>
      </aside>
      <main className="main-content"><motion.div key={page} initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="page-wrap">
        {page === 'dashboard' && <Dashboard filtered={filtered} visibleCreators={visibleCreators} hasMore={visibleCreators.length < filtered.length} onLoadMore={() => setCreatorPage((pageNumber) => pageNumber + 1)} categoryStats={categoryStats} query={query} setQuery={setQuery} category={category} setCategory={setCategory} status={status} setStatus={setStatus} sortBy={sortBy} setSortBy={setSortBy} view={view} setView={setView} onSelect={(creator) => void selectCreator(creator)} onImport={() => setImportOpen(true)} onAnalyze={() => void runAnalysis()} onOpenCategories={() => setCategoryModalOpen(true)} onOpenTrend={() => setTrendModalOpen(true)} analysisRunning={analysisRunning} summary={summary} onCreatorUpdated={(updated) => { setCreatorData((items) => items.map((item) => item.id === updated.id ? updated : item)); setSelected(updated) }} />}
        {page === 'sync' && <><SyncPageStateful syncing={syncing || bilibiliSync.status === 'running'} sync={bilibiliSync} startSync={() => void startSync()} onImport={() => setImportOpen(true)} /><BilibiliQuickActions status={bilibiliStatus} sync={bilibiliSync} history={syncHistory} metrics={metricsState} onRefresh={() => void refreshBilibiliStatus()} onLogin={() => void createBilibiliLogin()} onCapture={() => void captureBilibili()} onStop={() => void stopBilibiliSync()} onBackfill={() => void backfillMetrics()} /></>}
        {page === 'environment' && <EnvironmentPage notify={notify} />}
        {page === 'settings' && <SettingsPageV2 notify={notify} />}
      </motion.div></main>
    </div>
    <AnimatePresence>{selected && <FastCreatorDrawer creator={selected} onClose={() => setSelected(null)} notify={notify} onUpdated={(updated) => { setCreatorData((items) => items.map((item) => item.id === updated.id ? updated : item)); setSelected(updated) }} />}</AnimatePresence>
    <AnimatePresence>{importOpen && <ImportModal onClose={() => setImportOpen(false)} notify={notify} onImported={handleImportComplete} />}</AnimatePresence>
    <AnimatePresence>{loginOpen && <BilibiliLoginModal state={loginState} onClose={() => setLoginOpen(false)} onRefresh={() => void createBilibiliLogin()} onPoll={() => void pollBilibiliLogin()} />}</AnimatePresence>
    <AnimatePresence>{categoryModalOpen && <CategoryDetailModal stats={categoryStats} total={summary.total} onClose={() => setCategoryModalOpen(false)} />}</AnimatePresence>
    <AnimatePresence>{trendModalOpen && <CreatorTrendModal creators={creatorData} onClose={() => setTrendModalOpen(false)} />}</AnimatePresence>
    <AnimatePresence>{toast && <motion.div role="status" aria-live="polite" initial={{ opacity: 0, y: 12, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} className="toast"><Check size={16} />{toast}</motion.div>}</AnimatePresence>
  </div>
}

function ImportModal({ onClose, notify, onImported }: { onClose: () => void; notify: (message: string) => void; onImported: (result: ImportResponse) => void }) {
  const [fileName, setFileName] = useState('')
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState(false)
  const [fieldNames, setFieldNames] = useState<string[]>([])
  const [rowCount, setRowCount] = useState(0)
  const [parseError, setParseError] = useState('')
  const [uploading, setUploading] = useState(false)

  const acceptFile = async (file?: File) => {
    if (!file) return
    const valid = file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.json')
    if (!valid) { notify('只支持 CSV 或 JSON 文件'); return }
    try {
      const raw = await file.text()
      const isJson = file.name.toLowerCase().endsWith('.json')
      let fields: string[] = []
      let rows = 0
      if (isJson) {
        const parsed = JSON.parse(raw)
        const records: unknown[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed.items) ? parsed.items : [parsed]
        const firstRecord = records.find((record: unknown) => record && typeof record === 'object')
        fields = firstRecord ? Object.keys(firstRecord).slice(0, 8) : []
        rows = records.length
      } else {
        const lines = raw.split(/\r?\n/).filter(Boolean)
        fields = (lines[0] ?? '').split(',').map((field) => field.trim().replace(/^"|"$/g, '')).filter(Boolean).slice(0, 8)
        rows = Math.max(lines.length - 1, 0)
      }
      setParseError('')
      setFileName(file.name)
      setFieldNames(fields)
      setRowCount(rows)
      setPreview(true)
    } catch {
      setParseError('文件格式无法解析，请检查 CSV 表头或 JSON 结构。')
      setPreview(false)
    }
  }

  const uploadFile = async () => {
    const input = document.querySelector<HTMLInputElement>('.drop-zone input')
    const file = input?.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch(`${API_BASE}/imports/`, { method: 'POST', body: formData })
      if (!response.ok) throw new Error((await response.json()).detail || '导入失败')
      const result = await response.json() as ImportResponse
      onImported(result)
      onClose()
      notify(`已保存 ${result.creator_count} 个账号、${result.content_count} 条视频`)
    } catch (error) {
      notify(error instanceof Error ? error.message : '导入失败，请确认后端已启动')
    } finally {
      setUploading(false)
    }
  }

  return <motion.div className="modal-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <div className="modal-scrim" onClick={onClose} />
    <motion.section className="import-modal" initial={{ opacity: 0, y: 14, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .98 }} transition={{ duration: .2 }} role="dialog" aria-modal="true" aria-labelledby="import-title">
      <div className="modal-head"><div><span className="eyebrow"><span className="eyebrow-line" /> BILIBILI DATA / IMPORT</span><h2 id="import-title">导入 B站 UP 主数据</h2><p>从 CSV 或 JSON 开始，数据只在本地处理。</p></div><button className="icon-button" aria-label="关闭导入窗口" onClick={onClose}><X size={18} /></button></div>
      <label className={`drop-zone ${dragging ? 'dragging' : ''} ${preview ? 'has-file' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void acceptFile(event.dataTransfer.files[0]) }}>
        <input type="file" accept=".csv,.json,application/json,text/csv" onChange={(event) => acceptFile(event.target.files?.[0])} />
        <div className="drop-icon">{preview ? <Check size={24} /> : <CloudUpload size={24} />}</div>
        <strong>{preview ? fileName : '拖入文件，或点击选择'}</strong>
        <span>{preview ? '文件已读取，可以先预览字段映射' : '支持 CSV / JSON · 单文件不超过 20MB'}</span>
        {!preview && <span className="drop-link">选择本地文件</span>}
      </label>
      {parseError && <div className="import-error"><AlertTriangle size={15} />{parseError}</div>}
      <div className="import-notice"><AlertTriangle size={15} /><span>缺失阅读、点赞等互动字段时，会标记为“数据不足”，不会伪造热度。</span></div>
      {preview && <div className="import-preview"><div><strong>识别到 {fieldNames.length} 个字段</strong><span>{rowCount} 条记录 · 将自动匹配到账号、视频和热度字段</span></div><div className="field-chips">{fieldNames.map((field) => <span key={field}>{field}</span>)}</div></div>}
      <div className="modal-actions"><button className="button secondary" onClick={onClose}>取消</button><button className="button primary" disabled={!preview || uploading} onClick={() => void uploadFile()}>{uploading ? <LoaderCircle className="spin" size={15} /> : <ArrowUpRight size={15} />}{uploading ? '保存中…' : preview ? '保存到本地' : '选择文件后继续'}</button></div>
    </motion.section>
  </motion.div>
}

function Dashboard({ filtered, visibleCreators, hasMore, onLoadMore, categoryStats, query, setQuery, category, setCategory, status, setStatus, sortBy, setSortBy, view, setView, onSelect, onImport, onAnalyze, onOpenCategories, onOpenTrend, analysisRunning, summary, onCreatorUpdated }: { filtered: Creator[]; visibleCreators: Creator[]; hasMore: boolean; onLoadMore: () => void; categoryStats: CategoryStat[]; query: string; setQuery: (v: string) => void; category: string; setCategory: (v: string) => void; status: string; setStatus: (v: string) => void; sortBy: string; setSortBy: (v: string) => void; view: 'grid' | 'table'; setView: (v: 'grid' | 'table') => void; onSelect: (creator: Creator) => void; onImport: () => void; onAnalyze: () => void; onOpenCategories: () => void; onOpenTrend: () => void; analysisRunning: boolean; summary: { total: number; contents: number; priority: number; review: number; newCreators?: number }; onCreatorUpdated: (creator: Creator) => void }) {
  return <>
    <div className="page-header"><div><div className="eyebrow"><span className="eyebrow-line" /> OVERVIEW / 01</div><h1>洞察总览</h1><p>把关注列表变成可判断、可筛选、可复盘的内容资产。</p></div><div className="header-actions"><button className="button secondary" onClick={onImport}><Upload size={16} />导入数据</button><button className="button primary" onClick={onAnalyze} disabled={analysisRunning}>{analysisRunning ? <LoaderCircle className="spin" size={16} /> : <Play size={16} />}{analysisRunning ? '分析中…' : '运行分析'}</button></div></div>
    <section className="stats-grid"><StatCard icon={Users} label="关注账号" value={summary.total.toLocaleString('zh-CN')} trend="本地数据库" trendLabel="已持久化" tone="cyan" /><StatCard icon={Activity} label="已分析内容" value={summary.contents.toLocaleString('zh-CN')} trend="当前数据集" trendLabel="视频记录" tone="violet" /><StatCard icon={Sparkles} label="新增 UP 主" value={(summary.newCreators ?? 0).toLocaleString('zh-CN')} trend="上次同步以来" trendLabel="新增账号" tone="orange" /><StatCard icon={AlertTriangle} label="待复核" value={summary.review.toString().padStart(2, '0')} trend="需要人工判断" trendLabel="分类依据不足" tone="muted" /></section>
    <section className="insight-row"><div className="panel category-panel"><PanelHeading title="主题分布" meta={`${summary.total} 个账号 · ${categoryStats.length} 个细分主题`} action="查看全部" onAction={onOpenCategories} /><div className="category-layout"><div className="donut-wrap"><div className="donut donut-large" style={{ background: topicGradient(categoryStats, summary.total) }}><div className="donut-center"><strong>{categoryStats.length}</strong><span>细分主题</span><small>按最新内容归类</small></div></div></div><div className="legend-list">{categoryStats.slice(0, 8).map((item, index) => { const percent = summary.total ? Math.round(item.count / summary.total * 100) : 0; return <button className={`legend-item category-legend-button category-tone-${index % 6}`} key={item.name} onClick={() => setCategory(item.name)}><span className="legend-button-orb" /><span className="legend-label">{item.name}</span><strong>{percent}%</strong><small>{item.count}</small></button> })}</div></div></div><div className="panel trend-panel trend-panel-clickable" onClick={onOpenTrend} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onOpenTrend() }}><PanelHeading title="内容主题关系" meta="树状分析 · 点击查看 UP 主趋势" action="打开分析" onAction={onOpenTrend} /><div className="trend-summary"><div><span>覆盖账号</span><strong>{filtered.length.toLocaleString('zh-CN')}</strong><em><ArrowUpRight size={13} />本地分类</em></div><div className="chart-legend"><span><i className="line cyan-line" />内容主题</span><span><i className="line violet-line" />账号数量</span></div></div><TopicTree stats={categoryStats} total={summary.total} /></div></section>
    <section className="panel library-panel">
      <div className="library-heading"><div><PanelHeading title="博主库" meta={`${filtered.length} 个结果`} action="" /><div className="subtle-text">按主题、活跃度与热度定位值得关注的内容源</div></div><button className="text-button" onClick={() => exportCreators(filtered)}><Download size={15} />导出结果</button></div>
      <div className="filters"><div className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索账号、分类或关键词…" aria-label="搜索账号" />{query && <button onClick={() => setQuery('')} aria-label="清除搜索"><X size={14} /></button>}</div><Select value={category} options={['全部分类', 'AI / 科技', '产品 / 设计', '商业 / 投资', '职业 / 成长', '文化 / 生活']} onChange={setCategory} /><Select value={status} options={['全部状态', '重点关注', '观察中', '低优先级']} onChange={setStatus} /><Select value={sortBy} options={['heat', 'activity', 'name']} labels={['按热度', '按活跃度', '按名称']} onChange={setSortBy} /><button className="filter-button" onClick={() => setSortBy(sortBy === 'heat' ? 'activity' : 'heat')}><Filter size={16} />更多筛选</button><div className="view-switch"><button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label="卡片视图"><Grid2X2 size={16} /></button><button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')} aria-label="表格视图"><List size={17} /></button></div></div>
      {filtered.length ? (view === 'grid' ? <><div className="creator-grid">{visibleCreators.map((creator, index) => <CreatorCard key={creator.id} creator={creator} index={index} onSelect={onSelect} />)}</div>{hasMore && <div className="load-more-wrap"><button className="button secondary" onClick={onLoadMore}>加载更多博主（已显示 {visibleCreators.length} / {filtered.length}）</button></div>}</> : <CreatorTable creators={filtered} onSelect={onSelect} />) : <EmptyState onReset={() => { setQuery(''); setCategory('全部分类'); setStatus('全部状态') }} />}
    </section>
  </>
}

function StatCard({ icon: Icon, label, value, trend, trendLabel, tone }: { icon: typeof Users; label: string; value: string; trend: string; trendLabel: string; tone: string }) { return <motion.div whileHover={{ y: -3 }} className={`stat-card ${tone}`}><div className="stat-top"><div className="stat-icon"><Icon size={17} /></div><span>{label}</span><MoreHorizontal size={17} className="stat-more" /></div><div className="stat-value">{value}</div><div className="stat-foot"><strong>{trend}</strong><span>{trendLabel}</span></div></motion.div> }
function PanelHeading({ title, meta, action, onAction }: { title: string; meta: string; action: string; onAction?: () => void }) { return <div className="panel-heading"><div><h2>{title}</h2><span>{meta}</span></div>{action && <button className="text-button" onClick={(event) => { event.stopPropagation(); onAction?.() }}>{action}<ChevronRight size={14} /></button>}</div> }
function LegendItem({ color, label, value, count }: { color: string; label: string; value: string; count: string }) { return <div className="legend-item"><span className={`legend-dot ${color}`} /><span className="legend-label">{label}</span><strong>{value}</strong><small>{count}</small></div> }
function TopicTree({ stats, total }: { stats: CategoryStat[]; total: number }) { const top = stats.slice(0, 8); return <div className="topic-tree" aria-label="内容主题树状图"><div className="tree-root"><span className="tree-pulse" /><strong>全部内容</strong><small>{total.toLocaleString('zh-CN')} 个账号 · {stats.length} 个主题</small></div><div className="tree-branches">{top.map((item, index) => <div className={`tree-branch tree-branch-${index % 6}`} key={item.name}><i /><div className="tree-node"><span>{item.name}</span><b>{item.count}</b></div><div className="tree-leaves">{(item.children?.length ? item.children : [{ name: '待细分样本', count: item.count }]).slice(0, 3).map((child) => <span key={child.name}>{child.name} · {child.count}</span>)}</div></div>)}</div></div> }
function Select({ value, options, labels, onChange }: { value: string; options: string[]; labels?: string[]; onChange: (v: string) => void }) { return <label className="select-wrap"><select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option, index) => <option key={option} value={option}>{labels?.[index] || option}</option>)}</select><ChevronDown size={15} /></label> }
function CreatorCard({ creator, index, onSelect }: { creator: Creator; index: number; onSelect: (creator: Creator) => void }) { const tone = creator.heat >= 80 ? 'hot' : creator.heat >= 60 ? 'warm' : 'cool'; return <motion.button initial={false} animate={{ opacity: 1 }} whileHover={{ y: -3 }} whileTap={{ scale: .99 }} transition={{ duration: .16 }} className="creator-card" onClick={() => onSelect(creator)}><div className="creator-card-top"><div className={`avatar avatar-${index % 5}`}>{creator.avatarUrl ? <img src={creator.avatarUrl} alt={`${creator.name} 的 B 站头像`} width={52} height={52} loading="lazy" decoding="async" onError={(event) => { event.currentTarget.style.display = 'none' }} /> : creator.initials}</div><div className="creator-name"><strong>{creator.name}</strong><span>{creator.category} <i>·</i> {creator.sub}</span><small>{creator.followerCount == null ? '粉丝数据读取中' : `粉丝 ${formatMetric(creator.followerCount)}`}</small></div><MoreHorizontal size={17} className="card-more" /></div><div className="card-divider" /><div className="metric-row"><div className={`heat ${tone}`}><Zap size={14} fill="currentColor" /><strong>{creator.heat}</strong><span>热度</span></div><div className="activity"><span className="activity-dot" />{creator.status}<small>近 7 天 {creator.weekly} 条</small></div></div><div className="metric-bottom"><span><BookOpen size={14} />均播 {creator.views}</span><span><Activity size={14} />均赞 {creator.likes}</span></div>{creator.latestVideoTitle && <a className="latest-video" href={creator.latestVideoUrl || undefined} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}><span>最新视频</span><strong>{creator.latestVideoTitle}</strong></a>}<div className="card-footer"><span>更新于 {creator.updated}</span><span className={`status-pill ${creator.status === '重点关注' ? 'priority' : creator.status === '观察中' ? 'watch' : 'low'}`}>{creator.status}</span></div></motion.button> }
function CreatorTable({ creators: rows, onSelect }: { creators: Creator[]; onSelect: (creator: Creator) => void }) { return <div className="table-wrap"><table><thead><tr><th>账号</th><th>主题</th><th>热度</th><th>活跃度</th><th>周更</th><th>状态</th><th /></tr></thead><tbody>{rows.map((creator, i) => <tr key={creator.id} onClick={() => onSelect(creator)}><td><div className="table-creator"><div className={`avatar avatar-${i % 5}`}>{creator.avatarUrl ? <img src={creator.avatarUrl} alt={`${creator.name} 的 B 站头像`} width={42} height={42} loading="lazy" /> : creator.initials}</div><strong>{creator.name}</strong></div></td><td><span className="table-category">{creator.category}</span><small>{creator.sub}</small></td><td><strong className="table-heat">{creator.heat}</strong></td><td><div className="progress-line"><i style={{ width: `${creator.activity}%` }} /></div><small>{creator.activity}</small></td><td>{creator.weekly} 篇</td><td><span className="status-pill watch">{creator.status}</span></td><td><ChevronRight size={16} /></td></tr>)}</tbody></table></div> }
function EmptyState({ onReset }: { onReset: () => void }) { return <div className="empty-state"><Search size={28} /><strong>没有匹配的账号</strong><span>换个搜索词或清除筛选条件试试。</span><button className="button secondary" onClick={onReset}>清除筛选</button></div> }

function LegacyCreatorDrawer({ creator, onClose, notify }: { creator: Creator; onClose: () => void; notify: (message: string) => void }) { return <motion.div className="drawer-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.div className="drawer-scrim" onClick={onClose} /><motion.aside className="drawer" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}><div className="drawer-header"><span className="eyebrow">CREATOR PROFILE</span><button className="icon-button" aria-label="关闭详情" onClick={onClose}><PanelRightClose size={19} /></button></div><h2>{creator.name}</h2><p>{creator.category} · {creator.sub}</p></motion.aside></motion.div> }

function CategoryDetailModal({ stats, total, onClose }: { stats: CategoryStat[]; total: number; onClose: () => void }) {
  const palette = ['#74e4ee', '#9e8cff', '#f7aa65', '#76a9ff', '#db7cff', '#62d5a5', '#f27d9d', '#c4d16a', '#8ad4d8', '#b59fff', '#e8c26b', '#76c3ff', '#d890ff', '#65c79c']
  const sum = stats.reduce((value, item) => value + item.count, 0) || total || 1
  let cursor = 0
  const segments = stats.map((item, index) => { const start = cursor; cursor += item.count / sum * 100; return `${palette[index % palette.length]} ${start}% ${cursor}%` })
  return <motion.div className="modal-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><div className="modal-scrim" onClick={onClose} /><motion.section className="detail-modal category-detail-modal" initial={{ opacity: 0, y: 18, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} role="dialog" aria-modal="true" aria-labelledby="category-detail-title"><div className="modal-head"><div><span className="eyebrow"><span className="eyebrow-line" /> TOPIC MAP / DETAIL</span><h2 id="category-detail-title">完整主题分布</h2><p>按已同步 UP 主的最新视频样本拆分细分类别，共 {total.toLocaleString('zh-CN')} 个账号。</p></div><button className="icon-button" aria-label="关闭主题分布" onClick={onClose}><X size={18} /></button></div><div className="category-detail-layout"><div className="category-wheel category-wheel-tech" style={{ background: topicGradient(stats, total) }}><div><strong>{stats.length}</strong><span>细分主题</span></div></div><div className="category-detail-list">{stats.map((item, index) => <div className="category-detail-row" key={item.name}><span className="legend-dot" style={{ background: palette[index % palette.length] }} /><strong>{item.name}</strong><span>{item.count} 个账号</span><b>{Math.round(item.count / sum * 100)}%</b></div>)}</div></div><div className="topic-dial-grid">{stats.map((item, index) => { const percent = Math.round(item.count / sum * 100); return <div className="topic-dial-card" key={`dial-${item.name}`}><div className="topic-dial" style={{ background: `conic-gradient(${palette[index % palette.length]} ${percent * 3.6}deg, oklch(.55 .03 240 / .18) 0)` }}><div><strong>{percent}%</strong><span>{item.count} 个</span></div></div><b>{item.name}</b><small>账号占比 · 样本主题</small></div> })}</div><div className="modal-actions"><button className="button secondary" onClick={onClose}>返回总览</button></div></motion.section></motion.div>
}

function CreatorTrendModal({ creators, onClose }: { creators: Creator[]; onClose: () => void }) {
  const [creatorId, setCreatorId] = useState(creators[0]?.id || '')
  const creator = creators.find((item) => item.id === creatorId) || creators[0]
  const videos = creator?.contents?.slice(0, 5) || []
  const values = videos.map((video) => Number(video.heat_score || Math.min(100, ((video.view_count || 0) / 10000) + ((video.like_count || 0) / 1000)))).reverse()
  const chartValues = values.length ? values : [18, 28, 24, 41, 36]
  const bars = chartValues.map((value, index) => ({ value: Math.max(4, Math.min(92, value)), x: 8 + index * (84 / Math.max(1, chartValues.length)), width: Math.min(12, 64 / Math.max(1, chartValues.length)) }))
  return <motion.div className="modal-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><div className="modal-scrim" onClick={onClose} /><motion.section className="detail-modal trend-detail-modal" initial={{ opacity: 0, y: 18, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} role="dialog" aria-modal="true" aria-labelledby="trend-detail-title"><div className="modal-head"><div><span className="eyebrow"><span className="eyebrow-line" /> CONTENT HEAT / DETAIL</span><h2 id="trend-detail-title">UP 主内容热度趋势</h2><p>按最近视频样本查看热度变化，数据来自本地同步记录。</p></div><button className="icon-button" aria-label="关闭内容热度趋势" onClick={onClose}><X size={18} /></button></div><label className="trend-creator-select"><span>选择 UP 主</span><select value={creator?.id || ''} onChange={(event) => setCreatorId(event.target.value)}>{creators.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.category}</option>)}</select></label><div className="trend-detail-summary"><div><span>账号热度</span><strong>{creator?.heat?.toFixed(1) || '—'}</strong></div><div><span>最近样本</span><strong>{videos.length || 0} 条</strong></div><div><span>近 7 天周更</span><strong>{creator?.weekly ?? '—'}</strong></div></div><div className="detail-chart detail-bar-chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="选中 UP 主最近视频热度柱状图"><line x1="4" y1="92" x2="98" y2="92" stroke="rgba(150,220,235,.24)" strokeWidth=".6" />{bars.map((bar, index) => <g key={index}><rect className="trend-bar" x={bar.x} y={92 - bar.value} width={bar.width} height={bar.value} rx="1.2" /><text x={bar.x + bar.width / 2} y="98" textAnchor="middle">{videos.slice().reverse()[index]?.published_at ? new Date(videos.slice().reverse()[index].published_at as string).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) : `视频 ${index + 1}`}</text></g>)}</svg></div><div className="trend-video-list">{videos.slice(0, 5).map((video, index) => <div key={`${video.title}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><strong>{video.title}</strong><b>{Number(video.heat_score || 0).toFixed(1)}</b></div>)}</div><div className="modal-actions"><button className="button secondary" onClick={onClose}>关闭趋势</button></div></motion.section></motion.div>
}

function FastCreatorDrawer({ creator, onClose, notify, onUpdated }: { creator: Creator; onClose: () => void; notify: (message: string) => void; onUpdated: (creator: Creator) => void }) {
  const [editing, setEditing] = useState(false)
  const [categoryOverride, setCategoryOverride] = useState(creator.categoryOverride || creator.category)
  const [statusOverride, setStatusOverride] = useState(creator.statusOverride || creator.status)
  const [tags, setTags] = useState(creator.keywords.slice(0, 3).join('、'))
  const [notes, setNotes] = useState(creator.notes || '')
  const saveManual = async () => {
    try {
      const response = await fetch(`${API_BASE}/creators/${creator.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category_override: categoryOverride, status_override: statusOverride, custom_tags: tags.split(/[、,，]/).map((item) => item.trim()).filter(Boolean), manual_notes: notes }) })
      if (!response.ok) throw new Error('人工修正保存失败')
      const result = await response.json() as ImportResponse['items'][number]
      onUpdated(mapImportedCreator(result)); setEditing(false); notify('人工修正已保存并持久化')
    } catch (error) { notify(error instanceof Error ? error.message : '人工修正保存失败') }
  }
  const stats = creator.detailStats
  const weekly = Object.entries(stats?.weekly_posts || {}).slice(-8)
  const weeklyAverage = weekly.length ? (weekly.reduce((total, [, count]) => total + count, 0) / weekly.length).toFixed(1) : (creator.weekly ? creator.weekly.toFixed(1) : '—')
  return <motion.div className="drawer-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.div className="drawer-scrim" onClick={onClose} /><motion.aside className="drawer" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: .2, ease: 'easeOut' }}><div className="drawer-header"><span className="eyebrow"><span className="eyebrow-line" /> CREATOR PROFILE</span><button className="icon-button" aria-label="关闭详情" onClick={onClose}><PanelRightClose size={19} /></button></div><div className="drawer-identity"><div className="avatar avatar-large">{creator.avatarUrl ? <img src={creator.avatarUrl} alt={`${creator.name} 的 B 站头像`} width={64} height={64} decoding="async" onError={(event) => { event.currentTarget.style.display = 'none' }} /> : creator.initials}</div><div><h2>{creator.name}</h2><span>{creator.category} <i>·</i> {creator.sub}</span><div className="tag-row"><span className="tag">B站 UP 主</span><span className="tag accent">{creator.status}</span>{creator.heatDataStatus !== 'complete' && <span className="tag">部分数据不足</span>}</div></div></div><div className="score-rings"><ScoreRing label="热度" value={creator.heat} color="cyan" /><ScoreRing label="活跃" value={creator.activity} color="violet" /><ScoreRing label="质量" value={creator.quality} color="orange" /></div><div className="drawer-section"><div className="section-title"><h3>内容概览</h3><span>当前本地样本</span></div><div className="detail-stat-grid"><div><strong>{stats?.total_articles ?? creator.contents?.length ?? 0}</strong><span>视频数</span></div><div><strong>{formatMetric(stats?.avg_views)}</strong><span>平均播放</span></div><div><strong>{formatMetric(stats?.avg_likes)}</strong><span>平均点赞</span></div><div><strong>{formatMetric(stats?.avg_comments)}</strong><span>平均评论</span></div><div><strong>{stats?.original_ratio == null ? '数据不足' : `${stats.original_ratio}%`}</strong><span>原创比例</span></div><div><strong>{weeklyAverage}</strong><span>周均发布</span></div></div>{weekly.length > 0 && <div className="weekly-bars" aria-label="每周发布数量趋势">{weekly.map(([week, count]) => <div key={week} title={`${week}：${count} 条`}><i style={{ height: `${Math.max(10, Math.min(100, count * 18))}%` }} /><span>{week.slice(5)}</span></div>)}</div>}</div><div className="drawer-section"><div className="section-title"><h3>主题关键词</h3><span>基于当前视频样本</span></div><div className="keyword-cloud">{creator.keywords.map((word, i) => <span key={word} className={`keyword k${i}`}>{word}</span>)}</div></div><div className="drawer-section"><div className="section-title"><h3>系统判断依据</h3><span className="explain-badge"><Sparkles size={12} />可解释</span></div><div className="evidence-list">{creator.evidence.map((item) => <div key={item}><Check size={15} /><span>{item}</span></div>)}</div></div><div className="drawer-section"><div className="section-title"><h3>人工修正</h3><span>{creator.notes ? '已保存备注' : '可覆盖系统判断'}</span></div>{editing ? <div className="manual-form"><label className="field"><span>分类</span><select value={categoryOverride} onChange={(event) => setCategoryOverride(event.target.value)}>{['AI / 科技', '产品 / 设计', '商业 / 投资', '职业 / 成长', '文化 / 生活', '新闻 / 资讯', '其他'].map((item) => <option key={item}>{item}</option>)}</select></label><label className="field"><span>状态</span><select value={statusOverride} onChange={(event) => setStatusOverride(event.target.value)}>{['重点关注', '观察中', '低优先级', '已忽略'].map((item) => <option key={item}>{item}</option>)}</select></label><label className="field"><span>标签（用顿号分隔）</span><input value={tags} onChange={(event) => setTags(event.target.value)} /></label><label className="field"><span>备注</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} /></label><div className="drawer-actions"><button className="button secondary" onClick={() => setEditing(false)}>取消</button><button className="button primary" onClick={() => void saveManual()}><Check size={15} />保存修正</button></div></div> : <><div className="evidence-list"><div><Tags size={15} /><span>{creator.keywords.slice(0, 3).join('、') || '暂无标签'}</span></div><div><FileText size={15} /><span>{creator.notes || '暂无人工备注'}</span></div></div><div className="drawer-actions"><button className="button primary" onClick={() => setEditing(true)}><Tags size={16} />编辑分类、标签与备注</button></div></>}</div><div className="drawer-section"><div className="section-title"><h3>近期视频</h3><span>{creator.contents?.length || 0} 条</span></div>{(creator.contents?.length ? creator.contents.slice(0, 5) : []).map((video, i) => <a className="article-row" key={`${video.url || video.title}-${i}`} href={video.url || undefined} target="_blank" rel="noreferrer"><div className="article-index">{String(i + 1).padStart(2, '0')}</div><div><strong>{video.title}</strong><span>{video.published_at ? new Date(video.published_at).toLocaleDateString('zh-CN') : '时间未知'} <i>·</i> 播放 {formatMetric(video.view_count)} <i>·</i> 点赞 {formatMetric(video.like_count)}</span></div><ArrowUpRight size={15} /></a>)}</div></motion.aside></motion.div>
}
function ScoreRing({ label, value, color }: { label: string; value: number; color: string }) { const hint = label === '热度' ? '粉丝45% · 发布25% · 活跃30%' : label === '活跃' ? '近7天视频数' : '平均点赞数'; return <div className="score-ring" title={hint}><div className={`ring ring-${color}`} style={{ '--progress': `${value * 3.6}deg` } as React.CSSProperties}><div><strong>{value}</strong><span>{label}</span></div></div><small className="score-ring-hint">{hint}</small></div> }

function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) { return <div className="page-header"><div><div className="eyebrow"><span className="eyebrow-line" /> {eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action && <div className="header-actions">{action}</div>}</div> }
function JobStep({ icon: Icon, label, detail, done, active, error }: { icon: typeof Users; label: string; detail: string; done?: boolean; active?: boolean; error?: boolean }) { return <div className={`job-step ${done ? 'done' : ''} ${active ? 'active' : ''} ${error ? 'error' : ''}`}><div className="job-icon">{done ? <Check size={16} /> : active ? <LoaderCircle className="spin" size={16} /> : error ? <AlertTriangle size={16} /> : <Icon size={16} />}</div><div><strong>{label}</strong><span>{detail}</span></div></div> }
function HistoryRow({ time, type, count, duration, state }: { time: string; type: string; count: string; duration: string; state: string }) { return <div className="history-row"><div className="history-time"><Clock3 size={15} />{time}</div><span>{type}</span><strong>{count} 个账号</strong><span>{duration}</span><span className="history-state"><Check size={14} />{state}</span><ChevronRight size={15} /></div> }

function BilibiliQuickActions({ status, sync, history, metrics, onRefresh, onLogin, onCapture, onStop, onBackfill }: { status: BilibiliStatus | null; sync: BilibiliSyncState; history: SyncHistoryItem[]; metrics: MetricsState; onRefresh: () => void; onLogin: () => void; onCapture: () => void; onStop: () => void; onBackfill: () => void }) {
  const ready = status?.ready
  const loggedIn = status?.logged_in
  const running = sync.status === 'running'
  const progress = sync.following_total ? Math.min(100, Math.round(sync.followings_processed / sync.following_total * 100)) : running ? 8 : sync.status === 'completed' ? 100 : 0
  return <section className="panel bilibili-adapter-panel">
    <div className="bilibili-adapter-copy"><span className="eyebrow"><span className="eyebrow-line" /> BILIBILI ADAPTER / P1</span><h2>B站关注 UP 主</h2><p>读取已登录 B站页面中的公开关注动态，仅保存 UP 主、视频标题、播放/点赞等公开字段，不读取私信或隐私内容。</p></div>
    <div className="bilibili-adapter-actions"><button className="button secondary" onClick={onRefresh}><RefreshCw size={15} />检查 B站状态</button><button className="button primary" onClick={loggedIn ? onCapture : onLogin} disabled={running}><Zap size={15} />{loggedIn ? (running ? '全量读取中…' : '同步全部关注') : '扫码登录 B站'}</button><button className="button secondary" onClick={onCapture} disabled={!loggedIn || running}><Download size={15} />手动同步更新</button><button className="button secondary" onClick={onBackfill} disabled={metrics.status === 'running' || metrics.status === 'starting'}><Activity size={15} />{metrics.status === 'running' || metrics.status === 'starting' ? '补齐互动中…' : '补齐点赞数据'}</button><button className="button secondary" onClick={() => window.dispatchEvent(new Event('open-import'))}><Upload size={15} />导入 JSON / CSV</button>{running && <button className="button danger" onClick={onStop}><X size={15} />停止同步</button>}</div>
    <div className={`bilibili-status-strip ${ready && loggedIn ? 'ready' : 'offline'}`}><span className="live-dot" /><strong>{loggedIn ? `已登录${status?.user?.name ? `：${status.user.name}` : ''}` : '等待 B站扫码登录'}</strong><span>{status?.message || '点击“扫码登录 B站”，使用哔哩哔哩 App 扫描二维码。'}</span></div>
    <div className="bilibili-sync-progress"><div className="progress-label"><span>{running ? '后台全量读取进度' : sync.status === 'completed' ? '最近一次全量读取已完成' : '自动读取状态'}</span><strong>{progress}%</strong></div><div className="progress-track"><motion.i animate={{ width: `${progress}%` }} transition={{ duration: .35 }} /></div><div className="bilibili-sync-meta"><span>{sync.message}</span><span>{sync.followings_processed}/{sync.following_total || '—'} 位 UP 主</span><span>{sync.videos_scanned} 条视频</span><span>{sync.new_content} 条新增</span></div></div>
    <div className="metrics-progress"><div className="progress-label"><span>视频互动字段</span><strong>{metrics.total ? Math.round(metrics.processed / metrics.total * 100) : metrics.status === 'completed' ? 100 : 0}%</strong></div><div className="progress-track"><motion.i animate={{ width: `${metrics.total ? metrics.processed / metrics.total * 100 : metrics.status === 'completed' ? 100 : 0}%` }} transition={{ duration: .25 }} /></div><span>{metrics.message} · 已更新 {metrics.updated} 条</span></div>
    <div className="bilibili-pipeline"><span className="current">1 读取公开关注动态</span><span>2 清洗与去重</span><span>3 规则分类</span><span>4 热度分析</span></div>
    {history.length > 0 && <div className="sync-history"><div className="section-title"><h3>同步历史</h3><span>本地保存最近 {history.length} 次</span></div>{history.slice(0, 5).map((item) => <div className="history-row" key={item.id}><div className="history-time"><Clock3 size={14} />{item.started_at ? new Date(item.started_at).toLocaleString('zh-CN') : '刚刚'}</div><span>{item.followings_processed}/{item.following_total || '—'} 位 UP 主</span><strong>{item.new_content} 条新增</strong><span className="history-state"><Check size={14} />{item.status === 'completed' ? '已完成' : item.status === 'stopped' ? '已停止' : item.status === 'failed' ? '失败' : '进行中'}</span></div>)}</div>}
  </section>
}

function BilibiliLoginModal({ state, onClose, onRefresh, onPoll }: { state: BilibiliLogin; onClose: () => void; onRefresh: () => void; onPoll: () => void }) {
  const loggedIn = state.status === 'logged_in'
  const waiting = state.status === 'waiting' || state.status === 'scanned'
  return <motion.div className="modal-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <div className="modal-scrim" onClick={onClose} />
    <motion.section className="login-modal" initial={{ opacity: 0, y: 14, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .98 }} role="dialog" aria-modal="true" aria-labelledby="bili-login-title">
      <div className="modal-head"><div><span className="eyebrow"><span className="eyebrow-line" /> BILIBILI LOGIN / LOCAL</span><h2 id="bili-login-title">扫码登录 B站</h2><p>二维码只在本地显示；登录成功后仅读取公开关注 UP 主和视频内容。</p></div><button className="icon-button" aria-label="关闭 B站登录窗口" onClick={onClose}><X size={18} /></button></div>
      <div className="login-body">{state.qr_image && !loggedIn ? <div className="qr-frame"><img src={state.qr_image} alt="B站扫码登录二维码" /></div> : <div className={`login-state-icon ${loggedIn ? 'success' : 'waiting'}`}>{loggedIn ? <Check size={32} /> : <LoaderCircle className="spin" size={32} />}</div>}<strong className="login-message">{state.message}</strong><span className="login-hint">{loggedIn ? '现在可以关闭窗口并同步关注 UP 主。' : state.status === 'scanned' ? '已扫码，请在手机哔哩哔哩 App 中确认登录。' : state.status === 'expired' ? '二维码已失效，请点击“重新生成”。' : '打开哔哩哔哩 App，使用扫一扫确认。'}</span></div>
      <div className="login-privacy"><Check size={14} />本地会话仅用于公开关注内容读取，不保存密码、不读取私信。</div>
      <div className="modal-actions"><button className="button secondary" onClick={onClose}>稍后处理</button>{loggedIn ? <button className="button primary" onClick={onClose}>完成</button> : <>{waiting && <button className="button secondary" onClick={onPoll}>刷新状态</button>}<button className="button primary" onClick={onRefresh}>{state.status === 'expired' ? '重新生成' : '生成二维码'}</button></>}</div>
    </motion.section>
  </motion.div>
}

function SyncPageV2({ syncing, sync, startSync, onImport }: { syncing: boolean; sync: BilibiliSyncState; startSync: () => void; onImport: () => void }) {
  return <><PageTitle eyebrow="DATA INTAKE / 02" title="B站内容接入" description="读取关注 UP 主的公开视频内容，按原 PRD 链路进行清洗、分类和热度分析。" action={<button className="button primary" onClick={startSync} disabled={syncing}>{syncing ? <LoaderCircle className="spin" size={16} /> : <Play size={16} />}{syncing ? '分析中…' : '运行分析'}</button>} /><div className="sync-grid"><div className="panel sync-main"><div className="sync-status-head"><div><span className="eyebrow"><span className="eyebrow-line" /> LOCAL PIPELINE</span><h2>{syncing ? '正在分析 B站内容库' : '准备好开始一次分析'}</h2><p>{syncing ? '正在按设置中的时间窗口、取样数和热度权重计算。' : '支持 B站 JSON / CSV 导入；缺失互动字段会保留“数据不足”。'}</p></div><div className={`big-status ${syncing ? 'running' : ''}`}>{syncing ? <LoaderCircle className="spin" size={28} /> : <Database size={28} />}<span>{syncing ? 'RUNNING' : 'READY'}</span></div></div><div className="job-steps"><JobStep icon={Download} label="读取关注 UP 主" detail="已登录页面公开动态" done /><JobStep icon={FileText} label="清洗与去重" detail="账号 + BV / 标题" done /><JobStep icon={Bot} label="规则主题分类" detail="可解释证据" active={syncing} /><JobStep icon={BarChart3} label="热度与活跃度" detail="按设置计算" active={syncing} /></div><div className="sync-controls"><button className="button secondary" onClick={onImport}><Upload size={15} />导入 B站 JSON / CSV</button><span className="subtle-text">数据默认仅保存在本机</span></div></div><div className="panel source-panel"><PanelHeading title="数据源" meta="B站本地模式" action="" /><div className="source-card selected"><div className="source-logo file-logo"><span className="bili-dot" /></div><div><strong>B站关注动态</strong><span>已登录浏览器 · 公开内容</span></div><Check size={17} /></div><div className="source-card dashed" onClick={onImport}><div className="source-logo file-logo"><Plus size={18} /></div><div><strong>导入 B站数据文件</strong><span>支持 CSV、JSON 格式</span></div><ChevronRight size={16} /></div><div className="privacy-note"><Wifi size={15} /><span>本地处理<br /><small>不上传 B站登录态和原始内容</small></span></div></div></div></>
}

function SyncPageStateful({ syncing, sync, startSync, onImport }: { syncing: boolean; sync: BilibiliSyncState; startSync: () => void; onImport: () => void }) {
  const finished = sync.status === 'completed';
  const failed = sync.status === 'failed';
  const progress = sync.following_total ? Math.round(sync.followings_processed / sync.following_total * 100) : finished ? 100 : 0;
  const step = (index: number) => ({ done: finished || (syncing && index < 2), active: syncing && ((index === 0 && sync.phase === 'following_list') || (index === 1 && sync.phase === 'videos') || (index >= 2 && sync.phase === 'analysis')) });
  const s1 = step(0); const s2 = step(1); const s3 = step(2); const s4 = step(3);
  return <><PageTitle eyebrow="DATA INTAKE / 02" title="B站内容接入" description="读取关注 UP 主的公开视频，并完成清洗、分类、热度与活跃度分析。" action={<button className="button primary" onClick={startSync} disabled={syncing}>{syncing ? <LoaderCircle className="spin" size={16} /> : <Play size={16} />}{syncing ? '分析中' : '运行分析'}</button>} /><div className="sync-grid"><div className="panel sync-main"><div className="sync-status-head"><div><span className="eyebrow"><span className="eyebrow-line" /> LOCAL PIPELINE</span><h2>{finished ? '本次同步已完成' : failed ? '同步未完成' : syncing ? '正在分析 B站内容库' : '准备开始一次分析'}</h2><p>{sync.message || '先读取关注列表，再分析最新视频与近 7 天活跃度。'}</p></div><div className={`big-status ${syncing ? 'running' : finished ? 'complete' : failed ? 'error' : ''}`}>{syncing ? <LoaderCircle className="spin" size={28} /> : finished ? <Check size={28} /> : failed ? <AlertTriangle size={28} /> : <Database size={28} />}<span>{syncing ? 'RUNNING' : finished ? 'DONE' : failed ? 'ERROR' : 'READY'}</span></div></div><div className="sync-progress"><div className="progress-label"><span>关注 UP 主读取进度</span><strong>{progress}%</strong></div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><div className="progress-meta"><span>{sync.followings_processed}/{sync.following_total || '—'} 位 UP 主</span><span>{sync.videos_scanned} 条视频</span><span>{sync.new_creators ?? 0} 位新增</span></div></div><div className="job-steps"><JobStep icon={Download} label="读取关注 UP 主" detail={s1.done ? '已完成' : sync.phase === 'following_list' ? '正在读取列表' : '等待执行'} done={s1.done} active={s1.active} /><JobStep icon={FileText} label="清洗与去重" detail={s2.done ? '已完成' : sync.phase === 'videos' ? '正在处理视频' : '等待执行'} done={s2.done} active={s2.active} /><JobStep icon={Bot} label="规则主题分析" detail={s3.done ? '已完成' : sync.phase === 'analysis' ? '正在分析' : '等待同步'} done={s3.done} active={s3.active} /><JobStep icon={BarChart3} label="热度与活跃度" detail={s4.done ? '已完成' : failed ? '请重试同步' : '等待主题分析'} done={s4.done} active={s4.active} /></div><div className="sync-controls"><button className="button secondary" onClick={onImport}><Upload size={15} />导入 B站 JSON / CSV</button><span className="subtle-text">数据默认仅保存在本机</span></div></div><div className="panel source-panel"><PanelHeading title="数据源" meta="B站本地模式" action="" /><div className="source-card selected"><div className="source-logo file-logo"><span className="bili-dot" /></div><div><strong>B站关注动态</strong><span>已登录浏览器 · 公开内容</span></div><Check size={17} /></div><div className="source-card dashed" onClick={onImport}><div className="source-logo file-logo"><Plus size={18} /></div><div><strong>导入 B站数据文件</strong><span>支持 CSV、JSON 格式</span></div><ChevronRight size={16} /></div><div className="privacy-note"><Wifi size={15} /><span>本地处理<br /><small>不上传登录态和原始内容</small></span></div></div></div></>
}

function SettingsPageV2({ notify }: { notify: (message: string) => void }) {
  const [windowDays, setWindowDays] = useState(30); const [sampleSize, setSampleSize] = useState(10); const [videosPerCreator, setVideosPerCreator] = useState(3); const [delayMin, setDelayMin] = useState(0.25); const [delayMax, setDelayMax] = useState(0.65); const [provider, setProvider] = useState('local'); const [baseUrl, setBaseUrl] = useState(''); const [model, setModel] = useState(''); const [apiKey, setApiKey] = useState(''); const [savedKey, setSavedKey] = useState(''); const [weights, setWeights] = useState({ views: 45, likes: 25, shares: 20, comments: 10 }); const [categories, setCategories] = useState(['AI / 科技', '产品 / 设计', '商业 / 投资', '职业 / 成长', '文化 / 生活', '新闻 / 资讯']); const [newCategory, setNewCategory] = useState(''); const [saving, setSaving] = useState(false)
  useEffect(() => { void fetch(`${API_BASE}/settings/`).then((r) => r.json()).then((data: { window_days?: number; sample_size?: number; videos_per_creator?: number; delay_min?: number; delay_max?: number; llm_provider?: string; llm_base_url?: string; llm_model?: string; llm_api_key_masked?: string; weights?: Record<string, number>; categories?: string[] }) => { if (data.window_days) setWindowDays(data.window_days); if (data.sample_size) setSampleSize(data.sample_size); if (data.videos_per_creator) setVideosPerCreator(data.videos_per_creator); if (data.delay_min != null) setDelayMin(data.delay_min); if (data.delay_max != null) setDelayMax(data.delay_max); if (data.llm_provider) setProvider(data.llm_provider); if (data.llm_base_url) setBaseUrl(data.llm_base_url); if (data.llm_model) setModel(data.llm_model); if (data.llm_api_key_masked) setSavedKey(data.llm_api_key_masked); if (data.weights) setWeights({ views: Math.round((data.weights.views ?? .45) * 100), likes: Math.round((data.weights.likes ?? .25) * 100), shares: Math.round((data.weights.shares ?? .2) * 100), comments: Math.round((data.weights.comments ?? .1) * 100) }); if (data.categories?.length) setCategories(data.categories) }).catch(() => undefined) }, [])
  const updateWeight = (key: keyof typeof weights, value: number) => setWeights((current) => ({ ...current, [key]: value }))
  const save = async () => { if (Object.values(weights).reduce((sum, value) => sum + value, 0) !== 100) { notify('热度权重总和必须等于 100%'); return }; if (delayMax < delayMin) { notify('延迟上限必须大于等于下限'); return }; setSaving(true); try { const response = await fetch(`${API_BASE}/settings/`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ window_days: windowDays, sample_size: sampleSize, videos_per_creator: videosPerCreator, delay_min: delayMin, delay_max: delayMax, llm_provider: provider, llm_base_url: baseUrl, llm_model: model, llm_api_key: apiKey, weights: Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, value / 100])), categories }) }); if (!response.ok) throw new Error('设置保存失败'); const result = await response.json() as { llm_api_key_masked?: string }; if (result.llm_api_key_masked) setSavedKey(result.llm_api_key_masked); setApiKey(''); notify('分析设置已保存') } catch (error) { notify(error instanceof Error ? error.message : '设置保存失败') } finally { setSaving(false) } }
  const add = () => { const value = newCategory.trim(); if (value && !categories.includes(value)) { setCategories([...categories, value]); setNewCategory('') } }
  return <><PageTitle eyebrow="ANALYSIS CONFIG / 04" title="分析设置" description="调整 B站抓取、分类和本地分析口径，让每个判断都能被复算。" action={<button className="button primary" onClick={() => void save()} disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}{saving ? '保存中…' : '保存设置'}</button>} /><div className="settings-grid"><div className="panel setting-panel"><div className="setting-title"><div className="setting-icon cyan-bg"><Bot size={18} /></div><div><h2>内容接入</h2><span>本地读取公开 B站视频</span></div></div><div className="form-grid"><label className="field"><span>分析时间窗口</span><select value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value))}><option value={30}>近 30 天</option><option value={90}>近 90 天</option><option value={180}>近 180 天</option></select></label><label className="field"><span>每位 UP 主抓取数</span><select value={videosPerCreator} onChange={(e) => setVideosPerCreator(Number(e.target.value))}><option value={3}>3 条视频</option><option value={5}>5 条视频</option><option value={10}>10 条视频</option><option value={20}>20 条视频</option></select></label><label className="field"><span>请求延迟下限（秒）</span><input type="number" min="0.05" max="30" step="0.05" value={delayMin} onChange={(e) => setDelayMin(Number(e.target.value))} /></label><label className="field"><span>请求延迟上限（秒）</span><input type="number" min="0.05" max="60" step="0.05" value={delayMax} onChange={(e) => setDelayMax(Number(e.target.value))} /></label></div></div><div className="panel setting-panel"><div className="setting-title"><div className="setting-icon violet-bg"><Sparkles size={18} /></div><div><h2>本地分析引擎</h2><span>未配置 Key 时继续使用规则兜底</span></div></div><div className="form-grid"><label className="field"><span>Provider</span><select value={provider} onChange={(e) => setProvider(e.target.value)}><option value="local">Local fallback</option><option value="openai">OpenAI 兼容接口</option><option value="custom">自定义接口</option></select></label><label className="field"><span>模型名称</span><input value={model} onChange={(e) => setModel(e.target.value)} placeholder="例如 gpt-4o-mini" autoComplete="off" /></label><label className="field"><span>Base URL</span><input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://…/v1" inputMode="url" autoComplete="url" /></label><label className="field"><span>API Key（本地保存）</span><input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={savedKey || '未配置'} autoComplete="new-password" /></label></div></div><div className="panel setting-panel"><div className="setting-title"><div className="setting-icon violet-bg"><BarChart3 size={18} /></div><div><h2>热度权重</h2><span>总和：{Object.values(weights).reduce((sum, value) => sum + value, 0)}%</span></div></div>{([['views','播放', 'cyan'], ['likes','点赞','violet'], ['shares','分享','orange'], ['comments','评论','blue']] as const).map(([key, label, color]) => <label className="weight-control" key={key}><span>{label}</span><input type="range" min="0" max="100" value={weights[key]} onChange={(e) => updateWeight(key, Number(e.target.value))} aria-label={`${label}权重`} /><strong>{weights[key]}%</strong></label>)}</div><div className="panel setting-panel categories-setting"><div className="setting-title"><div className="setting-icon orange-bg"><Tags size={18} /></div><div><h2>主题分类</h2><span>可新增分类，保存后参与配置</span></div></div><div className="category-chips">{categories.map((item) => <span key={item}>{item}</span>)}</div><div className="category-add"><input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="输入新分类" aria-label="新分类名称" /><button className="button secondary" onClick={add}>添加</button></div></div></div></>
}

function EnvironmentPage({ notify }: { notify: (message: string) => void }) {
  const [checks, setChecks] = useState<Array<{ label: string; value: string; status: string; detail?: string }>>([])
  const [loading, setLoading] = useState(true)
  const load = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/environment/`)
      if (!response.ok) throw new Error('环境检测接口不可用')
      const result = await response.json() as { checks: Array<{ label: string; value: string; status: string; detail?: string }> }
      setChecks(result.checks)
      notify('环境检测已完成')
    } catch (error) { notify(error instanceof Error ? error.message : '环境检测失败') } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  const iconFor = (label: string) => label.includes('Python') ? Code2 : label.includes('B站') ? Wifi : label.includes('前端') ? Zap : label.includes('依赖') ? Settings2 : Database
  const readyCount = checks.filter((item) => item.status === 'ready').length
  return <><PageTitle eyebrow="RUNTIME / 03" title="运行环境" description="读取本机真实运行时、依赖、前端构建和 B站会话状态。" action={<button className="button secondary" onClick={() => void load()} disabled={loading}>{loading ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}重新检测</button>} /><div className="env-summary"><div className="env-summary-icon"><Check size={21} /></div><div><strong>{loading ? '正在检测环境' : `环境检测完成 · ${readyCount}/${checks.length} 项正常`}</strong><span>检测结果来自当前本机，不上传环境信息。</span></div><span className="summary-time">实时</span></div><div className="panel env-panel"><div className="env-list">{checks.map((item) => { const Icon = iconFor(item.label); return <div className="env-row" key={item.label}><div className={`env-icon ${item.status}`}><Icon size={17} /></div><div className="env-info"><strong>{item.label}</strong><span>{item.value}</span></div>{item.status === 'ready' ? <span className="ready-label"><Check size={14} />正常</span> : <span className="muted-label">需处理</span>}<button className="text-button" onClick={() => notify(item.detail || `${item.label}：${item.value}`)}>详情<ChevronRight size={14} /></button></div> })}</div><div className="env-actions"><button className="button secondary" onClick={() => notify('依赖修复需要用户确认安装范围')}><Settings2 size={16} />检查依赖</button><button className="button secondary" onClick={() => void fetch(`${API_BASE}/environment/frontend/build`, { method: 'POST' }).then(() => { notify('前端构建任务已执行'); void load() })}><RefreshCw size={16} />重新构建前端</button></div></div></>
}

function SettingsPage({ notify }: { notify: (message: string) => void }) {
  const [windowDays, setWindowDays] = useState(90)
  const [sampleSize, setSampleSize] = useState(20)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState(['AI / 科技', '产品 / 设计', '商业 / 投资', '职业 / 成长', '文化 / 生活', '新闻 / 资讯'])
  const [newCategory, setNewCategory] = useState('')
  const [clearBusy, setClearBusy] = useState(false)
  useEffect(() => { void fetch(`${API_BASE}/settings/`).then((response) => response.ok ? response.json() : null).then((data: { window_days?: number; sample_size?: number; categories?: string[] } | null) => { if (data?.window_days) setWindowDays(data.window_days); if (data?.sample_size) setSampleSize(data.sample_size); if (data?.categories?.length) setCategories(data.categories) }).catch(() => undefined) }, [])
  const saveSettings = async () => { setSaving(true); try { const response = await fetch(`${API_BASE}/settings/`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ window_days: windowDays, sample_size: sampleSize, weights: { views: .45, likes: .25, shares: .2, comments: .1 }, categories }) }); if (!response.ok) throw new Error('设置保存失败'); notify('设置已保存到本地数据库') } catch (error) { notify(error instanceof Error ? error.message : '设置保存失败') } finally { setSaving(false) } }
  const addCategory = () => { const value = newCategory.trim(); if (!value || categories.includes(value)) return; setCategories([...categories, value]); setNewCategory(''); notify(`已新增分类：${value}，请点击保存设置`) }
  const clearAll = async () => { if (!window.confirm('确定清空本地账号、视频和导入记录吗？此操作不可撤销。')) return; setClearBusy(true); try { const response = await fetch(`${API_BASE}/data/all`, { method: 'DELETE' }); if (!response.ok) throw new Error('清空数据失败'); notify('本地数据已清空') } catch (error) { notify(error instanceof Error ? error.message : '清空数据失败') } finally { setClearBusy(false) } }
  return <><PageTitle eyebrow="ANALYSIS CONFIG / 04" title="分析设置" description="调整分类体系与热度口径，让每个判断都能被复算。" action={<button className="button primary" onClick={() => void saveSettings()} disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}{saving ? '保存中…' : '保存设置'}</button>} /><div className="settings-grid"><div className="panel setting-panel"><div className="setting-title"><div className="setting-icon cyan-bg"><Bot size={18} /></div><div><h2>分析引擎</h2><span>未配置 API 时使用本地规则兜底</span></div><span className="configured"><span className="live-dot" />本地规则</span></div><div className="form-grid"><Field label="Provider" value="Local fallback" /><Field label="模型名称" value="规则分类器 v0.1" /><label className="field"><span>分析时间窗口</span><select value={windowDays} onChange={(event) => setWindowDays(Number(event.target.value))}><option value={30}>近 30 天</option><option value={90}>近 90 天</option><option value={180}>近 180 天</option></select></label><label className="field"><span>每个账号取样</span><select value={sampleSize} onChange={(event) => setSampleSize(Number(event.target.value))}><option value={10}>10 篇文章</option><option value={20}>20 篇文章</option><option value={50}>50 篇文章</option></select></label></div></div><div className="panel setting-panel"><div className="setting-title"><div className="setting-icon violet-bg"><BarChart3 size={18} /></div><div><h2>热度权重</h2><span>缺失字段会自动显示数据不足</span></div></div><Weight label="阅读" value="45%" width="45%" color="cyan" /><Weight label="点赞" value="25%" width="25%" color="violet" /><Weight label="在看" value="20%" width="20%" color="orange" /><Weight label="评论" value="10%" width="10%" color="blue" /></div><div className="panel setting-panel categories-setting"><div className="setting-title"><div className="setting-icon orange-bg"><Tags size={18} /></div><div><h2>主题分类</h2><span>支持人工新增、合并和覆盖</span></div><button className="icon-button" aria-label="新增分类" onClick={addCategory}><Plus size={17} /></button></div><div className="category-chips">{categories.map((item) => <span key={item}>{item}</span>)}</div><div className="category-add"><input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="输入新分类" aria-label="新分类名称" /><button className="button secondary" onClick={addCategory}>添加分类</button></div></div><div className="panel setting-panel danger-panel"><div className="setting-title"><div className="setting-icon muted-bg"><Database size={18} /></div><div><h2>数据管理</h2><span>数据默认保存在本地 SQLite 数据库</span></div></div><div className="data-actions"><button className="button secondary" onClick={() => { window.location.href = `${API_BASE}/data/export` }}><Download size={16} />导出分析结果</button><button className="button danger" onClick={() => void clearAll()} disabled={clearBusy}><AlertTriangle size={16} />{clearBusy ? '清空中…' : '清空所有数据'}</button></div></div></div></> }
function Field({ label, value }: { label: string; value: string }) { return <label className="field"><span>{label}</span><div>{value}<ChevronDown size={15} /></div></label> }
function Weight({ label, value, width, color }: { label: string; value: string; width: string; color: string }) { return <div className="weight-row"><span className={`legend-dot ${color}`} /> <span>{label}</span><div className="weight-track"><i className={color} style={{ width }} /></div><strong>{value}</strong></div> }

export default App
