/**
 * SsIcon — Material Symbols icon component for the Mentorly design system.
 * Maps descriptive names to Material Symbols icon names.
 *
 * Usage: <SsIcon name="dashboard" size={20} className="..." />
 *
 * Icon names use snake_case as per Material Symbols naming conventions.
 * See: https://fonts.google.com/icons
 */
const iconMap = {
  // Navigation
  dashboard: "grid_view",
  sessions: "school",
  students: "groups",
  calendar: "calendar_month",
  messages: "chat",
  "message-square": "chat",
  chat: "chat",
  analytics: "insights",
  earnings: "account_balance_wallet",
  wallet: "account_balance_wallet",
  reviews: "star",
  profile: "person",
  "professional-profile": "person",
  settings: "settings",
  notifications: "notifications",
  // Actions
  add: "add",
  plus: "add",
  edit: "edit",
  edit3: "edit",
  delete: "delete",
  trash2: "delete",
  close: "close",
  x: "close",
  menu: "menu",
  more: "more_horiz",
  "more-horizontal": "more_horiz",
  refresh: "refresh",
  "refresh-cw": "refresh",
  copy: "content_copy",
  share: "share",
  "share-2": "share",
  search: "search",
  filter: "filter_list",
  download: "download",
  upload: "upload",
  send: "send",
  "external-link": "open_in_new",

  // Navigation arrows
  "chevron-right": "chevron_right",
  "chevron-left": "chevron_left",
  "chevron-down": "chevron_down",
  "arrow-up-right": "north_east",
  "arrow-down-right": "south_east",

  // Status
  "check-circle": "check_circle",
  check_circle: "check_circle",
  "alert-circle": "error",
  "alert-triangle": "warning",
  info: "info",
  "question-mark": "help",
  "help-circle": "help",
  loader: "sync",
  sparkles: "auto_awesome",
  target: "track_changes",
  shield: "shield",
  zap: "bolt",
  bolt: "bolt",
  award: "workspace_premium",
  "check-square": "check_box",
  check: "check",
  "list-checks": "checklist",

  // Communication
  video: "videocam",
  "video-call": "videocam",
  phone: "call",
  call: "call",
  mail: "mail",
  email: "mail",
  link: "link",
  paperclip: "attachment",
  attachment: "attachment",
  image: "image",
  emoji: "emoji_emotions",
  smile: "emoji_emotions",

  // Media
  play: "play_circle",
  "play-circle": "play_circle",
  "voice-message": "mic",
  mic: "mic",

  // UI
  sun: "light_mode",
  "light-mode": "light_mode",
  moon: "dark_mode",
  "dark-mode": "dark_mode",
  grid: "grid_view",
  "grid-3x3": "grid_view",
  list: "view_list",
  eye: "visibility",
  "eye-off": "visibility_off",

  // Business
  trending: "trending_up",
  "trending-up": "trending_up",
  "trending-down": "trending_down",
  revenue: "payments",
  "dollar-sign": "payments",
  clock: "schedule",
  calendar_month: "calendar_month",
  calendar_days: "calendar_month",
  "calendar-days": "calendar_month",
  today: "calendar_month",
  home: "home",
  globe: "language",
  "book-open": "book",
  book: "book",
  courses: "school",
  learning: "school",

  // Content
  "file-text": "description",
  file: "description",
  document: "description",
  bookmark: "bookmark",
  heart: "favorite",
  star: "star",
  star_rate: "star",

  // User-facing
  user: "person",
  users: "groups",
  "user-x": "person_remove",
  "bell-off": "notifications_off",
  "calendar-plus": "event",
  "calendar-off": "event_busy",
  "calendar_add_on": "event",

  // Material Symbols direct names
  grid_view: "grid_view",
  video_camera_front: "videocam",
  groups: "groups",
  chat_bubble: "chat",
  insights: "insights",
  payments: "payments",
  person: "person",
  school: "school",
  menu_open: "menu_open",
  expand_more: "expand_more",
  logout: "logout",
  notifications_off: "notifications_off",
  group_off: "group_off",
  event_busy: "event_busy",
  checklist: "checklist",
  pending_actions: "pending",
  cancel: "cancel",
  block: "block",
  edit_note: "edit_note",
  "manage-search": "manage_search",
  manage_search: "manage_search",
  "arrow-forward": "arrow_forward",
  arrow_forward: "arrow_forward",
  "currency_rupee": "currency_rupee",
  "currency-rupee": "currency_rupee",

  // Default fallback
  default: "grid_view",
};

export default function SsIcon({ name, size = 20, className = "", style, ...props }) {
  const normalizedName = (name || "default").toLowerCase().replace(/[\s_]+/g, "-");
  const iconName = iconMap[normalizedName] || iconMap[name] || iconMap.default;

  return (
    <span
      className={`material-symbols-outlined ${className}`.trim()}
      style={{
        fontSize: size,
        width: size,
        height: size,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
      aria-hidden="true"
      {...props}
    >
      {iconName}
    </span>
  );
}
