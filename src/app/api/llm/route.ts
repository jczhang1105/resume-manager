import { NextRequest, NextResponse } from 'next/server';

// 调用阿里云 DashScope API
async function callDashScope(apiKey: string, prompt: string, systemPrompt: string) {
  console.log('调用阿里云API - OpenAI兼容模式');

  const response = await fetch('https://coding.dashscope.aliyuncs.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'kimi-k2.5',
      messages: [
        { role: 'system', content: systemPrompt || '你是一个专业的简历优化助手' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    })
  });

  const data = await response.json();
  console.log('阿里云响应状态:', response.status);
  console.log('阿里云响应:', JSON.stringify(data).substring(0, 500));

  if (!response.ok) {
    throw new Error(data.error?.message || data.message || JSON.stringify(data));
  }

  return data.choices?.[0]?.message?.content || '';
}

// 调用 Google AI Studio (Gemini) API
async function callGemini(apiKey: string, prompt: string, systemPrompt: string) {
  console.log('调用 Google AI Studio API (Gemini)');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt || '你是一个专业的简历优化助手' }]
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192
        }
      })
    }
  );

  const data = await response.json();
  console.log('Gemini响应状态:', response.status);
  console.log('Gemini响应:', JSON.stringify(data).substring(0, 500));

  if (!response.ok) {
    throw new Error(data.error?.message || JSON.stringify(data));
  }

  // Gemini 返回格式不同，需要提取文本
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return content;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, apiKey, prompt, systemPrompt } = body;

    if (!apiKey) {
      return NextResponse.json({ error: 'API Key is required' }, { status: 400 });
    }

    let content: string;

    // 根据提供商调用不同的 API
    if (provider === 'gemini') {
      content = await callGemini(apiKey, prompt, systemPrompt);
    } else {
      // 默认使用阿里云
      content = await callDashScope(apiKey, prompt, systemPrompt);
    }

    return NextResponse.json({ content });
  } catch (error: any) {
    console.error('API错误:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}