package com.tracking.ingestion.api

import com.tracking.ingestion.any
import com.tracking.ingestion.kafka.RawAisProducer
import com.tracking.ingestion.kafka.RawAdsbProducer
import com.tracking.ingestion.tracing.TraceContext
import com.tracking.ingestion.tracing.TraceContextExtractor
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
        "tracking.ingestion.batch.max-records=2",
        "spring.kafka.listener.auto-startup=false",
    ],
)
@AutoConfigureWebTestClient
public class BatchIngestControllerTest {
    @Autowired
    private lateinit var webTestClient: WebTestClient

    @MockBean
    private lateinit var rawAdsbProducer: RawAdsbProducer

    @MockBean
    private lateinit var rawAisProducer: RawAisProducer

    @MockBean
    private lateinit var traceContextExtractor: TraceContextExtractor

    @Test
    public fun `should accept batch within limit`() {
        given(
            traceContextExtractor.extract(any()),
        ).willReturn(
            TraceContext(
                requestId = "req-2",
                traceparent = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
            ),
        )
        given(
            rawAdsbProducer.publishBatch(
                any(),
                any(),
            ),
        ).willReturn(Mono.just(2))

        webTestClient.post()
            .uri("/api/v1/ingest/adsb/batch")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(
                """
                {
                  "records": [
                    {"icao": "ICAO1", "lat": 10.0, "lon": 106.0, "event_time": 1708941600000, "source_id": "SRC-1"},
                    {"icao": "ICAO2", "lat": 11.0, "lon": 107.0, "event_time": 1708941600100, "source_id": "SRC-1"}
                  ]
                }
                """.trimIndent(),
            )
            .exchange()
            .expectStatus().isAccepted
            .expectBody()
            .jsonPath("$.accepted").isEqualTo(2)
    }

    @Test
    public fun `should reject batch larger than configured limit with 413`() {
        webTestClient.post()
            .uri("/api/v1/ingest/adsb/batch")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(
                """
                {
                  "records": [
                    {"icao": "ICAO1", "lat": 10.0, "lon": 106.0, "event_time": 1708941600000, "source_id": "SRC-1"},
                    {"icao": "ICAO2", "lat": 11.0, "lon": 107.0, "event_time": 1708941600100, "source_id": "SRC-1"},
                    {"icao": "ICAO3", "lat": 12.0, "lon": 108.0, "event_time": 1708941600200, "source_id": "SRC-1"}
                  ]
                }
                """.trimIndent(),
            )
            .exchange()
            .expectStatus().isEqualTo(413)
            .expectBody()
            .jsonPath("$.code").isEqualTo("BATCH_SIZE_LIMIT_EXCEEDED")

        verifyNoInteractions(rawAdsbProducer)
    }
}
