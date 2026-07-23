import { axiosClient } from "@/lib/api";

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: number | null;
  role_name: "super_admin" | "administrator" | "accountant" | "operations_officer" | null;
  branch: number | null;
  is_active: boolean;
  deactivated: boolean;
  two_factor_enabled: boolean;
  is_superuser: boolean;
  last_login: string | null;
  created_at: string;
}

interface LoginResponse {
  access: string;
  refresh: string;
  user: AuthUser;
}

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  administrator: "Administrator",
  accountant: "Accountant",
  operations_officer: "Operations Officer",
};

/**
 * Logs in with email + password, persists the JWT pair and user profile to
 * localStorage (read by axiosClient's request/refresh interceptors in
 * lib/api.ts), and returns the authenticated user.
 */
export async function login(email: string, password: string): Promise<AuthUser> {
  const { data } = await axiosClient.post<LoginResponse>("/auth/login/", { email, password });
  localStorage.setItem("access_token", data.access);
  localStorage.setItem("refresh_token", data.refresh);
  localStorage.setItem("auth_user", JSON.stringify(data.user));
  return data.user;
}

export function logout() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("auth_user");
  window.location.href = "/login";
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("auth_user");
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem("access_token"));
}
