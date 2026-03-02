package com.tracking.auth.admin

import org.springframework.http.HttpStatus
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/auth/users")
public class UserAdminController(
    private val userAdminService: UserAdminService,
) {
    @GetMapping
    public fun listUsers(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
    ): UserAdminListResponse {
        return userAdminService.listUsers(page = page, size = size)
    }

    @PutMapping("/{id}/disable")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public fun disableUser(@PathVariable id: Long, authentication: Authentication): Unit {
        userAdminService.disableUser(id = id, performedBy = authentication.name)
    }

    @PutMapping("/{id}/enable")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public fun enableUser(@PathVariable id: Long, authentication: Authentication): Unit {
        userAdminService.enableUser(id = id, performedBy = authentication.name)
    }
}
