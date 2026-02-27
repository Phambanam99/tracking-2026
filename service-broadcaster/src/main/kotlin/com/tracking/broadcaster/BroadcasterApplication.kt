package com.tracking.broadcaster

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.ConfigurationPropertiesScan
import org.springframework.boot.runApplication

@SpringBootApplication
@ConfigurationPropertiesScan
public class BroadcasterApplication

public fun main(args: Array<String>): Unit {
    runApplication<BroadcasterApplication>(*args)
}
