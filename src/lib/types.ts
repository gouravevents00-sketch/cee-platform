export type Role = 'director' | 'admin' | 'design' | 'poc' | 'accounts'

export interface Profile {
  id: string
  name: string
  role: Role
  email: string
}

export interface Client {
  id: string
  name: string
  type: 'agency' | 'corporate' | 'government' | 'individual'
  contact_name?: string
  contact_phone?: string
  contact_email?: string
  credit_period_days: number
  advance_percent: number
}

export interface Event {
  id: string
  name: string
  client_id?: string
  event_date?: string
  venue?: string
  city?: string
  type?: string
  status: 'enquiry' | 'active' | 'execution' | 'completed' | 'cancelled'
  current_phase: number
  poc_id?: string
  notes?: string
  created_at: string
  clients?: Client
  poc?: Profile
}

export interface EventTask {
  id: string
  event_id: string
  phase: number
  phase_name: string
  task_number: string
  task_name: string
  task_type: 'action' | 'approval' | 'followup'
  owner_role: string
  status: 'pending' | 'in_progress' | 'done' | 'blocked'
  completed_by?: string
  completed_at?: string
  notes?: string
}

export interface Approval {
  id: string
  event_id: string
  task_id?: string
  type: string
  requested_by: string
  requested_at: string
  status: 'pending' | 'approved' | 'rejected'
  decided_by?: string
  decided_at?: string
  comment?: string
  attachment_url?: string
  events?: { name: string }
  requester?: Profile
}

export interface Expense {
  id: string
  event_id: string
  submitted_by: string
  item: string
  amount: number
  category: 'transport' | 'material' | 'food' | 'manpower' | 'other'
  bill_url?: string
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
  events?: { name: string }
  submitter?: Profile
}

export const PHASES = [
  { number: 0, name: 'Enquiry', color: 'bg-gray-100 text-gray-700' },
  { number: 1, name: 'Onboard', color: 'bg-blue-100 text-blue-700' },
  { number: 2, name: 'Plan & Cost', color: 'bg-purple-100 text-purple-700' },
  { number: 3, name: 'Recce & Layout', color: 'bg-yellow-100 text-yellow-700' },
  { number: 4, name: 'Operations', color: 'bg-orange-100 text-orange-700' },
  { number: 5, name: 'Artwork & Print', color: 'bg-pink-100 text-pink-700' },
  { number: 6, name: 'Execution', color: 'bg-red-100 text-red-700' },
  { number: 7, name: 'Close', color: 'bg-green-100 text-green-700' },
]

export const ROLE_LABELS: Record<Role, string> = {
  director: 'Director',
  admin: 'Admin / Logistics',
  design: 'Design Team',
  poc: 'POC',
  accounts: 'Accounts',
}

