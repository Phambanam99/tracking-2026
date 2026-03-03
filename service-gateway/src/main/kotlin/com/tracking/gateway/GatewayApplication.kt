package com.tracking.gateway

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.ConfigurationPropertiesScan
import org.springframework.boot.runApplication

@SpringBootApplication
@ConfigurationPropertiesScan
public class GatewayApplication

public fun main(args: Array<String>) {
	runApplication<GatewayApplication>(*args)
}
