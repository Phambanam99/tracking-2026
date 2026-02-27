package com.tracking.ingestion.lifecycle

import com.tracking.ingestion.kafka.RawAdsbProducer
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.times
import org.mockito.Mockito.verify

public class ShutdownFlushIT {
    @Test
    public fun `should flush producer on shutdown hook`() {
        val rawAdsbProducer = mock(RawAdsbProducer::class.java)
        val hook = IngestionShutdownHook(rawAdsbProducer)

        hook.flushKafkaProducerBuffer()

        verify(rawAdsbProducer, times(1)).flush()
    }
}
