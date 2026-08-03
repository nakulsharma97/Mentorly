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

# Load required environment configuration (JWT_SECRET, DB password, etc.) from
# the project-root .env file so local development works purely through
# environment configuration. Values already set in the environment win.
# Note: the parser is intentionally simple (KEY=VALUE, no quoting or inline
# comments) to match the format produced by scripts/env-setup.sh.
$envFile = Join-Path $PSScriptRoot "..\.env"
if (Test-Path $envFile) {
  Write-Host "Loading environment variables from $envFile"
  Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line -match "^([^=]+)=(.*)$") {
      $key = $matches[1].Trim()
      $value = $matches[2].Trim()
      if (-not [Environment]::GetEnvironmentVariable($key)) {
        [Environment]::SetEnvironmentVariable($key, $value)
      }
    }
  }
} else {
  Write-Host "No .env file found at $envFile — make sure JWT_SECRET (and SPRING_DATASOURCE_PASSWORD) are set in the environment."
}

Write-Host "Starting backend on port $Port..."
mvn spring-boot:run "-Dspring-boot.run.arguments=--server.port=$Port"
