# 🚀 Deployment Guide

## Quick Deploy to Vercel

### Option 1: Deploy from GitHub (Recommended)

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Ultrasound payment demo"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/ultrasound-payments.git
   git push -u origin main
   ```

2. **Deploy to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will auto-detect the Vite configuration
   - Click "Deploy"

### Option 2: Deploy with Vercel CLI

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel
   ```

3. **Follow the prompts**:
   - Link to existing project or create new
   - Confirm build settings
   - Deploy!

## 🔧 Build Configuration

The project is already configured for Vercel with:

- **`vercel.json`**: Routing and headers configuration
- **`package.json`**: Build scripts
- **Static files**: Quiet.js library files in `public/quiet-js/`

## 🌐 After Deployment

1. **Test the live URL** - Make sure HTTPS is working
2. **Test microphone access** - Allow permissions when prompted
3. **Test all three interfaces**:
   - Payment System
   - Audio Chat  
   - Text Transfer

## 📱 Testing Checklist

- [ ] HTTPS connection working
- [ ] Microphone permissions granted
- [ ] Payment system: Create request → Enter PIN → Confirm
- [ ] Chat: Send message → Receive response
- [ ] Text transfer: Send text → Receive text
- [ ] Audio visualization working
- [ ] Frequency detection working
- [ ] Mobile responsive design

## 🐛 Troubleshooting

### Microphone Access Issues
- Ensure HTTPS is enabled
- Check browser permissions
- Try different browsers (Chrome recommended)

### Audio Not Working
- Check browser compatibility
- Try different transmission profiles
- Ensure speakers/headphones are working

### Build Errors
- Run `npm install` to ensure dependencies
- Check Node.js version (16+ required)
- Clear node_modules and reinstall if needed

## 🔗 Share Your Demo

Once deployed, share your live demo URL with:
- Friends and colleagues
- Social media
- Developer communities
- GitHub README

The demo showcases cutting-edge ultrasound communication technology!
