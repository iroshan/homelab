#!/bin/bash
# Setup script for initial Kopia repository configuration
# Run this after first deployment to configure Google Drive repository

set -euo pipefail

echo "========================================="
echo "Kopia Repository Setup Helper"
echo "========================================="
echo ""
echo "This script will guide you through setting up Kopia with Google Drive."
echo ""
echo "Prerequisites:"
echo "1. Kopia container is running"
echo "2. You have access to Kopia UI at http://localhost:51515"
echo "3. You have a Google Drive account with 2TB space"
echo ""
echo "Steps to complete:"
echo ""
echo "1. Open Kopia UI: http://localhost:51515"
echo "2. Login with credentials from .env file"
echo "3. Create new repository:"
echo "   - Type: Google Drive"
echo "   - Folder: homelab-backups"
echo "   - Encryption: AES256-GCM-HMAC-SHA256"
echo "   - Password: (use KOPIA_PASSWORD from .env)"
echo ""
echo "4. Complete Google OAuth flow"
echo ""
echo "5. After repository is created, run:"
echo "   docker exec kopia kopia policy set --global \\"
echo "     --keep-daily ${KEEP_DAILY:-3} \\"
echo "     --keep-weekly ${KEEP_WEEKLY:-2} \\"
echo "     --keep-monthly ${KEEP_MONTHLY:-1} \\"
echo "     --compression zstd \\"
echo "     --enable-actions"
echo ""
echo "6. Test your first backup:"
echo "   docker exec kopia /app/scripts/backup.sh"
echo ""
echo "========================================="
echo ""
read -p "Press Enter to continue when ready..."
echo ""
echo "Opening Kopia UI in browser..."
echo "If it doesn't open automatically, visit: http://localhost:51515"
echo ""

# Try to open browser (optional)
if command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:51515" 2>/dev/null || true
fi

echo "Setup helper complete!"
