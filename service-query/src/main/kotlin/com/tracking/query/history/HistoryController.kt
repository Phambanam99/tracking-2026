package com.tracking.query.history

import com.tracking.query.dto.FlightPositionDto
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/aircraft")
public class HistoryController(
    private val historyService: HistoryService,
) {
    /**
     * Returns a flight trail for one aircraft within the given epoch-millis time range.
     *
     * @param icao 6-hex-char aircraft ICAO address.
     * @param from Start of time range (epoch millis, inclusive).
     * @param to End of time range (epoch millis, inclusive).
     * @param limit Maximum number of positions to return (1–5000, default 1000).
     */
    @GetMapping("/{icao}/history")
    public fun getHistory(
        @PathVariable icao: String,
        @RequestParam from: Long,
        @RequestParam to: Long,
        @RequestParam(defaultValue = "1000") limit: Int,
    ): ResponseEntity<List<FlightPositionDto>> {
        val icaoPattern = Regex("^[0-9A-Fa-f]{6}$")
        if (!icao.matches(icaoPattern)) {
            return ResponseEntity.badRequest().build()
        }
        if (from >= to) {
            return ResponseEntity.badRequest().build()
        }
        return ResponseEntity.ok(
            historyService.getHistory(icao.uppercase(), from, to, limit.coerceIn(1, 5000)),
        )
    }
}
