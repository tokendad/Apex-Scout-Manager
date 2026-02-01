#!/bin/sh

# Set default values
PUID=${PUID:-1000}
PGID=${PGID:-1000}
UMASK=${UMASK:-022}

echo "Starting Apex Scout Manager with:"
echo "  PORT: ${PORT:-3000}"
echo "  PUID: $PUID"
echo "  PGID: $PGID"
echo "  UMASK: $UMASK"
echo "  TZ: ${TZ:-UTC}"

# Set timezone if specified (validate to prevent path traversal)
if [ -n "$TZ" ]; then
    # Remove path traversal attempts and validate format
    # Strip any leading slashes to prevent absolute paths, remove .., filter to safe characters
    CLEAN_TZ=$(echo "$TZ" | sed 's/^[\/]*//g' | sed 's/\.\.//g' | sed 's/[^a-zA-Z0-9_\/+-]//g')
    
    # Ensure it doesn't start with / after cleaning (POSIX-compliant check)
    case "$CLEAN_TZ" in
        /*)
            echo "Warning: Invalid timezone '$TZ' (absolute paths not allowed), using default (UTC)"
            ;;
        *)
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
            ;;
    esac
fi

# Create node user/group if it doesn't exist
if ! getent group node >/dev/null 2>&1; then
    addgroup -g "$PGID" node
fi

if ! getent passwd node >/dev/null 2>&1; then
    adduser -D -u "$PUID" -G node node
fi

# Update node user/group IDs if different from defaults
CURRENT_UID=$(id -u node 2>/dev/null || echo "0")
CURRENT_GID=$(id -g node 2>/dev/null || echo "0")

if [ "$CURRENT_GID" != "$PGID" ]; then
    echo "Updating node group ID to $PGID"
    groupmod -o -g "$PGID" node
fi

if [ "$CURRENT_UID" != "$PUID" ]; then
    echo "Updating node user ID to $PUID"
    usermod -o -u "$PUID" node
fi

# Set umask
umask $UMASK

# Ensure data directory exists and has correct permissions
mkdir -p /data /data/logs
chown -R node:node /data /app

# Execute the main command as node user
exec su-exec node:node "$@"
