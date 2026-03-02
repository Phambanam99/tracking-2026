package com.tracking.auth.watchlist

import org.springframework.http.HttpStatus
import org.springframework.web.server.ResponseStatusException

public class WatchlistNotFoundException(message: String) :
    ResponseStatusException(HttpStatus.NOT_FOUND, message)

public class WatchlistLimitExceededException(message: String) :
    ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, message)
