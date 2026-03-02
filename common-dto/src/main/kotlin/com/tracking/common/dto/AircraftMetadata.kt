package com.tracking.common.dto

import com.fasterxml.jackson.annotation.JsonAlias
import com.fasterxml.jackson.annotation.JsonProperty
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
public data class AircraftMetadata(
    val registration: String? = null,
    @param:JsonProperty("aircraft_type")
    @get:JsonProperty("aircraft_type")
    @param:JsonAlias("aircraftType")
    @SerialName("aircraft_type")
    val aircraftType: String? = null,
    val operator: String? = null,
    @param:JsonProperty("country_code")
    @get:JsonProperty("country_code")
    @param:JsonAlias("countryCode")
    @SerialName("country_code")
    val countryCode: String? = null,
    @param:JsonProperty("country_flag_url")
    @get:JsonProperty("country_flag_url")
    @param:JsonAlias("countryFlagUrl")
    @SerialName("country_flag_url")
    val countryFlagUrl: String? = null,
    @param:JsonProperty("image_url")
    @get:JsonProperty("image_url")
    @param:JsonAlias("imageUrl")
    @SerialName("image_url")
    val imageUrl: String? = null,
    @param:JsonProperty("is_military")
    @get:JsonProperty("is_military")
    @param:JsonAlias("isMilitary")
    @SerialName("is_military")
    val isMilitary: Boolean = false,
)