export const STATUS_COLORS = {
  enquiry: 'bg-gray-100 text-gray-700',
  active: 'bg-blue-100 text-blue-700',
  execution: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

// ─── Experiences ────────────────────────────────────────────────────────────

export type ServiceType =
  | 'laser'
  | 'sketch'
  | 'robo_arm'
  | '3d_print'
  | 'photo_booth'
  | 'photo_360'
  | 'glambot'
  | 'mirror_booth'
  | 'brand_activation'
  | 'roaming_selfie'
  | 'mosaic_wall'
export type OrderStatus = 'inquiry' | 'confirmed' | 'assigned' | 'completed' | 'cancelled'

export interface ServicePackage {
  name: string
  duration: string
  pieces: number | null
  price: number
}

export interface ExperienceService {
  id: ServiceType
  name: string
  description: string
  color: string
  packages: ServicePackage[]
  extra_piece_rate: number | null
}

export interface ExperienceOrder {
  id: string
  service_type: ServiceType
  package_name: string
  client_id?: string
  client_name: string
  contact_name: string
  contact_phone: string
  event_name: string
  event_date: string
  event_city: string
  pieces_included?: number
  extra_pieces: number
  special_notes?: string
  status: OrderStatus
  operator_id?: string
  total_amount: number
  linked_event_id?: string
  created_by?: string
  created_at: string
  operator?: Profile
}

export const EXPERIENCE_SERVICES: ExperienceService[] = [
  {
    id: 'laser',
    name: 'Laser Engraving Station',
    description: 'Live personalized laser engraving on wooden coasters, keychains, acrylic standees',
    color: 'bg-orange-100 text-orange-700',
    packages: [
      { name: 'Basic', duration: '3 hrs', pieces: 50, price: 18000 },
      { name: 'Standard', duration: '6 hrs', pieces: 100, price: 28000 },
      { name: 'Premium', duration: 'Full day', pieces: 200, price: 45000 },
    ],
    extra_piece_rate: 150,
  },
  {
    id: 'sketch',
    name: 'Sketch Portrait Station',
    description: 'AI robot draws live guest portraits on paper — personalized souvenir to take home',
    color: 'bg-purple-100 text-purple-700',
    packages: [
      { name: 'Basic', duration: '3 hrs', pieces: 50, price: 22000 },
      { name: 'Standard', duration: '6 hrs', pieces: 100, price: 35000 },
      { name: 'Premium', duration: 'Full day', pieces: 200, price: 55000 },
    ],
    extra_piece_rate: 200,
  },
  {
    id: 'robo_arm',
    name: 'Robo Arm Interactive Demo',
    description: 'Live robotic arm demonstration — crowd-puller for tech, corporate & brand events',
    color: 'bg-blue-100 text-blue-700',
    packages: [
      { name: 'Half Day', duration: '4 hrs', pieces: null, price: 15000 },
      { name: 'Full Day', duration: '8 hrs', pieces: null, price: 25000 },
    ],
    extra_piece_rate: null,
  },
  {
    id: '3d_print',
    name: '3D Printing Station',
    description: 'Live 3D printing of brand logos, custom trophies, or personalised souvenirs',
    color: 'bg-green-100 text-green-700',
    packages: [
      { name: 'Half Day', duration: '4 hrs', pieces: null, price: 20000 },
      { name: 'Full Day', duration: '8 hrs', pieces: null, price: 35000 },
    ],
    extra_piece_rate: null,
  },
  {
    id: 'photo_booth',
    name: 'AI Photo Booth',
    description: 'AI-powered photo booth — filters, face swap, WhatsApp & QR sharing, branded prints',
    color: 'bg-pink-100 text-pink-700',
    packages: [
      { name: 'Basic', duration: '3 hrs', pieces: null, price: 15000 },
      { name: 'Standard', duration: '6 hrs', pieces: null, price: 25000 },
      { name: 'Premium', duration: 'Full day', pieces: null, price: 40000 },
    ],
    extra_piece_rate: null,
  },
  {
    id: 'photo_360',
    name: '360° Video Booth',
    description: 'Cinematic 360° slow-motion video — viral content for guests at weddings & corporate events',
    color: 'bg-violet-100 text-violet-700',
    packages: [
      { name: 'Standard', duration: '4 hrs', pieces: null, price: 25000 },
      { name: 'Premium', duration: '8 hrs', pieces: null, price: 45000 },
      { name: 'Luxury', duration: 'Full day', pieces: null, price: 65000 },
    ],
    extra_piece_rate: null,
  },
  {
    id: 'glambot',
    name: 'GlamBot Slow-Mo',
    description: 'Red-carpet cinematic slow-motion arm — high-end weddings, film promos, brand launches',
    color: 'bg-yellow-100 text-yellow-700',
    packages: [
      { name: 'Standard', duration: '4 hrs', pieces: null, price: 40000 },
      { name: 'Premium', duration: '8 hrs', pieces: null, price: 65000 },
      { name: 'Luxury', duration: 'Full day', pieces: null, price: 85000 },
    ],
    extra_piece_rate: null,
  },
  {
    id: 'mirror_booth',
    name: 'Mirror Booth',
    description: 'Full-length interactive magic mirror with animations, touch prompts & printed photos',
    color: 'bg-cyan-100 text-cyan-700',
    packages: [
      { name: 'Basic', duration: '3 hrs', pieces: null, price: 20000 },
      { name: 'Standard', duration: '6 hrs', pieces: null, price: 35000 },
      { name: 'Premium', duration: 'Full day', pieces: null, price: 50000 },
    ],
    extra_piece_rate: null,
  },
  {
    id: 'brand_activation',
    name: 'Brand Activation Station',
    description: 'Custom branded AI photo experience — AI inserts brand product into guest photos for viral reach',
    color: 'bg-red-100 text-red-700',
    packages: [
      { name: 'Half Day', duration: '4 hrs', pieces: null, price: 35000 },
      { name: 'Full Day', duration: '8 hrs', pieces: null, price: 60000 },
      { name: 'Campaign', duration: 'Multi-day', pieces: null, price: 100000 },
    ],
    extra_piece_rate: null,
  },
  {
    id: 'roaming_selfie',
    name: 'Roaming Selfie Stand',
    description: 'Operator-held tablet selfie stand roaming the event — no fixed booth, maximum guest coverage',
    color: 'bg-teal-100 text-teal-700',
    packages: [
      { name: 'Basic', duration: '3 hrs', pieces: null, price: 8000 },
      { name: 'Standard', duration: '6 hrs', pieces: null, price: 14000 },
      { name: 'Premium', duration: 'Full day', pieces: null, price: 22000 },
    ],
    extra_piece_rate: null,
  },
  {
    id: 'mosaic_wall',
    name: 'Photo Mosaic Wall',
    description: 'Guest photos come together live into one giant mosaic artwork — stunning focal point for any event',
    color: 'bg-indigo-100 text-indigo-700',
    packages: [
      { name: 'Standard', duration: '4 hrs', pieces: null, price: 15000 },
      { name: 'Premium', duration: '8 hrs', pieces: null, price: 25000 },
      { name: 'Full Day', duration: 'Full day', pieces: null, price: 35000 },
    ],
    extra_piece_rate: null,
  },
]

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  inquiry: 'bg-gray-100 text-gray-700',
  confirmed: 'bg-blue-100 text-blue-700',
  assigned: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

export const SERVICE_LABELS: Record<ServiceType, string> = {
  laser: 'Laser Engraving',
  sketch: 'Sketch Portrait',
  robo_arm: 'Robo Arm Demo',
  '3d_print': '3D Printing',
  photo_booth: 'AI Photo Booth',
  photo_360: '360° Video Booth',
  glambot: 'GlamBot Slow-Mo',
  mirror_booth: 'Mirror Booth',
  brand_activation: 'Brand Activation',
  roaming_selfie: 'Roaming Selfie Stand',
  mosaic_wall: 'Photo Mosaic Wall',
}

// ─── Production House ────────────────────────────────────────────────────────

export type ProductionServiceType = 'stage' | 'branding' | 'stall' | 'decor' | 'signage'
export type ProductionStatus =
  | 'inquiry'
  | 'quoted'
  | 'design_review'
  | 'in_production'
  | 'ready'
  | 'installed'
  | 'completed'
  | 'cancelled'

export interface ProductionOrder {
  id: string
  service_type: ProductionServiceType
  client_name: string
  contact_name: string
  contact_phone: string
  event_name: string
  event_date?: string
  event_city: string
  brief: string
  dimensions?: string
  material_preference?: string
  quoted_amount?: number
  final_amount?: number
  status: ProductionStatus
  assigned_to?: string
  linked_event_id?: string
  internal_notes?: string
  created_by?: string
  created_at: string
  assignee?: Profile
}

export const PRODUCTION_SERVICES: {
  id: ProductionServiceType
  name: string
  description: string
  color: string
  examples: string
}[] = [
  {
    id: 'stage',
    name: 'Stage Fabrication',
    description: 'Custom stage structures — platforms, backdrops, truss, raised stages',
    color: 'bg-red-100 text-red-700',
    examples: 'Award stages, conference stages, concert platforms',
  },
  {
    id: 'branding',
    name: 'Branding Installations',
    description: 'Large-format brand displays, standees, pillars, entrance arches',
    color: 'bg-blue-100 text-blue-700',
    examples: 'Flex branding, LED walls, photo walls, brand gates',
  },
  {
    id: 'stall',
    name: 'Exhibition Stalls',
    description: 'Custom-built exhibition & trade show stalls in MDF, wood, acrylic',
    color: 'bg-amber-100 text-amber-700',
    examples: 'Expo stalls, product launch setups, kiosk counters',
  },
  {
    id: 'decor',
    name: 'Custom Decor',
    description: 'Bespoke décor elements — props, installations, themed environments',
    color: 'bg-pink-100 text-pink-700',
    examples: 'Wedding mandaps, themed photo zones, centrepieces',
  },
  {
    id: 'signage',
    name: 'Signage & Flex',
    description: 'All print & flex work — banners, hoardings, roll-ups, wayfinding',
    color: 'bg-green-100 text-green-700',
    examples: 'Vinyl wraps, flex banners, acrylic letter boards',
  },
]

export const PRODUCTION_STATUS_COLORS: Record<ProductionStatus, string> = {
  inquiry: 'bg-gray-100 text-gray-700',
  quoted: 'bg-blue-100 text-blue-700',
  design_review: 'bg-purple-100 text-purple-700',
  in_production: 'bg-orange-100 text-orange-700',
  ready: 'bg-teal-100 text-teal-700',
  installed: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

export const PRODUCTION_STATUS_LABELS: Record<ProductionStatus, string> = {
  inquiry: 'Inquiry',
  quoted: 'Quoted',
  design_review: 'Design Review',
  in_production: 'In Production',
  ready: 'Ready',
  installed: 'Installed',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const PRODUCTION_SERVICE_LABELS: Record<ProductionServiceType, string> = {
  stage: 'Stage Fabrication',
  branding: 'Branding',
  stall: 'Exhibition Stall',
  decor: 'Custom Decor',
  signage: 'Signage & Flex',
}

// ─── Inventory ───────────────────────────────────────────────────────────────

export type InventoryCategory = 'experiences' | 'production' | 'general'

export interface InventoryItem {
  id: string
  name: string
  category: InventoryCategory
  description?: string
  color?: string
  qty_total: number
  qty_available: number
  unit: string
  image_url?: string
  is_active: boolean
  created_by?: string
  created_at: string
}

export const INVENTORY_CATEGORY_LABELS: Record<InventoryCategory, string> = {
  experiences: 'Experiences',
  production: 'Production House',
  general: 'General',
}

export const INVENTORY_CATEGORY_COLORS: Record<InventoryCategory, string> = {
  experiences: 'bg-purple-100 text-purple-700',
  production: 'bg-orange-100 text-orange-700',
  general: 'bg-gray-100 text-gray-700',
}
