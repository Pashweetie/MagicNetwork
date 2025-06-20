import { Card } from "../schema";

// Shared AI utility functions and providers
export class AIUtils {
  static async initializeAIProvider(): Promise<{ generator: any; isReady: boolean; provider: string }> {
    try {
      // Try Google Gemini first (free tier available)
      if (process.env.GOOGLE_API_KEY) {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const generator = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        console.log('Google Gemini AI ready for generation');
        return { generator, isReady: true, provider: 'gemini' };
      }

      // Try DeepSeek (free alternative)
      if (process.env.DEEPSEEK_API_KEY) {
        const { default: OpenAI } = await import('openai');
        const generator = new OpenAI({
          apiKey: process.env.DEEPSEEK_API_KEY,
          baseURL: 'https://api.deepseek.com'
        });
        console.log('DeepSeek AI ready for generation');
        return { generator, isReady: true, provider: 'deepseek' };
      }

      // Fallback to OpenAI if available
      if (process.env.OPENAI_API_KEY) {
        const { default: OpenAI } = await import('openai');
        const generator = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
        console.log('OpenAI GPT ready for generation');
        return { generator, isReady: true, provider: 'openai' };
      }

      console.log('No AI API keys available');
      return { generator: null, isReady: false, provider: 'none' };
    } catch (error) {
      console.error('Failed to initialize AI:', error);
      return { generator: null, isReady: false, provider: 'none' };
    }
  }

  static async generateWithAI(
    generator: any, 
    provider: string, 
    prompt: string
  ): Promise<string | null> {
    try {
      if (provider === 'gemini' && generator?.getGenerativeModel) {
        const model = generator.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        return result.response.text() || '';
      }
      
      if ((provider === 'openai' || provider === 'deepseek') && generator?.chat?.completions?.create) {
        const completion = await generator.chat.completions.create({
          model: provider === 'deepseek' ? 'deepseek-chat' : 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 500,
          temperature: 0.7
        });
        return completion.choices[0]?.message?.content || '';
      }
    } catch (error) {
      console.error(`AI generation failed with ${provider}:`, error);
    }
    
    return null;
  }

  static parseDelimitedResponse(response: string, delimiter: string = ','): string[] {
    const items = response
      .split('\n')
      .find(line => 
        line.toLowerCase().includes(':') || 
        line.includes(delimiter) ||
        !line.includes(':')
      ) || response;
    
    return items
      .replace(/.*:/i, '')
      .split(delimiter)
      .map(item => item.trim().toLowerCase())
      .filter(item => item.length > 0 && item.length < 30);
  }
}