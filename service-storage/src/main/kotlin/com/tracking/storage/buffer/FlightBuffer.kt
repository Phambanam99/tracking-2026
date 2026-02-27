package com.tracking.storage.buffer

import com.tracking.storage.model.PersistableFlight
import java.util.concurrent.LinkedBlockingQueue

public class FlightBuffer(
    private val maxCapacity: Int = 100_000,
) {
    private val queue: LinkedBlockingQueue<PersistableFlight> = LinkedBlockingQueue(maxCapacity)

    public fun offerAll(records: List<PersistableFlight>): Unit {
        for (record in records) {
            val accepted = queue.offer(record)
            if (!accepted) {
                throw BufferCapacityExceededException(maxCapacity)
            }
        }
    }

    public fun drainUpTo(maxItems: Int): List<PersistableFlight> {
        if (maxItems <= 0) {
            return emptyList()
        }

        val drained: MutableList<PersistableFlight> = ArrayList(maxItems.coerceAtMost(queue.size))
        queue.drainTo(drained, maxItems)
        return drained
    }

    public fun clear(): Unit = queue.clear()

    public fun size(): Int = queue.size

    public fun remainingCapacity(): Int = queue.remainingCapacity()

    public fun isEmpty(): Boolean = queue.isEmpty()
}

public class BufferCapacityExceededException(maxCapacity: Int) :
    IllegalStateException("Flight buffer reached max capacity $maxCapacity records.")
