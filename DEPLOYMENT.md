# Deployment Guide

## Backend (Render)

1. **Create a new Web Service on Render**
   - Connect your GitHub repository
   - Select the `backend` folder as the root directory
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Environment Variables:
     - `NODE_ENV=production`
     - `PORT=10000` (Render sets this automatically, but you can override)
     - `PLANNED_XLSX=./VD2026.xlsx` (or path to your Excel file)
     - `FRONTEND_URL=https://your-netlify-app.netlify.app` (your Netlify frontend URL)
     - `NETLIFY_URL=https://your-netlify-app.netlify.app` (same as above)

2. **Upload VD2026.xlsx**
   - Make sure `VD2026.xlsx` is in the `backend` directory
   - Or set `PLANNED_XLSX` environment variable to the correct path

3. **Note the Render URL**
   - After deployment, note your backend URL (e.g., `https://flowerama-backend.onrender.com`)

## Frontend (Netlify)

1. **Create a new site on Netlify**
   - Connect your GitHub repository
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `dist`

2. **Set Environment Variables**
   - `VITE_API_BASE=https://your-render-backend.onrender.com` (your Render backend URL)

3. **Deploy**
   - Netlify will automatically deploy on every push to main/master

## Local Development

1. **Backend:**
   ```bash
   cd backend
   npm install
   npm start
   ```
   Backend runs on http://localhost:3001

2. **Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Frontend runs on http://localhost:5173

## Testing URLs

After deployment, test these endpoints:

- **Health Check:** `https://your-backend.onrender.com/api/health`
- **Planned:** `https://your-backend.onrender.com/api/planned`
- **Dashboard:** `https://your-backend.onrender.com/api/dashboard`
- **History:** `https://your-backend.onrender.com/api/history`

## Test Scenario

Example test data:
- Planned = 30
- Produced = 10
- Sent = 3
- Sold = 2

Expected results:
- Net = 10 - 3 - 2 = 5 (Status: "Yippee" with green background)
- Ahead/Behind = 30 - 10 = 20

















