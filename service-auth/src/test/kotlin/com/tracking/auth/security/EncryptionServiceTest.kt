package com.tracking.auth.security

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

public class EncryptionServiceTest {
    @Test
    public fun `should encrypt and decrypt plaintext round-trip`() {
        val service = EncryptionService("abcdefghijklmnopqrstuvwxyz123456")
        service.validateConfiguration()

        val plaintext = "sensitive-private-key-material"
        val encrypted = service.encrypt(plaintext)
        val decrypted = service.decrypt(encrypted)

        assertNotEquals(plaintext, encrypted)
        assertEquals(plaintext, decrypted)
    }

    @Test
    public fun `should generate different ciphertext for same plaintext`() {
        val service = EncryptionService("abcdefghijklmnopqrstuvwxyz123456")
        service.validateConfiguration()

        val plaintext = "same-value"
        val encrypted1 = service.encrypt(plaintext)
        val encrypted2 = service.encrypt(plaintext)

        assertNotEquals(encrypted1, encrypted2)
    }

    @Test
    public fun `should fail configuration validation for short master key`() {
        val service = EncryptionService("short-key")

        assertThrows<IllegalStateException> {
            service.validateConfiguration()
        }
    }
}
