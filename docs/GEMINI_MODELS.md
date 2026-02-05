# Gemini Model Endpoints

Based on the `google-genai` Python SDK (latest version as of 2026-02-05):

## Recommended Endpoints

For integration with the Bifrost Bridge project, use these model identifiers:

- **Fast Model**: `gemini-2.0-flash-exp` or `gemini-flash-latest`
- **Pro Model**: `gemini-2.0-pro-exp` or `gemini-pro-latest`

## Notes

- The `google-generativeai` package is **deprecated** as of 2026
- Use `google-genai` package instead for new implementations
- Model listing requires API key configuration
- Gemini models are available through Google AI API or Vertex AI

## Future Integration

To add Gemini support to Bifrost Bridge:

1. Create `src/gemini-client.ts` similar to `perplexity-client.ts`
2. Add `GEMINI_API_KEY` to `.env`
3. Implement retry/timeout logic using existing `utils/retry.ts`
4. Add CLI commands: `bifrost.py gemini-ask` and `bifrost.py gemini-research`

## Reference

- SDK: `google-genai` (Python)
- Docs: https://ai.google.dev/gemini-api/docs
