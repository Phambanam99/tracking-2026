package com.tracking.auth.security

import jakarta.annotation.PostConstruct
import java.nio.charset.StandardCharsets
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

@Component
public class EncryptionService(
        @Value("\${auth.jwt.master-key}") private val masterKey: String,
) {
    @PostConstruct
    public fun validateConfiguration(): Unit {
        if (masterKey.length < 32) {
            throw IllegalStateException(
                    "auth.jwt.master-key must be at least 32 characters for AES-256"
            )
        }
    }

    public fun encrypt(plaintext: String): String {
        val cipher = Cipher.getInstance(CIPHER_ALGO)
        val keySpec =
                SecretKeySpec(masterKey.substring(0, 32).toByteArray(StandardCharsets.UTF_8), "AES")

        val iv = ByteArray(GCM_IV_LENGTH)
        secureRandom.nextBytes(iv)
        val gcmSpec = GCMParameterSpec(GCM_TAG_LENGTH * 8, iv)

        cipher.init(Cipher.ENCRYPT_MODE, keySpec, gcmSpec)
        val ciphertext = cipher.doFinal(plaintext.toByteArray(StandardCharsets.UTF_8))

        val encryptedData = ByteArray(iv.size + ciphertext.size)
        System.arraycopy(iv, 0, encryptedData, 0, iv.size)
        System.arraycopy(ciphertext, 0, encryptedData, iv.size, ciphertext.size)

        return Base64.getUrlEncoder().withoutPadding().encodeToString(encryptedData)
    }

    public fun decrypt(encryptedBase64: String): String {
        val encryptedData = Base64.getUrlDecoder().decode(encryptedBase64)

        val iv = ByteArray(GCM_IV_LENGTH)
        System.arraycopy(encryptedData, 0, iv, 0, iv.size)

        val ciphertext = ByteArray(encryptedData.size - iv.size)
        System.arraycopy(encryptedData, iv.size, ciphertext, 0, ciphertext.size)

        val cipher = Cipher.getInstance(CIPHER_ALGO)
        val keySpec =
                SecretKeySpec(masterKey.substring(0, 32).toByteArray(StandardCharsets.UTF_8), "AES")
        val gcmSpec = GCMParameterSpec(GCM_TAG_LENGTH * 8, iv)

        cipher.init(Cipher.DECRYPT_MODE, keySpec, gcmSpec)
        val plaintext = cipher.doFinal(ciphertext)

        return String(plaintext, StandardCharsets.UTF_8)
    }

    private companion object {
        private const val CIPHER_ALGO: String = "AES/GCM/NoPadding"
        private const val GCM_IV_LENGTH: Int = 12
        private const val GCM_TAG_LENGTH: Int = 16
        private val secureRandom: SecureRandom = SecureRandom()
    }
}
