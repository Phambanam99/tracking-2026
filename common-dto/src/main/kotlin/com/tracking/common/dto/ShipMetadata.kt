package com.tracking.common.dto

import com.fasterxml.jackson.annotation.JsonAlias
import com.fasterxml.jackson.annotation.JsonProperty
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
public data class ShipMetadata(
    @param:JsonProperty("flag_country")
    @get:JsonProperty("flag_country")
    @param:JsonAlias("flagCountry")
    @SerialName("flag_country")
    val flagCountry: String? = null,
    @param:JsonProperty("flag_url")
    @get:JsonProperty("flag_url")
    @param:JsonAlias("flagUrl")
    @SerialName("flag_url")
    val flagUrl: String? = null,
    @param:JsonProperty("ship_type_name")
    @get:JsonProperty("ship_type_name")
    @param:JsonAlias("shipTypeName")
    @SerialName("ship_type_name")
    val shipTypeName: String? = null,
    @param:JsonProperty("is_military")
    @get:JsonProperty("is_military")
    @param:JsonAlias("isMilitary")
    @SerialName("is_military")
    val isMilitary: Boolean = false,
)
