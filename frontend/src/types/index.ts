export interface OrganizationSettings {
  id: string;
  name: string;
  cnpj?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  useCustomAccess?: boolean;
  avatarUrl?: string | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: PaginatedMeta;
}

export interface Product {
  id: string;
  name: string;
  internalCode: string;
  barcode?: string;
  category: { id: string; name: string };
  manufacturer?: string;
  unit: string;
  minQuantity: number;
  location?: string;
  notes?: string;
  active: boolean;
  totalStock?: number;
  batches?: ProductBatch[];
  stockItems?: StockItem[];
}

export interface ProductBatch {
  id: string;
  batchNumber: string;
  expirationDate: string;
  manufacturingDate?: string;
  quantity?: number;
  status?: 'VALID' | 'WARNING' | 'CRITICAL' | 'EXPIRED';
}

export interface StockLocation {
  id: string;
  name: string;
  code: string;
  type: string;
  totalQuantity?: number;
}

export interface StockItem {
  id: string;
  quantity: number;
  product: Product;
  location: StockLocation;
  batch?: ProductBatch;
}

export interface StockMovement {
  id: string;
  type: string;
  status: string;
  quantity: number;
  movementDate: string;
  product: { id: string; name: string; internalCode: string };
  originLocation?: StockLocation;
  destinationLocation?: StockLocation;
  user: { id: string; name: string };
  invoiceNumber?: string;
  reason?: string;
  notes?: string | null;
  supplier?: { id: string; name: string } | null;
  batch?: { id: string; batchNumber: string; expirationDate?: string } | null;
  approvedBy?: { id: string; name: string } | null;
  approvedAt?: string | null;
  createdAt?: string;
}

export interface DashboardMetrics {
  kpis: {
    totalProducts: number;
    totalLocations: number;
    todayMovements: number;
    pendingTransfers: number;
    belowMinCount: number;
    expiringCount: number;
    monthlyEntryValue: number;
  };
  belowMin: Array<{
    id: string;
    name: string;
    internalCode: string;
    minQuantity: number;
    current: number;
    category?: string;
  }>;
  expiring: Array<{
    id: string;
    batchNumber: string;
    expirationDate: string;
    status?: string;
    product: { name: string };
  }>;
  recentMovements: StockMovement[];
}

export interface EntriesExitsChartData {
  period: string;
  chartData: Array<{ date: string; entries: number; exits: number }>;
}
