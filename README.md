# 🎓 Academiq — Student Productivity Platform

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)

**Academiq** is a premium, full-stack productivity ecosystem designed specifically for students. It combines scientifically-backed focus techniques, AI-driven task management, and visual gamification into a stunning glassmorphism interface.

---

## ✨ Key Features

### 🪴 The Knowledge Tree (Gamification)
Watch your learning literally grow! The **Growth Garden** features a dynamic SVG tree that evolves from a seedling to an ancient oak as you accumulate focus hours.

### 🍅 Smart Focus Engine
Master your time with multiple integrated techniques:
- **Pomodoro (25/5):** For high-intensity bursts.
- **52/17 Rule:** Optimized for cognitive retention.
- **90-min Deep Work:** For complex problem-solving.
- **Custom Mode:** Tailor your focus intervals.

### 📋 AI-Enhanced Task Management
- **Kanban Board:** Organize tasks with drag-and-drop ease.
- **AI Sub-tasks:** Automatically break down large projects into actionable steps.
- **Priority Matrix:** Smart calculation of task urgency and importance.
- **Celebrations:** Instant confetti explosions when you reach the finish line! 🎉

### 📅 Smart Planner
- **Weekly Layout:** A beautiful glassmorphism calendar for your study blocks.
- **AI Auto-Schedule:** Suggests optimal study times based on your deadlines.

### 📊 Performance Analytics
- **Activity Heatmaps:** Track your consistency over the months.
- **Focus Trends:** Detailed bar charts showing your study distribution.
- **Task Ring:** Real-time visualization of your completion progress.

---

## 🎨 Design Philosophy
Academiq uses a **Premium Glassmorphism** design system with:
- **Dynamic Theming:** Light, Dark, Sunset, and Forest modes.
- **Interactive Cursor Glow:** A subtle spotlight effect that follow your movement.
- **Micro-Animations:** Fluid transitions and celebratory effects for a delightful UX.

---

## 🛠️ Tech Stack

**Frontend:**
- HTML5 & CSS3 (Vanilla with Custom Properties)
- JavaScript (ES6+)
- [Canvas-Confetti](https://github.com/catdad/canvas-confetti) for celebrations
- Font Awesome & Google Fonts (Outfit, Inter)

**Backend:**
- Node.js & Express.js
- MySQL (Relational Database)
- JWT (JSON Web Tokens) for secure authentication
- Bcrypt for password hashing

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v14+)
- MySQL Server

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/academiq.git
   cd academiq
   ```

2. **Setup the Database**
   - Create a database named `student_productivity_db`.
   - Run the schema provided in `backend/database.sql`.

3. **Backend Configuration**
   - Navigate to the `backend` folder.
   - Create a `.env` file based on the provided sample:
     ```env
     PORT=5000
     DB_HOST=localhost
     DB_USER=root
     DB_PASS=yourpassword
     DB_NAME=student_productivity_db
     JWT_SECRET=your_secret_key
     ```
   - Install dependencies and start:
     ```bash
     npm install
     npm run dev
     ```

4. **Frontend Setup**
   - Simply open `frontend/login.html` in your browser or serve it using a local server (like Live Server).

---

## 📂 Project Structure

```text
├── backend/
│   ├── routes/          # API Endpoints
│   ├── middleware/      # Auth & Error handling
│   ├── server.js        # Entry point
│   └── database.sql     # MySQL Schema
├── frontend/
│   ├── css/             # Glassmorphism Styles
│   ├── js/              # Core Logic
│   ├── index.html       # Main Dashboard
│   └── login.html       # Auth Page
└── README.md
```

---

## 🗺️ Roadmap
- [ ] **Calendar Sync:** Integration with Google/Outlook.
- [ ] **Study Groups:** Collaborative focus sessions with friends.
- [ ] **Ambient Sounds:** Integrated Lo-Fi and Nature soundscape player.
- [ ] **Mobile App:** PWA support for mobile installation.

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.

---

**Built with ❤️ for students, by student.**
