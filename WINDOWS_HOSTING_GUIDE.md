# Orbica — Windows Self-Hosting & Cloudflare Tunnel Guide

This guide details how to host the **Orbica** backend services and database on a Windows laptop, and expose them to the internet securely using **Cloudflare Tunnel** for free.

---

## Phase 1: Set up the Infrastructure (Database & Cache)

1. **Install Docker Desktop**:
   * Download and install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/).
   * Verify Docker Desktop is launched and running.

2. **Clone the Repository**:
   * Open **PowerShell** or **Git Bash** and clone your repository:
     ```bash
     git clone https://github.com/viny4/orbica.git
     cd orbica
     ```

3. **Start the Database Stack**:
   * From the root of the project folder, spin up the backing services:
     ```bash
     docker compose up -d
     ```
   * This brings up PostgreSQL (with PostGIS/TimescaleDB), Redis, Elasticsearch, and Kafka in Docker.

4. **Run the Database Migrations & Ingest Seed Data**:
   * **Apply Schemas**:
     If you have Go installed on Windows, run:
     ```bash
     go run scripts/migrate.go up
     ```
   * **Seed the Database**:
     If you have Python installed:
     ```bash
     cd services/pipeline
     pip install -r requirements.txt
     python -m src.seed.historical_seed
     ```

---

## Phase 2: Start the Go Backend Services

Keep these two services running in separate PowerShell windows so they can connect to your local Docker database:

### 1. Go API Server (Port 8090)
* Runs the REST + GraphQL endpoints.
```bash
cd services/api
go run ./cmd/server
```

---

## Phase 3: Expose Services via Cloudflare Tunnel

Cloudflare Tunnel (`cloudflared`) connects your local ports to your public domain `orbica.space` without needing port forwarding or exposing your home IP address.

1. **Download and Install cloudflared**:
   * Download the Windows installer (`.msi`) from: [Cloudflare Tunnel Downloads](https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.msi).
   * Double-click the downloaded file and complete the installation.

2. **Login to Cloudflare**:
   * Open **PowerShell** as Administrator and run:
     ```powershell
     cloudflared tunnel login
     ```
   * A browser window will open. Sign in and select your domain **`orbica.space`** to authorize the agent.

3. **Create the Tunnel**:
   * Create a new tunnel named `orbica-server`:
     ```powershell
     cloudflared tunnel create orbica-server
     ```
   * This will output a **Tunnel ID** (UUID) and create a credentials JSON file. Copy this Tunnel ID.

4. **Add DNS Records**:
   * Route your subdomains directly to the tunnel:
     ```powershell
     cloudflared tunnel route dns orbica-server api.orbica.space
     cloudflared tunnel route dns orbica-server tracker.orbica.space
     ```

5. **Create the Configuration File**:
   * Navigate to `C:\Users\<Your_Windows_Username>\.cloudflared\`
   * Create a text file named **`config.yml`** and paste the following content (replace `TUNNEL_ID` with the ID from Step 3, and update `<Your_Windows_Username>` in the path):
     ```yaml
     tunnel: TUNNEL_ID
     credentials-file: C:\Users\<Your_Windows_Username>\.cloudflared\TUNNEL_ID.json

     ingress:
       - hostname: api.orbica.space
         service: http://localhost:8090
       - hostname: tracker.orbica.space
         service: http://localhost:7788
       - service: http_status:404
     ```

6. **Install and Run as a Windows Service**:
   * Register the tunnel as a background service so it launches automatically on boot:
     ```powershell
     cloudflared service install
     Start-Service cloudflared
     ```

---

## Phase 4: Deploy Next.js Frontend (Vercel / Cloudflare Pages)

1. Go to your frontend hosting provider (Vercel/Cloudflare Pages) and select your GitHub repository.
2. Choose `web` as the root directory of the build.
3. Add these Environment Variables to the deployment settings:
   * `NEXT_PUBLIC_API_URL` ➔ `https://api.orbica.space`
   * `NEXT_PUBLIC_TRACKER_WS_URL` ➔ `wss://tracker.orbica.space`
4. Deploy the site, add `orbica.space` as a custom domain on the provider, and you are live!
