package com.tracking.query.ship

import com.tracking.query.dto.ShipHistoryPositionDto
import com.tracking.query.dto.ShipSearchRequest
import com.tracking.query.dto.ShipSearchResult
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/ships")
public class ShipQueryController(
    private val shipQueryService: ShipQueryService,
) {
    @GetMapping("/search")
    public fun search(
        @RequestParam q: String,
        @RequestParam(defaultValue = "50") limit: Int,
    ): ResponseEntity<List<ShipSearchResult>> {
        if (q.trim().length < 2) {
            return ResponseEntity.badRequest().build()
        }

        return ResponseEntity.ok(shipQueryService.search(q.trim(), limit.coerceIn(1, 100)))
    }

    @PostMapping("/search/history")
    public fun searchHistory(
        @RequestBody @Valid request: ShipSearchRequest,
    ): ResponseEntity<List<ShipSearchResult>> =
        ResponseEntity.ok(shipQueryService.searchHistory(request))

    @GetMapping("/{mmsi}/history")
    public fun getHistory(
        @PathVariable mmsi: String,
        @RequestParam from: Long,
        @RequestParam to: Long,
        @RequestParam(defaultValue = "1000") limit: Int,
    ): ResponseEntity<List<ShipHistoryPositionDto>> {
        if (!mmsi.matches(Regex("^[0-9]{6,32}$"))) {
            return ResponseEntity.badRequest().build()
        }
        if (from >= to) {
            return ResponseEntity.badRequest().build()
        }

        return ResponseEntity.ok(shipQueryService.getHistory(mmsi, from, to, limit.coerceIn(1, 5000)))
    }
}
