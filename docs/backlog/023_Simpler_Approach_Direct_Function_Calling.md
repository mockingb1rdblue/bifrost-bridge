## Simpler Approach: Direct Function Calling

### Option 1: Use Gemini Function Calling API [ai.google](https://ai.google.dev/gemini-api/docs/function-calling)

```typescript
// src/perplexity-tools.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Define your Perplexity functions as Gemini tools
const tools = [
  {
    functionDeclarations: [
      {
        name: 'perplexity_research',
        description: 'Research a topic using Perplexity AI with web search and citations',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The research question or topic',
            },
            depth: {
              type: 'string',
              enum: ['quick', 'standard', 'deep'],
              description: 'Research depth',
            },
          },
          required: ['query'],
        },
      },
    ],
  },
];

const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
  tools: tools,
});

// When agent calls the function, execute it
async function handleFunctionCall(functionCall) {
  const { name, args } = functionCall;

  if (name === 'perplexity_research') {
    const result = await perplexityClient.research(args.query, {
      model: getModelForDepth(args.depth),
    });

    return {
      content: result.choices[0].message.content,
      citations: result.citations,
    };
  }
}

// Agent conversation loop
const chat = model.startChat();
const result = await chat.sendMessage('Research quantum computing');

if (result.response.functionCalls()) {
  const functionCall = result.response.functionCalls()[0];
  const functionResponse = await handleFunctionCall(functionCall);

  // Send function response back to agent
  const finalResult = await chat.sendMessage([
    {
      functionResponse: {
        name: functionCall.name,
        response: functionResponse,
      },
    },
  ]);

  console.log(finalResult.response.text());
}
```

### Option 2: Just Call Perplexity Directly in Your Code

Even simpler - just use Perplexity API directly when you need research:

```typescript
// Use in your existing projects
import { PerplexityClient } from './perplexity-client';

const pplx = new PerplexityClient(process.env.PERPLEXITY_API_KEY!);

// When you need research
const research = await pplx.research('topic here');
console.log(research.choices[0].message.content);
```

---
