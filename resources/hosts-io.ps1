param([string]$FixtureRoot)
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$utf8 = New-Object System.Text.UTF8Encoding($false, $true)
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
    [Console]::WriteLine('{"ready":true}')
    while ($null -ne ($line = [Console]::ReadLine())) {
        try {
            if ($line.Length -gt 12582912) { throw 'HOSTS_REQUEST_TOO_LARGE' }
            $request = $line | ConvertFrom-Json
            $value = $null
            switch ($request.op) {
                'read' {
                    $snapshot = Read-Bytes $hostsPath
                    if ($snapshot.Length -ge 4 -and [BitConverter]::ToString($snapshot, 0, 4) -in @('FF-FE-00-00', '00-00-FE-FF')) { $snapshot = $null; throw 'HOSTS_UNSUPPORTED_ENCODING' }
                    $encoding = $utf8
                    if ($snapshot.Length -ge 2 -and $snapshot[0] -eq 255 -and $snapshot[1] -eq 254) { $encoding = New-Object Text.UnicodeEncoding($false, $false, $true) }
                    elseif ($snapshot.Length -ge 2 -and $snapshot[0] -eq 254 -and $snapshot[1] -eq 255) { $encoding = New-Object Text.UnicodeEncoding($true, $false, $true) }
                    try { $value = $encoding.GetString($snapshot) } catch {
                        if ($encoding -ne $utf8) { $snapshot = $null; throw 'HOSTS_UNSUPPORTED_ENCODING' }
                        $encoding = [Text.Encoding]::Default
                        $value = $encoding.GetString($snapshot)
                    }
                    if ($value.Contains([char]0)) { $snapshot = $null; throw 'HOSTS_UNSUPPORTED_ENCODING' }
                    if ([Convert]::ToBase64String($encoding.GetBytes($value)) -cne [Convert]::ToBase64String($snapshot)) { throw 'HOSTS_UNSUPPORTED_ENCODING' }
                    $previous = $value
                }
                'replace' {
                    if ($null -eq $snapshot -or $request.expected -isnot [string] -or $request.next -isnot [string] -or $request.expected -cne $previous) { throw 'HOSTS_CONFLICT' }
                    if ($request.next.Length -gt 2097152) { throw 'HOSTS_FILE_TOO_LARGE' }
                    Assert-Regular $hostsPath
                    # Exclude ordinary writers; other programs doing atomic renames can still race this check.
                    $guard = [IO.File]::Open($hostsPath, 'Open', 'Read', ([IO.FileShare]::Read -bor [IO.FileShare]::Delete))
                    try {
                        if ([Convert]::ToBase64String((Read-Bytes $hostsPath)) -cne [Convert]::ToBase64String($snapshot)) { throw 'HOSTS_CONFLICT' }
                        Write-Atomic $hostsPath ($encoding.GetBytes($request.next))
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
            [Console]::WriteLine((ConvertTo-Json -InputObject @{ ok = $true; value = $value } -Depth 8 -Compress))
        } catch { [Console]::WriteLine((ConvertTo-Json -InputObject @{ error = $_.Exception.Message } -Compress)) }
    }
} catch { [Console]::WriteLine((ConvertTo-Json -InputObject @{ error = $_.Exception.Message } -Compress)); exit 1 }
finally { if ($locked) { $mutex.ReleaseMutex() }; if ($mutex) { $mutex.Dispose() } }

