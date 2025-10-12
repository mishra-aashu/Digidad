# Digidad Messaging App

A modern, real-time messaging application built with Node.js, React, and Supabase.

## 🚀 Features

- **Real-time messaging** with Socket.IO
- **User authentication** (registration/login)
- **Theme support** (Light, Dark, Patriotic themes)
- **User search** by phone number
- **Responsive design** for mobile and desktop
- **Modern UI** with smooth animations
- **Demo mode** for testing without backend setup

## 🛠️ Tech Stack

### Frontend
- **React 18** with hooks and context API
- **Vite** for fast development and building
- **React Router** for navigation
- **Socket.IO Client** for real-time communication
- **CSS3** with CSS custom properties for theming

### Backend
- **Node.js** with Express.js
- **Socket.IO** for real-time messaging
- **Supabase** for database and authentication (optional)
- **CORS** and security middleware

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Git

## 🔧 Installation & Setup

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd digidad-messaging-app
```

### 2. Install dependencies

#### Install server dependencies:
```bash
cd server
npm install
cd ..
```

#### Install client dependencies:
```bash
cd client
npm install
cd ..
```

#### Or install all at once:
```bash
npm run setup
```

### 3. Environment Configuration

#### Server Configuration (.env)
```bash
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
JWT_SECRET=your_jwt_secret_here
```

#### Client Configuration (client/.env)
```bash
VITE_API_URL=http://localhost:5000
VITE_SUPABASE_URL=demo
VITE_SUPABASE_ANON_KEY=demo
```

### 4. Database Setup (Optional)

If you want to use Supabase for persistent data:

1. Create a new project at [supabase.com](https://supabase.com)
2. Update your `.env` file with your Supabase credentials
3. Run the SQL schema (if provided) in your Supabase SQL editor

For demo mode, the app works with in-memory storage.

## 🚀 Running the Application

### Development Mode

#### Run both frontend and backend:
```bash
npm run dev-full
```

#### Or run them separately:

**Terminal 1 - Backend:**
```bash
npm run dev
# or
cd server && npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev-client
# or
cd client && npm run dev
```

### Production Mode

#### Build and start:

```bash
# Build the frontend
npm run build

# Start the server (serves both API and built frontend)
npm start
```

## 🌐 Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000
- **API Health Check:** http://localhost:5000/api/health

## 📱 Usage

### First Time Setup
1. Open http://localhost:3000 in your browser
2. Register a new account or login with existing credentials
3. Start searching for users by phone number
4. Begin messaging!

### Demo Mode
If no Supabase configuration is provided, the app runs in demo mode with:
- Mock user data
- In-memory message storage
- Simulated real-time features

## 🎨 Themes

The app supports three themes:
- **Light Theme** - Clean and modern
- **Dark Theme** - Easy on the eyes
- **Patriotic Theme** - Orange and red color scheme

Switch themes using the theme selector in the top-right corner.

## 🔧 API Endpoints

### Authentication
- `POST /api/auth` - User login/registration

### Chats
- `GET /api/chats/:userId` - Get user chats
- `GET /api/messages/:userId/:peerId` - Get chat messages

### Search
- `GET /api/search/:phone` - Search users by phone number

### Health Check
- `GET /api/health` - API status and active users count

## 🔌 Socket.IO Events

### Client to Server
- `authenticate` - Authenticate user
- `join_chat` - Join a chat room
- `send_message` - Send a message
- `typing_start` - Start typing indicator
- `typing_stop` - Stop typing indicator

### Server to Client
- `authenticated` - Authentication confirmation
- `receive_message` - New message received
- `user_typing` - Typing indicator updates

## 📁 Project Structure

```
digidad-messaging-app/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── contexts/       # React contexts
│   │   ├── hooks/          # Custom hooks
│   │   ├── services/       # API services
│   │   └── ...
│   ├── public/            # Static assets
│   └── package.json
├── server/                # Node.js backend
│   ├── index.js          # Main server file
│   └── package.json
├── package.json          # Root package.json
├── .env                  # Environment variables
└── README.md
```

## 🚨 Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Kill process using port 5000
   npx kill-port 5000
   
   # Or use different port in .env
   PORT=5001
   ```

2. **CORS errors**
   - Ensure CLIENT_URL in .env matches your frontend URL
   - Check that CORS is properly configured in server

3. **Socket.IO connection issues**
   - Verify both frontend and backend are running
   - Check console for connection errors
   - Ensure WebSocket connections are allowed

4. **Theme not applying**
   - Clear browser cache
   - Check if CSS custom properties are supported
   - Verify theme context is properly implemented

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with modern web technologies
- Inspired by popular messaging applications
- Thanks to the open-source community for amazing tools and libraries

---

**Happy messaging! 🚀**