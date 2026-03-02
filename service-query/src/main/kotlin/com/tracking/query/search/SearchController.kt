package com.tracking.query.search

import com.tracking.query.dto.AdvancedSearchRequest
import com.tracking.query.dto.SearchResult
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/aircraft")
public class SearchController(
    private val searchService: SearchService,
) {
    /**
     * Global live-aircraft search backed by Redis cache.
     *
     * @param q Search query (min 2 chars). Matches ICAO, registration, type, operator.
     * @param limit Maximum results to return (1–100).
     */
    @GetMapping("/search")
    public fun searchGlobal(
        @RequestParam q: String,
        @RequestParam(defaultValue = "50") limit: Int,
    ): ResponseEntity<List<SearchResult>> {
        if (q.trim().length < 2) {
            return ResponseEntity.badRequest().build()
        }
        return ResponseEntity.ok(searchService.searchGlobal(q.trim(), limit.coerceIn(1, 100)))
    }

    @GetMapping("/live")
    public fun liveByViewport(
        @RequestParam north: Double,
        @RequestParam south: Double,
        @RequestParam east: Double,
        @RequestParam west: Double,
        @RequestParam(defaultValue = "5000") limit: Int,
    ): ResponseEntity<List<SearchResult>> {
        if (north <= south || east <= west) {
            return ResponseEntity.badRequest().build()
        }

        return ResponseEntity.ok(
            searchService.findLiveInBoundingBox(
                north = north,
                south = south,
                east = east,
                west = west,
                limit = limit.coerceIn(1, 5000),
            ),
        )
    }

    /**
     * Advanced multi-criteria search across historical flight positions.
     */
    @PostMapping("/search/history")
    public fun searchHistory(
        @RequestBody @Valid request: AdvancedSearchRequest,
    ): ResponseEntity<List<SearchResult>> =
        ResponseEntity.ok(searchService.searchHistory(request))
}
