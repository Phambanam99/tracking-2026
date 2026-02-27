package com.tracking.ingestion

import org.mockito.Mockito

@Suppress("UNCHECKED_CAST")
public fun <T> any(): T {
    Mockito.any<T>()
    return null as T
}
