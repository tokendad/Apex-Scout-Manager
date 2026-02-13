# Docker Compose Documentation

This document explains how to install and run Apex Scout Manager using Docker and Docker Compose.

## Prerequisites

- Docker (version 20.10 or later)
- Docker Compose (version 1.29 or later)

### Installing Docker

**Linux:**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

**macOS:**
Download and install [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop)

**Windows:**
Download and install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop)

## Quick Start

1. **Clone the repository:**
   ```bash
   git clone https://github.com/tokendad/Apex-Scout-Manager.git
   cd Apex-Scout-Manager
   ```

2. **Start the application:**
   ```bash
   docker-compose up -d
   ```

3. **Access the application:**
   Open your browser and navigate to `http://localhost:8080`

4. **Stop the application:**
   ```bash
   docker-compose down
   ```

## Configuration Variables

The Docker Compose setup supports the following environment variables for customization:

### PUID (Process User ID)

**Description:** The user ID that the container process will run as.

**Default:** `1000`

**Usage:**
- Ensures files created by the container have the correct ownership
- Should match your host user ID for proper file permissions
- Find your PUID by running: `id -u`

**Example:**
```yaml
environment:
  - PUID=1000
```

### PGID (Process Group ID)

**Description:** The group ID that the container process will run as.

**Default:** `1000`

**Usage:**
- Ensures files created by the container have the correct group ownership
- Should match your host group ID for proper file permissions
- Find your PGID by running: `id -g`

**Example:**
```yaml
environment:
  - PGID=1000
```

### UMASK

**Description:** File creation mask that determines default permissions for new files and directories.

**Default:** `022`

**Common Values:**
- `022` - Files: `rw-r--r--` (644), Directories: `rwxr-xr-x` (755)
  - User: read/write, Group: read-only, Others: read-only
- `002` - Files: `rw-rw-r--` (664), Directories: `rwxrwxr-x` (775)
  - User: read/write, Group: read/write, Others: read-only
- `077` - Files: `rw-------` (600), Directories: `rwx------` (700)
  - User: read/write, Group: no access, Others: no access

**Example:**
```yaml
environment:
  - UMASK=022
```

### Ports

**Description:** Maps container ports to host ports for accessing the application.

**Default:** `8080:80` (Host port 8080 maps to container port 80)

**Format:** `HOST_PORT:CONTAINER_PORT`

**Examples:**
```yaml
ports:
  - "8080:80"    # Access at http://localhost:8080
  - "3000:80"    # Access at http://localhost:3000
  - "80:80"      # Access at http://localhost (requires admin/root)
```

**Note:** The container always uses port 80 internally; only change the host port (left side).

### TZ (Timezone)

**Description:** Sets the timezone for the container.

**Default:** `UTC`

**Usage:**
- Ensures timestamps and logs use your local timezone
- Uses the [tz database](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) format

**Examples:**
```yaml
environment:
  - TZ=America/New_York      # US Eastern Time
  - TZ=America/Los_Angeles   # US Pacific Time
  - TZ=Europe/London         # UK
  - TZ=Europe/Paris          # Central European Time
  - TZ=Asia/Tokyo            # Japan
  - TZ=Australia/Sydney      # Australian Eastern Time
```

### Volumes

**Description:** Maps directories from the host to the container for persistent data storage.

