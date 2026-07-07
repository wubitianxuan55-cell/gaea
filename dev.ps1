Start-Process -FilePath D:\AI\gaeaWX\gaeaW\bin\gaeaW.exe -ArgumentList "serve","--addr","127.0.0.1:8090"
Set-Location D:\AI\gaeaWX\gaeaW\desktop\frontend
Write-Host "http://127.0.0.1:5174"
npx vite
