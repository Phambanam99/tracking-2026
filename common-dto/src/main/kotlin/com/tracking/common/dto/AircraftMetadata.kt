package com.tracking.common.dto

import kotlinx.serialization.Serializable

@Serializable
public data class AircraftMetadata(
    val registration: String? = null,
    val aircraftType: String? = null,
    val operator: String? = null,
    val countryCode: String? = null,
    val countryFlagUrl: String? = null,
    val imageUrl: String? = null,
)
