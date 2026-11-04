# CodeSquad Workshop: AI Integration with Replit

Welcome to the hands-on workshop on **AI Integration**, hosted by **CodeSquad**! 

This repository serves as the central hub for our live coding session. In this workshop, you will learn how to connect modern Large Language Model (LLM) APIs, manage environment secrets securely, and deploy interactive AI-powered web applications entirely in the cloud using **Replit**.

---

## 🎯 Workshop Objectives

By the end of this workshop, you will be able to:
- Connect frontend/backend applications to AI model providers (e.g., OpenAI, Anthropic, or open-source alternatives).
- Manage API keys securely using Replit Secrets (`.env`).
- Implement core LLM patterns: prompt formatting, structured responses, and streaming outputs.
- Build and run an interactive AI application directly in your browser without local setup friction.

---

## 🛠️ Tech Stack & Prerequisites

- **Environment:** [Replit](https://replit.com/) (Free account required)
- **Language / Runtime:** Node.js / Python *(adjust depending on your workshop stack)*
- **AI Providers:** OpenAI API / Anthropic API / Groq
- **Prerequisites:** 
  - Basic programming fundamentals.
  - An active Replit account.
  - An API key from the designated AI provider (instructions provided during the session).

---

## 🚀 Quick Start (Replit)

You do **not** need to install anything locally on your machine. Follow these steps:

1. **Fork the Repl:**
   - Click the **"Run on Replit"** badge below (or import this repository URL directly into Replit):
   
   [![Run on Replit](https://replit.com/badge/github/<YOUR_GITHUB_USERNAME>/<YOUR_REPO_NAME>)](https://replit.com/github/<YOUR_GITHUB_USERNAME>/<YOUR_REPO_NAME>)

2. **Configure API Secrets:**
   - In your Repl, open the **Tools** pane on the left and select **Secrets** (🔒).
   - Add your API key:
     - **Key:** `OPENAI_API_KEY` (or provider equivalent)
     - **Value:** `your-secret-api-key-here`

3. **Install & Run:**
   - Replit automatically installs dependencies.
   - Click the green **"Run"** button at the top to start the development server.

---

## 📂 Repository Structure

```text
├── exercises/          # Step-by-step challenges for attendees
│   ├── 01-first-prompt/
│   ├── 02-streaming-responses/
│   └── 03-chat-assistant/
├── solutions/          # Reference solutions for each exercise
├── src/                # Core application source code
├── .replit             # Replit environment configuration
└── README.md           # Workshop guide and overview
