import { AIDisabledError, AIUnavailableError } from '../ai/errors.js';
import { getLLMProvider } from '../ai/llm/adapter.js';
import { User } from '../models/User.js';

// What the client needs to decide whether to show AI buttons.
export async function aiStatus(userId) {
  const user = await User.findById(userId).select('settings.aiEnabled').lean();
  const provider = getLLMProvider();
  return {
    enabled: user?.settings?.aiEnabled !== false,
    configured: Boolean(provider),
    provider: provider?.name ?? null,
  };
}

// Throws unless this user may use AI right now: their switch is on and a provider is set up.
export async function assertAIAllowed(userId) {
  const { enabled, configured } = await aiStatus(userId);
  if (!enabled) throw new AIDisabledError();
  if (!configured) throw new AIUnavailableError('AI is not set up on this server.');
}
