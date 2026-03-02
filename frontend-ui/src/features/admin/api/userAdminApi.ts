import { httpRequest } from "../../../shared/api/httpClient";

export type UserAdminItem = {
  id: number;
  username: string;
  email: string;
  enabled: boolean;
  roles: string[];
  createdAt: string;
};

export type UserAdminListResponse = {
  content: UserAdminItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export async function listUsers(page: number, size: number): Promise<UserAdminListResponse> {
  return httpRequest<UserAdminListResponse>({
    path: `/api/v1/auth/users?page=${page}&size=${size}`,
    method: "GET",
  });
}

export async function disableUser(id: number): Promise<void> {
  await httpRequest<unknown>({
    path: `/api/v1/auth/users/${id}/disable`,
    method: "PUT",
  });
}

export async function enableUser(id: number): Promise<void> {
  await httpRequest<unknown>({
    path: `/api/v1/auth/users/${id}/enable`,
    method: "PUT",
  });
}
