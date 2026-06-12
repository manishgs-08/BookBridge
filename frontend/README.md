# BookBridge - Frontend

BookBridge is a modern, responsive web application designed for a book exchange marketplace. It enables users to trade, request, and manage books seamlessly while providing features like real-time messaging, wishlists, and dispute resolution.

## Features

- **Authentication:** Secure user login and signup flows, including OAuth callbacks.
- **Marketplace & Home:** Browse available books and recent additions.
- **Book Details:** View comprehensive information about specific books.
- **Inventory Management:** Users can manage the books they are offering.
- **Wishlist:** Keep track of books you want to read or acquire.
- **Requests System:** Send, receive, and manage book exchange requests.
- **Messaging:** Communicate with other users regarding trades.
- **User Profiles:** Manage personal information and settings.
- **Dispute Resolution:** Built-in system for handling and resolving exchange disputes.
- **Admin Dashboard:** Administrative controls for platform management.

## Tech Stack

- **Framework:** [React 19](https://react.dev/)
- **Build Tool:** [Vite](https://vitejs.dev/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Routing:** [React Router v7](https://reactrouter.com/)
- **State & Data Fetching:** [TanStack React Query](https://tanstack.com/query/latest)
- **HTTP Client:** [Axios](https://axios-http.com/)
- **Icons:** [Lucide React](https://lucide.dev/)

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v18 or higher recommended)
- npm or yarn

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   Create a `.env` file in the root of the `frontend` directory and configure the necessary environment variables. (e.g., API base URL). *Note: Ensure you do not commit any secret keys or sensitive information.*

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   The application will typically be available at `http://localhost:5173`.

## Scripts

- `npm run dev`: Starts the local development server with Hot Module Replacement (HMR).
- `npm run build`: Compiles TypeScript and builds the app for production.
- `npm run lint`: Runs ESLint to catch code issues.
- `npm run preview`: Bootstraps a local web server to preview the production build.

## Project Structure

```
frontend/
├── public/           # Static assets
├── src/
│   ├── api/          # API integration and Axios setup
│   ├── assets/       # Images, icons, and fonts
│   ├── components/   # Reusable UI components and layouts
│   ├── context/      # React Contexts (e.g., AuthContext)
│   ├── pages/        # Application routes/pages
│   ├── App.tsx       # Main application component and routing setup
│   ├── main.tsx      # Application entry point
│   └── index.css     # Global styles and Tailwind directives
├── .env              # Environment variables (git-ignored)
├── package.json      # Project dependencies and scripts
├── tailwind.config.js# Tailwind CSS configuration
├── tsconfig.json     # TypeScript configuration
└── vite.config.ts    # Vite configuration
```
