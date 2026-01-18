#!/bin/sh

# Set default values
PUID=${PUID:-1000}
PGID=${PGID:-1000}
UMASK=${UMASK:-022}

echo "Starting GSCTracker with:"
echo "  PUID: $PUID"
echo "  PGID: $PGID"
echo "  UMASK: $UMASK"
echo "  TZ: ${TZ:-UTC}"

# Set timezone if specified (validate to prevent path traversal)
if [ -n "$TZ" ]; then
    # Remove any path traversal attempts and validate format (allow safe timezone characters)
    CLEAN_TZ=$(echo "$TZ" | sed 's/\.\.//g' | sed 's/[^a-zA-Z0-9_\/+-]//g')
    if [ -f "/usr/share/zoneinfo/$CLEAN_TZ" ]; then
        ln -snf /usr/share/zoneinfo/$CLEAN_TZ /etc/localtime
        echo $CLEAN_TZ > /etc/timezone
        echo "Timezone set to: $CLEAN_TZ"
    else
        if [ "$TZ" != "$CLEAN_TZ" ]; then
            echo "Warning: Timezone '$TZ' was sanitized to '$CLEAN_TZ' but is still invalid, using default (UTC)"
        else
            echo "Warning: Invalid timezone '$TZ', using default (UTC)"
        fi
    fi
fi

# Update nginx user/group IDs if different from defaults
CURRENT_UID=$(id -u nginx)
CURRENT_GID=$(id -g nginx)

if [ "$CURRENT_GID" != "$PGID" ]; then
    echo "Updating nginx group ID to $PGID"
    groupmod -o -g "$PGID" nginx
fi

if [ "$CURRENT_UID" != "$PUID" ]; then
    echo "Updating nginx user ID to $PUID"
    usermod -o -u "$PUID" nginx
fi

# Set umask
umask $UMASK

# Fix permissions for nginx directories (only if needed to improve startup performance)
if [ "$(stat -c '%u' /var/cache/nginx 2>/dev/null)" != "$PUID" ]; then
    echo "Fixing permissions for nginx directories..."
    chown -R nginx:nginx /var/cache/nginx /var/log/nginx /etc/nginx/conf.d
    chown -R nginx:nginx /usr/share/nginx/html
fi

# Execute the main command
exec "$@"
