import { clearAuthToken, getAuthState, setAuthToken } from "./useAuthStore";

clearAuthToken();
setAuthToken("access");
const state = getAuthState();

if (state.accessToken !== "access") {
  throw new Error("accessToken mismatch");
}
