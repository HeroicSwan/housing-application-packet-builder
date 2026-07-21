# AI vendor review

## Current enforcement decision (2026-07-16)

Applicant documents are classified as `CUSTOMER_SENSITIVE` at the storage-processing boundary. The application blocks every external AI processor for that class; only loopback Ollama is permitted in an explicitly approved local configuration, while production configuration requires `DOCUMENT_PROCESSOR=disabled` until the organization signs off. Cloud provider probes and adapters are unavailable.

The default local model is Ollama `qwen2.5vl:7b`, a 7B vision-language model suitable for text and image fixtures. The host must keep the Ollama service, model files, logs, and backups access-controlled.

The runtime catalog contains only self-hosted Ollama on a localhost endpoint. Every cloud provider and arbitrary gateway is retired from runtime selection. Existing cloud credentials and legacy environment variables should be removed from deployments.

Reviewed July 16, 2026. This is an engineering due-diligence record, not legal approval. The listed providers are synthetic-evaluation options only; production customer-data configuration rejects every external processor. An organization must document its own contract, DPA, region, subprocessors, incident terms, and lawful basis before using synthetic evaluation.

| Provider | Observed official position | Engineering disposition for applicant documents |
| --- | --- | --- |
| Ollama (self-hosted) | Processing occurs on operator-controlled infrastructure. | Allowed only on a loopback endpoint in an approved local configuration; production remains disabled until the organization approves host logs, backups, access controls, retention, and review procedures. |
| Google Gemini API | Unpaid services may use inputs/outputs for product improvement and human review. Paid API content is not used for product improvement, but prompts and responses are logged for abuse monitoring; Google states a 55-day period. | Block by default. Consider only paid service after DPA, transfer/region, 55-day retention, and sensitive-data review. Never use unpaid quota for applicant data. |
| GroqCloud | Inference content is not retained by default except temporary reliability/abuse logs for up to 30 days. Organization controls can enable zero data retention; usage metadata remains. | Conditional. Require organization-wide ZDR, persistence features disabled, DPA/security review, U.S. processing approval, and a dedicated key. |
| OpenRouter | OpenRouter prompt logging/training opt-ins are off by default and per-request ZDR routing is available, but requests are also governed by the selected downstream model provider. Metadata remains. | Conditional. The adapter sends `provider.zdr=true`; also require account guardrails, fixed provider/model allowlists, logging disabled, downstream-provider review, DPA, and a dedicated key. |
| SambaNova Cloud | Published terms permit processing customer content to provide the service or as required by law and place privacy notices/consent responsibility on the customer. Public support statements say prompts/outputs are not stored, but the reviewed binding material did not state a precise retention period. | Block pending a signed DPA/order form that specifies retention, deletion, training exclusion, regions, subprocessors, breach notice, and audit rights. |
| Cerebras Inference | Official support states prompt content, requests/responses, chat/transaction logs, and model inputs/outputs are not retained; organization/account data and usage metrics remain. Terms say service content is not used for model training. | Conditional. Require DPA/security and region/subprocessor validation, contractual confirmation of the support-page statement, incident terms, and a dedicated key. |
| Mistral API | Default API handling may retain input/output for 30 rolling days for abuse monitoring. Training and privacy controls exist; ZDR is available only on eligible Scale plans/stateless calls, and Labs models can be used for training regardless of opt-out. | Block by default. Consider only eligible paid stateless API with ZDR and training disabled, Labs disabled, DPA/region/subprocessor review, and a dedicated key. |

## Retired provider catalog

Gemini, Mistral, SambaNova, Groq, OpenRouter, xAI, DeepSeek, Together AI, Fireworks AI, Cohere, Perplexity, and arbitrary custom OpenAI-compatible endpoints are not selectable at runtime. They are retained only in this historical review for audit context. Legacy environment variables should be removed from deployments.

## Required approval record

For each synthetic-evaluation provider, record the legal entity, product/tier, model IDs, endpoint/region, DPA date, retention and deletion behavior, training setting, human-access conditions, subprocessors, transfer mechanism, breach-notification term, key owner, spend limit, approval owner, approval date, and next review date. Re-review on provider, model, endpoint, or terms changes and at least annually.

## Sources

- [Gemini API terms](https://ai.google.dev/gemini-api/terms) and [abuse monitoring](https://ai.google.dev/gemini-api/docs/usage-policies)
- [GroqCloud data controls](https://console.groq.com/docs/your-data)
- [OpenRouter data collection](https://openrouter.ai/docs/guides/privacy/data-collection) and [zero data retention](https://openrouter.ai/docs/guides/features/zdr)
- [SambaNova legal agreements](https://sambanova.ai/legal-agreements) and [Fast API Program terms](https://sambanova.ai/hubfs/23945802/PubSec/fast-api-program-tos.pdf)
- [Cerebras retention statement](https://support.cerebras.net/articles/1811589793-does-cerebras-retain-my-data) and [terms](https://cloud.cerebras.ai/terms)
- [Mistral privacy controls](https://docs.mistral.ai/admin/monitor-comply/privacy-data-controls), [privacy policy](https://legal.mistral.ai/terms/privacy-policy), and [ZDR eligibility](https://help.mistral.ai/en/articles/347612-can-i-activate-zero-data-retention-zdr)
