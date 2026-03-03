package com.tracking.ingestion.failure

import com.tracking.ingestion.any
import com.tracking.ingestion.api.ProducerUnavailableException
import com.tracking.ingestion.kafka.RawAdsbProducer
import com.tracking.ingestion.kafka.RawAisProducer
import com.tracking.ingestion.tracing.TraceContext
import com.tracking.ingestion.tracing.TraceContextExtractor
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
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
public class ProducerTimeoutIT {
    @Autowired
    private lateinit var webTestClient: WebTestClient

    @MockBean
    private lateinit var rawAdsbProducer: RawAdsbProducer

    @MockBean
    private lateinit var rawAisProducer: RawAisProducer

    @MockBean
    private lateinit var traceContextExtractor: TraceContextExtractor

    @Test
    public fun `should return 503 when kafka producer timeout occurs`() {
        given(traceContextExtractor.extract(any())).willReturn(
            TraceContext(
                requestId = "req-failure-timeout",
                traceparent = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
            ),
        )
        given(rawAdsbProducer.publish(any(), any())).willReturn(
            Mono.error(ProducerUnavailableException("Kafka publish timeout for key=ICAO123.")),
        )

        webTestClient.post()
            .uri("/api/v1/ingest/adsb")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(
                """
                {
                  "icao": "ICAO123",
                  "lat": 10.5,
                  "lon": 106.7,
                  "event_time": 1708941600000,
                  "source_id": "SRC-1"
                }
                """.trimIndent(),
            )
            .exchange()
            .expectStatus().isEqualTo(503)
            .expectBody()
            .jsonPath("$.code").isEqualTo("KAFKA_PRODUCER_UNAVAILABLE")
    }
}
