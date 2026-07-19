/**
 * SsIcon — Lucide icon mapper for the SkillSwap design system.
 * Maps descriptive names to lucide-react icons for easy use throughout the app.
 *
 * Usage: <SsIcon name="dashboard" size={20} className="..." />
 */
import {
  LayoutDashboard, GraduationCap, Users, Calendar,
  MessageSquare, BarChart3, Wallet, Star, User,
  Settings, Bell, LogOut, ChevronRight, ChevronLeft,
  ChevronDown, Search, X, Plus, Menu, MoreHorizontal,
  RefreshCw, TrendingUp, TrendingDown, DollarSign,
  Clock, CheckCircle, AlertCircle, AlertTriangle,
  Info, PlayCircle, Video, Phone, Mail, Link,
  ExternalLink, Copy, Share2, Download, Upload,
  FileText, Image, Paperclip, Send, Smile,
  Sun, Moon, Grid3X3, List, Filter, ArrowUpRight,
  ArrowDownRight, CalendarDays, Sparkles, Target,
  BookOpen, Award, Zap, Shield, Eye, EyeOff,
  Edit3, Trash2, Bookmark, Heart, Mic, BellOff,
  UserX, CheckSquare, Check, ListChecks, CalendarPlus,
  Home, Globe, HelpCircle, Loader,
} from "lucide-react";

const iconMap = {
  // Navigation
  dashboard: LayoutDashboard,
  sessions: GraduationCap,
  students: Users,
  calendar: Calendar,
  messages: MessageSquare,
  analytics: BarChart3,
  earnings: Wallet,
  wallet: Wallet,
  reviews: Star,
  profile: User,
  "professional-profile": User,
  settings: Settings,
  notifications: Bell,
  logout: LogOut,

  // Actions
  add: Plus,
  plus: Plus,
  edit: Edit3,
  delete: Trash2,
  close: X,
  menu: Menu,
  more: MoreHorizontal,
  refresh: RefreshCw,
  copy: Copy,
  share: Share2,
  search: Search,
  filter: Filter,
  download: Download,
  upload: Upload,
  send: Send,

  // Navigation arrows
  "chevron-right": ChevronRight,
  "chevron-left": ChevronLeft,
  "chevron-down": ChevronDown,
  "arrow-up-right": ArrowUpRight,
  "arrow-down-right": ArrowDownRight,

  // Status
  "check-circle": CheckCircle,
  "check_circle": CheckCircle,
  "alert-circle": AlertCircle,
  "alert-triangle": AlertTriangle,
  info: Info,
  "question-mark": HelpCircle,
  loader: Loader,
  sparkles: Sparkles,
  target: Target,
  shield: Shield,

  // Communication
  video: Video,
  "video-call": Video,
  phone: Phone,
  call: Phone,
  mail: Mail,
  email: Mail,
  link: ExternalLink,
  paperclip: Paperclip,
  attachment: Paperclip,
  image: Image,
  emoji: Smile,
  smile: Smile,

  // Media
  play: PlayCircle,
  "play-circle": PlayCircle,
  "voice-message": Mic,
  mic: Mic,

  // UI
  sun: Sun,
  moon: Moon,
  "light-mode": Sun,
  "dark-mode": Moon,
  grid: Grid3X3,
  list: List,
  eye: Eye,
  "eye-off": EyeOff,

  // Business
  trending: TrendingUp,
  "trending-up": TrendingUp,
  "trending-down": TrendingDown,
  revenue: DollarSign,
  "dollar-sign": DollarSign,
  clock: Clock,
  calendar_month: Calendar,
  calendar_days: CalendarDays,
  "calendar-days": CalendarDays,
  today: CalendarDays,

  // Content
  "file-text": FileText,
  file: FileText,
  document: FileText,
  bookmark: Bookmark,
  heart: Heart,
  star: Star,
  award: Award,
  zap: Zap,
  bolt: Zap,
  book: BookOpen,
  "book-open": BookOpen,
  courses: BookOpen,
  learning: BookOpen,
  home: Home,
  globe: Globe,

  // Lucide direct name mappings (used in MentorDashboard refactoring)
  user: User,
  users: Users,
  "message-square": MessageSquare,
  "user-x": UserX,
  "bell-off": BellOff,
  "check-square": CheckSquare,
  check: Check,
  "list-checks": ListChecks,
  "calendar-plus": CalendarPlus,
  "calendar-off": X,
  "share-2": Share2,

  // Material Symbols ↔ Lucide name mapping
  grid_view: LayoutDashboard,
  video_camera_front: Video,
  groups: Users,
  chat: MessageSquare,
  chat_bubble: MessageSquare,
  insights: BarChart3,
  payments: Wallet,
  person: User,
  star_rate: Star,
  school: GraduationCap,
  menu_open: ChevronLeft,
  expand_more: ChevronDown,
  logout: LogOut,
  "calendar_add_on": CalendarPlus,
  "notifications_off": BellOff,
  "group_off": UserX,
  "event_busy": X,
  checklist: CheckSquare,
  "pending_actions": Clock,
  
  // Default fallback
  default: LayoutDashboard,
};

export default function SsIcon({ name, size = 20, className = "", ...props }) {
  const normalizedName = (name || "default").toLowerCase().replace(/[\s_]+/g, "-");
  const IconComponent = iconMap[normalizedName] || iconMap[name] || iconMap.default;
  
  if (!IconComponent) return null;
  
  return (
    <IconComponent
      size={size}
      className={className}
      strokeWidth={1.5}
      {...props}
    />
  );
}
