package com.tracking.broadcaster.security

import java.security.PublicKey

public fun interface JwksKeyProvider {
    public fun resolveCachedKey(kid: String): PublicKey?

    public fun refreshAndResolveKey(kid: String): PublicKey? = resolveCachedKey(kid)
}
