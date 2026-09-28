param([string]$FixtureRoot, [IO.TextReader]$Reader, [IO.TextWriter]$Writer, [switch]$Watchdog)
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$utf8 = New-Object System.Text.UTF8Encoding($false, $true)
if (-not $Reader) { $Reader = [Console]::In }
if (-not $Writer) { $Writer = [Console]::Out }
$mutex = $null
$locked = $false
function Assert-Regular([string]$path) {
    if ((Test-Path -LiteralPath $path) -and ((Get-Item -Force -LiteralPath $path).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw 'HOSTS_REPARSE_POINT'
    }
    if (-not $FixtureRoot -and $path -eq $journalPath -and [IO.File]::Exists($path)) {
        $fileAcl = [IO.File]::GetAccessControl($path)
        if ($fileAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value -notin @('S-1-5-18', 'S-1-5-32-544')) { throw 'HOSTS_UNSAFE_JOURNAL_FILE' }
        foreach ($rule in $fileAcl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])) {
            if ($rule.AccessControlType -eq 'Allow' -and $rule.IdentityReference.Value -notin @('S-1-5-18', 'S-1-5-32-544')) { throw 'HOSTS_UNSAFE_JOURNAL_FILE' }
        }
    }
}
function Read-Bytes([string]$path) {
    Assert-Regular $path
    if ((Get-Item -LiteralPath $path).Length -gt 2097152) { throw 'HOSTS_FILE_TOO_LARGE' }
    return ,([IO.File]::ReadAllBytes($path))
}
function Write-Atomic([string]$path, [byte[]]$bytes) {
    Assert-Regular $path
    $temp = "$path.$([Guid]::NewGuid().ToString('N')).tmp"
    try {
        $stream = [IO.File]::Open($temp, 'CreateNew', 'Write', 'None')
        try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
        if ([IO.File]::Exists($path)) { [IO.File]::Replace($temp, $path, [NullString]::Value, $false) }
        else { [IO.File]::Move($temp, $path) }
    } finally { if ([IO.File]::Exists($temp)) { [IO.File]::Delete($temp) } }
}
function Read-Journal {
    Assert-Regular $journalPath
    if (-not [IO.File]::Exists($journalPath)) { return $null }
    $j = $utf8.GetString((Read-Bytes $journalPath)) | ConvertFrom-Json
    if ($j.version -ne 1 -or $j.expiresAt -le 0 -or @($j.fragments).Count -lt 1 -or @($j.fragments).Count -gt 2) { throw 'HOSTS_INVALID_JOURNAL' }
    foreach ($fragment in $j.fragments) {
        if ($fragment -isnot [string] -or $fragment.Length -gt 120000 -or $fragment -cnotmatch '\A(?:\r?\n)?# FocusLock BEGIN v1\r?\n(?:(?:0\.0\.0\.0|::) [a-z0-9.-]+\r?\n){1,400}# FocusLock END v1\r?\n\z') { throw 'HOSTS_INVALID_JOURNAL' }
    }
    return $j
}
function Flush-Dns {
    if (-not $FixtureRoot) {
        & (Join-Path ([Environment]::GetFolderPath('System')) 'ipconfig.exe') /flushdns | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'HOSTS_DNS_FLUSH_FAILED' }
    }
}
function Restore-Hosts {
    $j = Read-Journal
    if (-not $j) { return }
    $data = Read-Hosts
    $clean = $data.text
    foreach ($fragment in $j.fragments) { if ($clean.Contains($fragment)) { $clean = $clean.Remove($clean.IndexOf($fragment), $fragment.Length); break } }
    if ($clean.Contains('# FocusLock BEGIN v1') -or $clean.Contains('# FocusLock END v1')) { throw 'HOSTS_MANAGED_SECTION_CHANGED' }
    if ($clean -cne $data.text) {
        $guard = [IO.File]::Open($hostsPath, 'Open', 'Read', ([IO.FileShare]::Read -bor [IO.FileShare]::Delete))
        try {
            if ([Convert]::ToBase64String((Read-Bytes $hostsPath)) -cne [Convert]::ToBase64String($data.bytes)) { throw 'HOSTS_CONFLICT' }
            Write-Atomic $hostsPath ($data.encoding.GetBytes($clean))
        } finally { $guard.Dispose() }
    }
    Flush-Dns
    [IO.File]::Delete($journalPath)
}
function Read-Hosts {
    $bytes = Read-Bytes $hostsPath
    if ($bytes.Length -ge 4 -and [BitConverter]::ToString($bytes, 0, 4) -in @('FF-FE-00-00', '00-00-FE-FF')) { $bytes = $null; throw 'HOSTS_UNSUPPORTED_ENCODING' }
    $encoding = $utf8
    if ($bytes.Length -ge 2 -and $bytes[0] -eq 255 -and $bytes[1] -eq 254) { $encoding = New-Object Text.UnicodeEncoding($false, $false, $true) }
    elseif ($bytes.Length -ge 2 -and $bytes[0] -eq 254 -and $bytes[1] -eq 255) { $encoding = New-Object Text.UnicodeEncoding($true, $false, $true) }
    try { $text = $encoding.GetString($bytes) } catch {
        if ($encoding -ne $utf8) { $bytes = $null; throw 'HOSTS_UNSUPPORTED_ENCODING' }
        $encoding = [Text.Encoding]::Default
        $text = $encoding.GetString($bytes)
    }
    if ($text.Contains([char]0)) { $bytes = $null; throw 'HOSTS_UNSUPPORTED_ENCODING' }
    if ([Convert]::ToBase64String($encoding.GetBytes($text)) -cne [Convert]::ToBase64String($bytes)) { throw 'HOSTS_UNSUPPORTED_ENCODING' }
    return @{ bytes = $bytes; text = $text; encoding = $encoding }
}
try {
    if ($FixtureRoot) {
        $root = [IO.Path]::GetFullPath($FixtureRoot).TrimEnd('\')
        $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')
        if ([IO.Path]::GetDirectoryName($root) -ine $tempRoot -or [IO.Path]::GetFileName($root) -notlike 'focuslock-hosts-test-*') {
            throw 'HOSTS_INVALID_FIXTURE'
        }
        if (-not [IO.Directory]::Exists($root)) { throw 'HOSTS_INVALID_FIXTURE' }
        $hostsPath = Join-Path $root 'hosts'
    } else {
        $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
        $principal = New-Object Security.Principal.WindowsPrincipal($identity)
        if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'HOSTS_ADMIN_REQUIRED' }
        $root = Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'FocusLockHosts'
        $security = New-Object Security.AccessControl.DirectorySecurity
        $security.SetAccessRuleProtection($true, $false)
        $security.SetOwner((New-Object Security.Principal.SecurityIdentifier('S-1-5-32-544')))
        foreach ($sid in @('S-1-5-18', 'S-1-5-32-544')) {
            $account = New-Object Security.Principal.SecurityIdentifier($sid)
            $rule = New-Object Security.AccessControl.FileSystemAccessRule($account, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
            $security.AddAccessRule($rule)
        }
        if (-not [IO.Directory]::Exists($root)) { [void][IO.Directory]::CreateDirectory($root, $security) }
        Assert-Regular $root
        $acl = [IO.Directory]::GetAccessControl($root)
        if ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -notin @('S-1-5-18', 'S-1-5-32-544')) { throw 'HOSTS_UNSAFE_JOURNAL_DIRECTORY' }
        foreach ($rule in $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])) {
            if ($rule.AccessControlType -eq 'Allow' -and $rule.IdentityReference.Value -notin @('S-1-5-18', 'S-1-5-32-544')) { throw 'HOSTS_UNSAFE_JOURNAL_DIRECTORY' }
        }
        $hostsPath = Join-Path ([Environment]::GetFolderPath('System')) 'drivers\etc\hosts'
    }
    Assert-Regular $root
    $journalPath = Join-Path $root 'journal.json'
    $hash = [Security.Cryptography.SHA256]::Create()
    try { $key = [BitConverter]::ToString($hash.ComputeHash($utf8.GetBytes($root.ToLowerInvariant()))).Replace('-', '') } finally { $hash.Dispose() }
    $mutex = New-Object Threading.Mutex($false, "Global\FocusLockHosts-$key")
    try { $locked = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $locked = $true }
    if (-not $locked) { throw 'HOSTS_HELPER_BUSY' }
    $snapshot = $null
    if ($Watchdog) { Restore-Hosts }
    $Writer.WriteLine('{"ready":true}')
    while ($true) {
        if ($Watchdog) {
            $incoming = $Reader.ReadLineAsync()
            while (-not $incoming.Wait(500)) {
                $j = Read-Journal
                if ($j -and $j.expiresAt -le [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) { Restore-Hosts }
            }
            $line = $incoming.Result
        } else { $line = $Reader.ReadLine() }
        if ($null -eq $line) { break }
        try {
            if ($line.Length -gt 12582912) { throw 'HOSTS_REQUEST_TOO_LARGE' }
            $request = $line | ConvertFrom-Json
            $value = $null
            switch ($request.op) {
                'read' {
                    $data = Read-Hosts; $snapshot = $data.bytes; $encoding = $data.encoding; $value = $data.text; $previous = $value
                }
                'replace' {
                    if ($Watchdog) {
                        $j = Read-Journal
                        if ($j -and $j.expiresAt -le [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) { Restore-Hosts; throw 'HOSTS_LEASE_EXPIRED' }
                    }
                    if ($null -eq $snapshot -or $request.expected -isnot [string] -or $request.next -isnot [string] -or $request.expected -cne $previous) { throw 'HOSTS_CONFLICT' }
                    if ($request.next.Length -gt 2097152) { throw 'HOSTS_FILE_TOO_LARGE' }
                    Assert-Regular $hostsPath
                    # Exclude ordinary writers; other programs doing atomic renames can still race this check.
                    $guard = [IO.File]::Open($hostsPath, 'Open', 'Read', ([IO.FileShare]::Read -bor [IO.FileShare]::Delete))
                    try {
                        if ([Convert]::ToBase64String((Read-Bytes $hostsPath)) -cne [Convert]::ToBase64String($snapshot)) { throw 'HOSTS_CONFLICT' }
                        Write-Atomic $hostsPath ($encoding.GetBytes($request.next))
                        if ($Watchdog) { Flush-Dns }
                        $snapshot = $null
                    } finally { $guard.Dispose() }
                }
                'readJournal' {
                    Assert-Regular $journalPath
                    if ([IO.File]::Exists($journalPath)) { $value = $utf8.GetString((Read-Bytes $journalPath)) | ConvertFrom-Json }
                }
                'writeJournal' {
                    $json = ConvertTo-Json -InputObject $request.journal -Depth 8 -Compress
                    if ($json.Length -gt 1048576) { throw 'HOSTS_JOURNAL_TOO_LARGE' }
                    Write-Atomic $journalPath ($utf8.GetBytes($json))
                }
                'clearJournal' { Assert-Regular $journalPath; [IO.File]::Delete($journalPath) }
                default { throw 'HOSTS_UNKNOWN_OPERATION' }
            }
            $Writer.WriteLine((ConvertTo-Json -InputObject @{ ok = $true; value = $value } -Depth 8 -Compress))
        } catch { $Writer.WriteLine((ConvertTo-Json -InputObject @{ error = $_.Exception.Message } -Compress)) }
    }
} catch { $Writer.WriteLine((ConvertTo-Json -InputObject @{ error = $_.Exception.Message } -Compress)); exit 1 }
finally {
    try { if ($Watchdog -and $locked) { Restore-Hosts } }
    finally { if ($locked) { $mutex.ReleaseMutex() }; if ($mutex) { $mutex.Dispose() } }
}
