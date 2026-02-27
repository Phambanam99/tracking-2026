import { clearTokens, loadTokens, saveTokens } from "./tokenStorage";

clearTokens();
saveTokens("a");
const tokens = loadTokens();

if (tokens.accessToken !== "a") {
  throw new Error("access token mismatch");
}

if (tokens.refreshToken !== null) {
  throw new Error("refresh token must not be readable in JS (httpOnly cookie strategy)");
}
