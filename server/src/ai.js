const { z } = require('zod');
const { PromptTemplate } = require('@langchain/core/prompts');
const config = require('./config');

const investigationInput = z.object({ reportId: z.string().min(1), question: z.string().max(500).optional() });

async function ollamaGenerate(prompt) {
  const response = await fetch(`${config.ollamaBaseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: config.ollamaChatModel, prompt, stream: false }),
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
  const body = await response.json();
  if (typeof body.response !== 'string' || !body.response.trim()) throw new Error('Ollama returned an empty response.');
  return body.response.trim();
}

async function investigate(input, report, similarReports, sessionCount) {
  const parsed = investigationInput.parse(input);
  const evidence = {
    report: report.reportId,
    similarReports: similarReports.map((item) => ({
      reportId: item.reportId,
      buildId: item.buildId || null,
      sessionId: item.sessionId || null
    })),
    distinctSessions: sessionCount
  };
  const template = PromptTemplate.fromTemplate('You are Playtest Detective. Use only this JSON evidence and never invent facts: {evidence}. Report: {description}. Answer concisely with confirmed facts, possible explanations, missing information, and one next test. {question}');
  const prompt = await template.format({ evidence: JSON.stringify(evidence), description: report.description, question: parsed.question || '' });
  try {
    const summary = await ollamaGenerate(prompt);
    return { mode: 'ollama', evidence, summary };
  } catch (error) {
    const reason = error.name === 'TimeoutError'
      ? 'Ollama took too long to respond.'
      : error.message.includes('fetch failed')
        ? `Ollama is not reachable at ${config.ollamaBaseUrl}.`
        : error.message;
    return {
      mode: 'unavailable',
      evidence,
      summary: `Ollama could not generate this investigation: ${reason}`,
      confirmed: ['The selected report exists in the authorized workspace.'],
      possible: [],
      missing: [`Start Ollama and make sure the ${config.ollamaChatModel} model is installed.`],
      nextTest: 'Reproduce the report on the listed build while recording whether the checkpoint is activated.'
    };
  }
}
module.exports = { investigate };
