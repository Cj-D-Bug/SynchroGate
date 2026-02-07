# Script to trigger Railway rebuild
# Railway MUST rebuild for code changes to take effect

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Trigger Railway Rebuild" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "IMPORTANT: Railway MUST rebuild for session management changes to work!" -ForegroundColor Yellow
Write-Host ""

# Check if Railway CLI is installed
$railwayInstalled = Get-Command railway -ErrorAction SilentlyContinue

if ($railwayInstalled) {
    Write-Host "✅ Railway CLI found" -ForegroundColor Green
    Write-Host ""
    Write-Host "Option 1: Use Railway CLI to trigger rebuild" -ForegroundColor Cyan
    Write-Host "  cd backend" -ForegroundColor White
    Write-Host "  railway up" -ForegroundColor White
    Write-Host ""
    
    $useCLI = Read-Host "Use Railway CLI? (y/n)"
    if ($useCLI -eq "y" -or $useCLI -eq "Y") {
        cd backend
        railway up
        exit 0
    }
} else {
    Write-Host "⚠️  Railway CLI not installed" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To install Railway CLI:" -ForegroundColor Cyan
    Write-Host "  npm install -g @railway/cli" -ForegroundColor White
    Write-Host ""
}

Write-Host "Option 2: Push empty commit to trigger GitHub auto-deploy" -ForegroundColor Cyan
Write-Host ""

# Check if we have a remote
$remote = git remote get-url origin 2>$null
if ($remote) {
    Write-Host "✅ GitHub remote found: $remote" -ForegroundColor Green
    Write-Host ""
    
    $pushCommit = Read-Host "Create empty commit and push to trigger rebuild? (y/n)"
    if ($pushCommit -eq "y" -or $pushCommit -eq "Y") {
        Write-Host ""
        Write-Host "Creating empty commit..." -ForegroundColor Cyan
        git commit --allow-empty -m "Trigger Railway rebuild for session management"
        
        Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
        $branch = git branch --show-current
        if (-not $branch) {
            $branch = "main"
        }
        git push origin $branch
        
        Write-Host ""
        Write-Host "✅ Empty commit pushed!" -ForegroundColor Green
        Write-Host "🔄 Railway should automatically detect and rebuild..." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Check Railway dashboard: https://railway.app" -ForegroundColor Cyan
        Write-Host "Look for new deployment in progress" -ForegroundColor Cyan
    }
} else {
    Write-Host "⚠️  No GitHub remote configured" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To configure GitHub remote:" -ForegroundColor Cyan
    Write-Host "  git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git" -ForegroundColor White
    Write-Host ""
}

Write-Host ""
Write-Host "Option 3: Manual rebuild via Railway Dashboard" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Go to https://railway.app" -ForegroundColor White
Write-Host "2. Select your project" -ForegroundColor White
Write-Host "3. Select your backend service" -ForegroundColor White
Write-Host "4. Go to 'Deployments' tab" -ForegroundColor White
Write-Host "5. Click 'Redeploy' on latest deployment" -ForegroundColor White
Write-Host "   OR click 'Deploy' → 'Deploy Latest Commit'" -ForegroundColor White
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "After rebuild, verify in Railway logs:" -ForegroundColor Yellow
Write-Host "  ✅ User login listener initialized" -ForegroundColor Green
Write-Host "  ✅ Session created for user..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

