# Deploying Frontend to Vercel

## Option 1: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy from frontend directory
cd frontend
vercel

# Set environment variable
vercel env add NEXT_PUBLIC_API_URL production
# Enter your backend API URL when prompted
```

## Option 2: GitHub Integration

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
5. Add environment variable:
   - `NEXT_PUBLIC_API_URL`: Your backend API URL
6. Click "Deploy"

## Custom Domain

1. Go to your project settings in Vercel
2. Click "Domains"
3. Add your custom domain
4. Update DNS records as instructed

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `https://api.floodwatch.lk` |
