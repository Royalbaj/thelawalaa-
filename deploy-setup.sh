#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "🥘 Thelawalaa — Deployment Setup Assistant"
echo "========================================="

# 1. Setup Environment File
if [ ! -f .env.local ]; then
  echo "📄 Creating .env.local from template..."
  cp .env.example .env.local
  
  # Generate OTP_HMAC_SECRET
  if command -v openssl >/dev/null 2>&1; then
    OTP_SECRET=$(openssl rand -hex 32)
    # Replace the empty OTP_HMAC_SECRET value in .env.local
    sed -i '' "s/OTP_HMAC_SECRET=/OTP_HMAC_SECRET=${OTP_SECRET}/g" .env.local 2>/dev/null || \
    sed -i "s/OTP_HMAC_SECRET=/OTP_HMAC_SECRET=${OTP_SECRET}/g" .env.local
    echo "🔑 Generated secure OTP_HMAC_SECRET in .env.local"
  else
    echo "⚠️ openssl command not found. Please manually generate and add OTP_HMAC_SECRET to .env.local."
  fi
else
  echo "ℹ️ .env.local already exists. Skipping environment template copy."
fi

# 2. Setup Git Repository
if [ ! -d .git ]; then
  echo "📁 Initializing local Git repository..."
  git init
  git branch -M main
  git add .
  git commit -m "initial: ready for deployment"
  echo "✅ Local Git repository initialized and first commit created."
else
  echo "ℹ️ Git repository already initialized."
fi

echo "========================================="
echo "🎉 Setup Completed!"
echo ""
echo "Next Steps:"
echo "1. Create a PRIVATE repository on GitHub named 'thelawalaa'"
echo "2. Run the following commands to link and push your code:"
echo "   git remote add origin git@github.com:YOUR_GITHUB_USERNAME/thelawalaa.git"
echo "   git push -u origin main"
echo ""
echo "3. Open .env.local and fill in your Supabase, Resend, and Google Maps API keys."
echo "4. Copy those same values to your Vercel project environment variables settings."
echo ""
echo "For full details, view the walkthrough guide at:"
echo "file:///Users/bishalgaire/.gemini/antigravity/brain/4663851e-dc12-4069-b025-d24deddaf09a/artifacts/deployment_walkthrough.md"
