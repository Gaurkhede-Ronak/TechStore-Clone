
# 🛒 TechStore - E-Commerce Website

A modern, responsive, and feature-rich e-commerce web application built with React, Vite, Redux Toolkit, Bootstrap, and Appwrite.

TechStore provides a smooth online shopping experience with product browsing, user authentication, shopping cart, order management, checkout, and shipment tracking.

## 🚀 Features

- 🛍️ Product browsing and product details
- 🔐 User authentication and account management
- 🛒 Shopping cart and checkout
- 📦 Order management and order history
- 🚚 Shipment tracking
- 🎟️ Coupon management
- 💳 Payment integration
- 📱 Responsive design for mobile, tablet, and desktop
- 🔔 Toast notifications
- ⚡ Fast performance with Vite
- 🗄️ Appwrite backend integration

## 🛠️ Tech Stack

### Frontend
- React 19
- Vite
- Redux Toolkit
- React Router DOM
- Bootstrap 5
- React-Bootstrap
- Formik
- Yup
- React Hot Toast

### Backend
- Appwrite

## 📁 Project Structure

```text
TechStore/
├── public/
├── src/
│   ├── assets/
│   ├── components/
│   ├── pages/
│   ├── features/
│   ├── app/
│   ├── hooks/
│   ├── services/
│   ├── utils/
│   ├── App.jsx
│   └── main.jsx
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── package-lock.json
└── vite.config.js
```

*Note: The structure above is an example. Your actual project folders may differ.*

## ⚙️ Installation and Setup

### 1. Clone the repository

```bash
git clone YOUR_REPOSITORY_URL
```

### 2. Navigate to the project directory

```bash
cd TechStore
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create a `.env` file in the root directory and add your Appwrite configuration.

```env
VITE_APPWRITE_ENDPOINT=YOUR_APPWRITE_ENDPOINT
VITE_APPWRITE_PROJECT_ID=YOUR_APPWRITE_PROJECT_ID
VITE_APPWRITE_DATABASE_ID=YOUR_APPWRITE_DATABASE_ID
```

Replace the placeholders with your actual configuration and make sure the variable names match your source code.

**Never upload your `.env` file or private credentials to GitHub.**

### 5. Start the development server

```bash
npm run dev
```

Open the local URL shown in your terminal to view the application.

## 🏗️ Build for Production

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

## 🔐 Backend Configuration

TechStore uses Appwrite for backend services such as:

- Authentication
- Database operations
- Product and order data
- User management
- Storage

Configure the required Appwrite collections, permissions, and platform settings before running the application.

## 🌐 Deployment

The frontend can be deployed using platforms such as:

- Vercel
- Netlify

Configure the required environment variables on your hosting platform and add your deployed domain to the Appwrite Web platform settings.

## 🔒 Security

- Environment files are excluded from Git.
- Do not expose private API keys or payment secrets in frontend code.
- Configure Appwrite permissions carefully.
- Validate sensitive operations on a trusted backend.

## 👨‍💻 Author

**Ronak Gaurkhede**

## 📄 License

This project is currently available for personal and educational use. Add a formal license if you intend to distribute or reuse it under specific terms.
