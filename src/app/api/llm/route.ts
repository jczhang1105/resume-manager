import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, prompt, systemPrompt } = body;

    if (!apiKey) {
      return NextResponse.json({ error: 'API Key is required' }, { status: 400 });
    }

    console.log('调用阿里云API - OpenAI兼容模式');

    // 使用兼容OpenAI的端点
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
      return NextResponse.json({
        error: data.error?.message || data.message || JSON.stringify(data)
      }, { status: response.status });
    }

    return NextResponse.json({ content: data.choices?.[0]?.message?.content || '' });
  } catch (error: any) {
    console.error('API错误:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}