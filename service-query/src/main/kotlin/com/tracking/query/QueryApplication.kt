package com.tracking.query

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

@SpringBootApplication
@EnableScheduling
public class QueryApplication

public fun main(args: Array<String>) {
    runApplication<QueryApplication>(*args)
}
