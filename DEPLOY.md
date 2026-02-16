
# Deployment Guide (Debian Server)

This guide explains how to deploy the application to your Debian server using Docker.

## Prerequisites on the Server

1.  **Install Docker & Docker Compose:**
    ```bash
    # Update package index
    sudo apt-get update
    
    # Install required packages
    sudo apt-get install -y ca-certificates curl gnupg
    
    # Add Docker's official GPG key
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg

    # Set up the repository
    echo \
      "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
      "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker Engine
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    ```

2.  **Verify Docker installation:**
    ```bash
    sudo docker run hello-world
    ```

## Deployment Steps

1.  **Clone the Repository:**
    Log in to your server and clone your repository (or copy files via SCP/FileZilla).
    ```bash
    git clone https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git
    cd YOUR_REPO_NAME
    ```

2.  **Create Environment File:**
    Create a `.env` file in the project root with your secrets.
    ```bash
    nano .env
    ```
    Paste your environment variables (e.g. `NEXTAUTH_SECRET`, `NEXTAUTH_URL`):
    ```env
    NEXTAUTH_SECRET="your-super-long-secret-key"
    NEXTAUTH_URL="http://YOUR_SERVER_IP:3000"
    DATABASE_URL="file:./dev.db"
    ```
    *(Press `Ctrl+O` to save, `Enter` to confirm, and `Ctrl+X` to exit)*

3.  **Run the Application:**
    Start the application in detach mode (background):
    ```bash
    sudo docker compose up -d --build
    ```

4.  **Verify:**
    Open your browser and navigate to `http://YOUR_SERVER_IP:3000`.

## Updating the Application

When you have new changes in GitHub:

1.  Pull the latest code:
    ```bash
    git pull
    ```

2.  Rebuild and restart the container:
    ```bash
    sudo docker compose up -d --build
    ```

## Database Backup (Important!)

Since we use SQLite, your database is a single file `prisma/dev.db`.
To backup, simply copy this file to a safe location:
```bash
cp prisma/dev.db ~/backup_dev.db_$(date +%F)
```
