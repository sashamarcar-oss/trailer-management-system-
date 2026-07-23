import axios from "axios";
import {
  Paginated, Trailer, Client, Expense, Rental, Quotation, Invoice, AuditLog, Notification,
} from "@/types";
import {
  mockTrailers, mockClients, mockExpenses, mockRentals, mockQuotations, mockInvoices,
} from "@/lib/mock-data";

/* ------------------------------------------------------------------ */
/* Low-level axios client — JWT auth, refresh-on-401                  */
/* ------------------------------------------------------------------ */
export const axiosClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api",
  headers: { "Content-Type": "application/json" },
});

axiosClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      const refresh = localStorage.getItem("refresh_token");
      if (refresh) {
        try {
          const { data } = await axios.post(
            `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api"}/auth/refresh/`,
            { refresh }
          );
          localStorage.setItem("access_token", data.access);
          error.config.headers = error.config.headers ?? {};
          error.config.headers.Authorization = `Bearer ${data.access}`;
          return axios.request(error.config);
        } catch {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          localStorage.removeItem("auth_user");
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

function normalizeTrailerResponse<T extends Record<string, any>>(item: T): T {
  if (!item || typeof item !== "object") return item;
  return {
    ...item,
    trailerNumber: item.trailer_number ?? item.trailerNumber,
    registrationNumber: item.registration_number ?? item.registrationNumber,
    type: item.trailer_type ?? item.type,
    location: item.yard_location ?? item.location,
    nextInspection: item.next_inspection_date ?? item.nextInspection,
    insuranceExpiry: item.insurance_expiry ?? item.insuranceExpiry,
  };
}

function normalizeTrailerRequest(payload: Record<string, any>) {
  if (!payload || typeof payload !== "object") return payload;
  return {
    ...payload,
    trailer_number: payload.trailerNumber ?? payload.trailer_number,
    registration_number: payload.registrationNumber ?? payload.registration_number,
    trailer_type: payload.type ?? payload.trailer_type,
    yard_location: payload.location ?? payload.yard_location,
    next_inspection_date: payload.nextInspection ?? payload.next_inspection_date,
    insurance_expiry: payload.insuranceExpiry ?? payload.insurance_expiry,
  };
}

function normalizeExpenseResponse<T extends Record<string, any>>(item: T): T {
  if (!item || typeof item !== "object") return item;
  return {
    ...item,
    category: item.category_display ?? item.category,
    vendor: item.vendor_display ?? item.vendor,
    paymentMethod: item.payment_method ?? item.paymentMethod,
    status: item.status_display ?? item.status,
  };
}

function createResource<T extends { id: string }>(
  path: string,
  mockData: T[],
  options?: {
    requestMapper?: (payload: Partial<T>) => any;
    responseMapper?: (item: any) => any;
  }
) {
  let cache = [...mockData];

  async function safeGet<TData>(fn: () => Promise<TData>): Promise<TData> {
    if (useMockFallback) {
      try {
        return await fn();
      } catch {
        throw new Error("Backend unavailable");
      }
    }
    return await fn();
  }

  return {
    async list(params?: Record<string, string>): Promise<Paginated<T>> {
      if (useMockFallback) {
        try {
          const { data } = await axiosClient.get<Paginated<T>>(`/${path}/`, { params });
          return {
            ...data,
            results: options?.responseMapper ? data.results.map(options.responseMapper) : data.results,
          };
        } catch {
          return paginate(cache);
        }
      }

      const { data } = await axiosClient.get<Paginated<T>>(`/${path}/`, { params });
      return {
        ...data,
        results: options?.responseMapper ? data.results.map(options.responseMapper) : data.results,
      };
    },
    async retrieve(id: string): Promise<T | undefined> {
      if (useMockFallback) {
        try {
          const { data } = await axiosClient.get<T>(`/${path}/${id}/`);
          return options?.responseMapper ? options.responseMapper(data) : data;
        } catch {
          return cache.find((item) => item.id === id);
        }
      }

      const { data } = await axiosClient.get<T>(`/${path}/${id}/`);
      return options?.responseMapper ? options.responseMapper(data) : data;
    },
    async create(payload: Partial<T>): Promise<T> {
      if (useMockFallback) {
        try {
          const mappedPayload = options?.requestMapper ? options.requestMapper(payload) : payload;
          const { data } = await axiosClient.post<T>(`/${path}/`, mappedPayload);
          cache = [data, ...cache];
          return options?.responseMapper ? options.responseMapper(data) : data;
        } catch {
          const record = payload as T;
          cache = [record, ...cache];
          return record;
        }
      }

      const mappedPayload = options?.requestMapper ? options.requestMapper(payload) : payload;
      const { data } = await axiosClient.post<T>(`/${path}/`, mappedPayload);
      return options?.responseMapper ? options.responseMapper(data) : data;
    },
    async update(id: string, payload: Partial<T>): Promise<T> {
      if (useMockFallback) {
        try {
          const mappedPayload = options?.requestMapper ? options.requestMapper(payload) : payload;
          const { data } = await axiosClient.patch<T>(`/${path}/${id}/`, mappedPayload);
          cache = cache.map((item) => (item.id === id ? data : item));
          return options?.responseMapper ? options.responseMapper(data) : data;
        } catch {
          cache = cache.map((item) => (item.id === id ? { ...item, ...payload } : item));
          return cache.find((item) => item.id === id) as T;
        }
      }

      const mappedPayload = options?.requestMapper ? options.requestMapper(payload) : payload;
      const { data } = await axiosClient.patch<T>(`/${path}/${id}/`, mappedPayload);
      return options?.responseMapper ? options.responseMapper(data) : data;
    },
    async remove(id: string): Promise<void> {
      if (useMockFallback) {
        try {
          await axiosClient.delete(`/${path}/${id}/`);
        } finally {
          cache = cache.filter((item) => item.id !== id);
        }
        return;
      }

      await axiosClient.delete(`/${path}/${id}/`);
    },
  };
}

const useMockFallback = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

function paginate<T>(items: T[]): Paginated<T> {
  return { count: items.length, next: null, previous: null, results: items };
}

export const api = {
  auth: {
    async login(email: string, password: string) {
      const { data } = await axiosClient.post("/auth/login/", { email, password });
      return data as { access: string; refresh: string };
    },
    async me() {
      const { data } = await axiosClient.get("/auth/me/");
      return { data };
    },
    async forgotPassword(email: string) {
      const { data } = await axiosClient.post("/auth/forgot-password/", { email });
      return data;
    },
    async changePassword(oldPassword: string, newPassword: string) {
      const { data } = await axiosClient.post("/auth/change-password/", {
        old_password: oldPassword,
        new_password: newPassword,
      });
      return data;
    },
  },
  trailers: createResource<Trailer>("trailers", mockTrailers, {
    requestMapper: normalizeTrailerRequest,
    responseMapper: normalizeTrailerResponse,
  }),
  clients: createResource<Client>("clients", mockClients),
  expenses: createResource<Expense>("expenses", mockExpenses, {
    responseMapper: normalizeExpenseResponse,
  }),
  rentals: createResource<Rental>("rentals", mockRentals),
  quotations: createResource<Quotation>("quotations", mockQuotations),
  invoices: createResource<Invoice>("invoices", mockInvoices),
  auditLogs: {
    /** Audit logs are read-only and are served by the core Django app. */
    async list(params?: Record<string, string>): Promise<Paginated<AuditLog>> {
      const { data } = await axiosClient.get<Paginated<AuditLog>>(
        "/core/audit-logs/",
        { params }
      );
      return data;
    },
  },
  notifications: {
    async list(): Promise<Paginated<Notification>> {
      const { data } = await axiosClient.get<Paginated<Notification>>("/core/recent-activity/");
      return data;
    },
  },
};

export const login = api.auth.login;
