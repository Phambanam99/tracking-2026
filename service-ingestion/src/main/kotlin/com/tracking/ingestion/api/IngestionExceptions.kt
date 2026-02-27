package com.tracking.ingestion.api

public open class IngestionRuntimeException(
    val code: String,
    message: String,
) : RuntimeException(message)

public class IngestValidationException(message: String) :
    IngestionRuntimeException(code = "INGEST_VALIDATION_FAILED", message = message)

public class BatchSizeLimitExceededException(message: String) :
    IngestionRuntimeException(code = "BATCH_SIZE_LIMIT_EXCEEDED", message = message)

public class AdmissionRejectedException(message: String = "Ingestion admission limit reached.") :
    IngestionRuntimeException(code = "INGEST_ADMISSION_REJECTED", message = message)

public class ApiKeyRejectedException(message: String = "Invalid API key.") :
    IngestionRuntimeException(code = "API_KEY_REJECTED", message = message)

public class ProducerUnavailableException(message: String) :
    IngestionRuntimeException(code = "KAFKA_PRODUCER_UNAVAILABLE", message = message)
