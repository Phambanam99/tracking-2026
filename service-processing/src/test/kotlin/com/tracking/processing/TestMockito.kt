package com.tracking.processing

import org.mockito.Mockito

public fun <T> any(): T {
    Mockito.any<T>()
    @Suppress("UNCHECKED_CAST")
    return null as T
}
