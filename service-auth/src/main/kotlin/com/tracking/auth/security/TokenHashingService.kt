package com.tracking.auth.security

import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import jakarta.annotation.PostConstruct

@Component
public class TokenHashingService(
    @Value("\${auth.token-hash-pepper}")
    private val tokenHashPepper: String,
) {
    @PostConstruct
    public fun validateConfiguration(): Unit {
        if (tokenHashPepper.length < MIN_PEPPER_LENGTH) {
            throw IllegalStateException("auth.token-hash-pepper must be at least $MIN_PEPPER_LENGTH characters")
        }
    }

    public fun hash(rawValue: String): String {
        val mac = Mac.getInstance(HMAC_ALGORITHM)
        val key = SecretKeySpec(tokenHashPepper.toByteArray(StandardCharsets.UTF_8), HMAC_ALGORITHM)
        mac.init(key)
        val digest = mac.doFinal(rawValue.toByteArray(StandardCharsets.UTF_8))
        return Base64.getUrlEncoder().withoutPadding().encodeToString(digest)
    }

    public fun secureEquals(left: String, right: String): Boolean {
        return MessageDigest.isEqual(
            left.toByteArray(StandardCharsets.UTF_8),
            right.toByteArray(StandardCharsets.UTF_8),
        )
    }

    private companion object {
        private const val HMAC_ALGORITHM: String = "HmacSHA256"
        private const val MIN_PEPPER_LENGTH: Int = 24
    }
}
