param([string]$PipeName, [string]$Secret, [string]$CallerSid, [string]$FixtureRoot)
$ErrorActionPreference = 'Stop'
$pipe = $null
$reader = $null
$writer = $null
function Proof([string]$message) {
    $hmac = New-Object Security.Cryptography.HMACSHA256
    try {
        $hmac.Key = [Text.Encoding]::UTF8.GetBytes($Secret)
        return [BitConverter]::ToString($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($message))).Replace('-', '').ToLowerInvariant()
    } finally { $hmac.Dispose() }
}
function Read-Handshake {
    $task = $reader.ReadLineAsync()
    if (-not $task.Wait(5000)) { throw 'HOSTS_AUTH_TIMEOUT' }
    return $task.Result
}
try {
    if ($PipeName -notmatch '^FocusLock-[a-f0-9]{48}$' -or $Secret -notmatch '^[a-f0-9]{64}$') { throw 'HOSTS_INVALID_CONNECTION' }
    $acl = New-Object IO.Pipes.PipeSecurity
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($sid in @($CallerSid, 'S-1-5-18', 'S-1-5-32-544') | Select-Object -Unique) {
        $account = New-Object Security.Principal.SecurityIdentifier($sid)
        $acl.AddAccessRule((New-Object IO.Pipes.PipeAccessRule($account, 'ReadWrite', 'Allow')))
    }
    $pipe = New-Object IO.Pipes.NamedPipeServerStream($PipeName, 'InOut', 1, 'Byte', 'Asynchronous', 4096, 4096, $acl)
    if (-not $pipe.WaitForConnectionAsync().Wait(30000)) { throw 'HOSTS_CONNECT_TIMEOUT' }
    $reader = New-Object IO.StreamReader($pipe, (New-Object Text.UTF8Encoding($false)), $false, 4096, $true)
    $writer = New-Object IO.StreamWriter($pipe, (New-Object Text.UTF8Encoding($false)), 4096, $true)
    $writer.AutoFlush = $true
    $nonce = Read-Handshake
    if ($nonce -notmatch '^[a-f0-9]{64}$') { throw 'HOSTS_AUTH_FAILED' }
    $writer.WriteLine((Proof "server:$nonce"))
    if ((Read-Handshake) -cne (Proof "client:$nonce")) { throw 'HOSTS_AUTH_FAILED' }
    # No hosts or journal access occurs before both peers prove knowledge of the launch secret.
    & (Join-Path $PSScriptRoot 'hosts-io.ps1') -FixtureRoot $FixtureRoot -Reader $reader -Writer $writer -Watchdog
} finally {
    if ($writer) { $writer.Dispose() }
    if ($reader) { $reader.Dispose() }
    if ($pipe) { $pipe.Dispose() }
}
