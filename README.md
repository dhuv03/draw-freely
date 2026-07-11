# 🎨 DrawFreely

DrawFreely is a lightweight, high-performance, sketch-style collaborative-feeling whiteboard application. Built with React 19, TypeScript, Vite, and TailwindCSS, it leverages **Rough.js** for a beautiful hand-drawn aesthetic and **IndexedDB** for local auto-save persistence.

---

## ✨ Features

*   **Hand-Drawn Sketch Aesthetic:** Powered by [Rough.js](https://roughjs.com/), giving shapes a natural, hand-drawn feel.
*   **Comprehensive Shape Toolbar:**
    *   `Rectangle` ⏹️
    *   `Ellipse` ⭕
    *   `Diamond` 🔶
    *   `Line` ➖
    *   `Arrow` ➡️
    *   `Free Draw` ✏️ (using `perfect-freehand` for smooth, pressure-sensitive pressure stroke simulation)
    *   `Text` 🔤 (fully editable text fields with font size and family settings)
*   **Deep Customization (Properties Panel):**
    *   Stroke color and fill color selection.
    *   Stroke style (Solid, Dashed, Dotted).
    *   Fill style (Solid, Hachure, Cross-hatch).
    *   Adjustable stroke width, roughness, and opacity.
*   **Canvas Navigation:** Panning (using Spacebar/Hand tool) and zoom-in/out to work on large canvases.
*   **Persistent Storage:** Auto-saves your canvas to **IndexedDB** so you never lose your drawings on page refreshes.
*   **State History:** Complete **Undo** (`Ctrl + Z`) and **Redo** (`Ctrl + Y`) capabilities.
*   **Theme Toggle:** Beautiful **Light Mode** and **Dark Mode** layouts.

---

## 🛠️ Tech Stack

*   **Framework:** [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
*   **Bundler:** [Vite](https://vite.dev/)
*   **Styling:** [TailwindCSS 4](https://tailwindcss.com/)
*   **Rendering:** [Rough.js](https://roughjs.com/)
*   **Freehand Drawing:** [perfect-freehand](https://github.com/steveruizok/perfect-freehand)
*   **Storage:** [idb](https://github.com/jakearchibald/idb) (IndexedDB wrapper)
*   **Icons:** Lucide Icons (integrated custom styling)

---

## 🚀 Getting Started

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

### Installation

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/YOUR_USERNAME/excali-draw.git
    cd excali-draw
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Start the Development Server:**
    ```bash
    npm run dev
    ```
    Open your browser and navigate to `http://localhost:5173` to see it in action!

4.  **Build for Production:**
    ```bash
    npm run build
    ```

---

## 🌐 Deployment

This application is **100% client-side** (frontend-only). It does **not** require any backend or server hosting (like Render). You can deploy it completely for free on **Vercel** or **Netlify**.

### Deploying to Vercel

1.  Push your code to **GitHub**.
2.  Log in to [Vercel](https://vercel.com) using your GitHub account.
3.  Click **Add New...** -> **Project**.
4.  Import your GitHub repository.
5.  Click **Deploy**. Vercel will automatically detect Vite and host it.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to open issues or submit pull requests to help improve the project.

## 📄 License

This project is licensed under the MIT License.
