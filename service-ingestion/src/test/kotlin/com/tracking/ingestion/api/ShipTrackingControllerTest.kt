package com.tracking.ingestion.api

import com.tracking.common.dto.CanonicalShip
import com.tracking.ingestion.any
import com.tracking.ingestion.kafka.RawAdsbProducer
import com.tracking.ingestion.kafka.RawAisProducer
import com.tracking.ingestion.tracing.TraceContext
import com.tracking.ingestion.tracing.TraceContextExtractor
import kotlin.test.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.reactive.AutoConfigureWebTestClient
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.http.MediaType
import org.springframework.test.web.reactive.server.WebTestClient
import reactor.core.publisher.Mono

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = [
        "tracking.ingestion.security.enforce-api-key=false",
        "spring.kafka.listener.auto-startup=false",
    ],
)
@AutoConfigureWebTestClient
public class ShipTrackingControllerTest {
    @Autowired
    private lateinit var webTestClient: WebTestClient

    @MockBean
    private lateinit var rawAisProducer: RawAisProducer

    @MockBean
    private lateinit var rawAdsbProducer: RawAdsbProducer

    @MockBean
    private lateinit var traceContextExtractor: TraceContextExtractor

    @Test
    public fun `should accept single ship ingest payload and publish to kafka`() {
        var capturedShip: CanonicalShip? = null
        var capturedTraceContext: TraceContext? = null
        given(traceContextExtractor.extract(any())).willReturn(
            TraceContext(
                requestId = "req-ship-1",
                traceparent = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
            ),
        )
        given(rawAisProducer.publish(any(), any())).willAnswer { invocation ->
            capturedShip = invocation.getArgument(0)
            capturedTraceContext = invocation.getArgument(1)
            Mono.empty<Void>()
        }

        webTestClient.post()
            .uri("/api/v1/ingest/ais")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(
                """
                {
                  "mmsi": "574001230",
                  "lat": 10.7769,
                  "lon": 106.7009,
                  "vessel_name": "PACIFIC TRADER",
                  "event_time": 1708941600000,
                  "source_id": "AIS-PRIMARY"
                }
                """.trimIndent(),
            )
            .exchange()
            .expectStatus().isAccepted
            .expectBody()
            .jsonPath("$.accepted").isEqualTo(true)

        assertEquals("574001230", capturedShip?.mmsi)
        assertEquals("PACIFIC TRADER", capturedShip?.vesselName)
        assertEquals("req-ship-1", capturedTraceContext?.requestId)
    }

    @Test
    public fun `should reject invalid ship payload with 400 and skip kafka publish`() {
        webTestClient.post()
            .uri("/api/v1/ingest/ais")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(
                """
                {
                  "lat": 10.7769,
                  "lon": 106.7009,
                  "event_time": 1708941600000,
                  "source_id": "AIS-PRIMARY"
                }
                """.trimIndent(),
            )
            .exchange()
            .expectStatus().isBadRequest
            .expectBody()
            .jsonPath("$.code").isEqualTo("INGEST_VALIDATION_FAILED")

        verifyNoInteractions(rawAisProducer)
    }
}
