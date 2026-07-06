param(
  [int]$Port = 8080,
  [switch]$SkipPortCleanup
)

$preferredJdkHome = Join-Path $env:USERPROFILE ".jdk\jdk-25"
if (Test-Path $preferredJdkHome) {
  $env:JAVA_HOME = $preferredJdkHome
  $env:Path = (Join-Path $preferredJdkHome "bin") + ";" + $env:Path
  Write-Host "Using Java 25 from $preferredJdkHome"
}

if (-not $SkipPortCleanup) {
  $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($listener) {
    $owningProcess = $listener.OwningProcess
    if ($owningProcess) {
      Write-Host "Stopping process $owningProcess using port $Port..."
      Stop-Process -Id $owningProcess -Force -ErrorAction Stop
    }
  }
}

if (-not $env:SPRING_PROFILES_ACTIVE) {
  $env:SPRING_PROFILES_ACTIVE = "dev"
  Write-Host "Defaulting SPRING_PROFILES_ACTIVE=dev for local development"
}

Write-Host "Starting backend on port $Port..."
mvn spring-boot:run "-Dspring-boot.run.arguments=--server.port=$Port"
