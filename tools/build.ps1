<#
  Сборка и установка KinoPub на телевизор Samsung.

  Требуется Tizen SDK (ставится расширением «Tizen Extension» для VS Code)
  и профиль сертификата Samsung (см. README.md). Tizen Studio больше не нужна.

  Примеры:
    .\tools\build.ps1                                  # собрать подписанный .wgt
    .\tools\build.ps1 -TvIp 192.168.1.50               # собрать и установить на TV
    .\tools\build.ps1 -TvIp 192.168.1.50 -Profile kp   # указать профиль сертификата
    .\tools\build.ps1 -TizenHome D:\tizen-sdk          # указать путь к Tizen SDK вручную

    .\tools\build.ps1 -Unsigned                        # неподписанный .wgt, чтобы поделиться (SDK не нужен)
    .\tools\build.ps1 -Wgt KinoPub-unsigned.wgt -TvIp 192.168.1.50
                                                       # подписать готовый .wgt своим сертификатом и установить
#>
param(
    [string]$TvIp = '',
    [string]$Profile = '',
    [string]$TizenHome = '',
    [string]$Project = '',
    [switch]$Unsigned,
    [string]$Wgt = ''
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
# В репозитории приложение лежит в корне (рядом с tools), в общей папке — в kinopub-tizen
if (-not $Project) { $Project = if (Test-Path (Join-Path $root 'config.xml')) { '.' } else { 'kinopub-tizen' } }
$src = (Resolve-Path (Join-Path $root $Project)).Path

# Файлы репозитория, которым не место в пакете для TV
$skipTop = @('tools', 'docs', 'dist', '.git', '.github', '.vscode', '.gitignore', '.gitattributes', 'README.md', 'LICENSE', 'README.md')
function Test-Skip([string]$rel) {
    $first = ($rel -split '[\\/]')[0]
    return ($skipTop -contains $first) -or ($rel -match '(^|[\\/])(signature\d*\.xml|author-signature\.xml|config\.example\.js)$|\.wgt$')
}
if ((Test-Path (Join-Path $src 'js\api.js')) -and -not (Test-Path (Join-Path $src 'js\config.js'))) {
    Write-Host 'ВНИМАНИЕ: нет js\config.js с ключом API — вход в приложение работать не будет (см. README).' -ForegroundColor Yellow
}
# id и имя приложения берём из config.xml проекта
$cfg = Get-Content (Join-Path $src 'config.xml') -Raw -Encoding UTF8
$appId = [regex]::Match($cfg, 'tizen:application id="([^"]+)"').Groups[1].Value
$appName = ([regex]::Match($cfg, '<name>([^<]+)</name>').Groups[1].Value) -replace '[^A-Za-z0-9]', ''
$out = Join-Path $root 'dist'
New-Item -ItemType Directory -Force $out | Out-Null

# --- Неподписанный пакет: обычный zip исходников без подписей ---
function New-UnsignedWgt([string]$target) {
    Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
    if (Test-Path $target) { Remove-Item $target -Force }
    $zip = [IO.Compression.ZipFile]::Open($target, 'Create')
    try {
        Get-ChildItem $src -Recurse -File -Force | Where-Object { -not (Test-Skip $_.FullName.Substring($src.Length + 1)) } | ForEach-Object {
            # в zip нужны прямые слэши, иначе TV не распакует пакет
            $rel = $_.FullName.Substring($src.Length + 1) -replace '\\', '/'
            [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel, 'Optimal') | Out-Null
        }
    } finally { $zip.Dispose() }
}

if ($Unsigned) {
    $target = Join-Path $out "$appName-unsigned.wgt"
    New-UnsignedWgt $target
    Write-Host "Готово (без подписи): $target" -ForegroundColor Green
    Write-Host "Получатель подписывает и ставит его командой: tools\build.ps1 -Wgt $appName-unsigned.wgt -TvIp <IP телевизора>"
    exit 0
}

# --- Поиск Tizen SDK ---
# Путь задаётся при первом запуске расширения VS Code. Проверяем типичные места,
# пути из настроек VS Code и tizen.bat в PATH.
$candidates = @($TizenHome, $env:TIZEN_HOME, $env:TIZEN_SDK,
    'C:\tizen-sdk', "$env:USERPROFILE\tizen-sdk", 'D:\tizen-sdk',
    'C:\tizen-studio', "$env:USERPROFILE\tizen-studio", 'D:\tizen-studio')

$vsSettings = Join-Path $env:APPDATA 'Code\User\settings.json'
if (Test-Path $vsSettings) {
    $json = Get-Content $vsSettings -Raw -Encoding UTF8
    $found = [regex]::Matches($json, '"([A-Za-z]:[^"]*tizen[^"]*)"', 'IgnoreCase')
    foreach ($m in $found) { $candidates += ($m.Groups[1].Value -replace '\\\\', '\') }
}

$cmd = Get-Command tizen.bat -ErrorAction SilentlyContinue
if ($cmd) { $candidates += (Split-Path (Split-Path (Split-Path (Split-Path $cmd.Source)))) }

$tizenHomeFound = $candidates |
    Where-Object { $_ -and (Test-Path (Join-Path $_ 'tools\ide\bin\tizen.bat')) } |
    Select-Object -First 1
if (-not $tizenHomeFound) {
    Write-Host 'Tizen SDK не найден. Установите расширение «Tizen Extension» в VS Code (см. README.md)' -ForegroundColor Red
    Write-Host 'или укажите путь вручную: -TizenHome C:\путь\к\tizen-sdk' -ForegroundColor Red
    exit 1
}
$tizen = Join-Path $tizenHomeFound 'tools\ide\bin\tizen.bat'
$sdb = Join-Path $tizenHomeFound 'tools\sdb.exe'
Write-Host "Tizen SDK: $tizenHomeFound"

# --- Подпись и упаковка ---
$stage = Join-Path $env:TEMP "$appName-build"
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
New-Item -ItemType Directory -Force $stage | Out-Null
$pkgArgs = @('package', '-t', 'wgt')
if ($Profile) { $pkgArgs += @('-s', $Profile) }

if ($Wgt) {
    # Переподписываем готовый пакет (например, неподписанный, полученный от другого человека)
    $wgtPath = (Resolve-Path $Wgt).Path
    $wgtCopy = Join-Path $stage "$appName.wgt"
    Copy-Item $wgtPath $wgtCopy
    $pkgArgs += @('--', $wgtCopy)
} else {
    # Чистая копия исходников (без файлов репозитория и служебных файлов)
    Get-ChildItem $src -Recurse -File -Force | Where-Object { -not (Test-Skip $_.FullName.Substring($src.Length + 1)) } | ForEach-Object {
        $dst = Join-Path $stage $_.FullName.Substring($src.Length + 1)
        New-Item -ItemType Directory -Force (Split-Path $dst) | Out-Null
        Copy-Item $_.FullName $dst
    }
    Get-ChildItem $stage -Recurse -Include '*.wgt', '.project', '.tproject', '.sign*' -Force |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    $pkgArgs += @('--', $stage)
}

Write-Host "Подпись: tizen $($pkgArgs -join ' ')"
$log = & $tizen @pkgArgs 2>&1
$log | ForEach-Object { Write-Host $_ }
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Ошибка подписи. Проверьте, что в Certificate Manager есть активный профиль Samsung,' -ForegroundColor Red
    Write-Host 'или передайте его имя: -Profile <имя профиля>.' -ForegroundColor Red
    exit 1
}
if (($log -join "`n") -match 'Default profile is used') {
    Write-Host 'ВНИМАНИЕ: подписано стандартным сертификатом Tizen — телевизор такой пакет не примет.' -ForegroundColor Yellow
    Write-Host 'Сделайте профиль Samsung активным или передайте его имя: -Profile <имя профиля>.' -ForegroundColor Yellow
}

$wgtFile = Get-ChildItem $stage -Filter '*.wgt' | Select-Object -First 1
$target = Join-Path $out "$appName.wgt"
Copy-Item $wgtFile.FullName $target -Force
Write-Host "Готово: $target" -ForegroundColor Green

if (-not $TvIp) { exit 0 }

# --- Установка на телевизор ---
Write-Host "Подключение к TV $TvIp..."
& $sdb connect $TvIp
$serial = (& $sdb devices | Select-String $TvIp | ForEach-Object { ($_ -split '\s+')[0] } | Select-Object -First 1)
if (-not $serial) {
    Write-Host 'TV не подключился. Проверьте режим разработчика и IP компьютера в его настройках.' -ForegroundColor Red
    exit 1
}

& $tizen install -n "$appName.wgt" -s $serial -- $out
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Установка не удалась (см. README.md, раздел «Проблемы»).' -ForegroundColor Red
    exit 1
}

Write-Host 'Запускаю приложение...'
& $tizen run -p $appId -s $serial | Out-Null
Write-Host "Установлено! Приложение $appName появилось в списке приложений телевизора." -ForegroundColor Green
