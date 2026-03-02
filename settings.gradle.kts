pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        mavenCentral()
    }
}

rootProject.name = "tracking-2026"

include("common-dto")
include("service-auth")
include("service-gateway")
include("service-ingestion")
include("service-processing")
include("service-storage")
include("service-broadcaster")
include("service-query")
