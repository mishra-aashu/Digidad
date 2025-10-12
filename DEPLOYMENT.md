# 🚀 Digidad Messaging App - Deployment Guide

यह गाइड बताता है कि आप अपने Digidad messaging app को GitHub Pages और Railway पर कैसे deploy कर सकते हैं।

## 📋 Prerequisites

- GitHub account
- Railway account (for backend deployment)
- Supabase account (already configured)

## 🛠️ Deployment Steps

### Step 1: GitHub Repository Setup

1. **Create GitHub Repository**
   - GitHub पर जाएं और नया repository बनाएं
   - Repository name: `digidad-messaging-app`
   - Public या Private (आपकी पसंद)

2. **Push Code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Digidad messaging app"
   git branch -M main
   git remote add origin https://github.com/your-username/digidad-messaging-app.git
   git push -u origin main
   ```

### Step 2: GitHub Pages Setup (Frontend)

1. **Enable GitHub Pages**
   - Repository Settings में जाएं
   - Pages section में जाएं
   - Source को "GitHub Actions" पर सेट करें

2. **Frontend Deployment**
   - यह automatically GitHub Actions workflow के द्वारा होगा
   - Workflow `.github/workflows/deploy.yml` में defined है

### Step 3: Railway Setup (Backend)

1. **Railway Account**
   - [railway.app](https://railway.app) पर जाएं
   - Sign up करें और नया project बनाएं

2. **Deploy Backend**
   ```bash
   # Railway CLI install करें
   npm install -g @railway/cli

   # Login करें
   railway login

   # Service बनाएं
   railway link

   # Environment variables सेट करें
   railway variables set NODE_ENV=production
   railway variables set CLIENT_URL=https://your-username.github.io
   railway variables set SUPABASE_URL=your-supabase-url
   railway variables set SUPABASE_ANON_KEY=your-supabase-key
   ```

### Step 4: Environment Variables Configuration

1. **Production .env File**
   ```bash
   cp .env.example .env.production
   ```

2. **Required Variables**
   ```env
   SUPABASE_URL=https://mfigbwrmcmbipvkwqtsr.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1maWdid3JtY21iaXB2a3dxdHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2ODg1MjcsImV4cCI6MjA3NTI2NDUyN30.D7OmCYbHa3XUyqPWG4sxxKORP_jiWW9TqOSECAvazTE
   CLIENT_URL=https://your-username.github.io
   FRONTEND_URL=https://your-username.github.io
   NODE_ENV=production
   JWT_SECRET=your-secure-jwt-secret
   ```

### Step 5: Update CORS Settings

CORS settings automatically production domains को allow करती हैं:
- `https://your-username.github.io`
- Railway deployment URL
- Supabase URLs

## 🔧 Manual Deployment Commands

### Frontend Only (Development)
```bash
cd client
npm run build
# dist/ folder में files generate होंगी
```

### Backend Only (Railway)
```bash
# Railway पर deploy करने के लिए
railway up

# Logs check करने के लिए
railway logs

# Service status check करने के लिए
railway status
```

## 🌐 Production URLs

After deployment, your app will be available at:

- **Frontend**: `https://your-username.github.io/digidad-messaging-app`
- **Backend**: `https://your-app-name.railway.app`
- **Supabase**: Already configured

## 🔒 Security Checklist

- [ ] Environment variables को GitHub secrets में add करें
- [ ] Supabase RLS policies को check करें
- [ ] CORS settings को verify करें
- [ ] JWT secrets को rotate करें
- [ ] Rate limiting को enable करें

## 🚨 Troubleshooting

### Common Issues:

1. **Frontend not loading**
   - GitHub Pages को 24 घंटे लग सकते हैं
   - Repository name और GitHub username check करें

2. **Backend connection failed**
   - Railway service को check करें (`railway status`)
   - Environment variables को verify करें
   - Supabase connection को test करें

3. **CORS errors**
   - CLIENT_URL को सही सेट करें
   - Railway domain को allow करें

### Logs Check करने के लिए:
```bash
# Railway logs
railway logs

# Local development logs
npm run dev-full
```

## 📞 Support

अगर कोई problem आए तो:
1. GitHub Issues में report करें
2. Railway dashboard में logs check करें
3. Supabase dashboard में errors देखें

## 🔄 Updates और Maintenance

### New Features Deploy करने के लिए:
1. Code को commit करें
2. GitHub पर push करें
3. GitHub Actions automatically deploy करेगा

### Database Changes:
1. Supabase dashboard में migrations run करें
2. RLS policies को update करें
3. Environment variables को refresh करें

---

**Happy Deploying! 🎉**