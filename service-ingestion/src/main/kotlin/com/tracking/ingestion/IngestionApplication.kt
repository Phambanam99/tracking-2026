package com.tracking.ingestion

import org.springframework.boot.context.properties.ConfigurationPropertiesScan
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
@ConfigurationPropertiesScan
public class IngestionApplication

public fun main(args: Array<String>): Unit {
    runApplication<IngestionApplication>(*args)
}
