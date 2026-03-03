package com.tracking.storage.buffer

import com.tracking.storage.model.PersistableShip
import java.util.concurrent.LinkedBlockingQueue

public class ShipBuffer(
    private val maxCapacity: Int = 100_000,
) {
    private val queue: LinkedBlockingQueue<PersistableShip> = LinkedBlockingQueue(maxCapacity)

    public fun offerAll(records: List<PersistableShip>): Unit {
        for (record in records) {
            val accepted = queue.offer(record)
            if (!accepted) {
                throw BufferCapacityExceededException(maxCapacity)
            }
        }
    }

    public fun drainUpTo(maxItems: Int): List<PersistableShip> {
        if (maxItems <= 0) {
            return emptyList()
        }

        val drained: MutableList<PersistableShip> = ArrayList(maxItems.coerceAtMost(queue.size))
        queue.drainTo(drained, maxItems)
        return drained
    }

    public fun size(): Int = queue.size

    public fun isEmpty(): Boolean = queue.isEmpty()
}
