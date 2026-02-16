# Guide to Deploying on Debian 12 (Bookworm) via Docker

This guide contains step-by-step instructions on how to install Docker and run the application on a server running **Debian 12**.

## 1. System Update and Installation of Required System Tools

Before installing Docker, ensure your system is up-to-date and has the necessary tools installed.

Run the following commands as `root` or with `sudo`:

```bash
# Update the package list and upgrade the system
sudo apt-get update && sudo apt-get upgrade -y

# Install tools needed for apt to use packages over HTTPS
sudo apt-get install -y ca-certificates curl gnupg
```

## 2. Installation of Docker & Docker Compose (Official Repository)

We will use the official Docker repository to get the latest version.

1.  **Add Docker's official GPG key:**
    ```bash
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    ```

2.  **Add the repository to Apt sources:**
    ```bash
    echo \
      "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
      "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    ```

3.  **Install Docker Engine and Docker Compose:**
    ```bash
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    ```

4.  **Verify the installation:**
    ```bash
    sudo docker run hello-world
    ```
    If you see a "Hello from Docker!" message, the installation was successful.

## 3. Application Deployment

1.  **Clone the Repository:**
    ```bash
    # Replace the URL with your repository address
    git clone https://github.com/your-username/your-repo-name.git
    cd your-repo-name
    ```

2.  **Prepare Database File:**
    The database file `dev.db` is ignored by git, but Docker expects it to exist. Create an empty file to prevent Docker from creating a directory instead:
    ```bash
    touch prisma/dev.db
    # Ensure it's writable by the container's user (node/nextjs - uid 1001)
    chmod 666 prisma/dev.db
    ```

3.  **Configuration (.env):**
    Copy the `.env` example file (create it if it doesn't exist) and fill in the production values.
    ```bash
    nano .env
    ```
    **Example content for .env:**
    ```env
    # Database (used by Prisma inside the container)
    DATABASE_URL="file:/app/prisma/dev.db"

    # Authentication (generate a random string, e.g., with `openssl rand -base64 32`)
    NEXTAUTH_SECRET="your-secure-secret-key"
    NEXTAUTH_URL="http://ip-address-or-domain:3000"
    ```

3.  **Run the Application:**
    Run the container in the background (detached mode):
    ```bash
    sudo docker compose up -d --build
    ```

4.  **Initialize Database Schema & Seed Data:**
    The `dev.db` file is empty. We need to create the tables and add default data:
    ```bash
    # Create tables (push schema)
    sudo docker compose exec app npx prisma db push

    # Seed data (create admin account)
    sudo docker compose exec app node prisma/seed.js
    ```

5.  **Check Status:**
    ```bash
    sudo docker compose ps
    ```
    The application should be accessible at: `http://server-ip:3000`

## 4. Updates and Maintenance

### Updating the Application
When you have pushed changes to GitHub, run these commands on the server:

```bash
# 1. Download changes
git pull

# 2. Rebuild and restart containers
sudo docker compose up -d --build

# 3. Clean up unused images (optional, to save space)
sudo docker image prune -f
```

### Database Backup
The database corresponds to the file `prisma/dev.db`. To safeguard it:

```bash
# Copy the database to a safe location (e.g., home directory)
cp prisma/dev.db ~/backup_grafik_$(date +%F).db
```
