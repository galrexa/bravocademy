# Jalankan dari root project untuk verifikasi isi file route
Write-Host "=== answer/route.ts ===" -ForegroundColor Cyan
Select-String -Path "src\app\api\exam\answer\route.ts" -Pattern "getUser|safeParse|auth" | ForEach-Object { Write-Host "  L$($_.LineNumber): $($_.Line.Trim())" }

Write-Host "`n=== submit/route.ts ===" -ForegroundColor Cyan  
Select-String -Path "src\app\api\exam\submit\route.ts" -Pattern "getUser|safeParse|auth" | ForEach-Object { Write-Host "  L$($_.LineNumber): $($_.Line.Trim())" }

Write-Host "`n=== start/route.ts ===" -ForegroundColor Cyan
Select-String -Path "src\app\api\exam\start\route.ts" -Pattern "getUser|safeParse|auth" | ForEach-Object { Write-Host "  L$($_.LineNumber): $($_.Line.Trim())" }