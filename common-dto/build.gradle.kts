plugins {
    `java-library`
    kotlin("jvm")
    kotlin("plugin.serialization")
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    api("com.fasterxml.jackson.core:jackson-annotations:2.18.2")
    api("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")

    testImplementation(kotlin("test"))
    testImplementation("com.fasterxml.jackson.module:jackson-module-kotlin:2.18.2")
    testImplementation("io.kotest:kotest-assertions-core:5.9.1")
}
