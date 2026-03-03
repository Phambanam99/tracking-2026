package com.tracking.ingestion.api

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonProperty

@JsonIgnoreProperties(ignoreUnknown = true)
public data class IngestShipBatchRequest(
    @JsonProperty("records")
    val records: List<IngestShipRequest> = emptyList(),
)
