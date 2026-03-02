plugins {
    id("org.springframework.boot")
    id("io.spring.dependency-management")
    kotlin("jvm")
    kotlin("plugin.spring")
}

kotlin {
    jvmToolchain(17)
}

springBoot {
    mainClass.set("com.tracking.ingestion.IngestionApplicationKt")
}

tasks.named<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar") {
    requiresUnpack("**/netty-*.jar")
    requiresUnpack("**/reactor-netty-*.jar")
}

dependencies {
    implementation(project(":common-dto"))
    implementation(kotlin("reflect"))

    implementation("org.springframework.boot:spring-boot-starter-webflux")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.kafka:spring-kafka")
    implementation("io.micrometer:micrometer-registry-prometheus")
    implementation("com.github.ben-manes.caffeine:caffeine:3.1.8")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.kafka:spring-kafka-test")
    testImplementation("io.projectreactor:reactor-test")
    testImplementation("io.kotest:kotest-assertions-core:5.9.1")
    testImplementation(kotlin("test"))
}
