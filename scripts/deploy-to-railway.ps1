# PowerShell script to deploy session management changes to Railway
# This script helps commit changes and provides deployment options

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Deploy Session Management to Railway" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
$currentDir = Get-Location
if (-not (Test-Path "backend\src\services\sessionService.js")) {
    Write-Host "❌ Error: Please run this script from the SyncroGate root directory" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Found session management files" -ForegroundColor Green
Write-Host ""

# Check if git is initialized
if (-not (Test-Path ".git")) {
    Write-Host "📦 Git repository not found. Initializing..." -ForegroundColor Yellow
    git init
    Write-Host "✅ Git initialized" -ForegroundColor Green
    Write-Host ""
}

# Show current status
Write-Host "📋 Current git status:" -ForegroundColor Cyan
git status --short
Write-Host ""

# Ask user what they want to do
Write-Host "Select deployment method:" -ForegroundColor Yellow
Write-Host "1. Commit and push to GitHub (Railway auto-deploys)" -ForegroundColor White
Write-Host "2. Just commit changes (you'll push manually)" -ForegroundColor White
Write-Host "3. Show deployment instructions only" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Enter choice (1-3)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "🚀 Deploying via GitHub..." -ForegroundColor Cyan
        
        # Check if remote exists
        $remote = git remote get-url origin 2>$null
        if (-not $remote) {
            Write-Host ""
            Write-Host "⚠️  No GitHub remote configured." -ForegroundColor Yellow
            $repoUrl = Read-Host "Enter your GitHub repository URL (e.g., https://github.com/username/repo.git)"
            if ($repoUrl) {
                git remote add origin $repoUrl
                Write-Host "✅ Remote added" -ForegroundColor Green
            } else {
                Write-Host "❌ No repository URL provided. Exiting." -ForegroundColor Red
                exit 1
            }
        }
        
        # Stage all changes
        Write-Host ""
        Write-Host "📦 Staging changes..." -ForegroundColor Cyan
        git add .
        
        # Commit
        Write-Host "💾 Committing changes..." -ForegroundColor Cyan
        $commitMessage = "Add session management: enforce one device per user"
        git commit -m $commitMessage
        
        # Get current branch
        $branch = git branch --show-current
        if (-not $branch) {
            $branch = "main"
            git branch -M main
        }
        
        # Push
        Write-Host ""
        Write-Host "📤 Pushing to GitHub..." -ForegroundColor Cyan
        git push -u origin $branch
        
        Write-Host ""
        Write-Host "✅ Changes pushed to GitHub!" -ForegroundColor Green
        Write-Host "🔄 Railway will automatically deploy in a few moments..." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "📊 Check deployment status at: https://railway.app" -ForegroundColor Cyan
    }
    
    "2" {
        Write-Host ""
        Write-Host "💾 Committing changes..." -ForegroundColor Cyan
        
        git add .
        $commitMessage = "Add session management: enforce one device per user"
        git commit -m $commitMessage
        
        Write-Host ""
        Write-Host "✅ Changes committed!" -ForegroundColor Green
        Write-Host "📤 Push manually with: git push" -ForegroundColor Yellow
    }
    
    "3" {
        Write-Host ""
        Write-Host "📖 Deployment Instructions:" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Option A - GitHub (Auto-deploy):" -ForegroundColor Yellow
        Write-Host "  1. git add ." -ForegroundColor White
        Write-Host "  2. git commit -m 'Add session management'" -ForegroundColor White
        Write-Host "  3. git push" -ForegroundColor White
        Write-Host "  4. Railway will auto-deploy" -ForegroundColor White
        Write-Host ""
        Write-Host "Option B - Railway CLI:" -ForegroundColor Yellow
        Write-Host "  1. npm install -g @railway/cli" -ForegroundColor White
        Write-Host "  2. railway login" -ForegroundColor White
        Write-Host "  3. cd backend" -ForegroundColor White
        Write-Host "  4. railway link" -ForegroundColor White
        Write-Host "  5. railway up" -ForegroundColor White
        Write-Host ""
        Write-Host "Option C - Railway Dashboard:" -ForegroundColor Yellow
        Write-Host "  1. Go to https://railway.app" -ForegroundColor White
        Write-Host "  2. Select your project" -ForegroundColor White
        Write-Host "  3. Click 'Redeploy' or 'Deploy'" -ForegroundColor White
        Write-Host ""
    }
    
    default {
        Write-Host "❌ Invalid choice" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green

