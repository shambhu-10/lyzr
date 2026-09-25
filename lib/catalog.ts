export const FRAMEWORKS = [
  { id: "lyzr", label: "Lyzr", lang: "Python" },
  { id: "langgraph", label: "LangGraph", lang: "Python" },
  { id: "crewai", label: "CrewAI", lang: "Python" },
  { id: "openai-agents", label: "OpenAI Agents SDK", lang: "Python" },
  { id: "adk", label: "Google ADK", lang: "Python" },
  { id: "mastra", label: "Mastra", lang: "TypeScript" },
] as const;

export const MODELS = ["GPT-OSS 120B · Groq", "Llama 3.3 70B · Groq", "GPT-OSS 20B · Groq"] as const;

export const frameworkLabel = (id?: string) => FRAMEWORKS.find((f) => f.id === id)?.label ?? "Lyzr";
