# Environment Configuration

This project uses environment variables to configure the backend API URL and socket connection.

## Environment Files

### `.env` (Local Development)
```
VITE_API_BASE_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
VITE_NODE_ENV=development
```

### `.env.production` (Production)
```
VITE_API_BASE_URL=https://uno-backend-ycha.onrender.com
VITE_SOCKET_URL=https://uno-backend-ycha.onrender.com
VITE_NODE_ENV=production
```

## Setup Instructions

1. **For Local Development:**
   - Copy `.env.example` to `.env` (if provided)
   - Or create `.env` file with local development URLs
   - Make sure your backend is running on `http://localhost:3001`

2. **For Production:**
   - The `.env.production` file is used automatically during build
   - Update the URLs if you deploy to a different backend URL

## Usage

The environment variables are automatically used by:
- Socket connections in `useSocket.js` and `useSocket.jsx`
- API calls in components using the `apiFetch` utility from `utils/api.js`

## Switching Environments

- **Development:** Use `npm run dev` (uses `.env`)
- **Production Build:** Use `npm run build` (uses `.env.production`)
- **Preview Production:** Use `npm run preview` after building

## Environment Variables

- `VITE_API_BASE_URL`: Base URL for REST API calls
- `VITE_SOCKET_URL`: URL for Socket.IO connections  
- `VITE_NODE_ENV`: Environment mode (development/production)

Note: All environment variables must be prefixed with `VITE_` to be accessible in the frontend code.