package com.tracking.ingestion.lifecycle

import com.tracking.ingestion.kafka.RawAdsbProducer
import com.tracking.ingestion.kafka.RawAisProducer
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.times
import org.mockito.Mockito.verify

public class ShutdownFlushIT {
    @Test
    public fun `should flush producer on shutdown hook`() {
        val rawAdsbProducer = mock(RawAdsbProducer::class.java)
        val rawAisProducer = mock(RawAisProducer::class.java)
        val hook = IngestionShutdownHook(rawAdsbProducer, rawAisProducer)

        hook.flushKafkaProducerBuffer()

        verify(rawAdsbProducer, times(1)).flush()
        verify(rawAisProducer, times(1)).flush()
    }
}
