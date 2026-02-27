package com.tracking.auth.security

import java.math.BigInteger
import java.security.KeyFactory
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.PrivateKey
import java.security.PublicKey
import java.security.interfaces.RSAPublicKey
import java.security.spec.PKCS8EncodedKeySpec
import java.security.spec.X509EncodedKeySpec
import java.time.Instant
import java.util.Base64
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlin.math.max
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

@Component
public class JwksKeyProvider(
        private val encryptionService: EncryptionService,
        private val jwtSigningKeyRepository: JwtSigningKeyRepository? = null,
        @Value("\${auth.jwt.max-retained-keys:5}") private val maxRetainedKeys: Int = 5,
        @Value("\${tracking.security.jwt.refresh-token-ttl-seconds:1209600}")
        private val refreshTokenTtlSeconds: Long = 1209600,
) {
    private val keyPairsByKid: MutableMap<String, KeyPair> = ConcurrentHashMap()
    private val keyFactory: KeyFactory = KeyFactory.getInstance("RSA")
    private val safeMaxRetainedKeys: Int = max(maxRetainedKeys, 2)

    @Volatile private var currentKid: String = loadOrCreateInitialKey()

    public fun activeKid(): String = currentKid

    public fun activePrivateKey(): PrivateKey {
        return keyPairsByKid.getValue(currentKid).private
    }

    public fun publicKeys(): Map<String, PublicKey> {
        return keyPairsByKid.mapValues { (_, value) -> value.public }
    }

    public fun findPublicKeyByKid(kid: String?): PublicKey? {
        if (kid == null) {
            return null
        }

        return keyPairsByKid[kid]?.public
    }

    @Synchronized
    public fun rotate(): String {
        val nextKid = generateAndStoreKey()
        val previousKid = currentKid
        currentKid = nextKid
        markPreviousAsRetired(previousKid)
        pruneRetiredKeys()
        return nextKid
    }

    public fun jwks(): Map<String, Any> {
        val keys =
                publicKeys().mapNotNull { (kid, publicKey) ->
                    val rsaKey = publicKey as? RSAPublicKey ?: return@mapNotNull null
                    mapOf(
                            "kty" to "RSA",
                            "kid" to kid,
                            "use" to "sig",
                            "alg" to "RS256",
                            "n" to toBase64Url(rsaKey.modulus),
                            "e" to toBase64Url(rsaKey.publicExponent),
                    )
                }

        return mapOf("keys" to keys)
    }

    private fun loadOrCreateInitialKey(): String {
        val repository = jwtSigningKeyRepository
        if (repository == null) {
            return generateAndStoreKey()
        }

        val persistedKeys = repository.findAllByOrderByCreatedAtDesc()
        if (persistedKeys.isEmpty()) {
            val kid = generateAndStoreKey()
            persistKey(kid, keyPairsByKid.getValue(kid), active = true, retiredAt = null)
            return kid
        }

        persistedKeys.forEach { entity -> keyPairsByKid[entity.kid] = toKeyPair(entity) }

        val activeEntity = persistedKeys.firstOrNull { it.active } ?: persistedKeys.first()
        if (!activeEntity.active) {
            activeEntity.active = true
            activeEntity.retiredAt = null
            repository.save(activeEntity)
        }

        currentKid = activeEntity.kid
        pruneRetiredKeys()
        return activeEntity.kid
    }

    private fun generateAndStoreKey(): String {
        val kid = UUID.randomUUID().toString()
        val keyPairGenerator = KeyPairGenerator.getInstance("RSA")
        keyPairGenerator.initialize(2048)
        val keyPair = keyPairGenerator.generateKeyPair()

        keyPairsByKid[kid] = keyPair
        persistKey(kid, keyPair, active = true, retiredAt = null)

        return kid
    }

    private fun markPreviousAsRetired(previousKid: String) {
        val repository = jwtSigningKeyRepository ?: return
        val previousEntity = repository.findById(previousKid).orElse(null) ?: return
        previousEntity.active = false
        previousEntity.retiredAt = Instant.now()
        repository.save(previousEntity)
    }

    private fun persistKey(
            kid: String,
            keyPair: KeyPair,
            active: Boolean,
            retiredAt: Instant?,
    ) {
        val repository = jwtSigningKeyRepository ?: return

        if (active) {
            repository.findByActiveTrue()?.let { currentActive ->
                if (currentActive.kid != kid) {
                    currentActive.active = false
                    currentActive.retiredAt = Instant.now()
                    repository.save(currentActive)
                }
            }
        }

        val entity =
                JwtSigningKeyEntity().apply {
                    this.kid = kid
                    this.privateKeyDerBase64 =
                            encryptionService.encrypt(
                                    Base64.getEncoder().encodeToString(keyPair.private.encoded)
                            )
                    this.publicKeyDerBase64 =
                            Base64.getEncoder().encodeToString(keyPair.public.encoded)
                    this.active = active
                    this.retiredAt = retiredAt
                }
        repository.save(entity)
    }

    private fun pruneRetiredKeys() {
        val repository = jwtSigningKeyRepository ?: return
        val persistedKeys = repository.findAllByOrderByCreatedAtDesc()
        if (persistedKeys.isEmpty()) {
            return
        }

        val now = Instant.now()
        val toDelete =
                persistedKeys.filter { entity ->
                    !entity.active &&
                            entity.retiredAt != null &&
                            now.isAfter(entity.retiredAt!!.plusSeconds(refreshTokenTtlSeconds))
                }

        if (toDelete.isEmpty()) {
            return
        }

        repository.deleteAll(toDelete)
        toDelete.forEach { entity -> keyPairsByKid.remove(entity.kid) }
    }

    private fun toKeyPair(entity: JwtSigningKeyEntity): KeyPair {
        val publicBytes = Base64.getDecoder().decode(entity.publicKeyDerBase64)

        val decryptedPrivateKeyBase64 =
                try {
                    encryptionService.decrypt(entity.privateKeyDerBase64)
                } catch (e: Exception) {
                    // Provide fallback for keys created before encryption was added (during
                    // migration)
                    entity.privateKeyDerBase64
                }
        val privateBytes = Base64.getDecoder().decode(decryptedPrivateKeyBase64)

        val publicKey = keyFactory.generatePublic(X509EncodedKeySpec(publicBytes))
        val privateKey = keyFactory.generatePrivate(PKCS8EncodedKeySpec(privateBytes))
        return KeyPair(publicKey, privateKey)
    }

    private fun toBase64Url(value: BigInteger): String {
        val bytes = value.toByteArray().dropWhile { it == 0.toByte() }.toByteArray()
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }
}
