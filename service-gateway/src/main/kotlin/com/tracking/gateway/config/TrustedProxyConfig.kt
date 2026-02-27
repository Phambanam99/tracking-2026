package com.tracking.gateway.config

import java.math.BigInteger
import java.net.InetAddress
import java.net.InetSocketAddress
import java.util.regex.Pattern
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.stereotype.Component
import org.springframework.web.server.ServerWebExchange

@Component
public class TrustedProxyConfig(
    private val properties: TrustedProxyProperties,
) {
    public fun resolveClientIp(xForwardedFor: String?, remoteAddr: String): String {
        if (!isTrustedProxy(remoteAddr)) {
            return remoteAddr
        }

        val firstForwardedIp = xForwardedFor
            ?.split(',')
            ?.firstOrNull()
            ?.trim()
            ?.takeIf { it.isNotEmpty() }
            ?.takeIf { isValidIp(it) }

        return firstForwardedIp ?: remoteAddr
    }

    public fun resolveClientIp(exchange: ServerWebExchange): String {
        val remote = exchange.request.remoteAddress.normalizedIp()
        val forwardedFor = exchange.request.headers.getFirst("X-Forwarded-For")
        return resolveClientIp(forwardedFor, remote)
    }

    public fun isTrustedProxy(ipAddress: String): Boolean {
        return properties.cidrs.any { cidr -> isIpWithinCidr(ipAddress, cidr) }
    }

    private fun isValidIp(candidate: String): Boolean = IPV4_PATTERN.matcher(candidate).matches()

    private fun isIpWithinCidr(ipAddress: String, cidr: String): Boolean {
        val parts = cidr.split('/')
        if (parts.size != 2) {
            return false
        }

        val network = parts[0]
        val prefixLength = parts[1].toIntOrNull() ?: return false

        val ipBytes = runCatching { InetAddress.getByName(ipAddress).address }.getOrNull() ?: return false
        val networkBytes = runCatching { InetAddress.getByName(network).address }.getOrNull() ?: return false

        if (ipBytes.size != networkBytes.size) {
            return false
        }

        val bitLength = ipBytes.size * 8
        if (prefixLength !in 0..bitLength) {
            return false
        }

        val mask = if (prefixLength == 0) {
            BigInteger.ZERO
        } else {
            BigInteger.ONE.shiftLeft(bitLength).subtract(BigInteger.ONE)
                .shiftRight(bitLength - prefixLength)
                .shiftLeft(bitLength - prefixLength)
        }

        val ipValue = BigInteger(1, ipBytes)
        val networkValue = BigInteger(1, networkBytes)

        return ipValue.and(mask) == networkValue.and(mask)
    }

    private fun InetSocketAddress?.normalizedIp(): String {
        val host = this?.address?.hostAddress ?: this?.hostString.orEmpty()
        return host.substringBefore('%')
    }

    private companion object {
        private val IPV4_PATTERN: Pattern =
            Pattern.compile("^((25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(25[0-5]|2[0-4]\\d|1?\\d?\\d)$")
    }
}

@ConfigurationProperties(prefix = "tracking.gateway.security.trusted-proxy")
public class TrustedProxyProperties(
    public var cidrs: List<String> = listOf(
        "127.0.0.1/32",
        "10.0.0.0/8",
        "172.16.0.0/12",
        "192.168.0.0/16",
    ),
)