**Default:** `./data:/data` (Maps local `data` directory to container's `/data`)

**Format:** `HOST_PATH:CONTAINER_PATH`

**Examples:**
```yaml
volumes:
  - ./data:/data                      # Relative path
  - /path/to/host/data:/data         # Absolute path
  - ~/asm/data:/data                  # Home directory path
  - ./backups:/backups               # Additional volume
```

**Use Cases:**
- Store persistent data that survives container restarts
- Share files between host and container
- Backup and restore data easily

### Container Name

**Description:** Assigns a custom name to the container for easy reference.

**Default:** `asm`

**Usage:**
- Makes it easier to identify the container in `docker ps` output
- Allows direct reference in docker commands (e.g., `docker logs asm`)

**Example:**
```yaml
container_name: asm
# or
container_name: my-scout-manager
```

### Restart Options

**Description:** Defines the restart policy for the container.

**Default:** `unless-stopped`

**Available Options:**
- `no` - Do not restart automatically (default Docker behavior)
- `always` - Always restart the container if it stops
- `unless-stopped` - Always restart unless explicitly stopped by user
- `on-failure` - Restart only if container exits with non-zero status

**Examples:**
```yaml
restart: no              # Manual management
restart: always          # Production: always running
restart: unless-stopped  # Recommended: survives reboots but respects manual stops
restart: on-failure      # Development: restart on crashes only
```

**Recommendation:** Use `unless-stopped` for most use cases as it balances automatic recovery with user control.

## Complete Configuration Example

Here's a fully configured `docker-compose.yml` example:

```yaml
version: '3.8'

services:
  asm:
    build: .
    container_name: my-scout-manager
    restart: unless-stopped
    ports:
      - "8080:80"
    environment:
      - PUID=1000
      - PGID=1000
      - UMASK=022
      - TZ=America/New_York
    volumes:
      - ./data:/data
```

## Advanced Usage

### Building the Image

Build the Docker image manually:
```bash
docker build -t asm:latest .
```

### Running Without Docker Compose

Run the container directly with Docker:
```bash
docker run -d \
  --name asm \
  --restart unless-stopped \
  -p 8080:80 \
  -e PUID=1000 \
  -e PGID=1000 \
  -e UMASK=022 \
  -e TZ=America/New_York \
  -v $(pwd)/data:/data \
  asm:latest
```

### Viewing Logs

View real-time logs:
```bash
docker-compose logs -f
```

View last 100 lines:
```bash
docker-compose logs --tail=100
```

### Updating the Application

1. Pull the latest changes:
   ```bash
   git pull origin main
   ```

2. Rebuild and restart:
   ```bash
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   ```

### Backup and Restore

**Backup:**
```bash
# Stop the container
docker-compose down

# Backup data directory
tar -czf asm-backup-$(date +%Y%m%d).tar.gz data/

# Restart
docker-compose up -d
```

**Restore:**
```bash
# Stop the container
docker-compose down

# Restore from backup
tar -xzf asm-backup-YYYYMMDD.tar.gz

# Restart
docker-compose up -d
```

## Troubleshooting

### Port Already in Use

If port 8080 is already in use, change the host port in `docker-compose.yml`:
```yaml
ports:
  - "3000:80"  # Use port 3000 instead
```

### Permission Denied Errors

Ensure PUID and PGID match your user:
```bash
echo "PUID=$(id -u)"
echo "PGID=$(id -g)"
```

Update these values in your `docker-compose.yml`.

### Container Won't Start

Check the logs:
```bash
docker-compose logs
```

Verify the Docker service is running:
```bash
docker ps
```

### Cannot Access Application

1. Verify container is running:
   ```bash
   docker-compose ps
   ```

2. Check port mapping:
   ```bash
   docker port asm
   ```

3. Test with curl:
   ```bash
   curl http://localhost:8080
   ```

## File Locations

- **Application files:** `/usr/share/nginx/html/` (inside container)
- **Data volume:** `/data` (inside container), maps to `./data` (host)
- **Nginx config:** `/etc/nginx/conf.d/default.conf` (inside container)
- **Logs:** `/var/log/nginx/` (inside container)

## Security Considerations

1. **File Permissions:** Use appropriate UMASK values to restrict file access
2. **Port Exposure:** Only expose ports necessary for your use case
3. **Network:** Consider using Docker networks for multi-container setups
4. **Updates:** Regularly update the base nginx image for security patches

## Support

For issues and questions:
- Open an issue on [GitHub](https://github.com/tokendad/Apex-Scout-Manager/issues)
- Check existing issues for solutions
- Include Docker and Docker Compose versions in bug reports

## License

This project follows the same license as the main Apex Scout Manager repository.
