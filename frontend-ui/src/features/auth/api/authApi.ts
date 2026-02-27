import { httpRequest } from "../../../shared/api/httpClient";

export type LoginRequest = {
  username: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
};

export async function login(request: LoginRequest): Promise<LoginResponse> {
  return httpRequest<LoginResponse>("/api/v1/auth/login", "POST", request);
}
