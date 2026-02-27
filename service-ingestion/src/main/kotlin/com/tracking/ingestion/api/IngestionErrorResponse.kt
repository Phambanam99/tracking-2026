package com.tracking.ingestion.api

public data class IngestionErrorResponse(
    val timestamp: String,
    val status: Int,
    val error: String,
    val code: String,
    val message: String,
    val path: String,
)
