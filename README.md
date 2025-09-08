# Pdf QuizMuse

A modern AI-powered PDF chatbot application that allows users to upload PDF documents, ask questions about their content, and generate interactive quizzes. Built with Next.js, LangGraph, and a beautiful minimalistic UI inspired by ChatGPT and Grok.

🌐 **Live Demo**: [https://quizmuse.rushikesh.space/](https://quizmuse.rushikesh.space/)

![Pdf QuizMuse Screenshot](Screenshot%202025-09-08%20at%2012.20.45.png)

## ✨ Features

- **📄 PDF Document Upload**: Drag and drop or click to upload multiple PDF files
- **💬 Intelligent Chat**: Ask questions about your uploaded documents with AI-powered responses
- **🧠 Quiz Generation**: Create interactive quizzes from your document content
- **🌙 Dark/Light Theme**: Toggle between beautiful light and dark modes
- **📱 Responsive Design**: Works perfectly on desktop and mobile devices
- **🎨 Modern UI**: Clean, minimalistic design inspired by ChatGPT and Grok

## 🚀 Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives
- **Lucide React** - Beautiful icons
- **Jest** - Testing framework

### Backend
- **LangGraph** - AI workflow orchestration
- **LangChain** - LLM application framework
- **OpenAI** - Large language model integration
- **Supabase** - Vector database for embeddings
- **TypeScript** - Type-safe backend development

## 🛠️ Installation

> **🚀 Try it now**: [https://quizmuse.rushikesh.space/](https://quizmuse.rushikesh.space/) - No installation required!

### Prerequisites
- Node.js 18+ 
- npm or yarn
- OpenAI API key

### 1. Clone the Repository
```bash
git clone <repository-url>
cd pdf-chatbot
```

### 2. Install Dependencies

#### Backend
```bash
cd backend
npm install
```

#### Frontend
```bash
cd frontend
npm install
```

### 3. Environment Setup

#### Backend Environment
Create `backend/.env` file:
```bash
cp backend/.env.example backend/.env
```

#### Frontend Environment
Create `frontend/.env.local` file:
```bash
cp frontend/.env.example frontend/.env.local
```

### 4. Configure Environment Variables

Edit the environment files with your actual values:

**Backend (.env):**
- `OPENAI_API_KEY` - Your OpenAI API key
- `LANGGRAPH_API_KEY` - LangGraph API key (if using cloud)
- `CHROMA_PERSIST_DIRECTORY` - Directory for ChromaDB persistence
- `PORT` - Backend server port (default: 2024)

**Frontend (.env.local):**
- `NEXT_PUBLIC_LANGGRAPH_URL` - Backend API URL
- `NEXT_PUBLIC_APP_NAME` - Application name

## 🚀 Running the Application

### Development Mode

1. **Start the Backend:**
```bash
cd backend
npm run langgraph:dev
```

2. **Start the Frontend:**
```bash
cd frontend
npm run dev
```

3. **Access the Application:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:2024

### Production Mode

1. **Build the Frontend:**
```bash
cd frontend
npm run build
npm start
```

2. **Start the Backend:**
```bash
cd backend
npm run start
```

## 📖 Usage

### Uploading Documents
1. Click the upload area or drag and drop PDF files
2. Wait for the documents to be processed and indexed
3. View uploaded files in the sidebar

### Chatting with Documents
1. Navigate to the Chat section
2. Ask questions about your uploaded documents
3. Get AI-powered responses with source references

### Generating Quizzes
1. Go to the Quiz section
2. Select specific document sections (optional)
3. Click "Generate Quiz" to create interactive questions
4. Answer questions and track your progress

### Navigation
- Use the sidebar to switch between Chat and Quiz modes
- Browse the Table of Contents to jump to specific sections
- Toggle between light and dark themes using the theme button

## 🧪 Testing

### Frontend Tests
```bash
cd frontend
npm test
```

### Backend Tests
```bash
cd backend
npm test
```

### Integration Tests
```bash
cd backend
npm run test:int
```

## 🎨 Customization

### Color Theme
The application uses a custom color palette inspired by ChatGPT and Grok:
- **Rich Black**: `#0d1b2a`
- **Oxford Blue**: `#1b263b`
- **Yinmn Blue**: `#415a77`
- **Silver Lake Blue**: `#778da9`
- **Platinum**: `#f9f9f8`

Colors can be customized in `frontend/app/globals.css`.

### Styling
The application uses Tailwind CSS with custom CSS variables. All styling is done through Tailwind utility classes for consistency and maintainability.

## 📁 Project Structure

```
pdf-chatbot/
├── frontend/                 # Next.js frontend application
│   ├── app/                 # App Router pages and layouts
│   ├── components/          # Reusable React components
│   ├── lib/                 # Utility functions and configurations
│   ├── types/               # TypeScript type definitions
│   └── styles/              # Global styles and Tailwind config
├── backend/                 # LangGraph backend application
│   ├── src/                 # Source code
│   │   ├── ingestion_graph/ # Document processing workflow
│   │   ├── retrieval_graph/ # Document retrieval workflow
│   │   ├── quiz_graph/      # Quiz generation workflow
│   │   ├── toc_graph/       # Table of contents generation
│   │   └── shared/          # Shared utilities and services
│   └── test_docs/           # Sample PDF documents for testing
└── scripts/                 # Build and deployment scripts
```

## 🔧 API Endpoints

### Frontend API Routes
- `POST /api/chat` - Send chat messages
- `POST /api/ingest` - Upload and process documents
- `POST /api/quiz` - Generate quizzes
- `GET /api/toc` - Get table of contents
- `POST /api/cleanup` - Clean up resources

### Backend LangGraph Endpoints
- `POST /threads` - Create new conversation threads
- `POST /threads/{thread_id}/runs` - Execute workflows
- `GET /threads/{thread_id}/runs/{run_id}/stream` - Stream responses

## 🚀 Deployment

### Using Render (Recommended)
1. Connect your GitHub repository to Render
2. Set up environment variables in Render dashboard
3. Deploy both frontend and backend services

### Using Docker
```bash
# Build and run with Docker Compose
docker-compose up --build
```

### Manual Deployment
1. Build the frontend: `npm run build`
2. Start the backend: `npm run start`
3. Configure reverse proxy (nginx/Apache)
4. Set up SSL certificates

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Rushikesh Badgujar**
- GitHub: [@rushikesh-badgujar](https://github.com/rushikesh-badgujar)
- Email: [your-email@example.com]

## 🙏 Acknowledgments

- OpenAI for providing the language models
- LangChain team for the excellent AI framework
- Next.js team for the amazing React framework
- Radix UI for accessible component primitives
- Tailwind CSS for the utility-first CSS framework

## 📞 Support

If you encounter any issues or have questions:
1. Check the [Issues](https://github.com/your-repo/issues) page
2. Create a new issue with detailed information
3. Contact the maintainer

---

**Happy Document Chatting! 📚✨**
