package com.tracking.ingestion.failure

import com.tracking.ingestion.kafka.RawAdsbProducer
import com.tracking.ingestion.tracing.TraceContextExtractor
import java.util.concurrent.Semaphore
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.reactive.AutoConfigureWebTestClient
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.http.MediaType
import org.springframework.test.web.reactive.server.WebTestClient

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = [
        "tracking.ingestion.security.enforce-api-key=false",
        "spring.kafka.listener.auto-startup=false",
    ],
)
@AutoConfigureWebTestClient
public class KafkaBackpressureIT {
    @Autowired
    private lateinit var webTestClient: WebTestClient

    @MockBean(name = "ingestionAdmissionSemaphore")
    private lateinit var admissionSemaphore: Semaphore

    @MockBean
    private lateinit var rawAdsbProducer: RawAdsbProducer

    @MockBean
    private lateinit var traceContextExtractor: TraceContextExtractor

    @Test
    public fun `should return 429 quickly when admission queue is exhausted`() {
        given(admissionSemaphore.tryAcquire()).willReturn(false)

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
            .expectStatus().isEqualTo(429)
            .expectBody()
            .jsonPath("$.code").isEqualTo("INGEST_ADMISSION_REJECTED")

        verifyNoInteractions(rawAdsbProducer)
    }
}
