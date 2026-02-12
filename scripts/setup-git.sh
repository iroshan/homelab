#!/bin/bash
# Git Setup Script for Homelab
# Configures Git user, email, and GitHub authentication

set -euo pipefail

echo "========================================="
echo "Git Setup for Homelab"
echo "========================================="
echo ""

# Configure Git user
read -p "Git username: " GIT_USER
read -p "Git email: " GIT_EMAIL

git config --global user.name "$GIT_USER"
git config --global user.email "$GIT_EMAIL"

echo "✓ Git user configured"
echo ""

# GitHub authentication method
echo "Choose authentication method:"
echo "1) SSH Key (recommended)"
echo "2) Personal Access Token (HTTPS)"
read -p "Choice (1/2): " AUTH_METHOD

if [[ "$AUTH_METHOD" == "1" ]]; then
    # SSH Key setup
    echo ""
    echo "Setting up SSH authentication..."
    
    if [[ ! -f ~/.ssh/id_ed25519 ]]; then
        echo "Generating SSH key..."
        ssh-keygen -t ed25519 -C "$GIT_EMAIL" -f ~/.ssh/id_ed25519 -N ""
    else
        echo "SSH key already exists"
    fi
    
    echo ""
    echo "========================================="
    echo "Add this SSH key to GitHub:"
    echo "https://github.com/settings/ssh/new"
    echo "========================================="
    echo ""
    cat ~/.ssh/id_ed25519.pub
    echo ""
    echo "========================================="
    read -p "Press Enter after adding the key to GitHub..."
    
    # Test connection
    echo "Testing GitHub connection..."
    if ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
        echo "✓ GitHub SSH connection successful!"
    else
        echo "⚠ GitHub connection test (this is normal, don't worry)"
        ssh -T git@github.com || true
    fi
    
    echo ""
    echo "Use SSH URL format:"
    echo "git@github.com:USERNAME/homelab.git"
    echo ""
    
elif [[ "$AUTH_METHOD" == "2" ]]; then
    # Token setup
    echo ""
    echo "========================================="
    echo "Create a Personal Access Token:"
    echo "https://github.com/settings/tokens/new"
    echo ""
    echo "Required scopes: repo (all)"
    echo "Expiration: No expiration or 1 year"
    echo "========================================="
    echo ""
    read -p "Enter your token: " GH_TOKEN
    
    # Store token securely
    git config --global credential.helper store
    
    echo ""
    echo "Use HTTPS URL format:"
    echo "https://github.com/USERNAME/homelab.git"
    echo ""
    echo "⚠ Token will be stored in ~/.git-credentials"
    
else
    echo "Invalid choice"
    exit 1
fi

echo ""
echo "========================================="
echo "✅ Git configuration complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Create private GitHub repository: https://github.com/new"
echo "2. Repository name: homelab"
echo "3. Visibility: Private"
echo "4. Do NOT initialize with README"
echo ""
echo "Then connect your repo:"
echo "  cd /home/ubuntu/homelab"
echo "  git remote add origin <YOUR_REPO_URL>"
echo "  git push -u origin main"
echo ""
