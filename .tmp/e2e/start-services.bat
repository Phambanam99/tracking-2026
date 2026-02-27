@echo off
cd /d C:\Users\NamP7\Documents\workspace\2026\tracking-2026
set JAVA_HOME=C:\Users\NamP7\.jdks\ms-21.0.9
set PATH=%JAVA_HOME%\bin;%PATH%
if not exist .tmp\e2e mkdir .tmp\e2e
start "" /b java -jar service-ingestion\build\libs\service-ingestion-0.1.0-SNAPSHOT.jar --spring.profiles.active=local --server.port=18082 --tracking.ingestion.security.enforce-api-key=false --tracking.ingestion.security.auth-verify-uri=http://localhost:18081/internal/v1/api-keys/verify > .tmp\e2e\ingestion.log 2>&1
start "" /b java -jar service-processing\build\libs\service-processing-0.1.0-SNAPSHOT.jar --spring.profiles.active=local --server.port=18083 --spring.kafka.bootstrap-servers=localhost:29092 > .tmp\e2e\processing.log 2>&1
start "" /b java -jar service-storage\build\libs\service-storage-0.1.0-SNAPSHOT.jar --spring.profiles.active=local --server.port=18084 > .tmp\e2e\storage.log 2>&1
