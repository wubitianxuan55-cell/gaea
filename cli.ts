/**
 * Gaea CLI — lightweight chat-only terminal interface
 * Usage: npm run cli
 * Connects to the Gaea Express server (default http://localhost:3000).
 */

import * as readline from 'readline';

const BASE_URL = process.env.GAEA_API_URL || 'http://localhost:3000';
const MODEL = process.env.GAEA_MODEL || 'deepseek-chat';

const SYSTEM_PROMPT = '你是 Gaea，一个本地 AI 助手。回复简洁、专业、有帮助。';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const history: Message[] = [{ role: 'system', content: SYSTEM_PROMPT }];

function printHelp() {
  console.log(`
  Gaea CLI — Commands:
    /help          Show this help
    /clear         Clear conversation history
    /exit, /quit   Exit the CLI
    Anything else  Send a message to Gaea
  `);
}

async function chat(userInput: string): Promise<void> {
  history.push({ role: 'user', content: userInput });

  try {
    const resp = await fetch(`${BASE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'deepseek',
        model: MODEL,
        messages: history.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error(`\n  ❌ Server error (${resp.status}): ${err.slice(0, 200)}`);
      history.pop(); // remove the failed user message
      return;
    }

    const data = await resp.json();
    const reply = data.text || data.response || '(no response)';
    history.push({ role: 'assistant', content: reply });
    console.log(`\n  ${reply.split('\n').join('\n  ')}`);
  } catch (err: any) {
    if (err.cause?.code === 'ECONNREFUSED') {
      console.error('\n  ❌ Cannot connect to Gaea server. Is it running? (npm run dev)');
    } else {
      console.error(`\n  ❌ Error: ${err.message}`);
    }
    history.pop();
  }
}

function printWelcome() {
  console.log(`
  ╔══════════════════════════════════════╗
  ║         Gaea CLI — Chat             ║
  ║   DeepSeek-powered AI assistant     ║
  ║   Type /help for commands           ║
  ╚══════════════════════════════════════╝
  `);
}

async function main() {
  printWelcome();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '\n🧠 > ',
  });

  rl.prompt();

  for await (const line of rl) {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      continue;
    }

    switch (input.toLowerCase()) {
      case '/exit':
      case '/quit':
        console.log('\n  Goodbye!');
        rl.close();
        process.exit(0);
      case '/help':
        printHelp();
        break;
      case '/clear':
        history.length = 0;
        history.push({ role: 'system', content: SYSTEM_PROMPT });
        console.log('\n  🧹 Conversation cleared.');
        break;
      default:
        await chat(input);
        break;
    }

    rl.prompt();
  }
}

main().catch(console.error);
